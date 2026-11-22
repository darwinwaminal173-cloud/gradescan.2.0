-- ==============================================================================
-- GradeScan: Supabase Security Audit & Database Hardening Migration
-- Idempotent & Non-Destructive: Preserves all existing tables, rows, and relationships
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. UUID EXTENSION
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 2. PROFILE SECURITY & SEARCH_PATH HARDENING
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Idempotent policy refresh for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile" 
    ON public.profiles FOR DELETE 
    USING (auth.uid() = id);

-- Secure Profile Auto-Creation Trigger with Explicit search_path
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
-- 3. CLASS_STUDENTS CROSS-OWNERSHIP & PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.class_students ENABLE ROW LEVEL SECURITY;

-- Foreign key lookup indexes to prevent full table scans
CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON public.class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON public.class_students(student_id);

-- Enforce that educator must own BOTH the class and the student to enroll
DROP POLICY IF EXISTS "Teachers can manage class enrollments" ON public.class_students;
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
-- 4. REFRESH RLS POLICIES & INDEXES ACROSS CORE TABLES
-- -----------------------------------------------------------------------------

-- CLASSES
ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
CREATE POLICY "Teachers can manage their own classes" 
    ON public.classes FOR ALL 
    USING (auth.uid() = teacher_id) 
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);

-- STUDENTS
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage their own students" ON public.students;
CREATE POLICY "Teachers can manage their own students" 
    ON public.students FOR ALL 
    USING (auth.uid() = teacher_id) 
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON public.students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_student_number ON public.students(student_number);

-- QUIZZES
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage their own quizzes" ON public.quizzes;
CREATE POLICY "Teachers can manage their own quizzes" 
    ON public.quizzes FOR ALL 
    USING (auth.uid() = teacher_id) 
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_teacher_id ON public.quizzes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON public.quizzes(class_id);

-- ANSWER KEYS
ALTER TABLE IF EXISTS public.answer_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage answer keys for their quizzes" ON public.answer_keys;
CREATE POLICY "Teachers can manage answer keys for their quizzes" 
    ON public.answer_keys FOR ALL
    USING (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = answer_keys.quiz_id AND quizzes.teacher_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = answer_keys.quiz_id AND quizzes.teacher_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_answer_keys_quiz_id ON public.answer_keys(quiz_id);

-- EXAM RESULTS
ALTER TABLE IF EXISTS public.exam_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage their exam results" ON public.exam_results;
CREATE POLICY "Teachers can manage their exam results" 
    ON public.exam_results FOR ALL 
    USING (auth.uid() = teacher_id) 
    WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_exam_results_quiz_id ON public.exam_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_id ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_teacher_id ON public.exam_results(teacher_id);

-- EXAM ANSWERS
ALTER TABLE IF EXISTS public.exam_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage exam answers" ON public.exam_answers;
CREATE POLICY "Teachers can manage exam answers" 
    ON public.exam_answers FOR ALL
    USING (EXISTS (SELECT 1 FROM public.exam_results WHERE exam_results.id = exam_answers.result_id AND exam_results.teacher_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.exam_results WHERE exam_results.id = exam_answers.result_id AND exam_results.teacher_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_exam_answers_result_id ON public.exam_answers(result_id);

-- -----------------------------------------------------------------------------
-- 5. SECURE COMPATIBILITY VIEWS (security_invoker = true)
-- Dropped and recreated to ensure complete column alignment without column-mismatch errors
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.questions;
CREATE VIEW public.questions WITH (security_invoker = true) AS
SELECT id, quiz_id, question_number, correct_option, points, is_bonus, is_excluded, explanation, created_at 
FROM public.answer_keys;

DROP VIEW IF EXISTS public.scan_results;
CREATE VIEW public.scan_results WITH (security_invoker = true) AS 
SELECT * FROM public.exam_results;

DROP VIEW IF EXISTS public.student_answers;
CREATE VIEW public.student_answers WITH (security_invoker = true) AS 
SELECT * FROM public.exam_answers;

-- -----------------------------------------------------------------------------
-- 6. TIMESTAMP FUNCTION HARDENING
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
-- 7. STORAGE BUCKETS & FULL CRUD POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('scanned-answer-sheets', 'scanned-answer-sheets', false),
    ('answer-sheet-templates', 'answer-sheet-templates', true),
    ('generated-reports', 'generated-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies: Upload (INSERT), Access (SELECT), Update (UPDATE), Delete (DELETE)
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

-- Public template access for printable answer sheet downloads
DROP POLICY IF EXISTS "Public Template Access" ON storage.objects;
CREATE POLICY "Public Template Access" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'answer-sheet-templates');
