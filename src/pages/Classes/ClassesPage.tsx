import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Plus, 
  Users, 
  BookOpen, 
  Calendar, 
  Edit, 
  Trash2, 
  FileQuestion,
  Search,
  Eye,
  UserPlus,
  UserMinus,
  CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/services/db';
import { ClassRoom, Student } from '@/types/database';

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [currentClass, setCurrentClass] = useState<ClassRoom | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<string>('');

  // Form
  const [formData, setFormData] = useState({
    name: '',
    section: '',
    subject: '',
    academic_year: '2025-2026',
    description: '',
  });

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await db.getClasses();
      setClasses(data);
    } catch (e) {
      console.error('Failed to load classes:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      await db.createClass({
        name: formData.name,
        section: formData.section || null,
        subject: formData.subject || null,
        academic_year: formData.academic_year,
        description: formData.description || null,
      } as any);
      setIsAddOpen(false);
      resetForm();
      loadClasses();
    } catch (err: any) {
      alert(err.message || 'Error creating class');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !formData.name) return;

    try {
      await db.updateClass(currentClass.id, {
        name: formData.name,
        section: formData.section || null,
        subject: formData.subject || null,
        academic_year: formData.academic_year,
        description: formData.description || null,
      });
      setIsEditOpen(false);
      resetForm();
      loadClasses();
    } catch (err: any) {
      alert(err.message || 'Error updating class');
    }
  };

  const handleDelete = async () => {
    if (!currentClass) return;
    try {
      await db.deleteClass(currentClass.id);
      setIsDeleteOpen(false);
      loadClasses();
    } catch (err: any) {
      alert(err.message || 'Error deleting class');
    }
  };

  const handleViewRoster = async (cls: ClassRoom) => {
    setCurrentClass(cls);
    try {
      const [studs, all] = await Promise.all([
        db.getStudents(undefined, cls.id),
        db.getStudents(),
      ]);
      setClassStudents(studs);
      setAllStudents(all);
    } catch (e) {
      console.error(e);
    }
    setIsRosterOpen(true);
  };

  const handleEnrollStudent = async () => {
    if (!currentClass || !selectedStudentToEnroll) return;
    try {
      await db.enrollStudent(currentClass.id, selectedStudentToEnroll);
      setSelectedStudentToEnroll('');
      const updated = await db.getStudents(undefined, currentClass.id);
      setClassStudents(updated);
      loadClasses();
    } catch (e: any) {
      alert('Error enrolling student: ' + e.message);
    }
  };

  const handleUnenrollStudent = async (studentId: string) => {
    if (!currentClass) return;
    try {
      await db.unenrollStudent(currentClass.id, studentId);
      const updated = await db.getStudents(undefined, currentClass.id);
      setClassStudents(updated);
      loadClasses();
    } catch (e: any) {
      alert('Error removing student from class: ' + e.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      section: '',
      subject: '',
      academic_year: '2025-2026',
      description: '',
    });
    setCurrentClass(null);
  };

  const openEdit = (cls: ClassRoom) => {
    setCurrentClass(cls);
    setFormData({
      name: cls.name,
      section: cls.section || '',
      subject: cls.subject || '',
      academic_year: cls.academic_year,
      description: cls.description || '',
    });
    setIsEditOpen(true);
  };

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.section?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            Classroom &amp; Course Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize course sections, student rosters, and assign target quizzes.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create Class
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search classes by name, subject, or section..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((cls) => (
          <Card key={cls.id} className="hover:shadow-md transition-shadow">
            <CardHeader 
              action={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(cls)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Edit Class"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setCurrentClass(cls); setIsDeleteOpen(true); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                    title="Delete Class"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <CardTitle className="text-base truncate max-w-[200px]">{cls.name}</CardTitle>
              <div className="flex items-center gap-2 pt-1">
                {cls.section && <Badge size="sm" variant="info">{cls.section}</Badge>}
                <span className="text-[11px] text-slate-400">{cls.academic_year}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                {cls.description || 'No course description provided.'}
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{cls.student_count || 0}</span> Students
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  {cls.subject || 'General'}
                </span>
              </div>
            </CardContent>
            <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 rounded-b-xl flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewRoster(cls)}
                leftIcon={<Eye className="w-3.5 h-3.5" />}
              >
                View Roster
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create New Classroom / Section"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Class Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grade 10 - Biology"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Section / Cohort
              </label>
              <input
                type="text"
                placeholder="e.g. Section B"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                placeholder="e.g. Biology"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Academic Year
            </label>
            <input
              type="text"
              value={formData.academic_year}
              onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Course description or syllabus notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Create Class
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Class Details"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Class Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Section
              </label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
        title="Delete Class"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-bold">{currentClass?.name}</span>? Students in this class will not be deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete Class
            </Button>
          </div>
        </div>
      </Modal>

      {/* Class Roster Drawer Modal */}
      <Modal
        isOpen={isRosterOpen}
        onClose={() => setIsRosterOpen(false)}
        title={`Roster: ${currentClass?.name}`}
        description={`${classStudents.length} Students currently enrolled`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          {/* Enroll student directly */}
          <div className="flex items-center gap-2 p-3 bg-brand-50/60 dark:bg-brand-950/30 rounded-xl border border-brand-200/50 dark:border-brand-800/40">
            <select
              value={selectedStudentToEnroll}
              onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <option value="">Select student to assign to this class...</option>
              {allStudents
                .filter(s => !classStudents.some(cs => cs.id === s.id))
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.last_name}, {s.first_name} (#{s.student_number})
                  </option>
                ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnrollStudent}
              disabled={!selectedStudentToEnroll}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Assign
            </Button>
          </div>

          {classStudents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No students enrolled in this class yet. Select a student above to assign them.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {classStudents.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{s.last_name}, {s.first_name}</span>
                    <span className="ml-2 font-mono text-[11px] text-brand-700 dark:text-brand-400 font-bold">#{s.student_number}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{s.email || 'No email'}</span>
                    <button
                      onClick={() => handleUnenrollStudent(s.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="Remove from class"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
