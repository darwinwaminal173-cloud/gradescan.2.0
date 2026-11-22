# GradeScan – Online Examination Grading & OMR System

**GradeScan** is a complete, modern, responsive, browser-based examination grading system inspired by the functionality of ZipGrade, built with an original educational technology design, deep teal branding, and intuitive user experience.

> **Note:** GradeScan is a **first-class responsive website** designed for modern desktop, tablet, and mobile browsers.

---

## 🌟 1. Technology Stack

- **Frontend:** React 18 + Vite (TypeScript)
- **Styling:** Tailwind CSS (Custom Deep Teal EdTech Palette, Soft Gray Backgrounds, Subtle Shadows, Rounded Cards)
- **Icons:** Lucide React
- **Data Visualizations:** Recharts (Item Difficulty Bar Charts, Option Distribution Breakdowns, Class Average Trends)
- **Document & Vector Generation:** jsPDF + Canvas/SVG Engine (Vector-accurate 300 DPI printable answer sheets & PDF reports)
- **Computer Vision & OMR Engine:** OpenCV.js + Canvas Signal Processing (Perspective homography warp, 4-corner fiducial alignment, bubble darkness sampling, and ambient background luminance normalization)
- **Backend & Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication:** Supabase Auth (Sign up, Login, Logout, Password reset, and Persistent sessions) + Zero-Config Offline Local Sandbox Mode
- **Hosting & CI/CD:** GitHub Pages + GitHub Actions Workflow

---

## 🎨 2. Design & User Interface

- **Theme:** Modern educational technology platform
- **Primary Color:** Deep Teal (`#0f766e`, `#0d9488`, `#115e59`)
- **Backgrounds:** Clean white and soft slate/gray (`#f8fafc`, `#f1f5f9`)
- **Components:** Subtle shadows, rounded cards (`rounded-2xl`), clean typography, professional iconography, and smooth transitions
- **Responsive:** Fully optimized for mobile phones, tablets, laptops, and desktop screens

---

## 📋 3. System Modules & Capabilities

### 🔐 User Authentication
- Educator Sign Up (Name, School/Institution, Email, Password)
- Sign In with Email & Password
- **One-Click Educator Demo Access** for instantaneous zero-latency local testing
- Forgot Password & Password Reset workflows
- Protected routes & persistent user sessions
- Strict Row-Level Security ensuring each teacher accesses only their own records

### 📊 Dashboard
- Real-time stat cards: Total Students, Total Classes, Total Quizzes, Total Scanned Answer Sheets
- Performance overview: Score distribution bar chart and class performance trend
- Recent grading activity feed with score badges and timestamp
- Quick launch action buttons: Create Quiz, Print Sheets, Launch Scanner

### 👥 Student Management
- Add, edit, and delete student records
- **Student ID / LRN** (4 to 6 digits, optimized for 5-digit OMR bubble matrix)
- First Name, Last Name, Grade Level, and Section assignment
- Real-time search and class filtering
- Bulk student import via CSV or Excel (`.xlsx`)
- Export student records to CSV and Excel

### 🏫 Class Management
- Create, edit, and delete classroom cohorts
- Assign subject, section, academic year, and course descriptions
- View class roster and enrolled student records
- Track enrolled student count and performance

### 📝 Quiz Management
- Create quizzes with title, assigned class, exam date, and question count (20, 25, 30, 50, 60, 80, 100)
- Choices: **A, B, C, and D**
- Interactive Answer Key Modal:
  - Click bubble to set correct option (A, B, C, D)
  - Quick bulk tools: "Set All To A/B/C/D"
  - Custom points per question
  - Bonus question and Excluded question rules
- Duplicate existing quizzes with one click
- Track scanning history and class averages

### 📄 Answer Sheet Generator
- Generates camera-optimized printable PDF answer sheets
- Supports standard question sets (20, 25, 50, 100 questions)
- Choices: **A, B, C, and D**
- Standardized fields:
  - **Student Full Name** (print box)
  - **Student ID / LRN** (written digits box + 5-digit bubble grid)
  - **Grade Level & Section**
  - **Date & Subject**
  - Examination marking instructions
- 4 optical corner fiducial markers (black squares at exact canonical coordinates)
- Embedded QR code containing quiz identifier and metadata
- One-click Vector PDF download and direct browser print preview

### 📷 Answer Sheet Scanner (Computer Vision OMR)
- Browser camera scanning via standard WebRTC / Camera APIs (`navigator.mediaDevices.getUserMedia`)
- Mobile and desktop camera support (environment/rear camera auto-selection)
- Upload photo/image support (smartphone camera snapshots, scanned images)
- **Test Sample Sheet Feature:** Instantly generates a pre-marked answer sheet canvas and runs it through the computer vision engine for immediate live demonstration
- OpenCV.js perspective rectification:
  - Finds 4 black square fiducial markers in outer quadrants
  - Subpixel centroid calculation
  - Homography warp to canonical $1000 \times 1414$ resolution
  - Darkness ratio & contrast sampling with ambient paper luminance normalization
  - Extracts 5-digit Student ID / LRN automatically
  - Compares bubbled answers against quiz answer keys
  - Calculates score, percentage, and pass/fail status
- **Interactive Review & Manual Override Modal:**
  - Shows student match and detected ID
  - Visual breakdown of correct (green), incorrect (red), blank (gray), and multiple mark (amber) items
  - Teacher can tap any bubble (A, B, C, D) to correct or override an answer before saving
  - One-click "Confirm & Record to Gradebook"

### 📈 Results & Gradebook
- Complete examination results list with score percentages, pass/fail status, and confidence levels
- Search by student name or student number
- Filter by quiz
- Inspection modal showing full answer sheet breakdown (marked vs correct options, points awarded)
- Export gradebook to CSV and Excel (`.xlsx`)

### 🔬 Psychometric Item Analysis
- Question Difficulty Index ($P$-value):
  - Hard ($<45\%$ correct)
  - Moderate ($45–75\%$ correct)
  - Easy ($>75\%$ correct)
- Number of students answering correctly and incorrectly per item
- Percentage correct and percentage incorrect
- **Answer Distribution (A, B, C, D):** Exact student choice counts for every question to identify common distractors and misconceptions
- Top most difficult questions and easiest questions lists
- Interactive click-to-inspect bar chart
- Complete Question-by-Question Item Analysis Matrix table
- Comprehensive Downloadable PDF Report with class metrics, psychometric summary, and gradebook roster

---

## 🗄️ 4. Supabase Database Schema

The database is built on PostgreSQL with Row Level Security (RLS) policies ensuring complete data privacy per educator (`auth.uid() = teacher_id`).

### Tables & Relations:
1. `profiles`: Instructor account metadata linked to `auth.users(id)`.
2. `classes`: Classroom definitions with name, section, subject, academic year.
3. `students`: Student roster with unique `student_number` (LRN).
4. `class_students`: Junction table linking students to classes.
5. `quizzes`: Examination metadata, passing percentage, total questions.
6. `answer_keys`: Correct choices (A–D), points, bonus, and exclusion rules.
7. `exam_results` / `scan_results`: Graded exam records, scores, percentages.
8. `exam_answers` / `student_answers`: Item-level student bubble selections.

### Migration SQL:
To initialize your Supabase database:
1. Navigate to your **Supabase Dashboard** -> **SQL Editor**.
2. Open `supabase/schema.sql` from this repository.
3. Paste the contents and click **Run**.

---

## 🌐 5. GitHub Pages Deployment

GradeScan is pre-configured for automated deployment to GitHub Pages via GitHub Actions.

### Configuration Highlights:
- `vite.config.ts` includes `base: './'` for universal relative asset routing.
- Uses `HashRouter` to prevent 404 errors on page reloads or deep links on static hosts.
- Includes `public/404.html` SPA fallback script.
- GitHub Actions workflow located at `.github/workflows/deploy.yml`.

### Deployment Steps:
1. Push your repository to GitHub (`main` or `master` branch).
2. Go to **Settings** -> **Pages** in your GitHub repository.
3. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
4. (Optional) In **Settings** -> **Secrets and variables** -> **Actions**, add your repository secrets:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anonymous public key
5. The GitHub Action will automatically run, build, and deploy the GradeScan website!

---

## 💻 6. Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Create a `.env` file based on `.env.example`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
*(If unset, GradeScan automatically runs in its built-in Local Sandbox Mode with full interactive features and sample data).*

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 🔒 Security & Privacy
- Zero backend exposure of service role keys; only the public anonymous key is used.
- All Supabase queries enforce Row Level Security (`auth.uid() = teacher_id`).
- Local sessions and credentials stored securely in browser storage.
- Audio and camera streams operate entirely client-side; raw video never leaves the teacher's browser.
