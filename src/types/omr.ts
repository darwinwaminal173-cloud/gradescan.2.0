// OMR Computer Vision & Processing Types

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetCornerMarkers {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface BubbleCoordinate {
  questionNumber: number;
  optionIndex: number; // 0=A, 1=B, 2=C, 3=D, 4=E
  optionLabel: string; // 'A', 'B', 'C', 'D', 'E'
  normX: number; // Normalized coordinate in warped image [0..1]
  normY: number; // Normalized coordinate in warped image [0..1]
  normRadius: number; // Normalized radius
}

export interface StudentIdBubbleCoordinate {
  digitColumn: number; // 0 to 4 (5-digit ID)
  digitValue: number;  // 0 to 9
  normX: number;
  normY: number;
  normRadius: number;
}

export interface OMRTemplateSpec {
  id: string;
  name: string;
  totalQuestions: number;
  optionsPerQuestion: number;
  columns: number; // 1, 2, 3 columns on sheet
  aspectRatio: number; // Height / Width (e.g. 1.414 for A4)
  studentIdDigits: number; // usually 5
  // Registration marker specifications (normalized positions)
  registrationMarkers: {
    sizeRatio: number; // e.g. 0.04 of width
    positions: Point[]; // 4 corners
  };
}

export interface BubbleDetectionResult {
  questionNumber: number;
  optionLabel: string;
  fillRatio: number; // 0.0 (blank white) to 1.0 (completely filled black)
  isMarked: boolean;
  confidence: number;
}

export interface QuestionScanResult {
  questionNumber: number;
  markedOptions: string[];
  isMultiple: boolean;
  isBlank: boolean;
  confidence: number;
  bubbleDetails: BubbleDetectionResult[];
}

export interface ScannedSheetData {
  quizIdFromQr?: string;
  detectedStudentNumber: string;
  questions: QuestionScanResult[];
  overallConfidence: number;
  isBlurry: boolean;
  blurScore: number;
  cornersDetected: boolean;
  corners?: SheetCornerMarkers;
  warpedCanvas?: HTMLCanvasElement;
  timestamp: number;
}

export interface GradingEvaluation {
  totalScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  passed: boolean;
  itemResults: {
    questionNumber: number;
    marked: string[];
    correct: string[];
    isCorrect: boolean;
    pointsAwarded: number;
    isBonus: boolean;
    isExcluded: boolean;
    confidence: number;
    isMultiple: boolean;
    isBlank: boolean;
  }[];
}
