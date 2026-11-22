import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Check, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Ban, 
  PlusCircle, 
  HelpCircle 
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/services/db';
import { Quiz, AnswerKey } from '@/types/database';

interface AnswerKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz | null;
  onSaved?: () => void;
}

export const AnswerKeyModal: React.FC<AnswerKeyModalProps> = ({
  isOpen,
  onClose,
  quiz,
  onSaved,
}) => {
  const [keys, setKeys] = useState<AnswerKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quiz && isOpen) {
      loadKeys();
    }
  }, [quiz, isOpen]);

  const loadKeys = async () => {
    if (!quiz) return;
    try {
      setLoading(true);
      const data = await db.getAnswerKeys(quiz.id);
      
      // If no keys exist yet, initialize defaults for all quiz questions
      if (data.length === 0) {
        const initialKeys: AnswerKey[] = [];
        for (let i = 1; i <= quiz.total_questions; i++) {
          initialKeys.push({
            id: `temp_${quiz.id}_${i}`,
            quiz_id: quiz.id,
            question_number: i,
            correct_options: ['A'], // Default first option
            points: quiz.default_points_per_question,
            is_bonus: false,
            is_excluded: false,
            explanation: null,
          });
        }
        setKeys(initialKeys);
      } else {
        // Ensure all questions up to total_questions exist
        const fullKeys: AnswerKey[] = [];
        for (let i = 1; i <= quiz.total_questions; i++) {
          const existing = data.find(k => k.question_number === i);
          if (existing) {
            fullKeys.push(existing);
          } else {
            fullKeys.push({
              id: `temp_${quiz.id}_${i}`,
              quiz_id: quiz.id,
              question_number: i,
              correct_options: ['A'],
              points: quiz.default_points_per_question,
              is_bonus: false,
              is_excluded: false,
              explanation: null,
            });
          }
        }
        setKeys(fullKeys);
      }
    } catch (e) {
      console.error('Failed to load answer keys:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (qNumber: number, option: string) => {
    setKeys(prev => prev.map(k => {
      if (k.question_number !== qNumber) return k;
      // Single choice default (replace), or hold Shift/multi-select if desired
      // Standard OMR exam usually has single correct option
      const newOpts = k.correct_options.includes(option)
        ? k.correct_options.filter(o => o !== option)
        : [option];
      return { ...k, correct_options: newOpts.length > 0 ? newOpts : [option] };
    }));
  };

  const toggleBonus = (qNumber: number) => {
    setKeys(prev => prev.map(k => {
      if (k.question_number !== qNumber) return k;
      return { ...k, is_bonus: !k.is_bonus, is_excluded: false };
    }));
  };

  const toggleExcluded = (qNumber: number) => {
    setKeys(prev => prev.map(k => {
      if (k.question_number !== qNumber) return k;
      return { ...k, is_excluded: !k.is_excluded, is_bonus: false };
    }));
  };

  const updatePoints = (qNumber: number, pts: number) => {
    setKeys(prev => prev.map(k => {
      if (k.question_number !== qNumber) return k;
      return { ...k, points: Math.max(0.5, pts) };
    }));
  };

  const handleSave = async () => {
    if (!quiz) return;
    try {
      setSaving(true);
      await db.saveAnswerKeys(quiz.id, keys);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      alert('Error saving answer key: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!quiz) return null;

  const optionList = ['A', 'B', 'C', 'D', 'E'].slice(0, quiz.options_per_question);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Answer Key: ${quiz.title}`}
      description={`Set the official correct answer bubbles, points, bonus items, and exclusion rules (${quiz.total_questions} Questions).`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Quick Bulk Tools */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Set All To:</span>
            {optionList.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setKeys(prev => prev.map(k => ({ ...k, correct_options: [opt] })))}
                className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-brand-50 hover:border-brand-500 font-bold text-xs"
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-700 inline-block" /> Selected Key
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Bonus Q
            </span>
            <span className="flex items-center gap-1">
              <Ban className="w-3 h-3 text-red-500" /> Excluded
            </span>
          </div>
        </div>

        {/* Answer Key Question Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[58vh] overflow-y-auto p-1">
          {keys.map((k) => (
            <div
              key={k.question_number}
              className={`p-3 rounded-xl border transition-all ${
                k.is_excluded
                  ? 'border-red-200 bg-red-50/30 dark:bg-red-950/20'
                  : k.is_bonus
                  ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Q{k.question_number}.
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleBonus(k.question_number)}
                    title="Mark as Bonus Question"
                    className={`p-1 rounded text-[10px] font-bold ${
                      k.is_bonus ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'text-slate-400 hover:text-amber-600'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExcluded(k.question_number)}
                    title="Exclude Question from Grading"
                    className={`p-1 rounded text-[10px] font-bold ${
                      k.is_excluded ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : 'text-slate-400 hover:text-red-600'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={k.points}
                    onChange={(e) => updatePoints(k.question_number, parseFloat(e.target.value) || 1)}
                    className="w-12 px-1.5 py-0.5 text-[11px] rounded border border-slate-200 dark:border-slate-800 text-right font-medium"
                    title="Points for this question"
                  />
                  <span className="text-[10px] text-slate-400">pts</span>
                </div>
              </div>

              {/* Bubble Options */}
              <div className="flex items-center gap-1.5 pt-1">
                {optionList.map((opt) => {
                  const isSelected = k.correct_options.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={k.is_excluded}
                      onClick={() => toggleOption(k.question_number, opt)}
                      className={`flex-1 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-brand-700 text-white shadow-sm shadow-brand-700/30 ring-2 ring-brand-500/20'
                          : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-brand-400'
                      } ${k.is_excluded ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            Total Points: <span className="font-bold text-slate-900 dark:text-slate-100">{keys.filter(k => !k.is_excluded).reduce((a, b) => a + (b.is_bonus ? 0 : b.points), 0)}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={saving}
              onClick={handleSave}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Answer Key
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
