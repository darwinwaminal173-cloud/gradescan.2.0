-- ==============================================================================
-- GradeScan: Supabase PostgreSQL Schema Migration & Security Policies
-- Production-Ready OMR Scanning & Examination Management Database
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROFILES (Teacher / Educator Account Metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    school_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

-- Automatic Profile Creation Trigger for Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, school_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'school_name'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        school_name = COALESCE(EXCLUDED.school_name, public.profiles.school_name);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Note: Functions returning TRIGGER cannot be called directly via SQL or PostgREST RPC in PostgreSQL.
-- Pinned search_path prevents search-path hijacking during trigger execution.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. CLASSES (Courses, Grade Levels, and Sections)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    section TEXT,
    subject TEXT,
    academic_year TEXT DEFAULT '2025-2026',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own classes"
    ON public.classes FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);

-- -----------------------------------------------------------------------------
-- 3. STUDENTS (Student Records with 5-digit OMR / LRN Identifiers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_number TEXT NOT NULL, -- 4 to 6 digit code for OMR bubble grid / LRN
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    grade_level TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, student_number)
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own students"
    ON public.students FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON public.students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_student_number ON public.students(student_number);

-- -----------------------------------------------------------------------------
-- 4. CLASS_STUDENTS (Junction Table: Many-to-Many Enrollment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON public.class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON public.class_students(student_id);

CREATE POLICY "Teachers can manage class enrollments"
    ON public.class_students FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.classes
            WHERE classes.id = class_students.class_id
            AND classes.teacher_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 FROM public.students
            WHERE students.id = class_students.student_id
            AND students.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.classes
            WHERE classes.id = class_students.class_id
            AND classes.teacher_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 FROM public.students
            WHERE students.id = class_students.student_id
            AND students.teacher_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 5. QUIZZES (Examination Metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    exam_date DATE DEFAULT CURRENT_DATE,
    total_questions INTEGER NOT NULL CHECK (total_questions > 0),
    options_per_question INTEGER NOT NULL DEFAULT 4 CHECK (options_per_question IN (2, 4, 5)),
    default_points_per_question NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    passing_percentage NUMERIC(5,2) NOT NULL DEFAULT 60.0,
    sheet_template TEXT NOT NULL DEFAULT 'standard_20', -- standard_20, standard_50, standard_100
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own quizzes"
    ON public.quizzes FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_teacher_id ON public.quizzes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON public.quizzes(class_id);

-- -----------------------------------------------------------------------------
-- 6. ANSWER_KEYS & QUESTIONS (Correct Answer Bubbles and Question Rules)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.answer_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL CHECK (question_number > 0),
    correct_options TEXT[] NOT NULL DEFAULT '{}', -- Supports ['A'], ['B'], ['C'], ['D']
    points NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    is_bonus BOOLEAN NOT NULL DEFAULT FALSE,
    is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, question_number)
);

ALTER TABLE public.answer_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage answer keys for their quizzes"
    ON public.answer_keys FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes
            WHERE quizzes.id = answer_keys.quiz_id
            AND quizzes.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quizzes
            WHERE quizzes.id = answer_keys.quiz_id
            AND quizzes.teacher_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_answer_keys_quiz_id ON public.answer_keys(quiz_id);

-- Optional compatibility alias view for questions
DROP VIEW IF EXISTS public.questions;
CREATE VIEW public.questions WITH (security_invoker = true) AS
SELECT id, quiz_id, question_number, correct_option, points, is_bonus, is_excluded, explanation, created_at
FROM public.answer_keys;

-- -----------------------------------------------------------------------------
-- 7. EXAM_RESULTS / SCAN_RESULTS (Scanned Exam Outcomes & Calculated Scores)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_student_number TEXT, -- Extracted from OMR or manual input
    scanned_image_url TEXT,
    total_score NUMERIC(7,2) NOT NULL DEFAULT 0,
    max_score NUMERIC(7,2) NOT NULL DEFAULT 0,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    scan_confidence NUMERIC(5,2) DEFAULT 100.0,
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their exam results"
    ON public.exam_results FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_exam_results_quiz_id ON public.exam_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_id ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_teacher_id ON public.exam_results(teacher_id);

-- Compatibility view for scan_results
DROP VIEW IF EXISTS public.scan_results;
CREATE VIEW public.scan_results WITH (security_invoker = true) AS SELECT * FROM public.exam_results;

-- -----------------------------------------------------------------------------
-- 8. EXAM_ANSWERS / STUDENT_ANSWERS (Item-by-Item Student Bubble Responses)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES public.exam_results(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    marked_options TEXT[] NOT NULL DEFAULT '{}', -- Options bubbled, e.g. ['A'], ['B']
    correct_options TEXT[] NOT NULL DEFAULT '{}',
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    points_awarded NUMERIC(5,2) NOT NULL DEFAULT 0,
    confidence NUMERIC(5,2) DEFAULT 1.0,
    is_blank BOOLEAN NOT NULL DEFAULT FALSE,
    is_multiple BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage exam answers"
    ON public.exam_answers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_results
            WHERE exam_results.id = exam_answers.result_id
            AND exam_results.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_results
            WHERE exam_results.id = exam_answers.result_id
            AND exam_results.teacher_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_exam_answers_result_id ON public.exam_answers(result_id);

-- Compatibility view for student_answers
DROP VIEW IF EXISTS public.student_answers;
CREATE VIEW public.student_answers WITH (security_invoker = true) AS SELECT * FROM public.exam_answers;

-- -----------------------------------------------------------------------------
-- 9. AUTOMATIC TIMESTAMP TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_classes_updated_at ON public.classes;
CREATE TRIGGER tr_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_students_updated_at ON public.students;
CREATE TRIGGER tr_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER tr_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_exam_results_updated_at ON public.exam_results;
CREATE TRIGGER tr_exam_results_updated_at BEFORE UPDATE ON public.exam_results FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 10. STORAGE BUCKETS (Scanned Papers and Report Archive)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('scanned-answer-sheets', 'scanned-answer-sheets', false),
    ('answer-sheet-templates', 'answer-sheet-templates', true),
    ('generated-reports', 'generated-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Teacher Authenticated Upload" ON storage.objects;
CREATE POLICY "Teacher Authenticated Upload" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
    bucket_id IN ('scanned-answer-sheets', 'generated-reports') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teacher Authenticated Access" ON storage.objects;
CREATE POLICY "Teacher Authenticated Access" 
ON storage.objects FOR SELECT TO authenticated 
USING (
    bucket_id IN ('scanned-answer-sheets', 'generated-reports') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teacher Authenticated Update" ON storage.objects;
CREATE POLICY "Teacher Authenticated Update" 
ON storage.objects FOR UPDATE TO authenticated 
USING (
    bucket_id IN ('scanned-answer-sheets', 'generated-reports') 
    AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id IN ('scanned-answer-sheets', 'generated-reports') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teacher Authenticated Delete" ON storage.objects;
CREATE POLICY "Teacher Authenticated Delete" 
ON storage.objects FOR DELETE TO authenticated 
USING (
    bucket_id IN ('scanned-answer-sheets', 'generated-reports') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public Template Access" ON storage.objects;
CREATE POLICY "Public Template Access" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'answer-sheet-templates');