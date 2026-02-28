"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import {
  Trophy, Calendar, Printer, Search,
  ChevronDown, ChevronUp, School, FileSpreadsheet
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared grade helper
// ─────────────────────────────────────────────────────────────────────────────
function gradeFromPercent(p) {
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  if (p >= 33) return 'E';
  return 'F';
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
async function generatePDF({ studentsResults, subjects, subjectAverages, classes, selectedClass, startDate, endDate }) {
  const { jsPDF } = await import('jspdf');

  const className = classes.find(c => String(c.id) === String(selectedClass))?.name || 'Class';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Page dimensions & safe zones ─────────────────────────────────────────
  const PW = 297, PH = 210;           // A4 landscape
  const HEADER_H  = 22;               // top header band height
  const FOOTER_H  = 10;               // bottom footer band height
  const MARGIN    = 10;               // left/right page margin
  const CONTENT_TOP    = HEADER_H + 3;           // first safe content Y
  const CONTENT_BOTTOM = PH - FOOTER_H - 2;      // last safe content Y
  const CONTENT_H      = CONTENT_BOTTOM - CONTENT_TOP;
  const CONTENT_W      = PW - MARGIN * 2;

  // ── Colour palette ────────────────────────────────────────────────────────
  const C = {
    // Page chrome
    pageBg:   [245, 247, 250],
    hdrBg:    [10,  15,  30],
    hdrLine:  [79,  70,  229],   // indigo-600
    ftrBg:    [10,  15,  30],
    accent:   [79,  70,  229],
    accentLt: [199, 210, 254],   // indigo-200
    // Rows
    rowA:     [249, 250, 252],
    rowB:     [255, 255, 255],
    // Grade fills
    gFill: { 'A+': [209,250,229], A: [219,234,254], B: [254,243,199], C: [255,251,235], D: [255,237,213], E: [254,215,170], F: [254,202,202] },
    // Grade text
    gText: { 'A+': [4,120,87],   A: [29,78,216],   B: [146,64,14],  C: [161,98,7],   D: [154,52,18],  E: [194,65,12],  F: [185,28,28]  },
    // Neutrals
    white:  [255,255,255],
    black:  [0,  0,  0],
    ink:    [17, 24, 39],
    mid:    [75, 85, 99],
    muted:  [156,163,175],
    border: [229,231,235],
    // medals
    gold:   [253,211,77],
    silver: [209,213,219],
    bronze: [253,186,116],
    // stats
    emerald:[16, 185,129],
    red:    [239,68, 68],
    indigo: [99, 102,241],
    sky:    [14, 165,233],
  };

  // ── Low-level drawing helpers ─────────────────────────────────────────────
  const sf = c => doc.setFillColor  (c[0], c[1], c[2]);
  const sd = c => doc.setDrawColor  (c[0], c[1], c[2]);
  const st = c => doc.setTextColor  (c[0], c[1], c[2]);

  const fillR  = (x,y,w,h,c)          => { sf(c); doc.rect(x,y,w,h,'F'); };
  const bdR    = (x,y,w,h,fc,sc)      => { sf(fc); sd(sc); doc.rect(x,y,w,h,'FD'); };
  const strokeR= (x,y,w,h,c)          => { sd(c); doc.rect(x,y,w,h,'S'); };

  // Draw a table cell: optional fill → border → text
  const cell = (x, y, w, h, txt, opts = {}) => {
    const {
      fill = null, tc = C.ink, fs = 6.5, align = 'center',
      bold = false, bc = C.border, pad = 1.5,
    } = opts;
    if (fill) fillR(x, y, w, h, fill);
    strokeR(x, y, w, h, bc);
    doc.setFontSize(fs);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    st(tc);
    const ty = y + h / 2 + fs * 0.175;
    const s  = String(txt ?? '');
    if      (align === 'center') doc.text(s, x + w / 2,   ty, { align: 'center' });
    else if (align === 'right')  doc.text(s, x + w - pad,  ty, { align: 'right'  });
    else                          doc.text(s, x + pad,       ty);
  };

  const gFill = g => C.gFill[g] || C.rowB;
  const gText = g => C.gText[g] || C.ink;

  // ── TABLE column geometry ─────────────────────────────────────────────────
  const NAME_W  = 42;
  const POS_W   = 10;
  const OV_P_W  = 15;
  const OV_G_W  = 12;
  const FIXED_W = NAME_W + POS_W + OV_P_W + OV_G_W;
  const SUB_W   = Math.min(26, (CONTENT_W - FIXED_W) / Math.max(subjects.length, 1));
  const MRK_W   = SUB_W * 0.36;
  const PCT_W   = SUB_W * 0.36;
  const GRD_W   = SUB_W * 0.28;
  const TABLE_W = FIXED_W + subjects.length * SUB_W;
  const TX      = MARGIN + (CONTENT_W - TABLE_W) / 2;  // table start X, centred

  const ROW_H  = 7;
  const HDR1_H = 7;
  const HDR2_H = 5;

  // ── PAGE CHROME ───────────────────────────────────────────────────────────
  const paintBg = () => {
    fillR(0, 0, PW, PH, C.pageBg);
    // Subtle vertical accent stripes
    fillR(0,       0, 3, PH, C.accent);
    fillR(PW - 3,  0, 3, PH, C.accent);
  };

  const paintHeader = (title, sub) => {
    fillR(0, 0, PW, HEADER_H, C.hdrBg);
    fillR(3, 0, PW - 6, HEADER_H, C.hdrBg);      // keep over accent stripes
    fillR(0, HEADER_H - 1.5, PW, 1.5, C.hdrLine); // bottom rule
    // Title
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); st(C.white);
    doc.text(title, PW / 2, 9, { align: 'center' });
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); st(C.muted);
    doc.text(sub, PW / 2, 16.5, { align: 'center' });
  };

  const paintFooter = (pg, total) => {
    fillR(0, PH - FOOTER_H, PW, FOOTER_H, C.ftrBg);
    fillR(0, PH - FOOTER_H, PW, 1, C.hdrLine);
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); st(C.muted);
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`,
      MARGIN + 3, PH - 3.5,
    );
    doc.text(`Page ${pg} of ${total}`, PW - MARGIN - 3, PH - 3.5, { align: 'right' });
    doc.text(`${className}  ·  ${startDate} → ${endDate}`, PW / 2, PH - 3.5, { align: 'center' });
  };

  // ── TABLE HEADER (returns Y after headers) ────────────────────────────────
  const drawTableHeaders = (startY) => {
    let x = TX;
    const y1 = startY, y2 = startY + HDR1_H;

    // ── Row 1 label blocks ─────────────────────────────────────────────────
    bdR(x, y1, NAME_W, HDR1_H, C.hdrBg, C.hdrBg);
    doc.setFontSize(7); doc.setFont('helvetica','bold'); st(C.white);
    doc.text('STUDENT', x + NAME_W / 2, y1 + HDR1_H / 2 + 1.2, { align:'center' });
    x += NAME_W;

    bdR(x, y1, POS_W, HDR1_H, C.hdrBg, C.hdrBg);
    doc.setFontSize(6); st(C.muted);
    doc.text('POS', x + POS_W / 2, y1 + HDR1_H / 2 + 1.2, { align:'center' });
    x += POS_W;

    subjects.forEach(sub => {
      const lbl = sub.length > 11 ? sub.slice(0,10)+'…' : sub;
      bdR(x, y1, SUB_W, HDR1_H, [20,27,48], [30,41,59]);
      doc.setFontSize(6); doc.setFont('helvetica','bold'); st(C.accentLt);
      doc.text(lbl, x + SUB_W / 2, y1 + HDR1_H / 2 + 1.2, { align:'center' });
      x += SUB_W;
    });

    // Overall spanning cell
    bdR(x, y1, OV_P_W + OV_G_W, HDR1_H, C.accent, C.accent);
    doc.setFontSize(7); doc.setFont('helvetica','bold'); st(C.white);
    doc.text('OVERALL', x + (OV_P_W + OV_G_W) / 2, y1 + HDR1_H / 2 + 1.2, { align:'center' });

    // ── Row 2 sub-labels ───────────────────────────────────────────────────
    x = TX + NAME_W + POS_W;
    subjects.forEach(() => {
      cell(x,           y2, MRK_W, HDR2_H, 'Mrk', { fill:[18,25,45], tc:C.muted, fs:5,   bc:[15,23,42] });
      cell(x + MRK_W,   y2, PCT_W, HDR2_H, '%',   { fill:[18,25,45], tc:C.muted, fs:5,   bc:[15,23,42] });
      cell(x+MRK_W+PCT_W, y2, GRD_W, HDR2_H, 'Grd',{ fill:[18,25,45], tc:C.muted, fs:5, bc:[15,23,42] });
      x += SUB_W;
    });
    cell(x,           y2, OV_P_W, HDR2_H, '%',   { fill:[67,56,202], tc:C.white, fs:5.5 });
    cell(x + OV_P_W,  y2, OV_G_W, HDR2_H, 'Grd', { fill:[67,56,202], tc:C.white, fs:5.5 });

    return y2 + HDR2_H;
  };

  // ── SINGLE DATA ROW ───────────────────────────────────────────────────────
  const drawRow = (student, y, isOdd) => {
    const mm  = new Map(student.marksData.map(m => [m.subject, m]));
    const bg  = isOdd ? C.rowA : C.rowB;
    const ovG = student.overallGrade;
    let x = TX;

    // Name
    fillR(x, y, NAME_W, ROW_H, bg);
    strokeR(x, y, NAME_W, ROW_H, C.border);
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); st(C.ink);
    const nm = student.studentName.length > 23 ? student.studentName.slice(0,22)+'…' : student.studentName;
    doc.text(nm, x + 2, y + ROW_H/2 - 0.6);
    doc.setFontSize(5.2); doc.setFont('helvetica','normal'); st(C.muted);
    doc.text('ID: '+student.dasNumber, x + 2, y + ROW_H/2 + 2.8);
    x += NAME_W;

    // Position
    const pFill = student.position===1 ? C.gold : student.position===2 ? C.silver : student.position===3 ? C.bronze : bg;
    bdR(x, y, POS_W, ROW_H, pFill, C.border);
    doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    st(student.position <= 3 ? C.black : C.muted);
    doc.text(String(student.position), x + POS_W/2, y + ROW_H/2 + 1.4, { align:'center' });
    x += POS_W;

    // Subject columns
    subjects.forEach(sub => {
      const m   = mm.get(sub);
      const pct = (m?.total_marks > 0) ? (m.obtained_marks / m.total_marks) * 100 : undefined;
      const g   = pct !== undefined ? gradeFromPercent(pct) : '-';
      const gf  = pct !== undefined ? gFill(g) : bg;
      const gt  = pct !== undefined ? gText(g) : C.muted;

      // Marks & % on row background
      cell(x,           y, MRK_W, ROW_H, m?.obtained_marks ?? '—', { fill:bg, tc:C.mid, fs:6.2 });
      cell(x + MRK_W,   y, PCT_W, ROW_H, pct !== undefined ? pct.toFixed(0)+'%':'—', { fill:bg, tc:C.muted, fs:5.8 });

      // Grade badge — inner fill with 1px inset padding
      fillR(x + MRK_W + PCT_W, y, GRD_W, ROW_H, bg);
      strokeR(x + MRK_W + PCT_W, y, GRD_W, ROW_H, C.border);
      fillR(x + MRK_W + PCT_W + 0.6, y + 0.8, GRD_W - 1.2, ROW_H - 1.6, gf);
      doc.setFontSize(6.8); doc.setFont('helvetica','bold'); st(gt);
      doc.text(g, x + MRK_W + PCT_W + GRD_W/2, y + ROW_H/2 + 1.3, { align:'center' });
      x += SUB_W;
    });

    // Overall — full badge
    const ovF = gFill(ovG);
    const ovT = gText(ovG);
    fillR(x, y, OV_P_W, ROW_H, bg);
    strokeR(x, y, OV_P_W, ROW_H, ovT);
    fillR(x + 0.5, y + 0.7, OV_P_W - 1, ROW_H - 1.4, ovF);
    doc.setFontSize(6.8); doc.setFont('helvetica','bold'); st(ovT);
    doc.text(student.overallPercent.toFixed(1)+'%', x + OV_P_W/2, y + ROW_H/2 + 1.3, { align:'center' });
    x += OV_P_W;

    fillR(x, y, OV_G_W, ROW_H, bg);
    strokeR(x, y, OV_G_W, ROW_H, ovT);
    fillR(x + 0.5, y + 0.7, OV_G_W - 1, ROW_H - 1.4, ovF);
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); st(ovT);
    doc.text(ovG, x + OV_G_W/2, y + ROW_H/2 + 1.4, { align:'center' });
  };

  // ── AVERAGE FOOTER ROW ────────────────────────────────────────────────────
  const drawAvgRow = (y) => {
    let x = TX;
    bdR(x, y, NAME_W + POS_W, ROW_H, C.hdrBg, C.hdrBg);
    doc.setFontSize(6); doc.setFont('helvetica','bold'); st(C.accentLt);
    doc.text('CLASS AVERAGE', x + (NAME_W + POS_W)/2, y + ROW_H/2 + 1.2, { align:'center' });
    x += NAME_W + POS_W;

    subjects.forEach(sub => {
      const avg = parseFloat(subjectAverages[sub] || 0);
      const g   = gradeFromPercent(avg);
      bdR(x, y, SUB_W, ROW_H, [18,25,45], [30,41,59]);
      fillR(x + 0.5, y + 0.7, SUB_W - 1, ROW_H - 1.4, gFill(g));
      doc.setFontSize(6.5); doc.setFont('helvetica','bold'); st(gText(g));
      doc.text(avg.toFixed(1)+'%', x + SUB_W/2, y + ROW_H/2 + 1.2, { align:'center' });
      x += SUB_W;
    });
    bdR(x, y, OV_P_W + OV_G_W, ROW_H, [18,25,45], [30,41,59]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATS PAGE — completely self-contained, no overlap possible
  // Layout: strict grid of panels, each with its own bounding box
  // ─────────────────────────────────────────────────────────────────────────
  const drawStatsPage = () => {
    doc.addPage();
    paintBg();
    paintHeader(
      `ANALYTICS & STATISTICS  —  ${className.toUpperCase()}`,
      `Period: ${startDate}  →  ${endDate}  ·  ${studentsResults.length} students`
    );

    const allGrades = ['A+','A','B','C','D','E','F'];
    const gCounts   = {};
    allGrades.forEach(g => { gCounts[g] = 0; });
    studentsResults.forEach(s => { if (gCounts[s.overallGrade] !== undefined) gCounts[s.overallGrade]++; });

    const total      = studentsResults.length;
    const passCount  = studentsResults.filter(s => s.overallGrade !== 'F').length;
    const failCount  = gCounts['F'];
    const distCount  = (gCounts['A+']||0) + (gCounts['A']||0);
    const passRate   = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0.0';

    // ── Define grid panels (safe, non-overlapping) ──────────────────────────
    // Full layout from CONTENT_TOP to CONTENT_BOTTOM
    // Row 1: KPI bar  (height 22)
    // Row 2: [Grade Dist panel | Subject Avg panel]   (height ~72)
    // Row 3: [Top Performers panel | Pie + Summary panel]  (fills rest)

    const R1_Y = CONTENT_TOP;       const R1_H = 22;
    const R2_Y = R1_Y + R1_H + 4;  const R2_H = 72;
    const R3_Y = R2_Y + R2_H + 4;  const R3_H = CONTENT_BOTTOM - R3_Y;

    const MID_X = MARGIN + CONTENT_W / 2 + 2;  // right-column start
    const L_W   = CONTENT_W / 2 - 2;
    const R_W   = CONTENT_W / 2 - 2;

    // ── Helpers for panel drawing ──────────────────────────────────────────
    // Draw a card panel with dark background, accent top border
    const panel = (x, y, w, h, accentColor = C.accent) => {
      fillR(x, y, w, h, [22,30,50]);
      strokeR(x, y, w, h, [40,55,85]);
      fillR(x, y, w, 2.5, accentColor);   // top accent bar
    };

    // Section title inside panel (y is absolute)
    const panelTitle = (x, y, txt, col = C.white) => {
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); st(col);
      doc.text(txt, x, y);
      fillR(x, y + 1.5, 28, 0.6, col);   // underline
    };

    // ── ROW 1: KPI cards ────────────────────────────────────────────────────
    const KPIs = [
      { label:'Total Students', val: total,     color: C.indigo  },
      { label:'Passed',         val: passCount, color: C.emerald },
      { label:'Failed',         val: failCount, color: C.red     },
      { label:'Distinction',    val: distCount, color: C.gold    },
      { label:'Pass Rate',      val: passRate+'%', color: C.sky  },
    ];
    const KPI_W = (CONTENT_W - (KPIs.length - 1) * 3) / KPIs.length;

    KPIs.forEach(({ label, val, color }, i) => {
      const kx = MARGIN + i * (KPI_W + 3);
      const ky = R1_Y;
      fillR(kx, ky, KPI_W, R1_H, [22,30,50]);
      strokeR(kx, ky, KPI_W, R1_H, [40,55,85]);
      fillR(kx, ky, KPI_W, 2.5, color);   // accent top

      doc.setFontSize(13); doc.setFont('helvetica','bold'); st(color);
      doc.text(String(val), kx + KPI_W/2, ky + 14, { align:'center' });
      doc.setFontSize(5.8); doc.setFont('helvetica','normal'); st(C.muted);
      doc.text(label, kx + KPI_W/2, ky + 19.5, { align:'center' });
    });

    // ── ROW 2 LEFT: Grade Distribution ──────────────────────────────────────
    {
      const px = MARGIN, py = R2_Y, pw = L_W, ph = R2_H;
      panel(px, py, pw, ph, C.accent);

      panelTitle(px + 4, py + 8, 'OVERALL GRADE DISTRIBUTION', C.accentLt);

      const BAR_MAX = pw - 54;
      const BAR_H   = 7.5;
      const GAP     = 2.5;
      let   by      = py + 14;

      const gradeBarColors = {
        'A+': C.emerald, A: C.indigo, B: [245,158,11],
        C: [234,179,8], D: [249,115,22], E: [239,68,68], F: C.red,
      };

      allGrades.forEach(g => {
        const count = gCounts[g];
        const pct   = total > 0 ? (count / total) * 100 : 0;
        const bw    = (pct / 100) * BAR_MAX;
        const col   = gradeBarColors[g];

        // Grade label badge
        fillR(px + 4, by, 11, BAR_H, gFill(g));
        strokeR(px + 4, by, 11, BAR_H, gText(g));
        doc.setFontSize(6.5); doc.setFont('helvetica','bold'); st(gText(g));
        doc.text(g, px + 4 + 5.5, by + BAR_H/2 + 1.2, { align:'center' });

        // Track
        fillR(px + 18, by, BAR_MAX, BAR_H, [15,22,40]);
        if (bw > 0) {
          fillR(px + 18, by, bw, BAR_H, col);
          // Highlight shimmer on top
          fillR(px + 18, by, bw, 1.8, col.map(v => Math.min(255, v + 50)));
        }
        strokeR(px + 18, by, BAR_MAX, BAR_H, [30,41,70]);

        // Count & pct label
        doc.setFontSize(5.8); doc.setFont('helvetica','normal'); st(C.muted);
        doc.text(`${count} (${pct.toFixed(1)}%)`, px + 18 + BAR_MAX + 3, by + BAR_H/2 + 1.2);

        by += BAR_H + GAP;
      });
    }

    // ── ROW 2 RIGHT: Subject Averages ────────────────────────────────────────
    {
      const px = MID_X, py = R2_Y, pw = R_W, ph = R2_H;
      panel(px, py, pw, ph, C.sky);

      panelTitle(px + 4, py + 8, 'SUBJECT-WISE AVERAGES', [186,230,253]);

      const BAR_MAX = pw - 56;
      const BAR_H   = 7.5;
      const GAP     = 2.5;
      let   by      = py + 14;

      subjects.forEach(sub => {
        if (by + BAR_H > py + ph - 2) return; // safety: don't overflow panel

        const avg = parseFloat(subjectAverages[sub] || 0);
        const g   = gradeFromPercent(avg);
        const col = gText(g);
        const bw  = (avg / 100) * BAR_MAX;
        const lbl = sub.length > 15 ? sub.slice(0,14)+'…' : sub;

        doc.setFontSize(5.8); doc.setFont('helvetica','normal'); st(C.muted);
        doc.text(lbl, px + 4, by + BAR_H/2 + 1.2);

        fillR(px + 36, by, BAR_MAX, BAR_H, [15,22,40]);
        if (bw > 0) {
          fillR(px + 36, by, bw, BAR_H, gFill(g));
          fillR(px + 36, by, bw, 1.8, gFill(g).map(v => Math.min(255, v + 30)));
        }
        strokeR(px + 36, by, BAR_MAX, BAR_H, [30,41,70]);

        // Grade badge at end
        const bx2 = px + 36 + BAR_MAX + 2;
        fillR(bx2, by, 12, BAR_H, gFill(g));
        strokeR(bx2, by, 12, BAR_H, col);
        doc.setFontSize(5.8); doc.setFont('helvetica','bold'); st(col);
        doc.text(`${avg.toFixed(0)}%`, bx2 + 6, by + BAR_H/2 + 1.2, { align:'center' });

        by += BAR_H + GAP;
      });
    }

    // ── ROW 3 LEFT: Top Performers ───────────────────────────────────────────
    {
      const px = MARGIN, py = R3_Y, pw = L_W, ph = R3_H;
      panel(px, py, pw, ph, C.gold);
      panelTitle(px + 4, py + 8, 'TOP PERFORMERS', C.gold);

      const top  = studentsResults.slice(0, Math.min(5, Math.floor((ph - 14) / 14)));
      const meds = [C.gold, C.silver, C.bronze, [200,200,200],[200,200,200]];
      const lbls = ['1st','2nd','3rd','4th','5th'];
      let   cy   = py + 13;

      top.forEach((s, i) => {
        const ch = 12;
        fillR(px + 4, cy, pw - 8, ch, [15,22,40]);
        strokeR(px + 4, cy, pw - 8, ch, [40,55,85]);
        // Medal stripe
        fillR(px + 4, cy, 3.5, ch, meds[i]);

        doc.setFontSize(5.5); doc.setFont('helvetica','bold'); st(meds[i]);
        doc.text(lbls[i], px + 9, cy + 4.5);

        doc.setFontSize(6.8); doc.setFont('helvetica','bold'); st(C.white);
        const nm = s.studentName.length > 28 ? s.studentName.slice(0,27)+'…' : s.studentName;
        doc.text(nm, px + 9, cy + 9.5);

        // Pct badge (right)
        const bg = gFill(s.overallGrade);
        const tc = gText(s.overallGrade);
        fillR(px + pw - 32, cy + 1, 24, ch - 2, bg);
        doc.setFontSize(8); doc.setFont('helvetica','bold'); st(tc);
        doc.text(s.overallPercent.toFixed(1)+'%', px + pw - 20, cy + 7.5, { align:'center' });

        cy += ch + 2;
      });
    }

    // ── ROW 3 RIGHT: Pass/Fail pie + summary stats ───────────────────────────
    {
      const px = MID_X, py = R3_Y, pw = R_W, ph = R3_H;
      panel(px, py, pw, ph, C.emerald);

      // ── Left half of this panel: Pie chart ──────────────────────────────
      const PIE_W = pw * 0.45;
      panelTitle(px + 4, py + 8, 'PASS / FAIL', [167,243,208]);

      const cx   = px + PIE_W / 2;
      const cy   = py + ph / 2 + 2;
      const rad  = Math.min(PIE_W / 2 - 6, ph / 2 - 10);
      const pass = total > 0 ? passCount / total : 0;

      if (total > 0 && rad > 0) {
        // Draw full emerald circle first, then overlay red fail wedge
        doc.setFillColor(C.emerald[0], C.emerald[1], C.emerald[2]);
        doc.circle(cx, cy, rad, 'F');

        // Draw pass arc as polygon approximation
        if (pass > 0.005 && pass < 0.995) {
          // Draw fail arc as a filled polygon (center + arc points)
          const STEPS    = 60;
          const startAng = -Math.PI / 2 + pass * 2 * Math.PI; // fail starts where pass ends
          const sweep    = (1 - pass) * 2 * Math.PI;
          // Build triangle-fan points for fail segment
          const pts = [];
          for (let i = 0; i <= STEPS; i++) {
            const a = startAng + (i / STEPS) * sweep;
            pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
          }
          // Draw fail wedge using lines from center — jsPDF triangle approach
          doc.setFillColor(C.red[0], C.red[1], C.red[2]);
          for (let i = 0; i < pts.length - 1; i++) {
            // Each small triangle: center, pts[i], pts[i+1]
            doc.triangle(cx, cy, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], 'F');
          }
        } else if (pass <= 0.005) {
          // 100% fail — already drawn as full red circle above, skip emerald
          doc.setFillColor(C.red[0], C.red[1], C.red[2]);
          doc.circle(cx, cy, rad, 'F');
        }

        // Donut hole
        doc.setFillColor(22, 30, 50);
        doc.circle(cx, cy, rad * 0.52, 'F');

        // Centre label
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); st(C.white);
        doc.text(passRate+'%', cx, cy + 1.5, { align:'center' });
        doc.setFontSize(5.5); doc.setFont('helvetica','normal'); st(C.muted);
        doc.text('pass rate', cx, cy + 6, { align:'center' });

        // Legend below pie
        const LEG_Y = cy + rad + 5;
        fillR(cx - 14, LEG_Y, 7, 4, C.emerald);
        doc.setFontSize(5.5); doc.setFont('helvetica','normal'); st(C.muted);
        doc.text('Pass', cx - 6, LEG_Y + 3.2);
        fillR(cx + 4, LEG_Y, 7, 4, C.red);
        doc.text('Fail', cx + 12, LEG_Y + 3.2);
      }

      // ── Right half: summary stat rows ────────────────────────────────────
      const SX = px + PIE_W + 4;
      const SW = pw - PIE_W - 8;

      const stats = [
        { label:'Total Students', val: total,           color: C.indigo },
        { label:'Pass  (≥ 33%)',  val: passCount,       color: C.emerald},
        { label:'Fail  (< 33%)',  val: failCount,       color: C.red    },
        { label:'Distinction',    val: distCount,       color: C.gold   },
        { label:'Pass Rate',      val: passRate + '%',  color: C.sky    },
      ];

      let sy = py + 10;
      const STAT_ROW_H = (ph - 14) / stats.length;

      stats.forEach(({ label, val, color }) => {
        fillR(SX, sy, SW, STAT_ROW_H - 1, [15,22,40]);
        strokeR(SX, sy, SW, STAT_ROW_H - 1, [30,41,70]);
        fillR(SX, sy, 2.5, STAT_ROW_H - 1, color);  // left accent

        doc.setFontSize(5.8); doc.setFont('helvetica','normal'); st(C.muted);
        doc.text(label, SX + 5, sy + (STAT_ROW_H - 1) / 2 + 1);
        doc.setFontSize(9); doc.setFont('helvetica','bold'); st(color);
        doc.text(String(val), SX + SW - 3, sy + (STAT_ROW_H - 1) / 2 + 1.5, { align:'right' });

        sy += STAT_ROW_H;
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER DATA PAGES
  // ─────────────────────────────────────────────────────────────────────────
  let pageIdx = 1;
  paintBg();
  paintHeader(
    `CLASS RESULT REPORT  —  ${className.toUpperCase()}`,
    `Period: ${startDate}  →  ${endDate}  ·  ${studentsResults.length} students`
  );

  // Safe area for table
  const TABLE_SAFE_TOP    = CONTENT_TOP + 1;
  const TABLE_SAFE_BOTTOM = CONTENT_BOTTOM - 1;

  let y = drawTableHeaders(TABLE_SAFE_TOP);

  studentsResults.forEach((student, idx) => {
    // Check if we need a new page BEFORE drawing the row
    if (y + ROW_H > TABLE_SAFE_BOTTOM - ROW_H) {
      // Draw avg row, then footer, then new page
      drawAvgRow(y);
      paintFooter(pageIdx, '?');  // placeholder, fixed at end
      pageIdx++;
      doc.addPage();
      paintBg();
      paintHeader(
        `CLASS RESULT REPORT  —  ${className.toUpperCase()}  (cont.)`,
        `Period: ${startDate}  →  ${endDate}`
      );
      y = drawTableHeaders(TABLE_SAFE_TOP);
    }
    drawRow(student, y, idx % 2 === 0);
    y += ROW_H;
  });

  // Avg row after last student
  if (y + ROW_H <= TABLE_SAFE_BOTTOM) drawAvgRow(y);
  paintFooter(pageIdx, '?');

  // Stats page
  drawStatsPage();

  // Fix all page numbers now we know total
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    paintFooter(p, totalPages);
  }

  doc.save(`Result_${className}_${startDate}_${endDate}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ClassResultPage() {
  const [classes, setClasses]               = useState([]);
  const [selectedClass, setSelectedClass]   = useState('');
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');
  const [studentsResults, setStudentsResults] = useState([]);
  const [loading, setLoading]               = useState(false);
  const [generated, setGenerated]           = useState(false);
  const [subjects, setSubjects]             = useState([]);
  const [subjectAverages, setSubjectAverages] = useState({});
  const [gradeCounts, setGradeCounts]       = useState({});
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [pdfLoading, setPdfLoading]         = useState(false);

  useEffect(() => {
    supabase.from('classes').select('id, name').then(({ data }) => setClasses(data || []));
  }, []);

  // ── Single bulk query ─────────────────────────────────────────────────────
  const fetchClassResults = async () => {
    if (!selectedClass || !startDate || !endDate) return;
    setLoading(true);
    setGenerated(false);
    setStudentsResults([]);

    const { data: students, error: se } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber')
      .eq('class_id', selectedClass);

    if (se || !students?.length) { setLoading(false); setGenerated(true); return; }

    const ids = students.map(s => s.studentid);

    const { data: marks, error: me } = await supabase
      .from('marks')
      .select('studentid, obtained_marks, total_marks, tests!inner(test_name, date)')
      .in('studentid', ids)
      .gte('tests.date', startDate)
      .lte('tests.date', endDate);

    if (me) { console.error(me); setLoading(false); return; }

    // Group by student → subject
    const byStudent = {};
    const allSubs   = new Set();
    (marks || []).forEach(m => {
      const sub = m.tests?.test_name || 'Unknown';
      allSubs.add(sub);
      if (!byStudent[m.studentid])         byStudent[m.studentid] = {};
      if (!byStudent[m.studentid][sub])    byStudent[m.studentid][sub] = { obtained_marks: 0, total_marks: 0 };
      byStudent[m.studentid][sub].obtained_marks += m.obtained_marks;
      byStudent[m.studentid][sub].total_marks    += m.total_marks;
    });

    const results = students
      .filter(s => byStudent[s.studentid])
      .map(s => {
        const md      = Object.entries(byStudent[s.studentid]).map(([subject, d]) => ({ subject, ...d }));
        const totO    = md.reduce((a, m) => a + m.obtained_marks, 0);
        const totT    = md.reduce((a, m) => a + m.total_marks, 0);
        const pct     = totT > 0 ? (totO / totT) * 100 : 0;
        return { studentName: s.name, fatherName: s.fathername, mobilenumber: s.mobilenumber,
                 dasNumber: s.studentid, marksData: md, overallPercent: pct, overallGrade: gradeFromPercent(pct) };
      })
      .sort((a, b) => b.overallPercent - a.overallPercent)
      .map((s, i) => ({ ...s, position: i + 1 }));

    // Subject averages
    const subTot = {};
    results.forEach(s => s.marksData.forEach(m => {
      if (!subTot[m.subject]) subTot[m.subject] = { o: 0, t: 0 };
      subTot[m.subject].o += m.obtained_marks;
      subTot[m.subject].t += m.total_marks;
    }));
    const avgs = {};
    for (const k in subTot) avgs[k] = subTot[k].t > 0 ? ((subTot[k].o / subTot[k].t) * 100).toFixed(2) : 0;

    // Grade counts
    const gc = { 'A+':0, A:0, B:0, C:0, D:0, E:0, F:0 };
    results.forEach(s => { if (gc[s.overallGrade] !== undefined) gc[s.overallGrade]++; });

    setStudentsResults(results);
    setSubjectAverages(avgs);
    setGradeCounts(gc);
    setSubjects(Array.from(allSubs).sort());
    setGenerated(true);
    setLoading(false);
  };

  const handlePrint = async () => {
    if (!studentsResults.length) return;
    setPdfLoading(true);
    try {
      await generatePDF({ studentsResults, subjects, subjectAverages, classes, selectedClass, startDate, endDate });
    } catch (err) {
      console.error(err);
      alert('PDF error: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const exportCSV = () => {
    if (!studentsResults.length) return;
    let csv = 'Name,Student ID,Position';
    subjects.forEach(s => { csv += `,"${s} Mrk","${s} %","${s} Grd"`; });
    csv += ',Overall %,Overall Grd\n';
    studentsResults.forEach(s => {
      const mm = new Map(s.marksData.map(m => [m.subject, m]));
      let row  = `"${s.studentName}","${s.dasNumber}",${s.position}`;
      subjects.forEach(sub => {
        const m = mm.get(sub);
        const p = m?.total_marks > 0 ? (m.obtained_marks / m.total_marks)*100 : undefined;
        row += `,"${m?.obtained_marks??'-'}","${p !== undefined ? p.toFixed(1)+'%':'-'}","${p !== undefined ? gradeFromPercent(p):'-'}"`;
      });
      row += `,"${s.overallPercent.toFixed(2)}%","${s.overallGrade}"`;
      csv += row + '\n';
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
    a.download = `Result_${classes.find(c=>c.id==selectedClass)?.name||'Class'}.csv`;
    a.click();
  };

  const allGradesList = ['A+','A','B','C','D','E','F'];
  const gradeUIColors = {
    'A+': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    A:    'bg-blue-500/10 text-blue-300 border-blue-500/20',
    B:    'bg-amber-500/10 text-amber-300 border-amber-500/20',
    C:    'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
    D:    'bg-orange-500/10 text-orange-300 border-orange-500/20',
    E:    'bg-red-400/10 text-red-300 border-red-400/20',
    F:    'bg-red-600/10 text-red-400 border-red-600/20',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-slate-100 relative overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-[-5%] w-[40%] h-[40%] bg-slate-700/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <main className="container mx-auto p-4 md:p-6 max-w-7xl">

          {/* Page title */}
          <div className="flex flex-col mb-8 gap-1">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <School className="w-10 h-10 text-indigo-400" />
              <span className="text-black dark:text-white">Class Results</span>
            </h1>
            <p className="text-slate-400 text-lg font-light">Generate comprehensive grade reports and analytics.</p>
          </div>

          {/* Controls */}
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl mb-10 ring-1 ring-white/5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">Class</label>
                <Select onValueChange={setSelectedClass} value={selectedClass}>
                  <SelectTrigger className="h-12 bg-white border-slate-200 text-slate-900 rounded-xl">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-xl">
                    {classes.map(c => (
                      <SelectItem key={c.id} value={String(c.id)} className="cursor-pointer py-3">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Start Date
                </label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="h-12 bg-white border-slate-200 text-slate-900 rounded-xl [color-scheme:light]" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> End Date
                </label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="h-12 bg-white border-slate-200 text-slate-900 rounded-xl [color-scheme:light]" />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchClassResults} disabled={loading || !selectedClass || !startDate || !endDate}
                  className="h-12 w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg rounded-xl font-bold tracking-wide transition-all hover:scale-[1.02]">
                  {loading
                    ? <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Processing...
                      </div>
                    : <div className="flex items-center gap-2"><Search className="w-4 h-4" /> Generate Report</div>}
                </Button>
              </div>
            </div>
          </div>

          {generated && studentsResults.length > 0 && (
            <div className="space-y-8">

              {/* Summary bar */}
              <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {allGradesList.map(g => (gradeCounts[g] > 0) && (
                      <div key={g} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${gradeUIColors[g]}`}>
                        <span>{g}:</span>
                        <span>{gradeCounts[g]}</span>
                        <span className="font-normal opacity-60">
                          ({studentsResults.length > 0 ? ((gradeCounts[g]/studentsResults.length)*100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={exportCSV}
                      className="h-10 border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 rounded-lg">
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" /> Excel
                    </Button>
                    <Button variant="outline" onClick={handlePrint} disabled={pdfLoading}
                      className="h-10 border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 rounded-lg">
                      {pdfLoading
                        ? <div className="flex items-center gap-2">
                            <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                            Generating...
                          </div>
                        : <><Printer className="w-4 h-4 mr-2 text-indigo-400" /> Print PDF</>}
                    </Button>
                  </div>
                </div>

                {subjects.length > 0 && (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Subject Averages</p>
                    <div className="flex flex-wrap gap-2">
                      {subjects.map(sub => {
                        const avg = parseFloat(subjectAverages[sub] || 0);
                        const g   = gradeFromPercent(avg);
                        return (
                          <div key={sub} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${gradeUIColors[g]}`}>
                            <span className="text-slate-400 font-medium">{sub}:</span>
                            <span className="font-bold">{avg.toFixed(1)}%</span>
                            <span className="font-bold">({g})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-4">
                <p className="text-xs uppercase tracking-widest text-slate-400 text-center">Tap for details</p>
                {studentsResults.map(student => {
                  const expanded = expandedStudentId === student.dasNumber;
                  const mm = new Map(student.marksData.map(m => [m.subject, m]));
                  return (
                    <div key={student.dasNumber} onClick={() => setExpandedStudentId(expanded ? null : student.dasNumber)}
                      className={`bg-slate-900/40 border rounded-2xl transition-all shadow-lg cursor-pointer
                        ${expanded ? 'border-indigo-500/40 ring-1 ring-indigo-500/30' : 'border-white/10'}`}>
                      <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shadow-lg
                            ${student.position===1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-950'
                            : student.position===2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900'
                            : student.position===3 ? 'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950'
                            : 'bg-white/10 text-slate-200 border border-white/10'}`}>
                            {student.position <= 3 ? <Trophy className="w-5 h-5" /> : student.position}
                          </div>
                          <div>
                            <div className="font-bold text-lg dark:text-white">{student.studentName}</div>
                            <div className="text-xs text-slate-400 font-mono">#{student.dasNumber}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-black ${student.overallGrade==='F' ? 'text-red-400' : 'text-indigo-400'}`}>
                            {student.overallPercent.toFixed(1)}%
                          </div>
                          <div className={`text-xs font-bold uppercase ${gradeUIColors[student.overallGrade]?.split(' ')[1] || 'text-slate-400'}`}>
                            Grade: {student.overallGrade}
                          </div>
                        </div>
                      </div>
                      {expanded && (
                        <div className="bg-black/20 border-t border-white/5 p-4">
                          {subjects.map(sub => {
                            const m = mm.get(sub);
                            const g = m?.total_marks > 0 ? gradeFromPercent((m.obtained_marks/m.total_marks)*100) : '-';
                            return (
                              <div key={sub} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                                <span className="text-slate-200 font-medium">{sub}</span>
                                <div className="flex gap-4">
                                  <span className="text-slate-400 font-mono">{m?.obtained_marks||0}/{m?.total_marks||0}</span>
                                  <span className={`font-bold w-8 text-right ${g==='F' ? 'text-red-400' : 'text-white'}`}>{g}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="bg-white/5 p-1 flex justify-center border-t border-white/5">
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block relative">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-slate-500/20 via-indigo-500/20 to-slate-500/20 rounded-3xl blur-sm opacity-50 pointer-events-none" />
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-black/20 text-xs uppercase text-slate-300 font-bold tracking-wider">
                        <tr>
                          <th rowSpan="2" className="px-5 py-4 border-r border-white/5 sticky left-0 z-20 bg-slate-900">Student</th>
                          <th rowSpan="2" className="px-4 py-4 text-center border-r border-white/5">Pos.</th>
                          {subjects.map(sub => (
                            <th key={sub} colSpan="3" className="px-2 py-3 text-center border-r border-white/5 text-indigo-200">{sub}</th>
                          ))}
                          <th colSpan="2" className="px-2 py-3 text-center bg-indigo-500/10 text-indigo-200">Overall</th>
                        </tr>
                        <tr className="border-b border-white/10">
                          {subjects.map(sub => (
                            <>
                              <th key={`${sub}-m`} className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-white/5 w-14">Mrk</th>
                              <th key={`${sub}-p`} className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-white/5 w-14">%</th>
                              <th key={`${sub}-g`} className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-white/5 w-12">Grd</th>
                            </>
                          ))}
                          <th className="px-2 py-2 text-center bg-indigo-500/10 text-[10px] text-indigo-300 border-r border-white/5">%</th>
                          <th className="px-2 py-2 text-center bg-indigo-500/10 text-[10px] text-indigo-300">Grd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {studentsResults.map(student => {
                          const mm   = new Map(student.marksData.map(m => [m.subject, m]));
                          const fail = student.overallGrade === 'F';
                          return (
                            <tr key={student.dasNumber} className="hover:bg-white/5 transition-colors group">
                              <td className="px-5 py-4 border-r border-white/5 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
                                <div className="font-semibold dark:text-white">{student.studentName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{student.dasNumber}</div>
                              </td>
                              <td className="px-4 py-3 text-center border-r border-white/5">
                                {student.position <= 3
                                  ? <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                                      ${student.position===1 ? 'bg-yellow-400 text-black'
                                      : student.position===2 ? 'bg-slate-300 text-black'
                                      : 'bg-orange-400 text-black'}`}>{student.position}</span>
                                  : <span className="text-slate-500 font-mono">{student.position}</span>}
                              </td>
                              {subjects.map(sub => {
                                const m = mm.get(sub);
                                const p = m?.total_marks > 0 ? (m.obtained_marks/m.total_marks)*100 : undefined;
                                const g = p !== undefined ? gradeFromPercent(p) : '-';
                                return (
                                  <>
                                    <td key={`${sub}-m`} className="px-2 py-3 text-center text-xs text-slate-300/70 border-r border-white/5">{m?.obtained_marks??'—'}</td>
                                    <td key={`${sub}-p`} className="px-2 py-3 text-center text-xs text-slate-400 border-r border-white/5">{p ? p.toFixed(0)+'%':'—'}</td>
                                    <td key={`${sub}-g`} className={`px-2 py-3 text-center text-xs font-bold border-r border-white/5
                                      ${g==='A+'||g==='A' ? 'text-emerald-400' : g==='F' ? 'text-red-400' : 'text-slate-200'}`}>{g}</td>
                                  </>
                                );
                              })}
                              <td className={`px-2 py-3 text-center font-bold text-xs bg-indigo-500/5 ${fail ? 'text-red-400':'text-indigo-300'}`}>
                                {student.overallPercent.toFixed(1)}%
                              </td>
                              <td className={`px-2 py-3 text-center font-bold text-xs ${fail ? 'text-red-400 bg-red-500/10':'text-indigo-300 bg-indigo-500/5'}`}>
                                {student.overallGrade}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-black/30 border-t border-white/10 text-xs text-slate-400 font-bold">
                        <tr>
                          <td colSpan="2" className="px-5 py-3 text-right uppercase tracking-wider border-r border-white/5 sticky left-0 bg-slate-900 z-10">Class Avg.</td>
                          {subjects.map(sub => {
                            const avg = parseFloat(subjectAverages[sub] || 0);
                            const g   = gradeFromPercent(avg);
                            return (
                              <td key={`avg-${sub}`} colSpan="3" className="px-2 py-3 text-center border-r border-white/5">
                                <span className={`font-bold ${gradeUIColors[g]?.split(' ')[1] || ''}`}>{avg.toFixed(1)}%</span>
                              </td>
                            );
                          })}
                          <td colSpan="2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {generated && studentsResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/10 rounded-3xl border-dashed">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-medium text-white">No results found</h3>
              <p className="text-slate-400 max-w-sm text-center mt-2">No marks found for this class in the selected date range.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
