import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabaseClient";

export const generateCollectionReportBlob = async (startDate, endDate) => {

  // --- 1. Fetch data from Supabase using Pagination ---
  let allReceipts = [];
  let fetchMore = true;
  let from = 0;
  const pageSize = 1000;

  while (fetchMore) {
    const to = from + pageSize - 1;

    const { data: receiptsChunk, error } = await supabase
      .from("fee_payments")
      .select(`
        *,
        fee_invoice_details (
          fee_type
        ),
        fee_invoices (
          id,
          invoice_date,
          students (
            studentid,
            name,
            fathername,
            class_id,
            classes ( name )
          )
        )
      `)
      .gte("paid_at", `${startDate}T00:00:00.000Z`)
      .lte("paid_at", `${endDate}T23:59:59.999Z`)
      .order('paid_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (receiptsChunk && receiptsChunk.length > 0) {
      allReceipts.push(...receiptsChunk);
      from += pageSize;
      if (receiptsChunk.length < pageSize) {
        fetchMore = false;
      }
    } else {
      fetchMore = false;
    }
  }

  if (!allReceipts || allReceipts.length === 0) {
    throw new Error("No collections found for this date range.");
  }

  // --- 2. Format Date Range string for the header ---
  const startStr = new Date(startDate).toLocaleDateString();
  const endStr = new Date(endDate).toLocaleDateString();
  const dateRangeString = startStr === endStr ? startStr : `${startStr} to ${endStr}`;

  // --- 3. Grouping Logic (keyed by studentId + date + mode) ---
  const groupedMap = new Map();

  allReceipts.forEach((rcpt) => {
    const studentName = rcpt.fee_invoices?.students?.name || "Unknown";
    const studentId = rcpt.fee_invoices?.students?.studentid || studentName;
    const classData = rcpt.fee_invoices?.students?.classes;
    const studentClass = classData
      ? (Array.isArray(classData) ? classData[0]?.name : classData.name)
      : "N/A";

    const receiptDate = rcpt.paid_at ? new Date(rcpt.paid_at).toLocaleDateString() : "N/A";
    const description = rcpt.fee_invoice_details?.fee_type || "General Payment";
    const amount = Number(rcpt.amount) || 0;
    const mode = rcpt.payment_method || "Cash";

    // Key includes mode so different payment modes are never merged
    const key = `${studentId}_${receiptDate}_${mode}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        date: receiptDate,
        name: studentName,
        className: studentClass,
        descriptions: new Set([description]),
        amount: amount,
        mode: mode
      });
    } else {
      const existing = groupedMap.get(key);
      existing.amount += amount;
      existing.descriptions.add(description);
    }
  });

  // --- 4. Initialize PDF Document ---
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Header Section
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("DAR-E-ARQAM SCHOOL", margin, 45);

  doc.setFontSize(10);
  doc.text("FEE COLLECTION REPORT", pageWidth - margin, 45, { align: "right" });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.5);
  doc.line(margin, 55, pageWidth - margin, 55);

  // Meta Information
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);

  doc.text(`DATE RANGE: ${dateRangeString.toUpperCase()}`, margin, 70);

  const generatedTime = new Date().toLocaleString("en-US", {
    dateStyle: "medium", timeStyle: "short"
  });
  doc.text(`GENERATED: ${generatedTime.toUpperCase()}`, pageWidth - margin, 70, { align: "right" });

  // --- 5. Table Construction ---
  const tableColumns = ["DATE", "STUDENT NAME", "CLASS", "DESCRIPTION", "AMOUNT (PKR)", "MODE"];
  const tableRows = [];
  let totalAmount = 0;

  // Sort chronologically, then alphabetically by name
  const sortedGroupedData = Array.from(groupedMap.values()).sort((a, b) => {
    return new Date(a.date) - new Date(b.date) || a.name.localeCompare(b.name);
  });

  sortedGroupedData.forEach((group) => {
    totalAmount += group.amount;

    tableRows.push([
      group.date,
      group.name,
      group.className,
      Array.from(group.descriptions).join(", "),
      group.amount.toLocaleString(),
      group.mode.toUpperCase()
    ]);
  });

  // --- Per-mode subtotals ---
  const modeTotals = {};
  sortedGroupedData.forEach((group) => {
    const modeKey = group.mode.toUpperCase();
    modeTotals[modeKey] = (modeTotals[modeKey] || 0) + group.amount;
  });

  const modeFootRows = Object.entries(modeTotals).map(([mode, sum]) => [
    {
      content: mode,
      colSpan: 4,
      styles: { halign: "right", fontStyle: "normal", fontSize: 8, textColor: 60 }
    },
    {
      content: sum.toLocaleString(),
      styles: { fontStyle: "normal", halign: "right", fontSize: 8, textColor: 60 }
    },
    ""
  ]);

  const tableFoot = [
    ...modeFootRows,
    [
      {
        content: "TOTAL COLLECTION",
        colSpan: 4,
        styles: { halign: "right", fontStyle: "bold" }
      },
      {
        content: totalAmount.toLocaleString(),
        styles: { fontStyle: "bold", halign: "right" }
      },
      ""
    ]
  ];

  // --- 6. Render Table ---
  autoTable(doc, {
    startY: 85,
    head: [tableColumns],
    body: tableRows,
    foot: tableFoot,
    theme: "plain",
    margin: { left: margin, right: margin, bottom: 50 },
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      lineColor: 0,
      lineWidth: { top: 1, bottom: 1 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 20,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    footStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      lineColor: 0,
      lineWidth: { top: 1, bottom: 2 },
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 100 },
      2: { cellWidth: 60 },
      3: { cellWidth: "auto" },
      4: { halign: "right", cellWidth: 80, fontStyle: "bold", textColor: 0 },
      5: { halign: "center", cellWidth: 50 },
    },
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

  return doc.output("blob");
};
