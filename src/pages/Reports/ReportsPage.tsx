import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  HelpCircle, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Award,
  GraduationCap,
  Sparkles,
  PieChart as PieChartIcon,
  Layers,
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { jsPDF } from 'jspdf';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/services/db';
import { Quiz, ExamResult, AnswerKey } from '@/types/database';
import { exportItemAnalysisToCSV } from '@/lib/export-utils';

export interface QuestionStat {
  questionNumber: number;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  difficultyPercent: number; // % correct (P-value)
  incorrectPercent: number; // % incorrect
  category: 'Hard' | 'Moderate' | 'Easy';
  correctOption: string;
  countA: number;
  countB: number;
  countC: number;
  countD: number;
  countBlank: number;
}

export const ReportsPage: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [results, setResults] = useState<ExamResult[]>([]);
  const [answerKeys, setAnswerKeys] = useState<AnswerKey[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedQuizId) {
      computeAnalytics(selectedQuizId);
    }
  }, [selectedQuizId, quizzes]);

  const loadData = async () => {
    try {
      setLoading(true);
      const qList = await db.getQuizzes();
      setQuizzes(qList);
      if (qList.length > 0) {
        setSelectedQuizId(qList[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const computeAnalytics = async (quizId: string) => {
    try {
      setLoading(true);
      const [res, keys] = await Promise.all([
        db.getExamResults({ quizId }),
        db.getAnswerKeys(quizId),
      ]);
      setResults(res);
      setAnswerKeys(keys);

      const targetQuiz = quizzes.find(q => q.id === quizId);
      const totalQuestions = targetQuiz?.total_questions || 20;

      // Calculate Item Analysis across all student answers
      const stats: QuestionStat[] = [];
      for (let q = 1; q <= totalQuestions; q++) {
        const keyItem = keys.find(k => k.question_number === q);
        const correctOpt = keyItem?.correct_options?.[0] || 'A';

        let attempts = 0;
        let correct = 0;
        let countA = 0;
        let countB = 0;
        let countC = 0;
        let countD = 0;
        let countBlank = 0;

        res.forEach(r => {
          const ans = r.answers?.find(a => a.question_number === q);
          if (ans) {
            attempts++;
            if (ans.is_correct) correct++;

            const marked = ans.marked_options || [];
            if (marked.length === 0 || ans.is_blank) {
              countBlank++;
            } else {
              if (marked.includes('A')) countA++;
              if (marked.includes('B')) countB++;
              if (marked.includes('C')) countC++;
              if (marked.includes('D')) countD++;
            }
          }
        });

        const effectiveAttempts = attempts > 0 ? attempts : res.length;
        const diff = effectiveAttempts > 0 ? Math.round((correct / effectiveAttempts) * 100) : 75;
        const incorrect = effectiveAttempts - correct;
        const incPercent = Math.max(0, 100 - diff);

        let cat: 'Hard' | 'Moderate' | 'Easy' = 'Moderate';
        if (diff < 45) cat = 'Hard';
        else if (diff > 75) cat = 'Easy';

        stats.push({
          questionNumber: q,
          totalAttempts: effectiveAttempts,
          correctAttempts: correct,
          incorrectAttempts: incorrect,
          difficultyPercent: diff,
          incorrectPercent: incPercent,
          category: cat,
          correctOption: correctOpt,
          countA,
          countB,
          countC,
          countD,
          countBlank,
        });
      }

      setQuestionStats(stats);
      if (stats.length > 0) {
        setSelectedQuestionNumber(stats[0].questionNumber);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
  const totalScans = results.length;
  const scores = results.map(r => r.percentage);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highest = scores.length > 0 ? Math.max(...scores) : 0;
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;
  const passCount = results.filter(r => r.passed).length;
  const passRate = totalScans > 0 ? Math.round((passCount / totalScans) * 100) : 0;

  // Ranked Questions
  const mostDifficult = [...questionStats].sort((a, b) => a.difficultyPercent - b.difficultyPercent).slice(0, 4);
  const easiest = [...questionStats].sort((a, b) => b.difficultyPercent - a.difficultyPercent).slice(0, 4);

  // Selected question statistics for detailed choice distribution
  const selectedQuestion = questionStats.find(q => q.questionNumber === selectedQuestionNumber) || questionStats[0];

  const choiceDistributionData = selectedQuestion ? [
    { choice: 'Option A', count: selectedQuestion.countA, isCorrect: selectedQuestion.correctOption === 'A' },
    { choice: 'Option B', count: selectedQuestion.countB, isCorrect: selectedQuestion.correctOption === 'B' },
    { choice: 'Option C', count: selectedQuestion.countC, isCorrect: selectedQuestion.correctOption === 'C' },
    { choice: 'Option D', count: selectedQuestion.countD, isCorrect: selectedQuestion.correctOption === 'D' },
    { choice: 'Blank / Unmarked', count: selectedQuestion.countBlank, isCorrect: false },
  ] : [];

  const handleDownloadReportPDF = () => {
    if (!selectedQuiz) return;
    const doc = new jsPDF();

    // GradeScan Header
    doc.setFillColor(15, 118, 110); // Deep Teal
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GradeScan — Item Analysis & Examination Performance Report', 14, 15);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`Exam Title: ${selectedQuiz.title}`, 14, 32);
    doc.text(`Class: ${selectedQuiz.class_name || 'General Class'}   |   Exam Date: ${selectedQuiz.exam_date}`, 14, 39);
    doc.text(`Students Graded: ${totalScans}   |   Class Average: ${avg}%   |   Passing Rate: ${passRate}%`, 14, 46);
    doc.text(`Highest Score: ${highest}%   |   Lowest Score: ${lowest}%   |   Total Questions: ${selectedQuiz.total_questions}`, 14, 53);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(14, 58, 196, 58);

    // Most Difficult & Easiest summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Psychometric Findings:', 14, 66);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let y = 73;
    doc.text('• Most Challenging Items (Lowest % Correct):', 14, y);
    y += 6;
    mostDifficult.forEach((item) => {
      doc.text(`    Question ${item.questionNumber}: ${item.difficultyPercent}% correct (${item.correctAttempts}/${item.totalAttempts} correct) — Correct Key: ${item.correctOption}`, 14, y);
      y += 5.5;
    });

    y += 3;
    doc.text('• Easiest Items (Highest Mastery):', 14, y);
    y += 6;
    easiest.forEach((item) => {
      doc.text(`    Question ${item.questionNumber}: ${item.difficultyPercent}% correct (${item.correctAttempts}/${item.totalAttempts} correct) — Correct Key: ${item.correctOption}`, 14, y);
      y += 5.5;
    });

    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Item Analysis & Choice Distribution Table:', 14, y);
    y += 7;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 16, y + 5);
    doc.text('Key', 28, y + 5);
    doc.text('Correct (%)', 40, y + 5);
    doc.text('Incorrect (%)', 66, y + 5);
    doc.text('Choice A', 96, y + 5);
    doc.text('Choice B', 116, y + 5);
    doc.text('Choice C', 136, y + 5);
    doc.text('Choice D', 156, y + 5);
    doc.text('Difficulty', 176, y + 5);

    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    questionStats.forEach((st) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(`Q${st.questionNumber}`, 16, y);
      doc.text(`${st.correctOption}`, 28, y);
      doc.text(`${st.correctAttempts} (${st.difficultyPercent}%)`, 40, y);
      doc.text(`${st.incorrectAttempts} (${st.incorrectPercent}%)`, 66, y);
      doc.text(`${st.countA}`, 96, y);
      doc.text(`${st.countB}`, 116, y);
      doc.text(`${st.countC}`, 136, y);
      doc.text(`${st.countD}`, 156, y);
      doc.text(`${st.category}`, 176, y);
      y += 6;
    });

    // Student Roster Page
    doc.addPage();
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Gradebook Roster — Graded Answer Sheets', 14, 14);

    doc.setTextColor(15, 23, 42);
    y = 30;
    doc.setFontSize(9);
    results.forEach((r, idx) => {
      const name = r.student ? `${r.student.last_name}, ${r.student.first_name}` : 'Student';
      const idNum = r.student?.student_number || r.raw_student_number || 'N/A';
      const line = `${idx + 1}. [ID: ${idNum}] ${name}  —  Score: ${r.total_score}/${r.max_score} (${r.percentage}%) [${r.passed ? 'PASSED' : 'FAILED'}]`;
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 16, y);
      y += 6.5;
    });

    doc.save(`${selectedQuiz.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_gradescan_report.pdf`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            Item Analysis & Performance Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Question difficulty index (P-value), choice distribution (A, B, C, D), easiest & hardest items, and printable analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportItemAnalysisToCSV(questionStats, selectedQuiz?.title || 'item_analysis')}
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Export Item Analysis (CSV)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadReportPDF}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download PDF Report
          </Button>
        </div>
      </div>

      {/* Quiz Selector Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Exam:</span>
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:ring-2 focus:ring-brand-500"
            >
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Papers Graded: <strong className="text-slate-900 dark:text-slate-100">{totalScans}</strong></span>
            <span>Class Average: <strong className="text-brand-700 dark:text-brand-400">{avg}%</strong></span>
            <span>Passing Rate: <strong className="text-emerald-600">{passRate}%</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Item Difficulty Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Item Difficulty Index (Percentage Answering Correctly)</CardTitle>
              <p className="text-xs text-slate-500">Click any bar to inspect its exact answer distribution (A, B, C, D)</p>
            </div>
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-1 rounded-md border border-brand-200 dark:border-brand-800">
              Selected: Question {selectedQuestionNumber}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={questionStats} 
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    setSelectedQuestionNumber(e.activePayload[0].payload.questionNumber);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="questionNumber" tick={{ fontSize: 11 }} tickFormatter={(val) => `Q${val}`} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(val: any, _name: any, item: any) => [
                    `${val}% Correct (${item.payload.correctAttempts}/${item.payload.totalAttempts} students)`,
                    `Difficulty Index`
                  ]}
                  labelFormatter={(lbl) => `Question ${lbl} (Key: ${questionStats.find(q => q.questionNumber === Number(lbl))?.correctOption})`}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="difficultyPercent" radius={[4, 4, 0, 0]} cursor="pointer">
                  {questionStats.map((entry) => (
                    <Cell 
                      key={`cell-${entry.questionNumber}`} 
                      fill={
                        entry.questionNumber === selectedQuestionNumber
                          ? '#0f766e'
                          : entry.category === 'Hard' 
                          ? '#f43f5e' 
                          : entry.category === 'Easy' 
                          ? '#10b981' 
                          : '#0d9488'
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500 inline-block" /> Difficult (&lt;45% correct)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-600 inline-block" /> Moderate (45–75%)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Easy (&gt;75% correct)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-800 ring-2 ring-teal-400 inline-block" /> Active Selection</span>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Grid: Answer Choice Distribution & Psychometric Extremes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Answer Choice Distribution (A, B, C, D) for the selected question */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-brand-700" />
                    Answer Distribution: Question {selectedQuestion?.questionNumber}
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Correct Answer: <strong className="text-emerald-600 font-bold">Option {selectedQuestion?.correctOption}</strong> • Student choices breakdown
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Switch Q:</span>
                  <select
                    value={selectedQuestionNumber}
                    onChange={(e) => setSelectedQuestionNumber(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                  >
                    {questionStats.map(st => (
                      <option key={st.questionNumber} value={st.questionNumber}>
                        Q{st.questionNumber} ({st.difficultyPercent}% correct)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={choiceDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="choice" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip 
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} student(s) (${Math.round((Number(val) / (selectedQuestion?.totalAttempts || 1)) * 100)}%)`,
                        item.payload.isCorrect ? 'Correct Answer' : 'Distractor'
                      ]}
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {choiceDistributionData.map((entry, index) => (
                        <Cell 
                          key={`dist-cell-${index}`}
                          fill={entry.isCorrect ? '#10b981' : entry.choice.includes('Blank') ? '#94a3b8' : '#0d9488'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown cards for Options A, B, C, D */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const count = opt === 'A' ? selectedQuestion?.countA : opt === 'B' ? selectedQuestion?.countB : opt === 'C' ? selectedQuestion?.countC : selectedQuestion?.countD;
                  const isCorrect = selectedQuestion?.correctOption === opt;
                  const pct = Math.round(((count || 0) / (selectedQuestion?.totalAttempts || 1)) * 100);

                  return (
                    <div 
                      key={opt}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${
                        isCorrect 
                          ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30' 
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold">
                        <span>Choice {opt}</span>
                        {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />}
                      </div>
                      <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                        {count || 0}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Most Difficult & Easiest Questions Lists */}
        <div className="lg:col-span-5 space-y-4">
          {/* Most Difficult Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Most Difficult Items (Low Mastery)
              </CardTitle>
            </CardHeader>
            <div className="p-4 space-y-2">
              {mostDifficult.map((item, idx) => (
                <div 
                  key={item.questionNumber}
                  onClick={() => setSelectedQuestionNumber(item.questionNumber)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                    selectedQuestionNumber === item.questionNumber 
                      ? 'border-rose-400 bg-rose-50/60 dark:bg-rose-950/40 ring-1 ring-rose-300' 
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-[10px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">Question {item.questionNumber}</p>
                      <p className="text-[10px] text-slate-400">Correct: {item.correctAttempts} / {item.totalAttempts} ({item.difficultyPercent}%)</p>
                    </div>
                  </div>
                  <Badge variant="danger" size="sm">
                    {item.incorrectPercent}% Missed
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Easiest Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Easiest Items (High Mastery)
              </CardTitle>
            </CardHeader>
            <div className="p-4 space-y-2">
              {easiest.map((item, idx) => (
                <div 
                  key={item.questionNumber}
                  onClick={() => setSelectedQuestionNumber(item.questionNumber)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                    selectedQuestionNumber === item.questionNumber 
                      ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 ring-1 ring-emerald-300' 
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">Question {item.questionNumber}</p>
                      <p className="text-[10px] text-slate-400">Correct: {item.correctAttempts} / {item.totalAttempts} ({item.difficultyPercent}%)</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm">
                    {item.difficultyPercent}% Correct
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Complete Item Analysis Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-700" />
            Complete Question-by-Question Item Analysis Matrix
          </CardTitle>
          <p className="text-xs text-slate-500">
            Psychometric P-value index, correct vs incorrect counts, and full choice frequency breakdown (A, B, C, D)
          </p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Item #</th>
                <th className="px-3 py-3">Key</th>
                <th className="px-4 py-3">Correct Answers</th>
                <th className="px-4 py-3">Incorrect Answers</th>
                <th className="px-3 py-3 text-center">A</th>
                <th className="px-3 py-3 text-center">B</th>
                <th className="px-3 py-3 text-center">C</th>
                <th className="px-3 py-3 text-center">D</th>
                <th className="px-3 py-3 text-center">Blank</th>
                <th className="px-4 py-3 text-right">Difficulty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {questionStats.map((st) => (
                <tr 
                  key={st.questionNumber}
                  onClick={() => setSelectedQuestionNumber(st.questionNumber)}
                  className={`hover:bg-brand-50/40 dark:hover:bg-brand-950/20 cursor-pointer transition-colors ${
                    selectedQuestionNumber === st.questionNumber ? 'bg-brand-50/70 dark:bg-brand-950/40 font-semibold' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-bold">
                    Q{st.questionNumber}
                  </td>
                  <td className="px-3 py-3">
                    <span className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                      {st.correctOption}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-emerald-600">{st.correctAttempts}</span>
                    <span className="text-slate-400 text-[11px]"> ({st.difficultyPercent}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-rose-600">{st.incorrectAttempts}</span>
                    <span className="text-slate-400 text-[11px]"> ({st.incorrectPercent}%)</span>
                  </td>
                  <td className={`px-3 py-3 text-center ${st.correctOption === 'A' ? 'font-bold text-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30' : 'text-slate-600 dark:text-slate-400'}`}>
                    {st.countA}
                  </td>
                  <td className={`px-3 py-3 text-center ${st.correctOption === 'B' ? 'font-bold text-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30' : 'text-slate-600 dark:text-slate-400'}`}>
                    {st.countB}
                  </td>
                  <td className={`px-3 py-3 text-center ${st.correctOption === 'C' ? 'font-bold text-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30' : 'text-slate-600 dark:text-slate-400'}`}>
                    {st.countC}
                  </td>
                  <td className={`px-3 py-3 text-center ${st.correctOption === 'D' ? 'font-bold text-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30' : 'text-slate-600 dark:text-slate-400'}`}>
                    {st.countD}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">
                    {st.countBlank}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={st.category === 'Hard' ? 'danger' : st.category === 'Easy' ? 'success' : 'info'}>
                      {st.category}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};