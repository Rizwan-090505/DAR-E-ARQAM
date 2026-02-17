import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper to format currency/numbers for the PDF UI (turns 0 into "-")
const formatVal = (val) => (val && val > 0 ? val.toLocaleString() : "-");

// 1. Made async so React can await it and handle loading states
export const exportToPDF = async (defaulters, startDate, endDate) => {
  try {
    // 2. Throw explicit errors so React can catch them and show a toast
    if (!defaulters || defaulters.length === 0) {
      throw new Error("No student data available to export.");
    }

    // Use landscape orientation for 9 columns to prevent squashing
    const doc = new jsPDF("landscape");

    /* --- B&W PRINT-FRIENDLY HEADER --- */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); // Pure Black
    doc.text("DAR-E-ARQAM SCHOOL", 14, 16);
    
    doc.setFontSize(14);
    doc.text("Defaulter Report", 283, 16, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const safeDate = new Date().toLocaleDateString().replace(/\//g, "-");
    doc.text(`Generated: ${safeDate}`, 14, 23);
    
    if (startDate && endDate) {
      doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 28);
    }

    // Draw a neat horizontal line under the header
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(14, 32, 283, 32);

    /* --- TABLE DATA --- */
    const columns = [
      "Student Details", 
      "Class", 
      "Curr Tuition", 
      "Prev Tuition", 
      "Annual", 
      "Stationery", 
      "Arrears", 
      "Total Pending", 
      "Rec. This Mth"
    ];

    const rows = defaulters.map(student => ([
      `${student.name || "N/A"}\n${student.fathername || "N/A"} • ${student.studentid || "N/A"}`,
      student.className || "N/A",
      formatVal(student.currentTuition),
      formatVal(student.prevTuition),
      formatVal(student.annualCharges),
      formatVal(student.stationeryCharges),
      formatVal(student.arrears),
      formatVal(student.totalPending),
      formatVal(student.amountReceivedThisMonth)
    ]));

    /* --- GRAND TOTALS --- */
    const totals = {
      currentTuition: defaulters.reduce((a, b) => a + (b.currentTuition || 0), 0),
      prevTuition: defaulters.reduce((a, b) => a + (b.prevTuition || 0), 0),
      annualCharges: defaulters.reduce((a, b) => a + (b.annualCharges || 0), 0),
      stationeryCharges: defaulters.reduce((a, b) => a + (b.stationeryCharges || 0), 0),
      arrears: defaulters.reduce((a, b) => a + (b.arrears || 0), 0),
      totalPending: defaulters.reduce((a, b) => a + (b.totalPending || 0), 0),
      received: defaulters.reduce((a, b) => a + (b.amountReceivedThisMonth || 0), 0),
    };

    rows.push([
      { content: "GRAND TOTAL", colSpan: 2, styles: { halign: "right", fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.currentTuition), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.prevTuition), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.annualCharges), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.stationeryCharges), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.arrears), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.totalPending), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: formatVal(totals.received), styles: { fontStyle: "bold", fillColor: [235, 235, 235] } }
    ]);

    /* --- AUTOTABLE --- */
    const totalPagesExp = "{total_pages_count_string}";
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: 38,
      theme: "grid",
      headStyles: { 
        fillColor: [220, 220, 220], // Light Gray for solid B&W printing
        textColor: [0, 0, 0],       // Black Text
        fontSize: 9,
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 2.5, 
        valign: "middle",
        lineColor: [100, 100, 100], // Visible gray borders
        lineWidth: 0.1,
        textColor: [0, 0, 0] // Black text
      },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right", fontStyle: "bold" }, // Total Pending bolded
        8: { halign: "right" }
      },
      alternateRowStyles: { fillColor: [248, 248, 248] }, // Extremely faint gray for readability
      margin: { left: 14, right: 14 },
      didDrawPage: function (data) {
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        // Positioned at Y: 200 for Landscape bottom-right corner
        doc.text(
          `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${totalPagesExp}`,
          283, 200, { align: "right" }
        );
      }
    });

    if (typeof doc.putTotalPages === "function") {
      doc.putTotalPages(totalPagesExp);
    }

    doc.save(`Defaulter_Report_${safeDate}.pdf`);
    
    // 3. Return a success flag so React knows it finished
    return true; 

  } catch (error) {
    // Pass any underlying jsPDF errors back to React
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

/* ====================== CSV EXPORT ====================== */

export const exportToCSV = async (defaulters) => {
  try {
    if (!defaulters || defaulters.length === 0) {
      throw new Error("No student data available to export.");
    }

    // Expanded headers to match UI
    const headers = [
      "Student ID", "Name", "Father Name", "Class", 
      "Curr Tuition", "Prev Tuition", "Annual Charges", 
      "Stationery", "Arrears", "Total Pending", "Received This Month"
    ];

    const rows = defaulters.map(d => [
      d.studentid || "",
      `"${(d.name || "").replace(/"/g, '""')}"`, 
      `"${(d.fathername || "").replace(/"/g, '""')}"`,
      `"${(d.className || "").replace(/"/g, '""')}"`,
      d.currentTuition || 0,
      d.prevTuition || 0,
      d.annualCharges || 0,
      d.stationeryCharges || 0,
      d.arrears || 0,
      d.totalPending || 0,
      d.amountReceivedThisMonth || 0
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    const safeDate = new Date().toLocaleDateString().replace(/\//g, "-");
    link.download = `Dar-e-Arqam_Defaulters_${safeDate}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;

  } catch (error) {
    throw new Error(`Failed to generate CSV: ${error.message}`);
  }
};
