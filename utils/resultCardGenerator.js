// utils/resultCardGenerator.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });

const formatDateRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const options = { day: "2-digit", month: "short", year: "numeric" };
  return `${s.toLocaleDateString("en-GB", options)} – ${e.toLocaleDateString("en-GB", options)}`;
};

export const generateClassResultPDF = async (students, classInfo, dateRanges) => {
  const doc = new jsPDF("p", "mm", "a4");
  const logoImg = await loadImage("/logo-1.png");

  const colors = {
    navy: [12, 26, 58],
    royal: [30, 64, 175],
    softBlue: [30, 64, 175],
    border: [200, 210, 220],
    white: [255, 255, 255],
    muted: [100, 110, 120],
  };

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  students.forEach((student, index) => {
    if (index !== 0) doc.addPage();

    let y = margin;

    /* ===================== IMPROVED HEADER ===================== */
    const headerHeight = 28;
    doc.setFillColor(...colors.royal);
    doc.roundedRect(margin, y, contentWidth, headerHeight, 4, 4, "F");

    if (logoImg) {
      // Maintain Aspect Ratio & Slightly Larger
      const targetHeight = 18; 
      const ar = logoImg.width / logoImg.height;
      const targetWidth = targetHeight * ar;
      
      // White Background for Logo
      doc.setFillColor(...colors.white);
      doc.roundedRect(margin + 4, y + 4, targetWidth + 4, targetHeight + 2, 2, 2, "F");
      
      doc.addImage(logoImg, "PNG", margin + 6, y + 5, targetWidth, targetHeight);
    }

    // RESULT CARD pushed to extreme right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...colors.white);
    doc.text("RESULT CARD", margin + contentWidth - 8, y + (headerHeight / 2) + 2, { align: "right" });

    y += headerHeight + 8;

    /* ===================== STUDENT INFO BLOCK ===================== */
    doc.setDrawColor(...colors.royal);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "D");

    doc.setFontSize(10);
    doc.setTextColor(...colors.navy);
    const leftCol = margin + 5;
    const rightCol = margin + (contentWidth / 2) + 5;

    doc.setFont("helvetica", "bold");
    doc.text(`Student:`, leftCol, y + 8);
    doc.text(`Father:`, rightCol, y + 8);
    doc.text(`Class:`, leftCol, y + 15);
    doc.text(`DAS No:`, rightCol, y + 15);

    doc.setFont("helvetica", "normal");
    doc.text(String(student.studentName), leftCol + 18, y + 8);
    doc.text(String(student.fatherName), rightCol + 18, y + 8);
    doc.text(String(student.className), leftCol + 18, y + 15);
    doc.text(String(student.dasNumber), rightCol + 18, y + 15);

    y += 32;

    /* ===================== ROUNDED MARKS TABLE ===================== */
    const academicRange = formatDateRange(dateRanges.start, dateRanges.end);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Marks Distribution", margin, y);
    doc.setFontSize(8);
    doc.text(academicRange, margin + contentWidth, y, { align: "right" });

    y += 4;

    const marksBody = student.marksData.map((m) => {
      const percent = (m.obtained_marks / m.total_marks) * 100;
      return [m.subject.replace(/_/g, " "), m.total_marks, m.obtained_marks, `${percent.toFixed(0)}%`, getGrade(percent)];
    });

    // Drawing a background "pod" for the table to give rounded appearance
    const tableEstimateHeight = (marksBody.length + 1) * 8 + 2; 
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(margin, y, contentWidth, tableEstimateHeight, 4, 4, "F");

    autoTable(doc, {
      startY: y,
      head: [["Subject", "Total", "Obtained", "%", "Grade"]],
      body: marksBody,
      theme: "plain", // Plain theme allows the rounded background to show
      styles: { 
        fontSize: 10, 
        cellPadding: 4, 
        font: "helvetica", 
        halign: 'center',
        lineColor: [240, 240, 240], 
        lineWidth: 0.1 
      },
      headStyles: { 
        fillColor: colors.royal, 
        textColor: 255, 
        fontStyle: "bold",
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' }
      },
      // Apply slight rounding logic to top corners of header via hooks if needed
      didDrawCell: (data) => {
          // This ensures the table fits inside the rounded rect
      }
    });

    y = doc.lastAutoTable.finalY + 12;

    /* ===================== ATTENDANCE ===================== */
    doc.setFontSize(11);
    doc.setTextColor(...colors.navy);
    doc.text("Attendance Summary", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Working Days", "Present", "Absent", "Percentage"]],
      body: [[student.attendance.total, student.attendance.present, student.attendance.absent, `${student.attendance.percent.toFixed(1)}%`]],
      theme: "striped",
      headStyles: { fillColor: colors.navy, textColor: 255 },
      styles: { halign: "center", fontSize: 9 }
    });

    /* ===================== FOOTER ===================== */
    const footerY = pageHeight - 20;
    doc.setDrawColor(...colors.border);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text("Address: 583 Q Block Model Town Lahore", margin, footerY + 7);
    doc.text("Phone: 03234447292", margin + contentWidth, footerY + 7, { align: "right" });
    doc.text("Software generated document. No need of signatures.", pageWidth / 2, pageHeight - 5, { align: "center" });
  });

  doc.save(`Result_Card_${classInfo.name}.pdf`);
};

const getGrade = (percent) => {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
};
