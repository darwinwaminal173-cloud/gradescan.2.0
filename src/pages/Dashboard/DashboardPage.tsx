import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  FileQuestion, 
  Camera, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  FileText,
  Plus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/services/db';
import { DashboardStats, ExamResult, Quiz } from '@/types/database';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    totalQuizzes: 0,
    totalScans: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
    passingRate: 0,
  });
  const [recentResults, setRecentResults] = useState<ExamResult[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [s, results, quizzes] = await Promise.all([
        db.getDashboardStats(),
        db.getExamResults(),
        db.getQuizzes(),
      ]);
      setStats(s);
      setRecentResults(results.slice(0, 5));
      setRecentQuizzes(quizzes.slice(0, 4));
    } catch (e) {
      console.error('Failed loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  // Mock distribution data computed from actual results or bell curve standard
  const scoreDistribution = [
    { range: '0-50%', count: recentResults.filter(r => r.percentage < 50).length },
    { range: '50-60%', count: recentResults.filter(r => r.percentage >= 50 && r.percentage < 60).length },
    { range: '60-70%', count: recentResults.filter(r => r.percentage >= 60 && r.percentage < 70).length },
    { range: '70-80%', count: recentResults.filter(r => r.percentage >= 70 && r.percentage < 80).length },
    { range: '80-90%', count: recentResults.filter(r => r.percentage >= 80 && r.percentage < 90).length },
    { range: '90-100%', count: recentResults.filter(r => r.percentage >= 90).length },
  ];

  const trendData = [
    { exam: 'Quiz 1', avg: 72 },
    { exam: 'Quiz 2', avg: 78 },
    { exam: 'Midterm', avg: 81 },
    { exam: 'Physics 1', avg: stats.averageScore || 84 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-brand-900 via-brand-800 to-teal-800 text-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-brand-950/20 border border-brand-700/50">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/30 text-teal-200 border border-brand-400/30">
              GradeScan v2.0
            </span>
            <span className="text-xs text-teal-200/80">Computer Vision OMR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">GradeScan Dashboard</h1>
          <p className="text-sm text-teal-100/90 max-w-xl">
            Real-time optical mark recognition grading, high-accuracy camera scanning, automated psychometrics, and printable bubble sheets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/quizzes')}
            leftIcon={<Plus className="w-4 h-4 text-teal-200" />}
            className="bg-white/10 hover:bg-white/20 text-white border-0 shadow-xs backdrop-blur-xs"
          >
            New Quiz
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/answer-sheets')}
            leftIcon={<FileText className="w-4 h-4 text-teal-200" />}
            className="bg-white/10 hover:bg-white/20 text-white border-0 shadow-xs backdrop-blur-xs"
          >
            Print Sheets
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/scan')}
            leftIcon={<Camera className="w-4 h-4" />}
            className="bg-white text-brand-900 hover:bg-teal-50 shadow-md font-bold ring-1 ring-brand-300"
          >
            Launch Scanner
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          subtitle="Enrolled across classes"
          icon={<Users className="w-5 h-5" />}
          color="teal"
        />
        <StatCard
          title="Classes & Sections"
          value={stats.totalClasses}
          subtitle="Active academic cohorts"
          icon={<GraduationCap className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Sheets Scanned"
          value={stats.totalScans}
          subtitle={`${stats.passingRate}% passing rate`}
          icon={<Camera className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Class Average"
          value={`${stats.averageScore}%`}
          subtitle={`High: ${stats.highestScore}% | Low: ${stats.lowestScore}%`}
          icon={<Award className="w-5 h-5" />}
          color="amber"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <p className="text-xs text-slate-500">Student count grouped by examination percentage range</p>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Class Performance Trend</CardTitle>
            <p className="text-xs text-slate-500">Average exam percentage across recent assessments</p>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                    formatter={(val) => [`${val}%`, 'Average']}
                  />
                  <Area type="monotone" dataKey="avg" stroke="#0f766e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAvg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section: Recent Scans and Active Quizzes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Scanned Papers Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader 
              action={
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/results')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  View All
                </Button>
              }
            >
              <CardTitle>Recent Scanning Activity</CardTitle>
              <p className="text-xs text-slate-500">Latest graded answer sheets processed by OMR</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-4 py-3">Quiz</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3 text-right">Scanned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {recentResults.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                        No exam sheets scanned yet. Click "Launch Scanner" to scan an answer sheet!
                      </td>
                    </tr>
                  ) : (
                    recentResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {r.student ? `${r.student.last_name}, ${r.student.first_name}` : `ID: ${r.raw_student_number || 'Unknown'}`}
                          </div>
                          <span className="text-[10px] text-slate-400">#{r.student?.student_number || r.raw_student_number}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                          {r.quiz?.title || 'Midterm Exam'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{r.total_score}</span>
                          <span className="text-slate-400">/{r.max_score} ({r.percentage}%)</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={r.passed ? 'success' : 'danger'}>
                            {r.passed ? 'PASSED' : 'FAILED'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-400 text-[11px]">
                          {new Date(r.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Quizzes Column */}
        <div>
          <Card>
            <CardHeader
              action={
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/quizzes')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Manage
                </Button>
              }
            >
              <CardTitle>Active Quizzes</CardTitle>
              <p className="text-xs text-slate-500">Ready for scanning</p>
            </CardHeader>
            <div className="p-4 space-y-3">
              {recentQuizzes.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => navigate(`/scan?quizId=${q.id}`)}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-brand-50/40 dark:hover:bg-brand-950/20 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                      {q.title}
                    </span>
                    <Badge size="sm" variant="info">{q.total_questions} Qs</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{q.class_name || 'Physics Alpha'}</span>
                    <span className="text-brand-700 dark:text-brand-400 font-medium hover:underline">Scan Sheet →</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
