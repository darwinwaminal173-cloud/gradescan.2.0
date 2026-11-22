import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Download, 
  FileSpreadsheet, 
  Eye, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  FileText,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/services/db';
import { ExamResult, Quiz, ClassRoom } from '@/types/database';
import { exportResultsToCSV, exportResultsToExcel } from '@/lib/export-utils';

export const ExamResultsPage: React.FC = () => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedQuizId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [res, qList, cList] = await Promise.all([
        db.getExamResults({ quizId: selectedQuizId === 'all' ? undefined : selectedQuizId }),
        db.getQuizzes(),
        db.getClasses(),
      ]);
      setResults(res);
      setQuizzes(qList);
      setClasses(cList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResult = async () => {
    if (!selectedResult) return;
    try {
      await db.deleteExamResult(selectedResult.id);
      setIsDeleteOpen(false);
      loadData();
    } catch (err: any) {
      alert('Error deleting result: ' + err.message);
    }
  };

  const filtered = results.filter(r => {
    const sName = r.student ? `${r.student.first_name} ${r.student.last_name}` : 'Unknown';
    const sId = r.student?.student_number || r.raw_student_number || '';
    const qTitle = r.quiz?.title || '';

    return (
      sName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sId.includes(searchTerm) ||
      qTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            Examination Results &amp; Gradebook
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review graded answer sheets, export spreadsheets, and inspect individual question responses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportResultsToCSV(filtered)}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportResultsToExcel(filtered)}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium shrink-0">Quiz Filter:</span>
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="all">All Quizzes ({results.length} Scans)</option>
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-4 py-3">Quiz</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Percentage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Scanned Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No examination records found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.student ? `${r.student.last_name}, ${r.student.first_name}` : 'Unassigned'}
                      </div>
                      <span className="font-mono text-[10px] text-brand-700 dark:text-brand-400 font-bold">
                        #{r.student?.student_number || r.raw_student_number || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                      {r.quiz?.title || 'Quiz Assessment'}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                      {r.total_score} <span className="text-slate-400 font-normal">/ {r.max_score}</span>
                    </td>
                    <td className="px-4 py-3.5 font-extrabold text-brand-700 dark:text-brand-400">
                      {r.percentage}%
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={r.passed ? 'success' : 'danger'}>
                        {r.passed ? 'PASSED' : 'FAILED'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-slate-500">{r.scan_confidence || 100}%</span>
                      {r.needs_review && (
                        <span title="Marked for review">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline ml-1" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {new Date(r.scanned_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => { setSelectedResult(r); setIsDetailOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded transition-colors"
                        title="Inspect Scanned Breakdown"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedResult(r); setIsDeleteOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                        title="Delete Result"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Examination Record"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Are you sure you want to delete this scan record for <span className="font-bold">{selectedResult?.student ? selectedResult.student.last_name : 'Student'}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteResult}>
              Delete Record
            </Button>
          </div>
        </div>
      </Modal>

      {/* Result Breakdown Inspection Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Exam Breakdown: ${selectedResult?.student ? `${selectedResult.student.last_name}, ${selectedResult.student.first_name}` : 'Student'}`}
        description={`${selectedResult?.quiz?.title} • Score: ${selectedResult?.total_score}/${selectedResult?.max_score} (${selectedResult?.percentage}%)`}
        maxWidth="2xl"
      >
        {selectedResult && (
          <div className="space-y-4">
            {/* Header Metrics */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-600 font-bold">CORRECT</span>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-200">{selectedResult.correct_count}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                <span className="text-[10px] text-red-600 font-bold">INCORRECT</span>
                <p className="text-lg font-black text-red-800 dark:text-red-200">{selectedResult.incorrect_count}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 font-bold">BLANK</span>
                <p className="text-lg font-black text-slate-700 dark:text-slate-300">{selectedResult.unanswered_count}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] text-blue-600 font-bold">PERCENT</span>
                <p className="text-lg font-black text-blue-800 dark:text-blue-200">{selectedResult.percentage}%</p>
              </div>
            </div>

            {/* Scanned Image Snapshot if available */}
            {selectedResult.scanned_image_url && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Scanned Paper Snapshot</h4>
                <div className="max-h-48 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex justify-center bg-black">
                  <img src={selectedResult.scanned_image_url} alt="Scanned Answer Sheet" className="h-full object-contain" />
                </div>
              </div>
            )}

            {/* Answer Item Breakdown Table with Consistent Color Coding */}
            {selectedResult.answers && selectedResult.answers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Item Responses</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Correct</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-600 inline-block" /> Wrong</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-amber-500 bg-amber-100 inline-block" /> Key</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                  {selectedResult.answers.map((a) => (
                    <div
                      key={a.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                        a.is_correct
                          ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100'
                          : a.is_blank
                          ? 'border-slate-300 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                          : 'border-rose-300 bg-rose-50/60 dark:bg-rose-950/20 text-rose-950 dark:text-rose-100'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>Q{a.question_number}.</span>
                          {a.is_correct ? (
                            <span className="text-[10px] text-emerald-600 font-black">✔ Correct</span>
                          ) : a.is_blank ? (
                            <span className="text-[10px] text-slate-500 font-bold">Blank</span>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-black">✘ Wrong</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Marked: <span className={`font-black ${a.is_correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'}`}>{a.marked_options.join('') || '—'}</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                          Key: {a.correct_options?.join('') || '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
