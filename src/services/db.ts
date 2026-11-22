// ==============================================================================
// SMARTGRADE - Database Access & Supabase Relational Service
// ==============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { offlineSync } from './offlineSync';
import { 
  ClassRoom, 
  Student, 
  Quiz, 
  AnswerKey, 
  ExamResult, 
  ExamAnswer, 
  DashboardStats,
  Profile 
} from '@/types/database';

// Helper to retrieve current authenticated user id
export async function getAuthUserId(): Promise<string> {
  // Check Supabase session first if configured
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) return session.user.id;
    } catch (e) {
      console.warn('Supabase getSession error:', e);
    }
  }
  // Check active local user session
  try {
    const savedUser = localStorage.getItem('gradescan_local_user') || localStorage.getItem('smartgrade_local_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed?.user?.id) return parsed.user.id;
      if (parsed?.id) return parsed.id;
    }
  } catch (e) {
    console.warn('Local session read error:', e);
  }
  return 'default-teacher';
}

// -----------------------------------------------------------------------------
// LOCAL STORAGE PERSISTENCE ENGINE (Fallback / Zero-Config Playground)
// -----------------------------------------------------------------------------
const STORAGE_PREFIX = 'gradescan_db_';
const LEGACY_STORAGE_PREFIX = 'smartgrade_db_';

function getStored<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key) || localStorage.getItem(LEGACY_STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    console.error('Failed reading localStorage', e);
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('Failed saving localStorage', e);
  }
}

// Initial Seed Data for immediate testing
const INITIAL_CLASSES: ClassRoom[] = [
  {
    id: 'c1',
    teacher_id: 'default-teacher',
    name: 'Grade 10 - Science & Physics',
    section: 'Section Alpha',
    subject: 'Physics',
    academic_year: '2025-2026',
    description: 'Mechanics, Optics, and Thermodynamics',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    student_count: 5,
  },
  {
    id: 'c2',
    teacher_id: 'default-teacher',
    name: 'Grade 11 - Advanced Mathematics',
    section: 'Section Euler',
    subject: 'Calculus',
    academic_year: '2025-2026',
    description: 'Derivatives, Integrals, and Vector Spaces',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    student_count: 5,
  },
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1',
    teacher_id: 'default-teacher',
    student_number: '10001',
    first_name: 'Alexander',
    last_name: 'Wright',
    email: 'alexander.wright@student.edu',
    grade_level: 'Grade 10',
    notes: 'Honor roll student',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's2',
    teacher_id: 'default-teacher',
    student_number: '10002',
    first_name: 'Sophia',
    last_name: 'Chen',
    email: 'sophia.chen@student.edu',
    grade_level: 'Grade 10',
    notes: 'Excels in lab assessments',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's3',
    teacher_id: 'default-teacher',
    student_number: '10003',
    first_name: 'Marcus',
    last_name: 'Johnson',
    email: 'marcus.j@student.edu',
    grade_level: 'Grade 10',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's4',
    teacher_id: 'default-teacher',
    student_number: '10004',
    first_name: 'Emily',
    last_name: 'Davis',
    email: 'emily.davis@student.edu',
    grade_level: 'Grade 10',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's5',
    teacher_id: 'default-teacher',
    student_number: '10005',
    first_name: 'Lucas',
    last_name: 'Miller',
    email: 'lucas.miller@student.edu',
    grade_level: 'Grade 10',
    notes: 'Needs extra review on thermodynamics',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_CLASS_STUDENTS = [
  { id: 'cs1', class_id: 'c1', student_id: 's1', enrolled_at: new Date().toISOString() },
  { id: 'cs2', class_id: 'c1', student_id: 's2', enrolled_at: new Date().toISOString() },
  { id: 'cs3', class_id: 'c1', student_id: 's3', enrolled_at: new Date().toISOString() },
  { id: 'cs4', class_id: 'c1', student_id: 's4', enrolled_at: new Date().toISOString() },
  { id: 'cs5', class_id: 'c1', student_id: 's5', enrolled_at: new Date().toISOString() },
  { id: 'cs6', class_id: 'c2', student_id: 's1', enrolled_at: new Date().toISOString() },
  { id: 'cs7', class_id: 'c2', student_id: 's2', enrolled_at: new Date().toISOString() },
];

const INITIAL_QUIZ: Quiz = {
  id: 'q1',
  teacher_id: 'default-teacher',
  class_id: 'c1',
  title: 'Midterm Physics Assessment - Wave & Light Mechanics',
  description: 'Comprehensive multiple-choice exam covering geometric optics and wave theory.',
  exam_date: new Date().toISOString().split('T')[0],
  total_questions: 20,
  options_per_question: 4,
  default_points_per_question: 1.0,
  passing_percentage: 60,
  sheet_template: 'standard_20',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const INITIAL_ANSWER_KEYS: AnswerKey[] = [
  { id: 'ak1', quiz_id: 'q1', question_number: 1, correct_options: ['A'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak2', quiz_id: 'q1', question_number: 2, correct_options: ['C'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak3', quiz_id: 'q1', question_number: 3, correct_options: ['B'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak4', quiz_id: 'q1', question_number: 4, correct_options: ['D'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak5', quiz_id: 'q1', question_number: 5, correct_options: ['A'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak6', quiz_id: 'q1', question_number: 6, correct_options: ['B'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak7', quiz_id: 'q1', question_number: 7, correct_options: ['C'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak8', quiz_id: 'q1', question_number: 8, correct_options: ['A'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak9', quiz_id: 'q1', question_number: 9, correct_options: ['D'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak10', quiz_id: 'q1', question_number: 10, correct_options: ['B'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak11', quiz_id: 'q1', question_number: 11, correct_options: ['C'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak12', quiz_id: 'q1', question_number: 12, correct_options: ['A'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak13', quiz_id: 'q1', question_number: 13, correct_options: ['D'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak14', quiz_id: 'q1', question_number: 14, correct_options: ['C'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak15', quiz_id: 'q1', question_number: 15, correct_options: ['B'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak16', quiz_id: 'q1', question_number: 16, correct_options: ['A'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak17', quiz_id: 'q1', question_number: 17, correct_options: ['C'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak18', quiz_id: 'q1', question_number: 18, correct_options: ['D'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak19', quiz_id: 'q1', question_number: 19, correct_options: ['B'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
  { id: 'ak20', quiz_id: 'q1', question_number: 20, correct_options: ['A'], points: 1, is_bonus: false, is_excluded: false, explanation: null },
];

export const db = {
  // ---------------------------------------------------------------------------
  // CLASSES
  // ---------------------------------------------------------------------------
  async getClasses(overrideTeacherId?: string): Promise<ClassRoom[]> {
    if (isSupabaseConfigured) {
      try {
        const teacherId = overrideTeacherId || await getAuthUserId();
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          // get student counts
          return data;
        }
        if (error && error.code === '42P01') {
          console.warn('Classes table does not exist in Supabase yet. Please run migration.');
        }
      } catch (e) {
        console.warn('Supabase getClasses error:', e);
      }
    }

    const teacherId = overrideTeacherId || await getAuthUserId();
    const classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);
    const enrollments = getStored<{ class_id: string }[]>('class_students', INITIAL_CLASS_STUDENTS);
    const userClasses = teacherId === 'default-teacher' ? classes : classes.filter(c => c.teacher_id === teacherId);
    return userClasses.map(c => ({
      ...c,
      student_count: enrollments.filter(e => e.class_id === c.id).length
    }));
  },

  async createClass(c: Omit<ClassRoom, 'id' | 'created_at' | 'updated_at' | 'teacher_id'> & { teacher_id?: string }): Promise<ClassRoom> {
    const teacherId = c.teacher_id || await getAuthUserId();
    const classPayload = {
      ...c,
      section: c.section && c.section.trim() !== '' ? c.section.trim() : null,
      subject: c.subject && c.subject.trim() !== '' ? c.subject.trim() : null,
      description: c.description && c.description.trim() !== '' ? c.description.trim() : null,
      teacher_id: teacherId,
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('classes').insert([classPayload]).select().single();
        if (!error && data) return data;
        if (error) console.warn('Supabase createClass note:', error.message);
      } catch (e) {
        console.warn('Supabase createClass exception:', e);
      }
    }

    const classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);
    const newClass: ClassRoom = {
      ...classPayload,
      id: 'c_' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      student_count: 0
    };
    classes.unshift(newClass);
    setStored('classes', classes);
    return newClass;
  },

  async updateClass(id: string, updates: Partial<ClassRoom>): Promise<ClassRoom> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('classes').update(updates).eq('id', id).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase updateClass note:', e);
      }
    }

    const classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);
    const idx = classes.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Class not found');
    classes[idx] = { ...classes[idx], ...updates, updated_at: new Date().toISOString() };
    setStored('classes', classes);
    return classes[idx];
  },

  async deleteClass(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (!error) return;
      } catch (e) {
        console.warn('Supabase deleteClass note:', e);
      }
    }

    let classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);
    classes = classes.filter(c => c.id !== id);
    setStored('classes', classes);
  },

  // ---------------------------------------------------------------------------
  // STUDENTS
  // ---------------------------------------------------------------------------
  async getStudents(overrideTeacherId?: string, classId?: string): Promise<Student[]> {
    if (isSupabaseConfigured) {
      try {
        const teacherId = overrideTeacherId || await getAuthUserId();
        let query = supabase.from('students').select('*').eq('teacher_id', teacherId);
        if (classId) {
          const { data: junction } = await supabase.from('class_students').select('student_id').eq('class_id', classId);
          const ids = junction?.map(j => j.student_id) || [];
          query = query.in('id', ids);
        }
        const { data, error } = await query.order('last_name', { ascending: true });
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase getStudents note:', e);
      }
    }

    const teacherId = overrideTeacherId || await getAuthUserId();
    const students = getStored<Student[]>('students', INITIAL_STUDENTS);
    const junction = getStored<{ class_id: string; student_id: string }[]>('class_students', INITIAL_CLASS_STUDENTS);
    const classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);

    let filtered = teacherId === 'default-teacher' ? students : students.filter(s => s.teacher_id === teacherId);
    if (classId) {
      const studentIdsInClass = junction.filter(j => j.class_id === classId).map(j => j.student_id);
      filtered = filtered.filter(s => studentIdsInClass.includes(s.id));
    }

    return filtered.map(s => {
      const studentClassIds = junction.filter(j => j.student_id === s.id).map(j => j.class_id);
      const studentClasses = classes.filter(c => studentClassIds.includes(c.id));
      return { ...s, classes: studentClasses };
    });
  },

  async createStudent(s: Omit<Student, 'id' | 'created_at' | 'updated_at' | 'teacher_id'> & { teacher_id?: string }, classId?: string): Promise<Student> {
    const teacherId = s.teacher_id || await getAuthUserId();
    const validClassId = classId && classId.trim() !== '' ? classId : undefined;
    const studentPayload = { ...s, teacher_id: teacherId };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('students').insert([studentPayload]).select().single();
        if (!error && data) {
          if (validClassId) {
            await supabase.from('class_students').insert([{ class_id: validClassId, student_id: data.id }]);
          }
          return data;
        }
      } catch (e) {
        console.warn('Supabase createStudent note:', e);
      }
    }

    const students = getStored<Student[]>('students', INITIAL_STUDENTS);
    const newStudent: Student = {
      ...studentPayload,
      id: 's_' + Date.now() + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    students.unshift(newStudent);
    setStored('students', students);

    if (validClassId) {
      const junction = getStored<{ class_id: string; student_id: string; enrolled_at: string; id: string }[]>('class_students', INITIAL_CLASS_STUDENTS);
      junction.push({
        id: 'cs_' + Date.now(),
        class_id: validClassId,
        student_id: newStudent.id,
        enrolled_at: new Date().toISOString()
      });
      setStored('class_students', junction);
    }

    return newStudent;
  },

  async bulkCreateStudents(studentsList: Array<Omit<Student, 'id' | 'created_at' | 'updated_at'>>, classId?: string): Promise<number> {
    let created = 0;
    for (const item of studentsList) {
      await this.createStudent(item, classId);
      created++;
    }
    return created;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase updateStudent note:', e);
      }
    }

    const students = getStored<Student[]>('students', INITIAL_STUDENTS);
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Student not found');
    students[idx] = { ...students[idx], ...updates, updated_at: new Date().toISOString() };
    setStored('students', students);
    return students[idx];
  },

  async deleteStudent(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) return;
      } catch (e) {
        console.warn('Supabase deleteStudent note:', e);
      }
    }

    let students = getStored<Student[]>('students', INITIAL_STUDENTS);
    students = students.filter(s => s.id !== id);
    setStored('students', students);
  },

  async enrollStudent(classId: string, studentId: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('class_students').upsert([{ class_id: classId, student_id: studentId }], { onConflict: 'class_id,student_id' });
        return;
      } catch (e) {
        console.warn('Supabase enrollStudent note:', e);
      }
    }
    const junction = getStored<{ id: string; class_id: string; student_id: string; enrolled_at: string }[]>('class_students', INITIAL_CLASS_STUDENTS);
    if (!junction.some(j => j.class_id === classId && j.student_id === studentId)) {
      junction.push({
        id: 'cs_' + Date.now(),
        class_id: classId,
        student_id: studentId,
        enrolled_at: new Date().toISOString()
      });
      setStored('class_students', junction);
    }
  },

  async unenrollStudent(classId: string, studentId: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('class_students').delete().match({ class_id: classId, student_id: studentId });
        return;
      } catch (e) {
        console.warn('Supabase unenrollStudent note:', e);
      }
    }
    let junction = getStored<{ id: string; class_id: string; student_id: string; enrolled_at: string }[]>('class_students', INITIAL_CLASS_STUDENTS);
    junction = junction.filter(j => !(j.class_id === classId && j.student_id === studentId));
    setStored('class_students', junction);
  },

  // ---------------------------------------------------------------------------
  // QUIZZES
  // ---------------------------------------------------------------------------
  async getQuizzes(overrideTeacherId?: string): Promise<Quiz[]> {
    if (isSupabaseConfigured) {
      try {
        const teacherId = overrideTeacherId || await getAuthUserId();
        const { data, error } = await supabase
          .from('quizzes')
          .select(`
            *,
            classes ( name )
          `)
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((q: any) => ({
            ...q,
            class_name: q.classes?.name,
          }));
        }
      } catch (e) {
        console.warn('Supabase getQuizzes note:', e);
      }
    }

    const teacherId = overrideTeacherId || await getAuthUserId();
    const quizzes = getStored<Quiz[]>('quizzes', [INITIAL_QUIZ]);
    const classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);
    const results = getStored<ExamResult[]>('exam_results', []);

    const userQuizzes = teacherId === 'default-teacher' ? quizzes : quizzes.filter(q => q.teacher_id === teacherId);

    return userQuizzes.map(q => {
      const cls = classes.find(c => c.id === q.class_id);
      const quizResults = results.filter(r => r.quiz_id === q.id);
      const avg = quizResults.length > 0
        ? quizResults.reduce((acc, cur) => acc + cur.percentage, 0) / quizResults.length
        : 0;
      return {
        ...q,
        class_name: cls?.name,
        results_count: quizResults.length,
        average_score: Math.round(avg * 10) / 10,
      };
    });
  },

  async getQuizById(id: string): Promise<Quiz | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('quizzes')
          .select('*, classes ( name )')
          .eq('id', id)
          .single();
        if (!error && data) {
          return { ...data, class_name: data.classes?.name };
        }
      } catch (e) {
        console.warn('Supabase getQuizById note:', e);
      }
    }

    const quizzes = getStored<Quiz[]>('quizzes', [INITIAL_QUIZ]);
    const quiz = quizzes.find(q => q.id === id);
    if (!quiz) return null;
    const classes = getStored<ClassRoom[]>('classes', INITIAL_CLASSES);
    const cls = classes.find(c => c.id === quiz.class_id);
    return { ...quiz, class_name: cls?.name };
  },

  async createQuiz(
    quizData: Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'teacher_id'> & { teacher_id?: string }, 
    answerKeys?: Partial<AnswerKey>[]
  ): Promise<Quiz> {
    const teacherId = quizData.teacher_id || await getAuthUserId();
    const cleanClassId = quizData.class_id && quizData.class_id.trim() !== '' ? quizData.class_id : null;
    const payload = { ...quizData, class_id: cleanClassId, teacher_id: teacherId };

    if (isSupabaseConfigured) {
      try {
        const { data: newQuiz, error } = await supabase.from('quizzes').insert([payload]).select().single();
        if (!error && newQuiz) {
          if (answerKeys && answerKeys.length > 0) {
            const keysToInsert = answerKeys.map(k => ({
              quiz_id: newQuiz.id,
              question_number: k.question_number,
              correct_options: k.correct_options || ['A'],
              points: k.points || newQuiz.default_points_per_question,
              is_bonus: k.is_bonus || false,
              is_excluded: k.is_excluded || false,
            }));
            await supabase.from('answer_keys').insert(keysToInsert);
          }
          return newQuiz;
        }
      } catch (e) {
        console.warn('Supabase createQuiz note:', e);
      }
    }

    const quizzes = getStored<Quiz[]>('quizzes', [INITIAL_QUIZ]);
    const newQuiz: Quiz = {
      ...payload,
      id: 'q_' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    quizzes.unshift(newQuiz);
    setStored('quizzes', quizzes);

    const allKeys = getStored<AnswerKey[]>('answer_keys', INITIAL_ANSWER_KEYS);
    const newKeys: AnswerKey[] = [];
    for (let i = 1; i <= newQuiz.total_questions; i++) {
      const existing = answerKeys?.find(k => k.question_number === i);
      newKeys.push({
        id: 'ak_' + newQuiz.id + '_' + i,
        quiz_id: newQuiz.id,
        question_number: i,
        correct_options: existing?.correct_options || ['A'],
        points: existing?.points || newQuiz.default_points_per_question,
        is_bonus: existing?.is_bonus || false,
        is_excluded: existing?.is_excluded || false,
        explanation: null
      });
    }
    setStored('answer_keys', [...allKeys, ...newKeys]);

    return newQuiz;
  },

  async updateQuiz(id: string, updates: Partial<Quiz>): Promise<Quiz> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('quizzes').update(updates).eq('id', id).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase updateQuiz note:', e);
      }
    }

    const quizzes = getStored<Quiz[]>('quizzes', [INITIAL_QUIZ]);
    const idx = quizzes.findIndex(q => q.id === id);
    if (idx === -1) throw new Error('Quiz not found');
    quizzes[idx] = { ...quizzes[idx], ...updates, updated_at: new Date().toISOString() };
    setStored('quizzes', quizzes);
    return quizzes[idx];
  },

  async deleteQuiz(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('quizzes').delete().eq('id', id);
        if (!error) return;
      } catch (e) {
        console.warn('Supabase deleteQuiz note:', e);
      }
    }

    let quizzes = getStored<Quiz[]>('quizzes', [INITIAL_QUIZ]);
    quizzes = quizzes.filter(q => q.id !== id);
    setStored('quizzes', quizzes);
  },

  // ---------------------------------------------------------------------------
  // ANSWER KEYS
  // ---------------------------------------------------------------------------
  async getAnswerKeys(quizId: string): Promise<AnswerKey[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('answer_keys')
          .select('*')
          .eq('quiz_id', quizId)
          .order('question_number', { ascending: true });
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase getAnswerKeys note:', e);
      }
    }

    const allKeys = getStored<AnswerKey[]>('answer_keys', INITIAL_ANSWER_KEYS);
    const filtered = allKeys.filter(k => k.quiz_id === quizId).sort((a, b) => a.question_number - b.question_number);
    return filtered;
  },

  async saveAnswerKeys(quizId: string, keys: AnswerKey[]): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const cleanKeys = keys.map(k => ({
          quiz_id: quizId,
          question_number: k.question_number,
          correct_options: k.correct_options,
          points: k.points,
          is_bonus: k.is_bonus,
          is_excluded: k.is_excluded,
          explanation: k.explanation,
        }));
        const { error } = await supabase.from('answer_keys').upsert(cleanKeys, { onConflict: 'quiz_id,question_number' });
        if (!error) return;
      } catch (e) {
        console.warn('Supabase saveAnswerKeys note:', e);
      }
    }

    let allKeys = getStored<AnswerKey[]>('answer_keys', INITIAL_ANSWER_KEYS);
    allKeys = allKeys.filter(k => k.quiz_id !== quizId);
    allKeys.push(...keys);
    setStored('answer_keys', allKeys);
  },

  // ---------------------------------------------------------------------------
  // EXAM RESULTS & SCAN SESSIONS
  // ---------------------------------------------------------------------------
  async getExamResults(filters?: { quizId?: string; studentId?: string; classId?: string; teacherId?: string }): Promise<ExamResult[]> {
    const teacherId = filters?.teacherId || await getAuthUserId();
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('exam_results')
          .select(`
            *,
            students ( * ),
            quizzes ( title, passing_percentage, total_questions ),
            exam_answers ( * )
          `)
          .eq('teacher_id', teacherId)
          .order('scanned_at', { ascending: false });

        if (filters?.quizId) query = query.eq('quiz_id', filters.quizId);
        if (filters?.studentId) query = query.eq('student_id', filters.studentId);
        const { data, error } = await query;
        if (!error && data) {
          return data.map((r: any) => ({
            ...r,
            student: r.students,
            quiz: r.quizzes,
            answers: r.exam_answers,
          }));
        }
      } catch (e) {
        console.warn('Supabase getExamResults note:', e);
      }
    }

    let results = getStored<ExamResult[]>('exam_results', []);
    if (teacherId !== 'default-teacher') {
      results = results.filter(r => r.teacher_id === teacherId);
    }
    const students = getStored<Student[]>('students', INITIAL_STUDENTS);
    const quizzes = getStored<Quiz[]>('quizzes', [INITIAL_QUIZ]);
    const answers = getStored<ExamAnswer[]>('exam_answers', []);

    if (filters?.quizId) results = results.filter(r => r.quiz_id === filters.quizId);
    if (filters?.studentId) results = results.filter(r => r.student_id === filters.studentId);

    return results.map(r => ({
      ...r,
      student: students.find(s => s.id === r.student_id),
      quiz: quizzes.find(q => q.id === r.quiz_id),
      answers: answers.filter(a => a.result_id === r.id)
    }));
  },

  async saveExamResult(
    result: Omit<ExamResult, 'id' | 'scanned_at' | 'updated_at'>, 
    answers: Omit<ExamAnswer, 'id' | 'result_id'>[]
  ): Promise<ExamResult> {
    const teacherId = await getAuthUserId();
    const cleanStudentId = result.student_id && result.student_id.trim() !== '' ? result.student_id : null;
    const payload = { ...result, student_id: cleanStudentId, teacher_id: teacherId };

    const isConnected = isSupabaseConfigured && (typeof navigator === 'undefined' || navigator.onLine);

    if (isConnected) {
      try {
        const { data: res, error: resErr } = await supabase
          .from('exam_results')
          .insert([payload])
          .select()
          .single();

        if (!resErr && res) {
          const answersToInsert = answers.map(a => {
            const { id, result_id, ...cleanAns } = (a as any);
            return {
              ...cleanAns,
              result_id: res.id
            };
          });
          await supabase.from('exam_answers').insert(answersToInsert);
          return res;
        }
      } catch (e) {
        console.warn('Supabase saveExamResult note:', e);
      }
    }

    // OFFLINE STORAGE & AUTOMATIC SYNC QUEUE
    const newResult: ExamResult = {
      ...payload,
      id: 'res_' + Date.now(),
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Queue for automatic synchronization when internet returns
    offlineSync.enqueueOfflineResult(newResult, answers);

    const results = getStored<ExamResult[]>('exam_results', []);
    results.unshift(newResult);
    setStored('exam_results', results);

    const allAnswers = getStored<ExamAnswer[]>('exam_answers', []);
    const newAnswers: ExamAnswer[] = answers.map((a, i) => ({
      ...a,
      id: 'ans_' + newResult.id + '_' + i,
      result_id: newResult.id,
      created_at: new Date().toISOString()
    }));
    setStored('exam_answers', [...allAnswers, ...newAnswers]);

    return newResult;
  },

  async deleteExamResult(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('exam_results').delete().eq('id', id);
        if (!error) return;
      } catch (e) {
        console.warn('Supabase deleteExamResult note:', e);
      }
    }

    let results = getStored<ExamResult[]>('exam_results', []);
    results = results.filter(r => r.id !== id);
    setStored('exam_results', results);
  },

  // ---------------------------------------------------------------------------
  // DASHBOARD STATS
  // ---------------------------------------------------------------------------
  async getDashboardStats(overrideTeacherId?: string): Promise<DashboardStats> {
    const teacherId = overrideTeacherId || await getAuthUserId();
    const students = await this.getStudents(teacherId);
    const classes = await this.getClasses(teacherId);
    const quizzes = await this.getQuizzes(teacherId);
    const results = await this.getExamResults({ teacherId });

    const totalScans = results.length;
    const scores = results.map(r => r.percentage);
    const averageScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passingCount = results.filter(r => r.passed).length;
    const passingRate = totalScans > 0 ? Math.round((passingCount / totalScans) * 100) : 0;

    return {
      totalStudents: students.length,
      totalClasses: classes.length,
      totalQuizzes: quizzes.length,
      totalScans,
      averageScore,
      highestScore,
      lowestScore,
      passingRate
    };
  }
};
