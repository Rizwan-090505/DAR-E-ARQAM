import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

/**
 * Generates and downloads a PDF receipt for fee payment.
 * * @param {Object} data - The data object.
 * @param {Object} data.student - Student details (name, id, etc).
 * @param {string} data.invoiceId - The invoice ID number.
 * @param {Array} data.items - Array of fee details. expected to have { fee_type, payingNow }.
 * @param {number} data.totalPaidNow - The total sum being paid in this transaction.
 * @param {number} data.balanceAfterPayment - The remaining balance after this payment.
 */
export const printReceipt = ({ student, invoiceId, items, totalPaidNow, balanceAfterPayment }) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // -- Branding Colors --
  const primaryColor = [37, 99, 235] // Blue-600
  const grayColor = [100, 116, 139]  // Slate-500

  // -- Header --
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(...primaryColor)
  doc.text("DAR-E-ARQAM SCHOOL", pageWidth / 2, 20, { align: "center" })
  
  doc.setFontSize(10)
  doc.setTextColor(...grayColor)
  doc.setFont("helvetica", "normal")
  doc.text("Payment Receipt / Official Copy", pageWidth / 2, 26, { align: "center" })

  // -- Separator Line --
  doc.setDrawColor(200, 200, 200)
  doc.line(15, 32, pageWidth - 15, 32)

  // -- Info Grid --
  doc.setFontSize(10)
  doc.setTextColor(0)
  
  // Left Side (Student)
  doc.setFont("helvetica", "bold")
  doc.text("Student Details:", 15, 42)
  doc.setFont("helvetica", "normal")
  doc.text(`Name: ${student?.name || 'N/A'}`, 15, 48)
  doc.text(`ID/Roll No: ${student?.studentid || 'N/A'}`, 15, 54)
  doc.text(`Father Name: ${student?.fathername || 'N/A'}`, 15, 60)

  // Right Side (Invoice)
  doc.setFont("helvetica", "bold")
  doc.text("Transaction Details:", 130, 42)
  doc.setFont("helvetica", "normal")
  doc.text(`Receipt ID: #${invoiceId}-${Date.now().toString().slice(-4)}`, 130, 48)
  doc.text(`Invoice Ref: #${invoiceId}`, 130, 54)
  doc.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 130, 60)

  // -- Filter Items --
  // We only want to show items where money is actually being paid, 
  // OR show the full list if you prefer. 
  // Here we filter for items being paid > 0 to make the receipt cleaner.
  const receiptRows = items
    .filter(item => item.payingNow > 0) 
    .map(item => [
      item.fee_type,
      item.totalAmount.toLocaleString(),
      item.payingNow.toLocaleString()
    ])

  // If nothing paid (edge case or 0 payment), show empty message or all items
  if (receiptRows.length === 0) {
      receiptRows.push(["No payment recorded", "-", "0"])
  }

  // -- Table --
  autoTable(doc, {
    startY: 70,
    head: [['Fee Description', 'Total Fee Amount', 'Paid Now (PKR)']],
    body: receiptRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
    }
  })

  // -- Totals --
  const finalY = doc.lastAutoTable.finalY + 10
  
  // Box for totals
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(248, 250, 252) // Light gray bg
  doc.rect(120, finalY - 5, 75, 25, 'FD')

  doc.setFont("helvetica", "bold")
  doc.setTextColor(0)
  doc.text("Total Paid:", 125, finalY + 2)
  doc.text(`${totalPaidNow.toLocaleString()}`, 190, finalY + 2, { align: "right" })
  
  doc.setTextColor(...grayColor)
  doc.setFontSize(9)
  doc.text("Remaining Balance:", 125, finalY + 12)
  doc.text(`${balanceAfterPayment.toLocaleString()}`, 190, finalY + 12, { align: "right" })

  // -- Footer Note --
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text("System Generated Receipt. Signature not required.", pageWidth / 2, 280, { align: "center" })

  // Save
  doc.save(`Receipt_${student?.name}_${new Date().toISOString().split('T')[0]}.pdf`)
}
