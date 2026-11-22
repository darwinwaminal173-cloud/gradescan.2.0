// ==============================================================================
// GradeScan - Vector & Printable PDF Answer Sheet Generator
// High-Precision Fiducial Layout for Camera OMR Alignment
// ==============================================================================

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Quiz } from '@/types/database';
import { 
  CANONICAL_WIDTH, 
  CANONICAL_HEIGHT, 
  getCornerMarkerSpecs, 
  getStudentIdBubbleCoordinates, 
  getQuestionBubbleCoordinates 
} from '@/lib/omr-engine';

export interface AnswerSheetConfig {
  title: string;
  className?: string;
  examDate?: string;
  totalQuestions: number;
  optionsCount?: number; // Defaults to 4 (A, B, C, D)
  quizId?: string;
  customInstructions?: string;
}

/**
 * Generates an SVG string representation of the OMR answer sheet at canonical coordinates.
 * Can be drawn to Canvas, embedded into DOM, or rendered directly.
 */
export async function generateAnswerSheetSVG(config: AnswerSheetConfig): Promise<string> {
  const {
    title,
    className = 'General Science',
    examDate = new Date().toISOString().split('T')[0],
    totalQuestions,
    optionsCount = 4, // 4 choices (A, B, C, D)
    quizId = 'GRADESCAN-DEMO',
    customInstructions = 'Use a dark pencil (No. 2 / HB) or black ink pen. Fill bubbles completely. Do not fold or bend the page.'
  } = config;

  // Generate QR Code data URL
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(JSON.stringify({ quizId, q: totalQuestions, opt: 4 }), {
      margin: 1,
      width: 120,
    });
  } catch (e) {
    console.warn('QR code generation failed, using fallback', e);
  }

  const markers = getCornerMarkerSpecs();
  const idBubbles = getStudentIdBubbleCoordinates();
  // Strictly support A, B, C, D
  const qBubbles = getQuestionBubbleCoordinates(totalQuestions, 4);

  // Determine question column groupings
  let numColumns = 1;
  if (totalQuestions > 50) numColumns = 4;
  else if (totalQuestions > 25) numColumns = 2;

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANONICAL_WIDTH} ${CANONICAL_HEIGHT}" width="100%" height="100%" style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <style>
    .marker { fill: #000000; }
    .label { font-size: 13px; font-weight: 700; fill: #0f172a; }
    .muted { font-size: 10.5px; fill: #475569; font-weight: 500; }
    .title { font-size: 22px; font-weight: 800; fill: #0f766e; }
    .sub { font-size: 13px; fill: #334155; font-weight: 600; }
    .bubble-border { stroke: #0f172a; stroke-width: 1.6; fill: #ffffff; }
    .bubble-text { font-size: 10px; font-weight: 800; fill: #0f172a; text-anchor: middle; dominant-baseline: central; }
    .q-number { font-size: 13px; font-weight: 800; fill: #0f766e; text-anchor: end; dominant-baseline: central; }
    .header-box { stroke: #cbd5e1; stroke-width: 1.2; fill: #f8fafc; rx: 4; }
    .id-header { font-size: 11px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
    .badge { fill: #0f766e; rx: 4; }
    .badge-text { font-size: 11px; font-weight: bold; fill: #ffffff; text-anchor: middle; }
  </style>

  <!-- 1. Four Optical Corner Fiducial Markers -->
  <rect class="marker" x="${markers.topLeft.x}" y="${markers.topLeft.y}" width="${markers.topLeft.size}" height="${markers.topLeft.size}" />
  <rect class="marker" x="${markers.topRight.x}" y="${markers.topRight.y}" width="${markers.topRight.size}" height="${markers.topRight.size}" />
  <rect class="marker" x="${markers.bottomRight.x}" y="${markers.bottomRight.y}" width="${markers.bottomRight.size}" height="${markers.bottomRight.size}" />
  <rect class="marker" x="${markers.bottomLeft.x}" y="${markers.bottomLeft.y}" width="${markers.bottomLeft.size}" height="${markers.bottomLeft.size}" />

  <!-- 2. Header & GradeScan Branding Section -->
  <g transform="translate(100, 48)">
    <rect class="badge" x="0" y="2" width="92" height="20" rx="4" />
    <text class="badge-text" x="46" y="16">GRADESCAN</text>
    <text class="title" x="105" y="20">${escapeXml(title)}</text>
    <text class="sub" x="0" y="44">Class / Subject: ${escapeXml(className)}  •  Exam Date: ${escapeXml(examDate)}  •  Total Items: ${totalQuestions} Qs (A-D)</text>
  </g>

  <!-- QR Code for fast automated sheet identification -->
  ${qrDataUrl ? `<image href="${qrDataUrl}" x="825" y="45" width="85" height="85" />` : ''}

  <!-- 3. Student Identification Fill-in Header -->
  <g transform="translate(100, 115)">
    <!-- Student Full Name Field -->
    <rect class="header-box" x="0" y="0" width="510" height="38" />
    <text class="muted" x="12" y="16">STUDENT FULL NAME (LAST, FIRST, M.I.):</text>

    <!-- Grade Level and Section Field -->
    <rect class="header-box" x="0" y="46" width="250" height="38" />
    <text class="muted" x="12" y="62">GRADE LEVEL &amp; SECTION:</text>

    <!-- Student ID / LRN Field -->
    <rect class="header-box" x="260" y="46" width="250" height="38" />
    <text class="muted" x="272" y="62">DATE &amp; SUBJECT:</text>

    <!-- Instructions Box -->
    <rect class="header-box" x="0" y="92" width="510" height="75" />
    <text class="label" x="12" y="112">EXAMINATION MARKING INSTRUCTIONS:</text>
    <text class="muted" x="12" y="130">• Use dark pencil (No. 2 / HB) or black ink pen. Fill bubble completely: ⬛ (Incorrect: ✖ ✔ ⚪)</text>
    <text class="muted" x="12" y="146">• Bubble your 5-digit Student ID / LRN in the grid on the right.</text>
    <text class="muted" x="12" y="160">• Erase cleanly if changing an answer. Keep this sheet flat without folds or tears.</text>
  </g>

  <!-- 4. Student ID / LRN 5-Digit Bubble Matrix -->
  <g id="student-id-matrix">
    <rect x="635" y="125" width="210" height="325" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" rx="6" />
    <text class="label" x="740" y="148" text-anchor="middle">STUDENT ID / LRN</text>
    
    <!-- Column header boxes for handwritten digits -->
    ${[0, 1, 2, 3, 4].map(col => {
      const x = 650 + col * 36;
      return `<rect x="${x - 13}" y="156" width="26" height="24" fill="#ffffff" stroke="#94a3b8" stroke-width="1.2" rx="3" />`;
    }).join('')}
  `;

  // Draw Student ID bubbles
  for (const b of idBubbles) {
    const x = b.normX * CANONICAL_WIDTH;
    const y = b.normY * CANONICAL_HEIGHT + 35; // adjusted for ID header
    const r = b.normRadius * CANONICAL_WIDTH;
    svg += `
      <circle class="bubble-border" cx="${x}" cy="${y}" r="${r}" />
      <text class="bubble-text" x="${x}" y="${y}">${b.digitValue}</text>
    `;
  }

  svg += `</g>`;

  // Divider line before questions
  svg += `
    <line x1="70" y1="465" x2="930" y2="465" stroke="#0f766e" stroke-width="1.5" stroke-dasharray="4 4" />
    <text class="muted" x="500" y="460" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f766e">ANSWER CHOICES (A, B, C, D)</text>
  `;

  // Draw Question Rows & Bubbles (Choices A, B, C, D)
  for (let q = 1; q <= totalQuestions; q++) {
    const qCoords = qBubbles.filter(b => b.questionNumber === q);
    if (qCoords.length === 0) continue;

    const first = qCoords[0];
    const qX = first.normX * CANONICAL_WIDTH - 25;
    const qY = first.normY * CANONICAL_HEIGHT;

    // Question number label
    svg += `<text class="q-number" x="${qX}" y="${qY}">${q}.</text>`;

    for (const b of qCoords) {
      const bx = b.normX * CANONICAL_WIDTH;
      const by = b.normY * CANONICAL_HEIGHT;
      const br = b.normRadius * CANONICAL_WIDTH;

      svg += `
        <circle class="bubble-border" cx="${bx}" cy="${by}" r="${br}" />
        <text class="bubble-text" x="${bx}" y="${by}">${b.optionLabel}</text>
      `;
    }
  }

  // Footer
  svg += `
    <g transform="translate(100, 1375)">
      <text class="muted" x="400" y="0" text-anchor="middle">GradeScan Examination Platform • Align 4 corner black boxes within camera view to scan</text>
    </g>
  </svg>
  `;

  return svg;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export interface PDFDownloadResult {
  success: boolean;
  filename: string;
  blobUrl: string;
  blob: Blob;
  shared: boolean;
}

/**
 * Generates an in-memory PDF Blob with strictly 1 single page.
 */
export async function generateAnswerSheetPDFBlob(config: AnswerSheetConfig): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const svgString = await generateAnswerSheetSVG(config);

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // 2x supersampling for crisp print quality
      canvas.width = CANONICAL_WIDTH * 2;
      canvas.height = CANONICAL_HEIGHT * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = canvas.toDataURL('image/png');
        // Render exactly on 210 x 297mm A4 page
        doc.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        URL.revokeObjectURL(url);
        resolve();
      } else {
        reject(new Error('Canvas context initialization failed'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image rasterization failed'));
    };
    img.src = url;
  });

  // Strict single-page guarantee: remove any accidental overflow page
  while (doc.getNumberOfPages() > 1) {
    doc.deletePage(2);
  }

  const safeFilename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_sheet_${config.totalQuestions}q.pdf`;
  const pdfBlob = doc.output('blob');
  const typedBlob = new Blob([pdfBlob], { type: 'application/pdf' });

  return { blob: typedBlob, filename: safeFilename };
}

/**
 * Downloads a high-resolution, vector-accurate printable PDF document.
 * Includes mobile Chrome compatibility, Android Web Share API, and robust fallback.
 */
export async function downloadAnswerSheetPDF(config: AnswerSheetConfig): Promise<PDFDownloadResult> {
  const { blob, filename } = await generateAnswerSheetPDFBlob(config);
  const blobUrl = URL.createObjectURL(blob);

  let shared = false;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // If on mobile and Web Share API is available, share the actual PDF file
  if (isMobile && typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `${config.title} Answer Sheet`,
          text: `GradeScan Printable Answer Sheet (${config.totalQuestions} Questions)`,
        });
        shared = true;
      }
    } catch (shareErr: any) {
      // If user canceled the share dialog, do not treat as fatal error
      if (shareErr.name === 'AbortError') {
        return { success: true, filename, blobUrl, blob, shared: false };
      }
      console.warn('Web Share failed, proceeding with direct download:', shareErr);
    }
  }

  // Reliable cross-platform anchor download fallback
  if (!shared) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Keep blob URL active for 60 seconds to ensure mobile download manager finishes
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  }

  return {
    success: true,
    filename,
    blobUrl,
    blob,
    shared,
  };
}
