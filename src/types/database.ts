// Database and Domain Types for SMARTGRADE

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  school_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassRoom {
  id: string;
  teacher_id: string;
  name: string;
  section: string | null;
  subject: string | null;
  academic_year: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined fields
  student_count?: number;
}

export interface Student {
  id: string;
  teacher_id: string;
  student_number: string; // 4 to 6 digit ID matching OMR bubble grid
  first_name: string;
  last_name: string;
  email: string | null;
  grade_level: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined fields
  classes?: ClassRoom[];
}

export interface ClassStudent {
  id: string;
  class_id: string;
  student_id: string;
  enrolled_at: string;
}

export type SheetTemplateType = 
  | 'standard_20'
  | 'standard_30'
  | 'standard_50'
  | 'standard_60'
  | 'standard_80'
  | 'standard_100'
  | 'standard_120';

export interface Quiz {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  exam_date: string;
  total_questions: number;
  options_per_question: 4 | 5 | 2; // 4: A-D, 5: A-E, 2: T/F
  default_points_per_question: number;
  passing_percentage: number;
  sheet_template: SheetTemplateType;
  created_at: string;
  updated_at: string;
  // Joined fields
  class_name?: string;
  answer_keys?: AnswerKey[];
  results_count?: number;
  average_score?: number;
}

export interface AnswerKey {
  id: string;
  quiz_id: string;
  question_number: number;
  correct_options: string[]; // e.g., ['A'] or ['B', 'C'] for multiple correct
  points: number;
  is_bonus: boolean;
  is_excluded: boolean;
  explanation: string | null;
  created_at?: string;
}

export interface ExamResult {
  id: string;
  quiz_id: string;
  student_id: string | null;
  teacher_id: string;
  raw_student_number: string | null;
  scanned_image_url: string | null;
  total_score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  passed: boolean;
  scan_confidence: number;
  needs_review: boolean;
  scanned_at: string;
  updated_at: string;
  // Joined fields
  student?: Student;
  quiz?: Quiz;
  answers?: ExamAnswer[];
}

export interface ExamAnswer {
  id: string;
  result_id: string;
  question_number: number;
  marked_options: string[]; // ['A'] or ['B'] or ['A', 'C']
  correct_options: string[];
  is_correct: boolean;
  points_awarded: number;
  confidence: number;
  is_blank: boolean;
  is_multiple: boolean;
  created_at?: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  totalQuizzes: number;
  totalScans: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passingRate: number;
}
