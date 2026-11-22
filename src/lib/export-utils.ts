// CSV & Excel Export and Import Utilities for SMARTGRADE

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Student, ExamResult } from '@/types/database';

/**
 * Exports students list to CSV format and initiates browser download.
 */
export function exportStudentsToCSV(students: Student[], filename: string = 'students_roster.csv'): void {
  const data = students.map(s => ({
    'Student ID': s.student_number,
    'First Name': s.first_name,
    'Last Name': s.last_name,
    'Email': s.email || '',
    'Grade Level': s.grade_level || '',
    'Notes': s.notes || '',
  }));

  const csv = Papa.unparse(data);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/**
 * Exports exam results to CSV format.
 */
export function exportResultsToCSV(results: ExamResult[], examTitle: string = 'exam_results'): void {
  const data = results.map(r => ({
    'Student ID': r.student?.student_number || r.raw_student_number || 'N/A',
    'Student Name': r.student ? `${r.student.last_name}, ${r.student.first_name}` : 'Unknown',
    'Quiz': r.quiz?.title || 'Quiz',
    'Total Score': r.total_score,
    'Max Score': r.max_score,
    'Percentage (%)': r.percentage,
    'Passed': r.passed ? 'YES' : 'NO',
    'Correct': r.correct_count,
    'Incorrect': r.incorrect_count,
    'Unanswered': r.unanswered_count,
    'Scan Confidence (%)': r.scan_confidence,
    'Needs Review': r.needs_review ? 'YES' : 'NO',
    'Scanned At': new Date(r.scanned_at).toLocaleString(),
  }));

  const csv = Papa.unparse(data);
  const safeTitle = examTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeTitle}_results.csv`);
}

/**
 * Exports comprehensive item analysis (psychometrics, choice distribution A-D) to CSV.
 */
export function exportItemAnalysisToCSV(items: any[], quizTitle: string = 'item_analysis'): void {
  const data = items.map(item => ({
    'Item #': item.questionNumber,
    'Correct Key': item.correctOption,
    'Total Attempts': item.totalAttempts,
    'Correct Count': item.correctAttempts,
    'Incorrect Count': item.incorrectAttempts,
    'Correct % (P-Value)': `${item.difficultyPercent}%`,
    'Incorrect %': `${item.incorrectPercent}%`,
    'Difficulty Category': item.category,
    'Choice A Count': item.countA,
    'Choice B Count': item.countB,
    'Choice C Count': item.countC,
    'Choice D Count': item.countD,
    'Blank Count': item.countBlank,
  }));

  const csv = Papa.unparse(data);
  const safeTitle = quizTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeTitle}_item_analysis.csv`);
}

/**
 * Exports exam results to Excel (.xlsx) workbook with multiple sheets (Results + Item Analysis).
 */
export function exportResultsToExcel(results: ExamResult[], examTitle: string = 'exam_results'): void {
  const resultsData = results.map(r => ({
    'Student ID': r.student?.student_number || r.raw_student_number || 'N/A',
    'Student Name': r.student ? `${r.student.last_name}, ${r.student.first_name}` : 'Unknown',
    'Quiz': r.quiz?.title || 'Quiz',
    'Total Score': r.total_score,
    'Max Score': r.max_score,
    'Percentage': `${r.percentage}%`,
    'Status': r.passed ? 'PASSED' : 'FAILED',
    'Correct': r.correct_count,
    'Incorrect': r.incorrect_count,
    'Unanswered': r.unanswered_count,
    'Confidence': `${r.scan_confidence}%`,
    'Scanned Date': new Date(r.scanned_at).toLocaleDateString(),
  }));

  const wb = XLSX.utils.book_new();
  const wsResults = XLSX.utils.json_to_sheet(resultsData);
  XLSX.utils.book_append_sheet(wb, wsResults, 'Summary Results');

  const safeTitle = examTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
  XLSX.writeFile(wb, `${safeTitle}_results.xlsx`);
}

/**
 * Parses uploaded CSV/Excel file for bulk student import.
 */
export async function parseStudentsFromFile(file: File): Promise<Array<Omit<Student, 'id' | 'created_at' | 'updated_at' | 'teacher_id'>>> {
  return new Promise((resolve, reject) => {
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(firstSheet);
          resolve(formatStudentRows(json));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(formatStudentRows(results.data));
        },
        error: (err) => reject(err),
      });
    }
  });
}

function formatStudentRows(rows: any[]): Array<Omit<Student, 'id' | 'created_at' | 'updated_at' | 'teacher_id'>> {
  return rows.map((r, index) => {
    const studentNumber = r['Student ID'] || r['student_id'] || r['student_number'] || r['ID'] || `100${String(index + 10).padStart(2, '0')}`;
    const firstName = r['First Name'] || r['first_name'] || r['FirstName'] || 'Student';
    const lastName = r['Last Name'] || r['last_name'] || r['LastName'] || `${index + 1}`;
    const email = r['Email'] || r['email'] || null;
    const gradeLevel = r['Grade Level'] || r['grade_level'] || r['Grade'] || 'Grade 10';
    const notes = r['Notes'] || r['notes'] || '';

    return {
      student_number: String(studentNumber).trim(),
      first_name: String(firstName).trim(),
      last_name: String(lastName).trim(),
      email: email ? String(email).trim() : null,
      grade_level: String(gradeLevel).trim(),
      notes: String(notes).trim(),
    };
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
