import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generates and opens a PDF receipt in a new tab using the "School Invoice" design.
 */
export const printReceipt = ({ student, invoiceId, items, totalPaidNow, balanceAfterPayment, receiptDate }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // --- 1. COLOR PALETTE ---
  const COLORS = {
    brand: [31, 41, 55],
    accent: [185, 28, 28],
    sub_bg: [249, 250, 251],
    text: [55, 65, 81],
    border: [229, 231, 235],
    green: [21, 128, 61]
  };

  // --- 2. HEADER BACKGROUND ---
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // --- 3. HEADER TEXT ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("DAR-E-ARQAM SCHOOL", margin, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(209, 213, 219);
  doc.text("Q MODEL TOWN CAMPUS", margin, 27);
  doc.text("Phone: +92 323 4447292", margin, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("PAYMENT RECEIPT", pageWidth - margin, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text("OFFICIAL COPY", pageWidth - margin, 27, { align: "right" });

  // --- 4. FLOATING METADATA BOX ---
  const boxY = 40;
  const boxHeight = 35;
  const boxWidth = pageWidth - (margin * 2);

  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, boxY, boxWidth, boxHeight, 2, 2, 'FD');

  const col1X = margin + 5;
  const textYStart = boxY + 8;
  const lineHeight = 7;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(9);

  doc.setFont("helvetica", "bold");
  doc.text("Student Name:", col1X, textYStart);
  doc.setFont("helvetica", "normal");
  doc.text(student?.name || 'N/A', col1X + 30, textYStart);

  doc.setFont("helvetica", "bold");
  doc.text("Father Name:", col1X, textYStart + lineHeight);
  doc.setFont("helvetica", "normal");
  doc.text(student?.fathername || 'N/A', col1X + 30, textYStart + lineHeight);

  doc.setFont("helvetica", "bold");
  doc.text("ID / Roll No:", col1X, textYStart + (lineHeight * 2));
  doc.setFont("helvetica", "normal");
  doc.text(String(student?.studentid || 'N/A'), col1X + 30, textYStart + (lineHeight * 2));

  const col2X = pageWidth / 2 + 10;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text("Receipt ID:", col2X, textYStart);
  doc.setFont("helvetica", "normal");
  doc.text(`#${invoiceId}-${Date.now().toString().slice(-4)}`, col2X + 25, textYStart);

  doc.setFont("helvetica", "bold");
  doc.text("Ref Invoice:", col2X, textYStart + lineHeight);
  doc.setFont("helvetica", "normal");
  doc.text(`#${invoiceId}`, col2X + 25, textYStart + lineHeight);

  const displayDate = new Date(receiptDate || Date.now()).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric"
  });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.accent);
  doc.text("Date Paid:", col2X, textYStart + (lineHeight * 2));
  doc.setFont("helvetica", "normal");
  doc.text(displayDate, col2X + 25, textYStart + (lineHeight * 2));

  // --- 5. FEE TABLE ---
  // Columns: FEE TYPE | AMOUNT RECEIVED | AMOUNT PENDING
  const tableStartY = boxY + boxHeight + 10;

  const filteredItems = items.filter(item => item.payingNow > 0);

  // Rows: fee type | amount received (payingNow) only
  const receiptRows = filteredItems.map(item => [
    item.fee_type,
    item.payingNow.toLocaleString()
  ]);

  if (receiptRows.length === 0) {
    receiptRows.push(["No payment recorded", "0"]);
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [['FEE TYPE', 'AMOUNT RECEIVED']],
    body: receiptRows,
    foot: [[
      { content: 'TOTAL RECEIVED', styles: { fontStyle: 'bold', textColor: [255, 255, 255] } },
      { content: totalPaidNow.toLocaleString(), styles: { fontStyle: 'bold', textColor: [255, 255, 255], halign: 'right' } },
    ]],
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: COLORS.brand,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      cellPadding: 3.5
    },
    bodyStyles: {
      textColor: COLORS.text,
      fontSize: 9,
      cellPadding: 3.5
    },
    footStyles: {
      fillColor: COLORS.brand,
      fontSize: 9,
      cellPadding: 3.5,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'right' }
    },
    didParseCell: function (data) {
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
    willDrawCell: function (data) {
      if (data.section === 'body' && data.row.index % 2 === 0) {
        doc.setFillColor(...COLORS.sub_bg);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
      }
    }
  });

  // --- BALANCE ROW after table ---
  const balanceY = doc.lastAutoTable.finalY + 8;
  const rowHeight = 9;
  const tableWidth = pageWidth - (margin * 2);

  doc.setFillColor(...COLORS.sub_bg);
  doc.rect(margin, balanceY, tableWidth, rowHeight, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(margin, balanceY, tableWidth, rowHeight, 'S');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text("BALANCE REMAINING", margin + 4, balanceY + 6);

  const balanceText = balanceAfterPayment === 0 ? '0 ✓' : balanceAfterPayment.toLocaleString();
  doc.setTextColor(...(balanceAfterPayment === 0 ? COLORS.green : COLORS.accent));
  doc.text(balanceText, pageWidth - margin - 4, balanceY + 6, { align: 'right' });

  // --- 6. PAID IN FULL BADGE ---
  if (balanceAfterPayment === 0) {
    const badgeY = balanceY + rowHeight + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.green);
    doc.text("✓ PAID IN FULL", pageWidth - margin, badgeY, { align: "right" });
  }

  // --- 7. FOOTER ---
  const footerY = pageHeight - 40;

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.1);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.brand);
  doc.text("Instructions:", margin, footerY + 5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("1. Please keep this receipt for your records.", margin, footerY + 10);
  doc.text("2. Any discrepancies must be reported within 7 days.", margin, footerY + 14);
  doc.text("3. This is a computer-generated receipt and requires no signature.", margin, footerY + 18);

  // --- 8. OPEN IN NEW TAB ---
  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank");
};
