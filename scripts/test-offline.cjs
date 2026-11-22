// Test offline sync queue and deduplication logic
const PENDING_SYNC_KEY = 'smartgrade_pending_sync_queue';

// Mock localStorage in Node
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; }
};

console.log('=== TEST 1: Enqueue Offline Exam Result ===');
const mockResult = {
  quiz_id: 'q1',
  student_id: 's1',
  teacher_id: 'default-teacher',
  raw_student_number: '2025-001',
  scanned_image_url: null,
  total_score: 42,
  max_score: 50,
  percentage: 84,
  correct_count: 42,
  incorrect_count: 5,
  unanswered_count: 3,
  passed: true,
  scan_confidence: 96,
  needs_review: false,
  scanned_at: '2026-10-30T08:00:00Z'
};

const mockAnswers = [
  { question_number: 1, marked_options: ['A'], correct_options: ['A'], is_correct: true, points_awarded: 1, confidence: 98, is_blank: false, is_multiple: false },
  { question_number: 2, marked_options: ['B'], correct_options: ['C'], is_correct: false, points_awarded: 0, confidence: 95, is_blank: false, is_multiple: false }
];

// Offline sync enqueue logic
function enqueue(resultData, answersData) {
  const raw = localStorage.getItem(PENDING_SYNC_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  const dedupKey = `sync_${resultData.quiz_id}_${resultData.student_id || resultData.raw_student_number}_${resultData.total_score}_${resultData.scanned_at}`;
  
  const existingIndex = queue.findIndex(item => item.id === dedupKey);
  const newRecord = {
    id: dedupKey,
    type: 'exam_result',
    resultData,
    answersData,
    createdAt: new Date().toISOString(),
    attempts: 0
  };

  if (existingIndex >= 0) {
    queue[existingIndex] = newRecord; // update existing, prevent duplicate
  } else {
    queue.push(newRecord);
  }

  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  return queue.length;
}

const count1 = enqueue(mockResult, mockAnswers);
console.log('Item enqueued. Queue length:', count1);
if (count1 !== 1) throw new Error('Expected queue length 1');

console.log('\n=== TEST 2: Deduplication Check ===');
// Enqueue same record again
const count2 = enqueue(mockResult, mockAnswers);
console.log('Duplicate item enqueued. Queue length after deduplication:', count2);
if (count2 !== 1) throw new Error('Deduplication failed! Duplicate record created.');

console.log('\n=== TEST 3: Multiple Distinct Scans Enqueued ===');
const mockResult2 = { ...mockResult, student_id: 's2', scanned_at: '2026-10-30T08:05:00Z' };
const count3 = enqueue(mockResult2, mockAnswers);
console.log('Second distinct student scan enqueued. Queue length:', count3);
if (count3 !== 2) throw new Error('Expected 2 distinct records');

console.log('\n=== ALL OFFLINE SYNC TESTS PASSED! ===');
