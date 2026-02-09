import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generates and downloads a PDF receipt using the "School Invoice" design.
 */
export const printReceipt = ({ student, invoiceId, items, totalPaidNow, balanceAfterPayment }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15; // Approx equivalent to 50pt in original design

  // --- 1. COLOR PALETTE (Converted from Hex to RGB) ---
  const COLORS = {
    brand: [31, 41, 55],    // #1F2937 (Dark Charcoal)
    accent: [185, 28, 28],  // #B91C1C (Red)
    sub_bg: [249, 250, 251],// #F9FAFB (Very Light Grey)
    text: [55, 65, 81],     // #374151 (Dark Grey)
    border: [229, 231, 235] // #E5E7EB (Light Border)
  };

  // --- 2. HEADER BACKGROUND ---
  // Large dark strip at the top (approx 140pt -> ~50mm)
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // --- 3. HEADER TEXT ---
  // Left: School Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20); // 24pt -> ~20 equivalent
  doc.setTextColor(255, 255, 255);
  doc.text("DAR-E-ARQAM SCHOOL", margin, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(209, 213, 219); // Light gray text
  doc.text("Q MODEL TOWN CAMPUS", margin, 27);
  doc.text("Phone: +92 323 4447292", margin, 32);

  // Right: Badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("PAYMENT RECEIPT", pageWidth - margin, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text("OFFICIAL COPY", pageWidth - margin, 27, { align: "right" });

  // --- 4. FLOATING METADATA BOX ---
  // White box with border/shadow effect overlapping the header
  const boxY = 40;
  const boxHeight = 35;
  const boxWidth = pageWidth - (margin * 2);

  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, boxY, boxWidth, boxHeight, 2, 2, 'FD');

  // Box Content - Column 1 (Student)
  const col1X = margin + 5;
  const textYStart = boxY + 8;
  const lineHeight = 7;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(9);

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("Student Name:", col1X, textYStart);
  doc.setFont("helvetica", "normal");
  doc.text(student?.name || 'N/A', col1X + 30, textYStart);

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.text("Father Name:", col1X, textYStart + lineHeight);
  doc.setFont("helvetica", "normal");
  doc.text(student?.fathername || 'N/A', col1X + 30, textYStart + lineHeight);

  // Row 3
  doc.setFont("helvetica", "bold");
  doc.text("ID / Roll No:", col1X, textYStart + (lineHeight * 2));
  doc.setFont("helvetica", "normal");
  doc.text(student?.studentid || 'N/A', col1X + 30, textYStart + (lineHeight * 2));

  // Box Content - Column 2 (Transaction)
  const col2X = pageWidth / 2 + 10;

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("Receipt ID:", col2X, textYStart);
  doc.setFont("helvetica", "normal");
  doc.text(`#${invoiceId}-${Date.now().toString().slice(-4)}`, col2X + 25, textYStart);

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.text("Ref Invoice:", col2X, textYStart + lineHeight);
  doc.setFont("helvetica", "normal");
  doc.text(`#${invoiceId}`, col2X + 25, textYStart + lineHeight);

  // Row 3 (Date - Red Accent)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.accent);
  doc.text("Date Paid:", col2X, textYStart + (lineHeight * 2));
  doc.text(new Date().toLocaleDateString(), col2X + 25, textYStart + (lineHeight * 2));

  // --- 5. FEE TABLE ---
  const tableStartY = boxY + boxHeight + 10;

  // Filter items like in your original code
  const receiptRows = items
    .filter(item => item.payingNow > 0)
    .map(item => [
      item.fee_type,
      item.totalAmount.toLocaleString(),
      item.payingNow.toLocaleString()
    ]);

  if (receiptRows.length === 0) receiptRows.push(["No payment recorded", "-", "0"]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['DESCRIPTION', 'TOTAL FEE', 'PAID NOW (PKR)']],
    body: receiptRows,
    theme: 'plain', // We construct the style manually to match design
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: COLORS.brand,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      cellPadding: 3
    },
    bodyStyles: {
      textColor: COLORS.text,
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 'auto' }, // Description
      1: { cellWidth: 40, halign: 'right' }, // Total Fee
      2: { cellWidth: 40, halign: 'right' }  // Paid Now
    },
    didParseCell: function (data) {
      // Align the header for amounts to the right manually if needed, 
      // but columnStyles usually handles it.
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
    willDrawCell: function (data) {
      // Zebra Striping manually to match the #F9FAFB look
      if (data.section === 'body' && data.row.index % 2 === 0) {
        doc.setFillColor(...COLORS.sub_bg);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
      }
    }
  });

  // --- 6. TOTALS SECTION ---
  const finalY = doc.lastAutoTable.finalY + 5;

  // Separator Line
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.5);
  doc.line(margin, finalY, pageWidth - margin, finalY);

  const totalY = finalY + 8;

  // Total Label (Brand Color)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.brand);
  doc.text("TOTAL PAID", margin + 5, totalY);

  // Total Amount (Red Accent)
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.accent);
  doc.text(`Rs. ${totalPaidNow.toLocaleString()}`, pageWidth - margin, totalY, { align: "right" });

  // Balance (Small Text)
  if (balanceAfterPayment > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(`Remaining Balance: Rs. ${balanceAfterPayment.toLocaleString()}`, pageWidth - margin, totalY + 6, { align: "right" });
  }

  // --- 7. FOOTER / INSTRUCTIONS ---
  const footerY = pageHeight - 40;

  // Footer Line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.1);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  // Instructions
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.brand);
  doc.text("Instructions:", margin, footerY + 5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.text("1. Please keep this receipt for your records.", margin, footerY + 10);
  doc.text("2. Any discrepancies must be reported within 7 days.", margin, footerY + 14);
  doc.text("3. This is a computer-generated receipt and requires no signature.", margin, footerY + 18);

  // --- SAVE ---
  const safeName = (student?.name || "Student").replace(/[^a-z0-9]/gi, '_');
  doc.save(`Receipt_${safeName}_${invoiceId}.pdf`);
};
