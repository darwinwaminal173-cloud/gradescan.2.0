import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  Printer, 
  Sliders, 
  QrCode, 
  ScanLine, 
  CheckCircle2, 
  Settings2,
  Sparkles,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/services/db';
import { Quiz, ClassRoom } from '@/types/database';
import { generateAnswerSheetSVG, downloadAnswerSheetPDF, AnswerSheetConfig } from '@/lib/sheet-generator';

export const AnswerSheetsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const quizIdParam = searchParams.get('quizId');

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizIdParam || '');

  // Sheet configuration
  const [config, setConfig] = useState<AnswerSheetConfig>({
    title: 'Standard Examination Sheet',
    className: 'Physics & General Science',
    examDate: new Date().toISOString().split('T')[0],
    totalQuestions: 20,
    optionsCount: 4,
    quizId: 'SMARTGRADE-GENERIC',
    customInstructions: 'Use dark pencil (No. 2 / HB) or black pen. Fill bubbles completely.',
  });

  const [svgPreview, setSvgPreview] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<{ message: string; blobUrl?: string; filename?: string; isShared?: boolean } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedQuizId && quizzes.length > 0) {
      const q = quizzes.find(item => item.id === selectedQuizId);
      if (q) {
        setConfig({
          title: q.title,
          className: q.class_name || 'General Science',
          examDate: q.exam_date,
          totalQuestions: q.total_questions,
          optionsCount: q.options_per_question,
          quizId: q.id,
          customInstructions: 'Use a dark pencil (No. 2 / HB) or black ink pen. Fill bubbles completely.',
        });
      }
    }
  }, [selectedQuizId, quizzes]);

  useEffect(() => {
    updatePreview();
  }, [config]);

  const loadData = async () => {
    try {
      const [q, c] = await Promise.all([
        db.getQuizzes(),
        db.getClasses(),
      ]);
      setQuizzes(q);
      setClasses(c);

      if (quizIdParam) {
        const found = q.find(item => item.id === quizIdParam);
        if (found) {
          setConfig({
            title: found.title,
            className: found.class_name || 'General Class',
            examDate: found.exam_date,
            totalQuestions: found.total_questions,
            optionsCount: found.options_per_question,
            quizId: found.id,
            customInstructions: 'Use a dark pencil (No. 2 / HB) or black ink pen. Fill bubbles completely.',
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updatePreview = async () => {
    try {
      const svg = await generateAnswerSheetSVG(config);
      setSvgPreview(svg);
    } catch (e) {
      console.error('Failed to generate preview:', e);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setGenerating(true);
      setDownloadNotice(null);
      const res = await downloadAnswerSheetPDF(config);
      if (res.shared) {
        setDownloadNotice({
          message: `Sheet shared successfully via mobile system dialog!`,
          blobUrl: res.blobUrl,
          filename: res.filename,
          isShared: true,
        });
      } else {
        setDownloadNotice({
          message: `PDF generated: ${res.filename}`,
          blobUrl: res.blobUrl,
          filename: res.filename,
          isShared: false,
        });
      }
    } catch (err: any) {
      alert('Error downloading PDF: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.title} - Printable OMR Sheet</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
            svg { width: 100vw; height: 100vh; max-width: 210mm; max-height: 297mm; }
          </style>
        </head>
        <body>
          ${svgPreview}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            Answer Sheet Generator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate camera-optimized printable PDF bubble sheets with optical corner markers & QR codes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Sheet
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={generating}
            onClick={handleDownloadPDF}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Download / Share Status Banner */}
      {downloadNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-100 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">{downloadNotice.message}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                A4 portrait layout • Single page verified • Camera-optimized corner markers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {downloadNotice.blobUrl && (
              <a
                href={downloadNotice.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors text-xs flex items-center gap-1.5"
              >
                Open / View PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => setDownloadNotice(null)}
              className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customization Controls */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                Sheet Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Load from existing quiz */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Load From Existing Quiz
                </label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- Custom Template --</option>
                  {quizzes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.total_questions} Questions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grade &amp; Section
                  </label>
                  <input
                    type="text"
                    value={config.className}
                    onChange={(e) => setConfig({ ...config, className: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={config.examDate}
                    onChange={(e) => setConfig({ ...config, examDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Number of Questions
                  </label>
                  <select
                    value={config.totalQuestions}
                    onChange={(e) => setConfig({ ...config, totalQuestions: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-brand-500 font-bold"
                  >
                    <option value={20}>20 Questions</option>
                    <option value={25}>25 Questions</option>
                    <option value={50}>50 Questions</option>
                    <option value={100}>100 Questions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Answer Choices
                  </label>
                  <div className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold text-brand-700 dark:text-brand-300">
                    A, B, C, D (Standard)
                  </div>
                </div>
              </div>

              {/* OMR Features notice */}
              <div className="p-3 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/50 dark:border-brand-800/60 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-brand-900 dark:text-brand-300 flex items-center gap-1.5">
                  <ScanLine className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                  OMR Features Included:
                </span>
                <ul className="text-[11px] text-brand-800 dark:text-brand-300 space-y-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400 shrink-0" />
                    4 High-contrast corner registration boxes
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400 shrink-0" />
                    5-Digit Student ID / LRN bubble selector matrix
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400 shrink-0" />
                    Automated Quiz QR identification tag
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400 shrink-0" />
                    Subpixel bubble centers for high scanner precision
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Live SVG Preview */}
        <div className="lg:col-span-8">
          <Card className="overflow-hidden">
            <CardHeader
              action={
                <Badge variant="success" size="sm">
                  Ready to Print
                </Badge>
              }
            >
              <CardTitle className="text-sm">High-Resolution Sheet Preview</CardTitle>
              <p className="text-xs text-slate-500">Live rendering of the camera-scannable answer sheet</p>
            </CardHeader>
            <div className="p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center items-center overflow-auto">
              <div 
                className="bg-white shadow-xl rounded-lg border border-slate-300 w-full max-w-[550px] aspect-[1/1.414] overflow-hidden p-2"
                dangerouslySetInnerHTML={{ __html: svgPreview }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
