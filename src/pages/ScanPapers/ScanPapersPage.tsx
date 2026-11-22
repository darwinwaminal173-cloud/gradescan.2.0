// ==============================================================================
// GradeScan - Real-Time Full-Screen Portrait Camera OMR Scanner
// High-Precision Automatic Capture, Auto-Save & Color-Coded Answer Checking
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Upload, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Sparkles, 
  UserCheck, 
  FileText, 
  ScanLine, 
  Save, 
  RefreshCw, 
  Sliders, 
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  SwitchCamera,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/services/db';
import { Quiz, AnswerKey, Student, ExamResult } from '@/types/database';
import { 
  processOMRCanvas, 
  gradeScannedAnswers, 
  CANONICAL_WIDTH, 
  CANONICAL_HEIGHT,
  findRegistrationCorners,
  measureSharpness,
  getStudentIdBubbleCoordinates,
  getQuestionBubbleCoordinates
} from '@/lib/omr-engine';
import { generateAnswerSheetSVG } from '@/lib/sheet-generator';
import { ScannedSheetData, GradingEvaluation, QuestionScanResult, Point } from '@/types/omr';

interface SessionScannedRecord {
  id: string;
  studentName: string;
  studentNumber: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  timestamp: string;
}

export const ScanPapersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quizIdParam = searchParams.get('quizId');

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [answerKeys, setAnswerKeys] = useState<AnswerKey[]>([]);

  // Camera & Stream states
  const [cameraActive, setCameraActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Optical alignment & status states
  const [alignmentState, setAlignmentState] = useState<'searching' | 'detected' | 'stable' | 'capturing'>('searching');
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('Align answer sheet with the 4 corner targets');
  const [autoSaveToast, setAutoSaveToast] = useState<{
    studentName: string;
    studentNumber: string;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
  } | null>(null);

  // Scan Results & Review State
  const [scanResult, setScanResult] = useState<ScannedSheetData | null>(null);
  const [evaluation, setEvaluation] = useState<GradingEvaluation | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [manualStudentId, setManualStudentId] = useState<string>('');
  const [reviewQuestions, setReviewQuestions] = useState<QuestionScanResult[]>([]);
  const [scannedImageUrl, setScannedImageUrl] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [sessionRecords, setSessionRecords] = useState<SessionScannedRecord[]>([]);

  // References
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastCornersRef = useRef<{ tl: Point; tr: Point; br: Point; bl: Point } | null>(null);
  const stableCountRef = useRef<number>(0);
  const lastCaptureTimeRef = useRef<number>(0);

  useEffect(() => {
    loadInitialData();
    enumerateCameras();

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (selectedQuiz) {
      loadQuizDetails(selectedQuiz.id);
    }
  }, [selectedQuiz]);

  const loadInitialData = async () => {
    try {
      const [qList, sList] = await Promise.all([
        db.getQuizzes(),
        db.getStudents(),
      ]);
      setQuizzes(qList);
      setStudents(sList);

      if (quizIdParam) {
        const found = qList.find(q => q.id === quizIdParam);
        if (found) setSelectedQuiz(found);
      } else if (qList.length > 0) {
        setSelectedQuiz(qList[0]);
      }
    } catch (e) {
      console.error('Error loading initial quiz data:', e);
    }
  };

  const loadQuizDetails = async (quizId: string) => {
    try {
      const keys = await db.getAnswerKeys(quizId);
      setAnswerKeys(keys);
    } catch (e) {
      console.error('Error loading answer keys:', e);
    }
  };

  const enumerateCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devList = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devList.filter(d => d.kind === 'videoinput');
      setDevices(videoDevs);
      if (videoDevs.length > 0) {
        // Prefer rear / environment camera on mobile devices
        const backCamera = videoDevs.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') || 
          d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera ? backCamera.deviceId : videoDevs[videoDevs.length - 1].deviceId);
      }
    } catch (e) {
      console.warn('Camera enumeration note:', e);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      stopCamera();

      let stream: MediaStream;
      try {
        // Request portrait-optimized resolution with environment camera preference
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // Fallback for devices that reject exact constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setAlignmentState('searching');
        setScanStatusMessage('Position all 4 corner black boxes within view');
        startLiveScanningLoop();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Camera permission denied or camera not found. Please grant camera permission in your browser.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setAlignmentState('searching');
  };

  const flipCamera = async () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDev = devices[nextIndex];
    setSelectedDeviceId(nextDev.deviceId);

    // Restart camera with the newly selected device
    stopCamera();
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  /**
   * Continuous Optical Analysis Loop for Automatic Capture
   */
  const startLiveScanningLoop = () => {
    let lastEvalTime = 0;

    const tick = async (timestamp: number) => {
      if (!videoRef.current || !cameraActive) return;

      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0 && !isProcessing && selectedQuiz) {
        // Run alignment check every 280ms
        if (timestamp - lastEvalTime > 280) {
          lastEvalTime = timestamp;
          await evaluateLiveFrame();
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  /**
   * Evaluates the video frame for the 4 corner fiducials and stability.
   */
  const evaluateLiveFrame = async () => {
    if (!videoRef.current || isProcessing) return;
    const video = videoRef.current;

    // Cooldown check (wait 2.5 seconds after a capture before auto-capturing again)
    const now = Date.now();
    if (now - lastCaptureTimeRef.current < 2500) {
      return;
    }

    try {
      // Lightweight analysis canvas downsampled for high-speed detection (< 8ms)
      const testCanvas = canvasRef.current || document.createElement('canvas');
      const scale = 0.5;
      testCanvas.width = Math.round(video.videoWidth * scale);
      testCanvas.height = Math.round(video.videoHeight * scale);
      const ctx = testCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, testCanvas.width, testCanvas.height);

      // Check for 4 optical corner markers
      const corners = findRegistrationCorners(ctx, testCanvas.width, testCanvas.height);

      if (corners) {
        // Check geometric proportions: aspect ratio of quadrilateral
        const wTop = Math.hypot(corners.topRight.x - corners.topLeft.x, corners.topRight.y - corners.topLeft.y);
        const wBottom = Math.hypot(corners.bottomRight.x - corners.bottomLeft.x, corners.bottomRight.y - corners.bottomLeft.y);
        const hLeft = Math.hypot(corners.bottomLeft.x - corners.topLeft.x, corners.bottomLeft.y - corners.topLeft.y);
        const hRight = Math.hypot(corners.bottomRight.x - corners.topRight.x, corners.bottomRight.y - corners.topRight.y);

        const avgW = (wTop + wBottom) / 2;
        const avgH = (hLeft + hRight) / 2;
        const aspect = avgH / (avgW || 1);

        // Standard A4 portrait sheet aspect ratio is ~1.414. Acceptable perspective range: 1.05 - 1.80
        if (aspect >= 1.05 && aspect <= 1.80) {
          // Check frame stability against last detected corners
          if (lastCornersRef.current) {
            const drift = 
              Math.hypot(corners.topLeft.x - lastCornersRef.current.tl.x, corners.topLeft.y - lastCornersRef.current.tl.y) +
              Math.hypot(corners.topRight.x - lastCornersRef.current.tr.x, corners.topRight.y - lastCornersRef.current.tr.y) +
              Math.hypot(corners.bottomRight.x - lastCornersRef.current.br.x, corners.bottomRight.y - lastCornersRef.current.br.y) +
              Math.hypot(corners.bottomLeft.x - lastCornersRef.current.bl.x, corners.bottomLeft.y - lastCornersRef.current.bl.y);

            // If corner drift is under threshold, increment stability counter
            if (drift < 24) {
              stableCountRef.current++;
            } else {
              stableCountRef.current = 1;
            }
          } else {
            stableCountRef.current = 1;
          }

          lastCornersRef.current = {
            tl: corners.topLeft,
            tr: corners.topRight,
            br: corners.bottomRight,
            bl: corners.bottomLeft,
          };

          // If stable for 2 consecutive evaluations (~560ms) and auto-capture is enabled: TRIGGER!
          if (autoCaptureEnabled && stableCountRef.current >= 2) {
            setAlignmentState('stable');
            setScanStatusMessage('Sheet aligned! Capturing and grading...');
            lastCaptureTimeRef.current = Date.now();
            stableCountRef.current = 0;
            lastCornersRef.current = null;

            // Trigger full capture
            await captureAndProcessFrame(false);
          } else {
            setAlignmentState('detected');
            setScanStatusMessage('Sheet detected — Hold phone steady');
          }
          return;
        }
      }

      // If corners not found or aspect invalid:
      stableCountRef.current = 0;
      lastCornersRef.current = null;
      setAlignmentState('searching');
      setScanStatusMessage('Align answer sheet with the 4 corner targets');
    } catch (e) {
      console.warn('Live frame evaluation note:', e);
    }
  };

  /**
   * Captures full-resolution frame from video or static image and executes OMR grading.
   */
  const captureAndProcessFrame = async (isManualTrigger: boolean = true) => {
    if (!videoRef.current || !selectedQuiz) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      setIsProcessing(true);
      setAlignmentState('capturing');

      // Vibrate mobile device upon capture if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([60]);
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const snapshotUrl = canvas.toDataURL('image/jpeg', 0.88);

      // Perform complete OMR recognition
      const result = await processOMRCanvas(
        canvas, 
        selectedQuiz.total_questions, 
        selectedQuiz.options_per_question
      );

      await handleScanCompleted(result, snapshotUrl);
    } catch (e) {
      console.error('Error during OMR processing:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Processes a successful sheet recognition: matches student, grades answers,
   * auto-saves if confident and unique, or opens Manual Review if attention is required.
   */
  const handleScanCompleted = async (data: ScannedSheetData, snapshotUrl: string) => {
    if (!selectedQuiz) return;

    // Audio cue
    if (soundEnabled) {
      playBeep();
    }

    const studentNum = data.detectedStudentNumber;
    const found = students.find(s => s.student_number === studentNum);

    // Check for duplicate submission
    let isDuplicate = false;
    if (found) {
      try {
        const existingResults = await db.getExamResults({ quizId: selectedQuiz.id });
        isDuplicate = existingResults.some(r => r.student_id === found.id || r.raw_student_number === studentNum);
      } catch (err) {
        console.warn('Error checking existing exam results:', err);
      }
    }

    // Grade against current quiz answer key
    const evalResult = gradeScannedAnswers(data.questions, selectedQuiz, answerKeys);

    // Criteria for automatic saving:
    // 1. Auto-save is enabled
    // 2. Student is definitively recognized and registered in student database
    // 3. Student ID is not empty or dummy '00000'
    // 4. Overall confidence is high (>= 75%)
    // 5. Not a duplicate submission
    // 6. No low-confidence or conflicting multiple marks
    const isCleanScan = !data.questions.some(q => q.isMultiple || q.confidence < 50);
    const canAutoSave = 
      autoSaveEnabled && 
      found !== undefined && 
      found !== null && 
      studentNum !== '00000' && 
      data.overallConfidence >= 75 && 
      !isDuplicate && 
      isCleanScan;

    if (canAutoSave) {
      // Automatic Record Saving without interruption
      await executeSaveExamResult(
        found.id,
        studentNum,
        snapshotUrl,
        evalResult,
        data.overallConfidence,
        false
      );

      // Display floating Auto-Save feedback toast
      setAutoSaveToast({
        studentName: `${found.last_name}, ${found.first_name}`,
        studentNumber: studentNum,
        score: evalResult.totalScore,
        maxScore: evalResult.maxScore,
        percentage: evalResult.percentage,
        passed: evalResult.passed,
      });

      // Perfect score celebration
      if (evalResult.percentage === 100) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      // Hide toast after 3.5 seconds
      setTimeout(() => {
        setAutoSaveToast(null);
      }, 3500);

      // Brief pause before resuming optical scan
      setAlignmentState('searching');
      setScanStatusMessage(`Auto-saved: ${found.last_name} (${evalResult.percentage}%). Ready for next sheet.`);
    } else {
      // Require Manual Review
      setScanResult(data);
      setScannedImageUrl(snapshotUrl);
      setReviewQuestions([...data.questions]);
      setMatchedStudent(found || null);
      setManualStudentId(found ? found.id : '');
      setEvaluation(evalResult);

      if (isDuplicate) {
        setDuplicateWarning(`Warning: Student #${studentNum} (${found?.last_name}) already has a submitted score for this exam!`);
      } else if (!found) {
        setDuplicateWarning(`Student ID #${studentNum} was not found in the student roster. Please manually assign the student below.`);
      } else if (!isCleanScan) {
        setDuplicateWarning(`Review required: Paper contains ambiguous or multiple markings that require teacher confirmation.`);
      } else {
        setDuplicateWarning(null);
      }

      setIsReviewOpen(true);
    }
  };

  /**
   * Persists the exam result to Supabase / Gradebook database.
   */
  const executeSaveExamResult = async (
    targetStudentId: string | null,
    studentNumber: string | null,
    imageUrl: string | null,
    evalResult: GradingEvaluation,
    confidence: number,
    needsReview: boolean
  ) => {
    if (!selectedQuiz) return;

    try {
      const saved = await db.saveExamResult({
        quiz_id: selectedQuiz.id,
        student_id: targetStudentId,
        teacher_id: selectedQuiz.teacher_id || '',
        raw_student_number: studentNumber,
        scanned_image_url: imageUrl,
        total_score: evalResult.totalScore,
        max_score: evalResult.maxScore,
        percentage: evalResult.percentage,
        correct_count: evalResult.correctCount,
        incorrect_count: evalResult.incorrectCount,
        unanswered_count: evalResult.unansweredCount,
        passed: evalResult.passed,
        scan_confidence: confidence || 95,
        needs_review: needsReview,
      }, evalResult.itemResults.map(item => ({
        question_number: item.questionNumber,
        marked_options: item.marked,
        correct_options: item.correct,
        is_correct: item.isCorrect,
        points_awarded: item.pointsAwarded,
        confidence: item.confidence,
        is_blank: item.isBlank,
        is_multiple: item.isMultiple,
      })));

      // Add to session tally list
      const matched = students.find(s => s.id === targetStudentId);
      const newRecord: SessionScannedRecord = {
        id: saved.id || `session_${Date.now()}`,
        studentName: matched ? `${matched.last_name}, ${matched.first_name}` : 'Unassigned Student',
        studentNumber: studentNumber || 'N/A',
        totalScore: evalResult.totalScore,
        maxScore: evalResult.maxScore,
        percentage: evalResult.percentage,
        passed: evalResult.passed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSessionRecords(prev => [newRecord, ...prev]);
    } catch (e: any) {
      console.error('Error saving exam result:', e);
      throw e;
    }
  };

  const handleManualSave = async () => {
    if (!selectedQuiz || !evaluation) return;

    try {
      setSavingResult(true);
      const targetStudentId = manualStudentId || matchedStudent?.id || null;

      await executeSaveExamResult(
        targetStudentId,
        scanResult?.detectedStudentNumber || null,
        scannedImageUrl,
        evaluation,
        scanResult?.overallConfidence || 95,
        reviewQuestions.some(q => q.isMultiple || q.confidence < 50)
      );

      if (evaluation.percentage === 100) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      setIsReviewOpen(false);
      setScanStatusMessage(`Saved result for ${matchedStudent ? matchedStudent.last_name : 'Student'} (${evaluation.percentage}%).`);
    } catch (err: any) {
      alert('Error saving exam result: ' + err.message);
    } finally {
      setSavingResult(false);
    }
  };

  /**
   * Static photo upload handler.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedQuiz) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const snapshotUrl = canvas.toDataURL('image/jpeg', 0.88);

        try {
          setIsProcessing(true);
          const result = await processOMRCanvas(
            canvas, 
            selectedQuiz.total_questions, 
            selectedQuiz.options_per_question
          );
          await handleScanCompleted(result, snapshotUrl);
        } catch (err: any) {
          alert('OMR recognition error: ' + err.message);
        } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  /**
   * Simulates scanning a pre-marked test sheet for immediate verification.
   */
  const handleScanSampleSheet = async () => {
    if (!selectedQuiz) return;
    try {
      setIsProcessing(true);
      setScanStatusMessage('Synthesizing sample bubble sheet & running OMR engine...');
      const canvas = document.createElement('canvas');
      canvas.width = CANONICAL_WIDTH;
      canvas.height = CANONICAL_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const svgString = await generateAnswerSheetSVG({
        title: selectedQuiz.title,
        className: selectedQuiz.class_name || 'Physics Alpha',
        examDate: selectedQuiz.exam_date,
        totalQuestions: selectedQuiz.total_questions,
        optionsCount: 4,
        quizId: selectedQuiz.id,
      });

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });

      // Mark Student ID 10001
      const idBubbles = getStudentIdBubbleCoordinates();
      const demoIdDigits = [1, 0, 0, 0, 1];
      for (let col = 0; col < 5; col++) {
        const targetDigit = demoIdDigits[col];
        const bubble = idBubbles.find(b => b.digitColumn === col && b.digitValue === targetDigit);
        if (bubble) {
          const bx = bubble.normX * CANONICAL_WIDTH;
          const by = bubble.normY * CANONICAL_HEIGHT + 35;
          const br = bubble.normRadius * CANONICAL_WIDTH;
          ctx.beginPath();
          ctx.arc(bx, by, br * 0.76, 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
        }
      }

      // Mark question bubbles
      const qBubbles = getQuestionBubbleCoordinates(selectedQuiz.total_questions, 4);
      for (let q = 1; q <= selectedQuiz.total_questions; q++) {
        const key = answerKeys.find(k => k.question_number === q);
        let chosenOpt = key?.correct_options[0] || 'A';
        // Add 2 realistic student errors
        if (q === 4) chosenOpt = chosenOpt === 'A' ? 'B' : 'A';
        if (q === 11) chosenOpt = chosenOpt === 'C' ? 'D' : 'B';

        const b = qBubbles.find(item => item.questionNumber === q && item.optionLabel === chosenOpt);
        if (b) {
          const bx = b.normX * CANONICAL_WIDTH;
          const by = b.normY * CANONICAL_HEIGHT;
          const br = b.normRadius * CANONICAL_WIDTH;
          ctx.beginPath();
          ctx.arc(bx, by, br * 0.78, 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
        }
      }

      const snapshotUrl = canvas.toDataURL('image/jpeg', 0.9);
      const result = await processOMRCanvas(canvas, selectedQuiz.total_questions, 4);
      await handleScanCompleted(result, snapshotUrl);
    } catch (err: any) {
      alert('Sample test sheet scanning error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleOptionOverride = (qNumber: number, option: string) => {
    if (!selectedQuiz) return;

    setReviewQuestions(prev => {
      const updated = prev.map(q => {
        if (q.questionNumber !== qNumber) return q;
        const newMarked = q.markedOptions.includes(option)
          ? q.markedOptions.filter(o => o !== option)
          : [option];
        return {
          ...q,
          markedOptions: newMarked,
          isBlank: newMarked.length === 0,
          isMultiple: newMarked.length > 1,
        };
      });

      const newEval = gradeScannedAnswers(updated, selectedQuiz, answerKeys);
      setEvaluation(newEval);
      return updated;
    });
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // AudioContext policy
    }
  };

  // Dynamic corner guide colors based on live alignment state
  const cornerColor = 
    alignmentState === 'stable'
      ? 'border-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
      : alignmentState === 'detected'
      ? 'border-teal-400'
      : 'border-slate-500/70';

  const statusDot = 
    alignmentState === 'stable'
      ? 'bg-emerald-400'
      : alignmentState === 'detected'
      ? 'bg-teal-400'
      : 'bg-amber-400';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Camera className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            GradeScan Camera Scanner
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Full-screen portrait OMR scanner with automatic marker alignment, instant auto-save, and color-coded answer grading.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleScanSampleSheet}
            isLoading={isProcessing}
            leftIcon={<Sparkles className="w-4 h-4 text-brand-600" />}
            className="border-brand-300 dark:border-brand-700 hover:bg-brand-50/50"
            title="Scan synthesized test sheet immediately"
          >
            Test Sample Sheet
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Photo
          </Button>

          {!cameraActive ? (
            <Button
              variant="primary"
              size="sm"
              onClick={startCamera}
              leftIcon={<Camera className="w-4 h-4" />}
            >
              Start Camera
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={stopCamera}
              leftIcon={<X className="w-4 h-4" />}
            >
              Stop Camera
            </Button>
          )}
        </div>
      </div>

      {/* Active Exam Selector & Scanner Controls Header */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Active Exam:</span>
            <select
              value={selectedQuiz?.id || ''}
              onChange={(e) => {
                const found = quizzes.find(q => q.id === e.target.value);
                if (found) setSelectedQuiz(found);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 font-bold focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-900"
            >
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.total_questions} Questions • Pass: {q.passing_percentage}%)
                </option>
              ))}
            </select>
          </div>

          {/* Feature Toggles */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCaptureEnabled}
                onChange={(e) => setAutoCaptureEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Auto-Capture
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Auto-Save Valid Scans
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Main Viewfinder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Full-Screen Portrait Viewfinder */}
        <div className="lg:col-span-8 flex justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden bg-black shadow-2xl border-4 border-slate-800 flex items-center justify-center">
            {/* Camera Video Stream */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${cameraActive ? 'opacity-100' : 'opacity-0 hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Offline Inactive Viewfinder */}
            {!cameraActive && (
              <div className="p-8 text-center space-y-4 text-slate-400 z-10">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 mx-auto flex items-center justify-center text-brand-400 shadow-inner">
                  <ScanLine className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Portrait Camera Scanner Ready</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    Click "Start Camera" to scan physical sheets, or "Test Sample Sheet" to test the OMR engine immediately.
                  </p>
                </div>
                {cameraError && (
                  <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs max-w-xs mx-auto text-left">
                    <p className="font-bold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      Camera Permission Required
                    </p>
                    <p className="text-[11px] mt-1 opacity-90">{cameraError}</p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                  <Button variant="primary" size="md" onClick={startCamera} leftIcon={<Camera className="w-4 h-4" />}>
                    Start Camera
                  </Button>
                  <Button variant="outline" size="md" onClick={handleScanSampleSheet} leftIcon={<Sparkles className="w-4 h-4 text-brand-400" />} className="text-slate-300 border-slate-700">
                    Test Sample Sheet
                  </Button>
                </div>
              </div>
            )}

            {/* 4 Optical Corner Alignment Guides */}
            {cameraActive && (
              <div className="absolute inset-5 sm:inset-7 pointer-events-none flex flex-col justify-between z-10">
                {/* Top Corner Reticles */}
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 border-t-4 border-l-4 rounded-tl-2xl transition-all duration-300 ${cornerColor}`} />
                  <div className={`w-12 h-12 border-t-4 border-r-4 rounded-tr-2xl transition-all duration-300 ${cornerColor}`} />
                </div>

                {/* Center Status Pill */}
                <div className="self-center flex flex-col items-center gap-2">
                  {alignmentState === 'searching' && (
                    <div className="w-40 h-0.5 bg-brand-400/80 shadow-[0_0_10px_rgba(20,184,166,0.8)] animate-pulse" />
                  )}
                  <div className="px-3.5 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-2 shadow-2xl">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusDot} animate-pulse`} />
                    <span>{scanStatusMessage}</span>
                  </div>
                </div>

                {/* Bottom Corner Reticles */}
                <div className="flex justify-between items-end">
                  <div className={`w-12 h-12 border-b-4 border-l-4 rounded-bl-2xl transition-all duration-300 ${cornerColor}`} />
                  <div className={`w-12 h-12 border-b-4 border-r-4 rounded-br-2xl transition-all duration-300 ${cornerColor}`} />
                </div>
              </div>
            )}

            {/* Floating Top-Right Controls */}
            {cameraActive && (
              <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2.5 rounded-full bg-slate-950/80 backdrop-blur-md text-white border border-slate-700 hover:bg-slate-800 transition-colors"
                  title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-brand-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                </button>
                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="p-2.5 rounded-full bg-slate-950/80 backdrop-blur-md text-white border border-slate-700 hover:bg-slate-800 transition-colors"
                    title="Flip / Switch Camera"
                  >
                    <SwitchCamera className="w-4 h-4 text-brand-400" />
                  </button>
                )}
              </div>
            )}

            {/* Floating Bottom Control Bar */}
            {cameraActive && (
              <div className="absolute bottom-4 inset-x-4 flex items-center justify-between p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 z-20 shadow-2xl">
                <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                  <span className={`w-2 h-2 rounded-full ${alignmentState === 'stable' ? 'bg-emerald-400' : 'bg-brand-400'}`} />
                  <span>{autoCaptureEnabled ? 'Auto-Scan Active' : 'Manual Shutter'}</span>
                </div>

                {/* Shutter Button */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => captureAndProcessFrame(true)}
                  className="w-14 h-14 rounded-full bg-white border-4 border-brand-500 shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-brand-900 font-black disabled:opacity-50"
                  title="Capture & Grade Now"
                >
                  <ScanLine className="w-6 h-6 text-brand-700" />
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopCamera}
                  className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800 py-1 px-2.5"
                >
                  Close
                </Button>
              </div>
            )}

            {/* Auto-Save Toast Overlay */}
            {autoSaveToast && (
              <div className="absolute top-4 inset-x-4 p-3 rounded-2xl bg-emerald-900/90 backdrop-blur-md border border-emerald-400/80 text-white shadow-2xl z-30 flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm">
                    {autoSaveToast.percentage}%
                  </div>
                  <div>
                    <p className="font-extrabold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      Auto-Saved: {autoSaveToast.studentName}
                    </p>
                    <p className="text-[11px] text-emerald-200">
                      Score: {autoSaveToast.score}/{autoSaveToast.maxScore} • ID #{autoSaveToast.studentNumber}
                    </p>
                  </div>
                </div>
                <Badge variant={autoSaveToast.passed ? 'success' : 'danger'} size="sm">
                  {autoSaveToast.passed ? 'PASSED' : 'FAILED'}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Instructions & Scanned in this Session Tally */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Scanning Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <p>Hold your phone in <strong>portrait mode</strong> directly above the answer sheet.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <p>Fit all <strong>4 black corner boxes</strong> inside the viewfinder reticles.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <p>Hold steady for half a second. The camera automatically detects, locks, and captures!</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                <p>When Student ID is valid, GradeScan automatically saves the score without stopping!</p>
              </div>
            </CardContent>
          </Card>

          {/* Graded Papers in Current Session */}
          <Card>
            <CardHeader
              action={
                <Badge variant="teal" size="sm">
                  {sessionRecords.length} Graded
                </Badge>
              }
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                Session History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionRecords.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No sheets scanned in this session yet. Start the camera or test sample sheets to begin!
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {sessionRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/50"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{rec.studentName}</p>
                        <p className="text-[11px] text-slate-500">ID #{rec.studentNumber} • {rec.timestamp}</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-black ${rec.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {rec.percentage}%
                        </span>
                        <p className="text-[10px] text-slate-400">{rec.totalScore}/{rec.maxScore} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUAL VERIFICATION & MANUAL REVIEW MODAL                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title="Verify Scanned Exam Sheet"
        description="Review detected bubble answers, confirm student match, or tap any bubble to override."
        maxWidth="4xl"
      >
        {evaluation && (
          <div className="space-y-5">
            {/* Warning Banner if Unmatched, Duplicate, or Low Confidence */}
            {duplicateWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{duplicateWarning}</p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    Please confirm student assignment and verify marked responses before recording.
                  </p>
                </div>
              </div>
            )}

            {/* Top Score Banner */}
            <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ${
              evaluation.passed 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100' 
                : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-md ${evaluation.passed ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  {evaluation.percentage}%
                </div>
                <div>
                  <h3 className="font-black text-lg">
                    Score: {evaluation.totalScore} / {evaluation.maxScore} points
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      Correct: {evaluation.correctCount}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-rose-700 dark:text-rose-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      Incorrect: {evaluation.incorrectCount}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                      Unanswered: {evaluation.unansweredCount}
                    </span>
                  </div>
                </div>
              </div>
              <Badge variant={evaluation.passed ? 'success' : 'danger'} size="md">
                {evaluation.passed ? 'PASSED' : 'FAILED'}
              </Badge>
            </div>

            {/* Student Matching Section */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Detected OMR ID: <span className="font-mono font-bold text-brand-700 dark:text-brand-400">#{scanResult?.detectedStudentNumber || 'N/A'}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-slate-500 font-bold shrink-0">Assign to Student:</span>
                <select
                  value={manualStudentId || matchedStudent?.id || ''}
                  onChange={(e) => {
                    setManualStudentId(e.target.value);
                    const s = students.find(item => item.id === e.target.value);
                    setMatchedStudent(s || null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- Unassigned / Guest --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.last_name}, {s.first_name} (#{s.student_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Item-by-Item Review Grid with Color-Coded Answers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Item Analysis & Answers
                </h4>
                {/* Color Legend */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Correct
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> Wrong
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-amber-500 bg-amber-100 inline-block" /> Key
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Blank
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-72 overflow-y-auto p-1">
                {evaluation.itemResults.map((item) => {
                  const optionLetters = ['A', 'B', 'C', 'D', 'E'].slice(0, selectedQuiz?.options_per_question || 4);

                  return (
                    <div
                      key={item.questionNumber}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        item.isCorrect
                          ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100'
                          : item.isMultiple
                          ? 'border-purple-300 bg-purple-50/70 dark:bg-purple-950/30 text-purple-950 dark:text-purple-100'
                          : item.isBlank
                          ? 'border-slate-300 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                          : 'border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 font-bold">
                        <div className="flex items-center gap-1">
                          <span>Q{item.questionNumber}.</span>
                          {item.isCorrect && <span className="text-[10px] text-emerald-600 font-black">✔</span>}
                          {!item.isCorrect && !item.isBlank && <span className="text-[10px] text-rose-600 font-black">✘</span>}
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                          Key: {item.correct.join(',')}
                        </span>
                      </div>

                      {/* Bubble selector override */}
                      <div className="flex items-center gap-1">
                        {optionLetters.map(opt => {
                          const isStudentMarked = item.marked.includes(opt);
                          const isCorrectKey = item.correct.includes(opt);

                          let btnStyle = 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
                          if (isStudentMarked && isCorrectKey) {
                            btnStyle = 'bg-emerald-600 text-white border-emerald-600 font-black ring-1 ring-emerald-300';
                          } else if (isStudentMarked && !isCorrectKey) {
                            btnStyle = 'bg-rose-600 text-white border-rose-600 font-black line-through';
                          } else if (!isStudentMarked && isCorrectKey) {
                            btnStyle = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-2 border-dashed border-amber-500 font-black ring-1 ring-amber-400';
                          }

                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleToggleOptionOverride(item.questionNumber, opt)}
                              title={`Option ${opt}${isCorrectKey ? ' (Correct Answer)' : ''}${isStudentMarked ? ' (Marked by Student)' : ''}`}
                              className={`flex-1 h-7 rounded text-[11px] border flex items-center justify-center transition-all ${btnStyle}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Confirm & Save */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsReviewOpen(false);
                  startCamera();
                }}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Discard & Rescan
              </Button>
              <Button
                variant="success"
                size="md"
                isLoading={savingResult}
                onClick={handleManualSave}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Confirm & Record to Gradebook
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
