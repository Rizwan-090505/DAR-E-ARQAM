// utils/resultCardGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to load image for the PDF
const loadImage = (src) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};

export const generateClassResultPDF = async (students, classInfo, dateRanges) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const logoUrl = '/logo-1.png';
  const logoImg = await loadImage(logoUrl);

  const colors = {
    primary: [31, 41, 55],
    accent: [37, 99, 235],
    light: [243, 244, 246],
    white: [255, 255, 255],
    border: [209, 213, 219],
  };

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;

  students.forEach((student, index) => {
    if (index > 0) doc.addPage();

    let finalY = margin;

    // ===== Header =====
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', margin, 10, 40, 25);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...colors.primary);
    doc.text("DAR-E-ARQAM SCHOOLS", pageWidth / 2, 25, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("تعلیم، تہذیب ساتھ ساتھ", pageWidth / 2, 32, { align: 'center' });

    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(1);
    doc.line(margin, 38, pageWidth - margin, 38);

    doc.setFillColor(...colors.primary);
    doc.rect(pageWidth / 2 - 30, 36, 60, 8, 'F');
    doc.setFontSize(12);
    doc.setTextColor(...colors.white);
    doc.text("RESULT CARD", pageWidth / 2, 41.5, { align: 'center' });

    // ===== Student Details =====
    finalY = 55;

    if (!student.isClear) {
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(220, 38, 38);
      doc.rect(margin, finalY - 8, pageWidth - (margin * 2), 8, 'FD');
      doc.setTextColor(185, 28, 28);
      doc.setFontSize(9);
      doc.text("Outstanding Dues Pending", pageWidth / 2, finalY - 2.5, { align: 'center' });
      finalY += 5;
    }

    autoTable(doc, {
      startY: finalY,
      head: [['Student Name', 'Father Name', 'Class', 'Roll / ID']],
      body: [[
        student.studentName,
        student.fatherName,
        student.className,
        student.dasNumber
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: colors.light,
        textColor: colors.primary,
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: colors.border
      },
      bodyStyles: {
        textColor: 0,
        fontSize: 11,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 50 },
      }
    });

    finalY = doc.lastAutoTable.finalY + 10;

    // ===== Marks Table =====
    const marksBody = student.marksData.map(m => {
      const percent = (m.obtained_marks / m.total_marks) * 100;
      return [
        m.subject,
        m.total_marks,
        m.obtained_marks,
        `${percent.toFixed(0)}%`,
        getGrade(percent)
      ];
    });

    const totalMax = student.marksData.reduce((acc, m) => acc + m.total_marks, 0);
    const totalObtained = student.marksData.reduce((acc, m) => acc + m.obtained_marks, 0);
    const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    marksBody.push([
      { content: 'OVERALL RESULT', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: totalMax, styles: { fontStyle: 'bold' } },
      { content: totalObtained, styles: { fontStyle: 'bold' } },
      { content: `${overallPercent.toFixed(1)}%`, styles: { fontStyle: 'bold' } },
      { content: getGrade(overallPercent), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
    ]);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colors.primary);
    doc.text(
      `Academic Performance (${dateRanges.start} to ${dateRanges.end})`,
      margin,
      finalY - 3
    );

    autoTable(doc, {
      startY: finalY,
      head: [['Subject', 'Total Marks', 'Obtained', 'Percentage', 'Grade']],
      body: marksBody,
      theme: 'striped',
      headStyles: {
        fillColor: colors.primary,
        textColor: colors.white,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center', fontStyle: 'bold' }
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: colors.border,
        lineWidth: 0.1
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      }
    });

    finalY = doc.lastAutoTable.finalY + 15;

    // ===== Attendance =====
    doc.setFontSize(11);
    doc.text(
      `Attendance Summary (${dateRanges.attnStart} to ${dateRanges.attnEnd})`,
      margin,
      finalY - 3
    );

    autoTable(doc, {
      startY: finalY,
      head: [['Total Working Days', 'Days Present', 'Days Absent', 'Attendance %']],
      body: [[
        student.attendance.total,
        student.attendance.present,
        student.attendance.absent,
        `${student.attendance.percent.toFixed(1)}%`
      ]],
      theme: 'plain',
      tableWidth: 'wrap',
      headStyles: {
        fillColor: colors.accent,
        textColor: colors.white,
        halign: 'center'
      },
      bodyStyles: {
        halign: 'center',
        lineColor: colors.border,
        lineWidth: 0.1
      }
    });

    // ===== Footer =====
    const footerY = pageHeight - 20;

    doc.setDrawColor(...colors.border);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setFont("helvetica", "italic");
    doc.text(
      "This document is computer-generated and does not require a signature.",
      pageWidth / 2,
      footerY + 5,
      { align: 'center' }
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(
      "© DAR-E-ARQAM SCHOOLS",
      pageWidth / 2,
      footerY + 10,
      { align: 'center' }
    );
  });

  doc.save(
    `Result_Card_${classInfo.name}_${new Date().toISOString().split('T')[0]}.pdf`
  );
};

const getGrade = (percent) => {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 33) return 'E';
  return 'F';
};

