// ==============================================================================
// SMARTGRADE - Offline Data Storage & Synchronization Engine
// Ensures teachers can scan & grade papers without internet, then auto-syncs
// to Supabase PostgreSQL when internet connectivity returns.
// ==============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ExamResult, ExamAnswer } from '@/types/database';

export interface PendingSyncRecord {
  id: string; // Unique deterministic client UUID
  type: 'exam_result';
  resultData: Omit<ExamResult, 'id'>;
  answersData: Omit<ExamAnswer, 'id' | 'result_id'>[];
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const PENDING_SYNC_KEY = 'smartgrade_pending_sync_queue';
type SyncListener = (isOnline: boolean, pendingCount: number) => void;

class OfflineSyncService {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyListeners();
        this.syncPendingRecords();
      });
      window.addEventListener('offline', () => {
        this.notifyListeners();
      });
    }
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public getPendingQueue(): PendingSyncRecord[] {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading pending sync queue:', e);
      return [];
    }
  }

  private setPendingQueue(queue: PendingSyncRecord[]): void {
    try {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
      this.notifyListeners();
    } catch (e) {
      console.error('Error writing pending sync queue:', e);
    }
  }

  public getPendingCount(): number {
    return this.getPendingQueue().length;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline(), this.getPendingCount());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const online = this.isOnline();
    const count = this.getPendingCount();
    this.listeners.forEach(fn => {
      try { fn(online, count); } catch {}
    });
  }

  /**
   * Enqueues an exam result scanned while offline or when Supabase is unreachable.
   * Generates a deterministic deduplication key.
   */
  public enqueueOfflineResult(
    resultData: Omit<ExamResult, 'id'>,
    answersData: Omit<ExamAnswer, 'id' | 'result_id'>[]
  ): PendingSyncRecord {
    const queue = this.getPendingQueue();

    // Deterministic deduplication ID based on quiz, student, and exact score
    const dedupKey = `sync_${resultData.quiz_id}_${resultData.student_id || resultData.raw_student_number || 'anon'}_${resultData.total_score}_${resultData.scanned_at || Date.now()}`;

    // Prevent duplicate entries in the offline queue
    const existingIndex = queue.findIndex(item => item.id === dedupKey);
    const newRecord: PendingSyncRecord = {
      id: dedupKey,
      type: 'exam_result',
      resultData,
      answersData,
      createdAt: new Date().toISOString(),
      attempts: 0
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = newRecord;
    } else {
      queue.push(newRecord);
    }

    this.setPendingQueue(queue);
    return newRecord;
  }

  /**
   * Synchronizes all queued offline records to Supabase.
   * Handles deduplication to avoid saving identical results twice.
   */
  public async syncPendingRecords(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0 };
    if (!this.isOnline() || !isSupabaseConfigured) {
      return { synced: 0, failed: 0 };
    }

    const queue = this.getPendingQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    const remainingQueue: PendingSyncRecord[] = [];

    for (const record of queue) {
      try {
        if (record.type === 'exam_result') {
          // Check for existing record to prevent duplicates
          let duplicateCheck = supabase
            .from('exam_results')
            .select('id')
            .eq('quiz_id', record.resultData.quiz_id)
            .eq('total_score', record.resultData.total_score);

          if (record.resultData.student_id) {
            duplicateCheck = duplicateCheck.eq('student_id', record.resultData.student_id);
          } else if (record.resultData.raw_student_number) {
            duplicateCheck = duplicateCheck.eq('raw_student_number', record.resultData.raw_student_number);
          }

          const { data: existingRecords } = await duplicateCheck.limit(1);

          if (existingRecords && existingRecords.length > 0) {
            // Already synced or exists in database - safely remove from queue
            synced++;
            continue;
          }

          // Prepare clean payload for Supabase (omit local temporary string ID)
          const rawId = (record.resultData as any).id;
          const isTempId = !rawId || String(rawId).startsWith('res_');
          const cleanStudentId = record.resultData.student_id && 
            String(record.resultData.student_id).trim() !== '' && 
            !String(record.resultData.student_id).startsWith('s_')
              ? record.resultData.student_id
              : null;

          const dataToInsert = {
            ...record.resultData,
            student_id: cleanStudentId,
          };
          if (isTempId) {
            delete (dataToInsert as any).id;
          }

          // Insert into Supabase
          const { data: insertedResult, error: resErr } = await supabase
            .from('exam_results')
            .insert([dataToInsert])
            .select()
            .single();

          if (resErr || !insertedResult) {
            throw new Error(resErr?.message || 'Failed to insert exam result');
          }

          if (record.answersData && record.answersData.length > 0) {
            const answersToInsert = record.answersData.map(a => {
              const { id, result_id, ...cleanAns } = a as any;
              return {
                ...cleanAns,
                result_id: insertedResult.id
              };
            });
            await supabase.from('exam_answers').insert(answersToInsert);
          }

          synced++;
        }
      } catch (err: any) {
        console.warn(`Sync failed for item ${record.id}:`, err);
        failed++;
        record.attempts += 1;
        record.lastError = err?.message || String(err);
        remainingQueue.push(record);
      }
    }

    this.setPendingQueue(remainingQueue);
    this.isSyncing = false;
    return { synced, failed };
  }
}

export const offlineSync = new OfflineSyncService();
