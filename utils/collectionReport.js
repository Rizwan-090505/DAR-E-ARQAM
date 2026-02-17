import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const generateCollectionReportBlob = (receipts, dateRange = "All Time") => {
  // Initialize A4 vertical document
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Compact margins
  const margin = 40; 

  // --- 1. Header Section ---
  // School Name (Bold, pure black for crisp printing)
  doc.setTextColor(0, 0, 0); 
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("DAR-E-ARQAM SCHOOL", margin, 45);

  // Document Title (Slightly smaller, right-aligned for balance)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FEE COLLECTION REPORT", pageWidth - margin, 45, { align: "right" });

  // Aesthetically pleasing sharp separator line (Pure black)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.5);
  doc.line(margin, 55, pageWidth - margin, 55);

  // --- 2. Meta Information ---
  // Dark gray for meta to establish hierarchy without losing print quality
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80); 

  // Date Range (Left)
  doc.text(`DATE RANGE: ${dateRange.toUpperCase()}`, margin, 70);
  
  // Generation Time (Right)
  const generatedTime = new Date().toLocaleString("en-US", { 
    dateStyle: "medium", timeStyle: "short" 
  });
  doc.text(`GENERATED: ${generatedTime.toUpperCase()}`, pageWidth - margin, 70, { align: "right" });

  // --- 3. Table Construction ---
  const tableColumns = ["STUDENT NAME", "DESCRIPTION", "AMOUNT (PKR)", "MODE"];
  const tableRows = [];
  let totalAmount = 0;

  receipts.forEach((rcpt) => {
    const studentName = rcpt.fee_invoices?.students?.name || "Unknown";
    const description = rcpt.displayFeeLabel || "N/A";
    const amount = Number(rcpt.amount) || 0;
    const mode = rcpt.displayMethod || "Cash";

    totalAmount += amount;

    tableRows.push([
      studentName,
      description,
      amount.toLocaleString(), 
      mode.toUpperCase()
    ]);
  });

  // Semantic Footer Row for AutoTable
  const tableFoot = [
    [
      { 
        content: "TOTAL COLLECTION", 
        colSpan: 2, 
        styles: { halign: "right", fontStyle: "bold" } 
      },
      { 
        content: totalAmount.toLocaleString(), 
        styles: { fontStyle: "bold" } 
      },
      "" // Empty cell for "Mode" column
    ]
  ];

  // --- 4. Render Table (Ledger-Style for B&W Print) ---
  autoTable(doc, {
    startY: 85,
    head: [tableColumns],
    body: tableRows,
    foot: tableFoot,
    theme: "plain", // Strip default styling
    margin: { left: margin, right: margin, bottom: 50 },
    
    // Header: Classic solid top and bottom lines
    headStyles: {
      fillColor: false,
      textColor: 0, // Pure black
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      lineColor: 0, 
      lineWidth: { top: 1, bottom: 1 }, // Print-friendly borders
    },
    
    // Body: Clean, no backgrounds, dark text
    bodyStyles: {
      fontSize: 8,
      textColor: 20, // Near-black for readability
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    
    // Footer (Total): Emphasized bottom border
    footStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      lineColor: 0,
      lineWidth: { top: 1, bottom: 2 }, // Thicker bottom line signifies "Grand Total"
    },
    
    // Column Alignments
    columnStyles: {
      0: { cellWidth: 160 }, 
      1: { cellWidth: "auto" }, 
      2: { halign: "right", cellWidth: 80, fontStyle: "bold", textColor: 0 }, 
      3: { halign: "center", cellWidth: 60 }, 
    },
    
    // Page Numbers (The "Pro" touch)
    didDrawPage: function (data) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `PAGE ${data.pageNumber} OF ${doc.internal.getNumberOfPages()}`,
        pageWidth / 2,
        pageHeight - 20,
        { align: "center" }
      );
    }
  });

  // --- 5. Output Blob ---
  return doc.output("blob");
};
