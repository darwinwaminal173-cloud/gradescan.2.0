# SMARTGRADE - Comprehensive Project Plan & Architecture Specification
**Production-Ready ZipGrade-Inspired OMR Scanning and Grading Web Application**

---

## 1. Executive Overview & System Architecture

**SMARTGRADE** is an Optical Mark Recognition (OMR) examination platform designed for educators, institutions, and test administrators. It solves the critical bottleneck of grading printed assessments by turning standard smartphone or webcam cameras into high-speed, high-accuracy OMR scanners.

### Core Architecture Flow
```
Teacher Dashboard
   ├── 1. Class & Student Management (Roster, IDs, Sections, Import/Export)
   ├── 2. Quiz Configuration (Questions, Keys, Points, Bonus/Exclude Rules)
   ├── 3. OMR Sheet Generator (20/30/50/60/80/100/120 Qs, 4/5 options, QR, Alignment Marks)
   ├── 4. Live Camera / Image Upload OMR Scanner (OpenCV.js, Perspective Warp, Bubble Darkness Sampling)
   ├── 5. Verification & Review UI (Confidence flags, Multiple-mark warning, Student matching)
   ├── 6. Grading Engine (Score calculation, pass/fail, weighted scoring)
   └── 7. Analytics & Reporting (Item analysis, score distributions, student mastery, CSV/PDF export)
```

---

## 2. Technical Stack Specifications

| Layer | Technologies | Role / Justification |
|---|---|---|
| **Frontend Framework** | React 18 / Vite / TypeScript | High performance, strict type safety, fast HMR |
| **Styling & UI Components** | Tailwind CSS, Lucide React, Radix UI primitives | Modern, responsive, accessible, dark mode support |
| **State & Data Fetching** | TanStack Query (React Query) v5 | Robust caching, optimistic updates, background sync |
| **Form Management** | React Hook Form + Zod | Schema-validated input for students, quizzes, answer keys |
| **Computer Vision Engine** | OpenCV.js + Canvas API | Client-side real-time sheet detection, perspective warp, bubble density analysis |
| **Document Generation** | jsPDF + html2canvas / SVG Engine | High-precision vector printable OMR answer sheets & score reports |
| **Data Analytics** | Recharts | Interactive visualizations (bell curve, question difficulty, class comparisons) |
| **Backend & Storage** | Supabase (PostgreSQL + Auth + Storage + RLS) | Secure authentication, multi-tenant relational persistence, scanned paper archive |

---

## 3. Database Architecture (Supabase PostgreSQL)

### Entity-Relationship Schema

```
profiles (Teachers / Admins)
   ├── classes (id, teacher_id, name, subject, academic_year, created_at)
   │     └── class_students (class_id, student_id)
   │           └── students (id, teacher_id, student_number, first_name, last_name, email, grade_level)
   │
   └── quizzes (id, teacher_id, class_id, title, description, exam_date, total_questions, options_per_question, passing_percentage)
         ├── questions (id, quiz_id, question_number, points, is_bonus, is_excluded)
         ├── answer_keys (id, quiz_id, question_number, correct_option)
         └── exam_results (id, quiz_id, student_id, scanned_sheet_url, total_score, max_score, percentage, passed, scanned_at)
               └── exam_answers (id, result_id, question_number, marked_option, is_correct, confidence_score)
```

### Table Definitions & Constraints
1. **profiles**: Linked to `auth.users`, stores teacher full name, school, subscription/role.
2. **classes**: Classroom definitions owned by a teacher (`teacher_id` foreign key).
3. **students**: Students belonging to a teacher's account with unique `student_number` (supports 4 to 6 digit IDs for OMR bubbling).
4. **class_students**: Many-to-many relationship linking students to classes.
5. **quizzes**: Metadata for exams (sheet template type: 20, 30, 50, 60, 100 questions; options: 4 [A-D] or 5 [A-E]).
6. **questions & answer_keys**: Supports single or multiple correct answers, point weighting, bonus points, or exclusion from grading.
7. **exam_results & exam_answers**: Stores raw scan data, image snapshots, detected bubble responses, confidence scores, and calculated grades.
8. **Row Level Security (RLS)**: Enforced across every table so teachers can only read/write records where `teacher_id = auth.uid()`.

---

## 4. OMR Computer Vision & Scanning Pipeline

The browser-based OMR pipeline uses **OpenCV.js** directly on HTML5 video frames and high-resolution snapshots:

```
[Camera Feed / File Upload]
           │
           ▼
[1. Preprocessing]
   • Grayscale conversion (cv.cvtColor)
   • Gaussian Blur for noise removal (cv.GaussianBlur)
   • Adaptive / Otsu Thresholding (cv.threshold / cv.adaptiveThreshold)
           │
           ▼
[2. Alignment & Corner Detection]
   • 4 high-contrast outer corner fiducial markers (Square target boxes)
   • Contour detection (cv.findContours) & convex quad extraction
   • Corner sorting: Top-Left, Top-Right, Bottom-Right, Bottom-Left
           │
           ▼
[3. Perspective Rectification]
   • Four-point Perspective Warp (cv.getPerspectiveTransform + cv.warpPerspective)
   • Normalized canonical size (e.g., 1200 x 1700 px at 150 DPI)
           │
           ▼
[4. ROI & Bubble Grid Sampling]
   • Student ID Grid: 5 columns x 10 rows (Digits 0-9)
   • Question Bubble Matrix: Rows 1..N with columns A, B, C, D, (E)
   • Per-bubble pixel density ratio: (Dark pixels inside bubble circle / Total inner area)
           │
           ▼
[5. Decision Logic & Signal Processing]
   • Baseline background luminance calibration
   • Marked: Ratio > Dynamic Threshold (e.g. > 38% fill)
   • Blank: Ratio < 15% fill
   • Multiple marks: Flag for manual review
   • Confidence metric: Margin between selected bubble and nearest competitor
           │
           ▼
[6. Review & Grading Verification]
   • Real-time visual overlay on camera preview
   • Instant grading against Answer Key
   • Teacher review screen with quick tap-to-correct interface
   • Save to Supabase (Record + Optional image to Storage)
```

---

## 5. Answer Sheet Generator System

The system generates standard printable vector PDFs and high-contrast SVG sheets with:
1. **Four Optical Registration Targets**: Standardized black squares positioned at identical relative coordinates $(x_i, y_i)$.
2. **Metadata Header**: Name, Date, Class, Exam Title, Instructions.
3. **Student ID Bubble Matrix**: Multi-column digit selector allowing student identification directly from scan.
4. **Question Grid Layouts**:
   - 20 Questions (Compact single page, large bubbles)
   - 30 / 50 Questions (2-column layout)
   - 60 / 100 Questions (3-column layout)
5. **QR Code / Barcode**: Contains unique `quiz_id` and sheet configuration for auto-detecting the exam without manual selection.

---

## 6. Implementation Checklist & Roadmap

- [x] Phase 1: Planning, Architecture Specification & Schema Design
- [ ] Phase 2: Environment Setup, Vite React TypeScript scaffolding, Tailwind & Component Library
- [ ] Phase 3: Supabase Client, Auth Context, Database Migrations & Offline/Demo Resilience
- [ ] Phase 4: Core Management Modules (Students, Classes, Quizzes, Answer Keys)
- [ ] Phase 5: Answer Sheet Generator (Printable Vector/PDF, Multiple Layouts, Alignment Markers, QR Code)
- [ ] Phase 6: OpenCV.js OMR Scanner Engine (Live Camera, File Upload, Warp Perspective, Bubble Detection)
- [ ] Phase 7: Grading Engine, Review UI, Manual Entry & Supabase Persistence
- [ ] Phase 8: Reports, Analytics Dashboard (Recharts), Item Analysis & CSV/PDF Export
- [ ] Phase 9: End-to-End Verification, UI Polish, Dark Mode & User Documentation
