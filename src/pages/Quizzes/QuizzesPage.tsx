import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileQuestion, 
  Plus, 
  Search, 
  KeyRound, 
  Camera, 
  FileText, 
  Copy, 
  Trash2, 
  Edit, 
  Calendar, 
  GraduationCap,
  Award,
  CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/services/db';
import { Quiz, ClassRoom, SheetTemplateType } from '@/types/database';
import { AnswerKeyModal } from './AnswerKeyModal';

export const QuizzesPage: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  // Form
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    class_id: '',
    exam_date: new Date().toISOString().split('T')[0],
    total_questions: 20,
    options_per_question: 4 as 4 | 5 | 2,
    default_points_per_question: 1,
    passing_percentage: 60,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [q, c] = await Promise.all([
        db.getQuizzes(),
        db.getClasses(),
      ]);
      setQuizzes(q);
      setClasses(c);
    } catch (e) {
      console.error('Failed to load quizzes:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    try {
      let template: SheetTemplateType = 'standard_20';
      if (formData.total_questions > 50) template = 'standard_100';
      else if (formData.total_questions > 20) template = 'standard_50';

      const newQuiz = await db.createQuiz({
        class_id: formData.class_id || null,
        title: formData.title,
        description: formData.description || null,
        exam_date: formData.exam_date,
        total_questions: Number(formData.total_questions),
        options_per_question: formData.options_per_question,
        default_points_per_question: Number(formData.default_points_per_question),
        passing_percentage: Number(formData.passing_percentage),
        sheet_template: template,
      });

      setIsCreateOpen(false);
      resetForm();
      loadData();
      
      // Immediately open Answer Key configuration for the new quiz
      setSelectedQuiz(newQuiz);
      setIsAnswerKeyOpen(true);
    } catch (err: any) {
      alert(err.message || 'Error creating quiz');
    }
  };

  const handleDuplicateQuiz = async (quiz: Quiz) => {
    try {
      const keys = await db.getAnswerKeys(quiz.id);
      await db.createQuiz({
        teacher_id: quiz.teacher_id,
        class_id: quiz.class_id,
        title: `${quiz.title} (Copy)`,
        description: quiz.description,
        exam_date: new Date().toISOString().split('T')[0],
        total_questions: quiz.total_questions,
        options_per_question: quiz.options_per_question,
        default_points_per_question: quiz.default_points_per_question,
        passing_percentage: quiz.passing_percentage,
        sheet_template: quiz.sheet_template,
      }, keys);
      loadData();
    } catch (err: any) {
      alert('Error duplicating quiz: ' + err.message);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!selectedQuiz) return;
    try {
      await db.deleteQuiz(selectedQuiz.id);
      setIsDeleteOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting quiz');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      class_id: '',
      exam_date: new Date().toISOString().split('T')[0],
      total_questions: 20,
      options_per_question: 4,
      default_points_per_question: 1,
      passing_percentage: 60,
    });
    setSelectedQuiz(null);
  };

  const filtered = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.class_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileQuestion className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            Quiz &amp; Exam Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build GradeScan quizzes, set answer keys (A, B, C, D), configure points, and trigger real-time scanning.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => { resetForm(); setIsCreateOpen(true); }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Quiz
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search quizzes by title or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Quizzes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((q) => (
          <Card key={q.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <CardHeader
                action={
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateQuiz(q)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="Duplicate Quiz"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedQuiz(q); setIsDeleteOpen(true); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                      title="Delete Quiz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                }
              >
                <CardTitle className="text-base truncate max-w-[200px]">{q.title}</CardTitle>
                <div className="flex items-center gap-2 pt-1 text-slate-400 text-[11px]">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{q.class_name || 'Unassigned'}</span>
                  <span>•</span>
                  <span>{new Date(q.exam_date).toLocaleDateString()}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                  {q.description || 'No description provided.'}
                </p>

                {/* Specs pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge size="sm" variant="info">{q.total_questions} Questions</Badge>
                  <Badge size="sm" variant="default">{q.options_per_question} Options (A-{q.options_per_question === 4 ? 'D' : q.options_per_question === 5 ? 'E' : 'B'})</Badge>
                  <Badge size="sm" variant="outline">Pass: {q.passing_percentage}%</Badge>
                </div>

                {/* Performance banner */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Scanned Papers:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{q.results_count || 0}</span>
                </div>
              </CardContent>
            </div>

            {/* Actions Footer */}
            <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 rounded-b-xl flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSelectedQuiz(q); setIsAnswerKeyOpen(true); }}
                leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-500" />}
              >
                Answer Key
              </Button>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/answer-sheets?quizId=${q.id}`)}
                  title="Print Answer Sheets"
                  leftIcon={<FileText className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />}
                >
                  Sheets
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/scan?quizId=${q.id}`)}
                  leftIcon={<Camera className="w-3.5 h-3.5" />}
                >
                  Scan
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Quiz Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New OMR Quiz / Exam"
        description="Configure exam questions, bubble options, and grading criteria."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateQuiz} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quiz Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Unit 3 Mechanics Exam"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assign to Class
              </label>
              <select
                value={formData.class_id}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Examination Date
              </label>
              <input
                type="date"
                value={formData.exam_date}
                onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Questions *
              </label>
              <select
                value={formData.total_questions}
                onChange={(e) => setFormData({ ...formData, total_questions: parseInt(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value={20}>20 Questions</option>
                <option value={30}>30 Questions</option>
                <option value={50}>50 Questions</option>
                <option value={60}>60 Questions</option>
                <option value={80}>80 Questions</option>
                <option value={100}>100 Questions</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Options per Q
              </label>
              <select
                value={formData.options_per_question}
                onChange={(e) => setFormData({ ...formData, options_per_question: parseInt(e.target.value) as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value={4}>4 Options (A-D)</option>
                <option value={5}>5 Options (A-E)</option>
                <option value={2}>2 Options (T/F)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Passing Score (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.passing_percentage}
                onChange={(e) => setFormData({ ...formData, passing_percentage: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Syllabus topics covered or grading instructions..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Create & Set Answer Key →
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Quiz"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-bold">{selectedQuiz?.title}</span>? All associated answer keys and scan results will also be deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteQuiz}>
              Delete Quiz
            </Button>
          </div>
        </div>
      </Modal>

      {/* Answer Key Editor Modal */}
      <AnswerKeyModal
        isOpen={isAnswerKeyOpen}
        onClose={() => { setIsAnswerKeyOpen(false); setSelectedQuiz(null); }}
        quiz={selectedQuiz}
        onSaved={loadData}
      />
    </div>
  );
};
