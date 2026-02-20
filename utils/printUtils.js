/**
 * printUtils.js
 * Premium, compact jsPDF printable slips (v3+ autotable compatible)
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ─── Shared Logic & UI Helpers ─────────────────────────── */

export const parseFee = (fee) => {
  try {
    const obj = typeof fee === "string" ? JSON.parse(fee) : fee || {};
    const get = (k1, k2) => Number(obj[k1] ?? obj[k2] ?? (typeof fee === "number" ? fee : 0));
    const [adm, mon, ann, sta] = [get("admission", "admission_fee"), get("monthly", "monthly_fee"), get("annual", "annual_charges"), get("stationery", "stationery_charges")];
    return { admission: adm, monthly: mon, annual: ann, stationery: sta, total: adm + mon + ann + sta };
  } catch {
    return { admission: 0, monthly: 0, annual: 0, stationery: 0, total: Number(fee) || 0 };
  }
};

const newDoc = () => new jsPDF({ unit: "pt", format: "a4" });

const openPdf = (doc) => {
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000); // Cleanup memory
};

const addHeader = (doc, title, showSchool = false) => {
  doc.setFont("helvetica", "bold");
  if (showSchool) {
    doc.setFontSize(20).setTextColor(30, 58, 138).text("DAR-E-ARQAM SCHOOL", 297, 45, { align: "center" });
  }
  
  doc.setFontSize(14).setTextColor(showSchool ? 71 : 15, showSchool ? 85 : 23, showSchool ? 105 : 42);
  doc.text(title.toUpperCase(), 297, showSchool ? 65 : 45, { align: "center" });
  
  const y = showSchool ? 75 : 55;
  doc.setDrawColor(226, 232, 240).setLineWidth(1).line(40, y, 555, y);
  
  const date = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
  doc.setFontSize(8).setTextColor(148, 163, 184).setFont("helvetica", "normal").text(`Generated: ${date}`, 555, y + 12, { align: "right" });
  
  return y + 25;
};

const addGuardianInfo = (doc, g, startY) => {
  // Compact 45pt high rounded box
  doc.setFillColor(248, 250, 252).setDrawColor(203, 213, 225).roundedRect(40, startY, 515, 45, 4, 4, "FD");
  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold").text("PARENTS/GUARDIAN DETAILS", 50, startY + 14);
  
  doc.setFontSize(9).setTextColor(15, 23, 42);
  // Row 1: Father & Contact
  doc.setFont("helvetica", "normal").text("Father: ", 50, startY + 28);
  doc.setFont("helvetica", "bold").text(g?.fathername || "—", 85, startY + 28);
  doc.setFont("helvetica", "normal").text("Contact: ", 300, startY + 28);
  doc.setFont("helvetica", "bold").text(g?.mobilenumber || "—", 340, startY + 28);
  
  // Row 2: Address
  doc.setFont("helvetica", "normal").text("Address: ", 50, startY + 40);
  doc.setFont("helvetica", "bold").text(g?.address || "—", 95, startY + 40);
  
  return startY + 60; 
};

const checkPageBreak = (doc, y, req = 120) => (y + req > doc.internal.pageSize.getHeight() ? (doc.addPage(), 50) : y);

// Shared sleek styling for autoTable
const tableTheme = {
  theme: "grid",
  margin: { left: 40, right: 40 },
  styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.5 },
  headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: "bold" }
};

/* ─── Fee Quotation Slip ────────────────────────────────── */

export const printFeeQuote = (siblings) => {
  if (!siblings?.length) return;
  const doc = newDoc();
  let y = addGuardianInfo(doc, siblings[0], addHeader(doc, "Inquiry Slip"));

  siblings.forEach((s) => {
    y = checkPageBreak(doc, y, 140);

    // Slim Sibling Banner
    doc.setFillColor(241, 245, 249).rect(40, y, 515, 20, "F");
    doc.setFontSize(10).setTextColor(15, 23, 42).setFont("helvetica", "bold").text(s.name, 48, y + 14);
    doc.setFont("helvetica", "normal").setTextColor(71, 85, 105).text(`  |  Class: ${s.class}`, 48 + doc.getTextWidth(s.name), y + 14);
    
    const fee = parseFee(s.quoted_fee);

    autoTable(doc, {
      ...tableTheme,
      startY: y + 20,
      head: [["Fee Component", "Amount (PKR)"]],
      body: [
        ["Admission Fee", fee.admission.toLocaleString()],
        ["Monthly Fee", fee.monthly.toLocaleString()],
        ["Annual Charges", fee.annual.toLocaleString()],
        ["Stationery Charges", fee.stationery.toLocaleString()],
        ["Total Payable", `PKR ${fee.total.toLocaleString()}`],
      ],
      columnStyles: { 0: { halign: "left" }, 1: { halign: "right", fontStyle: "bold", textColor: [30, 58, 138] } },
      didParseCell: (data) => {
        if (data.row.index === 4) { // Highlight Total Row
          data.cell.styles.fillColor = [238, 242, 255]; 
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    y = doc.lastAutoTable.finalY + 20;
  });

  openPdf(doc);
};

/* ─── Test Schedule Slip ────────────────────────────────── */

export const printTestSlip = (siblings) => {
  if (!siblings?.length) return;
  const doc = newDoc();
  let y = addGuardianInfo(doc, siblings[0], addHeader(doc, "Admission Test Schedule", true));

  siblings.forEach((s) => {
    y = checkPageBreak(doc, y, 140);

    // Slim Sibling Banner
    doc.setFillColor(241, 245, 249).rect(40, y, 515, 20, "F");
    doc.setFontSize(10).setTextColor(15, 23, 42).setFont("helvetica", "bold").text(s.name, 48, y + 14);
    doc.setFont("helvetica", "normal").setTextColor(71, 85, 105).text(`  |  Class: ${s.class}`, 48 + doc.getTextWidth(s.name), y + 14);

    const testDate = s.test_date 
      ? new Date(s.test_date).toLocaleString("en-PK", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) 
      : "Not Scheduled";

    autoTable(doc, {
      ...tableTheme,
      startY: y + 20,
      head: [["Detail", "Information"]],
      body: [
        ["Previous School", s.previous_school || "—"],
        ["Application Status", s.status || "—"],
        ["Academic Session", `${s.session || ""} ${s.year || ""}`.trim()],
        ["Test Date & Time", testDate],
      ],
      columnStyles: { 0: { halign: "left", cellWidth: 140, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { halign: "left" } }
    });

    y = doc.lastAutoTable.finalY + 20;
  });

  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(9).setFont("helvetica", "italic").setTextColor(100, 116, 139);
  doc.text("*** Please bring this slip with you on the test day ***", 297, y + 15, { align: "center" });

  openPdf(doc);
};
