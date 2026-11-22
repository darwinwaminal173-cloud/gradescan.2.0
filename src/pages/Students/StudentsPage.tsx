import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Upload, 
  Download, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  GraduationCap, 
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/services/db';
import { Student, ClassRoom, ExamResult } from '@/types/database';
import { exportStudentsToCSV, parseStudentsFromFile } from '@/lib/export-utils';

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [studentResults, setStudentResults] = useState<ExamResult[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    student_number: '',
    first_name: '',
    last_name: '',
    email: '',
    grade_level: 'Grade 10',
    notes: '',
    class_id: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [selectedClassId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([
        db.getStudents(undefined, selectedClassId === 'all' ? undefined : selectedClassId),
        db.getClasses(),
      ]);
      setStudents(s);
      setClasses(c);
    } catch (e) {
      console.error('Failed to load students:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_number || !formData.first_name || !formData.last_name) return;

    try {
      await db.createStudent({
        student_number: formData.student_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        grade_level: formData.grade_level,
        notes: formData.notes,
      } as any, formData.class_id || undefined);

      setIsAddOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating student');
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;

    try {
      await db.updateStudent(currentStudent.id, {
        student_number: formData.student_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        grade_level: formData.grade_level,
        notes: formData.notes,
      });

      setIsEditOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating student');
    }
  };

  const handleDeleteStudent = async () => {
    if (!currentStudent) return;
    try {
      await db.deleteStudent(currentStudent.id);
      setIsDeleteOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting student');
    }
  };

  const handleViewDetail = async (student: Student) => {
    setCurrentStudent(student);
    try {
      const results = await db.getExamResults({ studentId: student.id });
      setStudentResults(results);
    } catch (e) {
      console.error(e);
    }
    setIsDetailOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseStudentsFromFile(file);
      const createdCount = await db.bulkCreateStudents(
        parsed as any,
        selectedClassId !== 'all' ? selectedClassId : undefined
      );
      alert(`Successfully imported ${createdCount} students!`);
      loadData();
    } catch (err: any) {
      alert('Failed to parse file: ' + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setFormData({
      student_number: '',
      first_name: '',
      last_name: '',
      email: '',
      grade_level: 'Grade 10',
      notes: '',
      class_id: '',
    });
    setCurrentStudent(null);
  };

  const openEdit = (s: Student) => {
    setCurrentStudent(s);
    setFormData({
      student_number: s.student_number,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email || '',
      grade_level: s.grade_level || 'Grade 10',
      notes: s.notes || '',
      class_id: s.classes?.[0]?.id || '',
    });
    setIsEditOpen(true);
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = 
      s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_number.includes(searchTerm);
    return matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            Student Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage student rosters, assigned 5-digit OMR bubble IDs / LRN, Grade Level, Section, and examination histories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, .xlsx, .xls"
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportStudentsToCSV(filteredStudents)}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { resetForm(); setIsAddOpen(true); }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, student ID / LRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium shrink-0">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="all">All Classes ({students.length})</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Student ID / LRN</th>
                <th className="px-5 py-3">Full Name</th>
                <th className="px-4 py-3">Class &amp; Section</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Grade Level</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-brand-700 dark:text-brand-400">
                      #{s.student_number}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      {s.last_name}, {s.first_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                      {s.classes && s.classes.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                          {s.classes[0].name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {s.email || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline">{s.grade_level || 'Grade 10'}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleViewDetail(s)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                        title="View Performance History"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Edit Student"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setCurrentStudent(s); setIsDeleteOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                        title="Delete Student"
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

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Student"
        description="Assign a unique 5-digit ID number for OMR bubble sheet recognition."
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Student ID (OMR Number) *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="e.g. 10006"
                value={formData.student_number}
                onChange={(e) => setFormData({ ...formData, student_number: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Must be numeric (e.g. 10001)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enrolled Class
              </label>
              <select
                value={formData.class_id}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                placeholder="First name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                placeholder="Last name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="student@example.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grade Level
              </label>
              <input
                type="text"
                placeholder="Grade 10"
                value={formData.grade_level}
                onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Teacher Notes
            </label>
            <textarea
              rows={2}
              placeholder="Any special remarks or accommodations..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Student
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Student Information"
      >
        <form onSubmit={handleUpdateStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Student ID *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.student_number}
                onChange={(e) => setFormData({ ...formData, student_number: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grade Level
              </label>
              <input
                type="text"
                value={formData.grade_level}
                onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Student"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-bold">{currentStudent?.first_name} {currentStudent?.last_name}</span> (ID: #{currentStudent?.student_number})? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteStudent}>
              Delete Student
            </Button>
          </div>
        </div>
      </Modal>

      {/* Student Performance History Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Student Profile: ${currentStudent?.first_name} ${currentStudent?.last_name}`}
        description={`OMR ID: #${currentStudent?.student_number} • Grade: ${currentStudent?.grade_level}`}
        maxWidth="2xl"
      >
        <div className="space-y-5">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-center">
              <span className="text-[10px] text-blue-600 font-bold uppercase">Exams Taken</span>
              <p className="text-lg font-extrabold text-blue-900 dark:text-blue-200">{studentResults.length}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center">
              <span className="text-[10px] text-emerald-600 font-bold uppercase">Average Score</span>
              <p className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200">
                {studentResults.length > 0 
                  ? `${Math.round(studentResults.reduce((a, b) => a + b.percentage, 0) / studentResults.length)}%`
                  : 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-center">
              <span className="text-[10px] text-purple-600 font-bold uppercase">Pass Rate</span>
              <p className="text-lg font-extrabold text-purple-900 dark:text-purple-200">
                {studentResults.length > 0
                  ? `${Math.round((studentResults.filter(r => r.passed).length / studentResults.length) * 100)}%`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Exam History List */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Examination History</h4>
            {studentResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                No exam scans recorded for this student yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {studentResults.map((r) => (
                  <div key={r.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{r.quiz?.title || 'Exam'}</p>
                      <p className="text-[10px] text-slate-400">{new Date(r.scanned_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{r.total_score}/{r.max_score}</span>
                        <span className="text-[11px] text-slate-400"> ({r.percentage}%)</span>
                      </div>
                      <Badge variant={r.passed ? 'success' : 'danger'}>
                        {r.passed ? 'PASSED' : 'FAILED'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
