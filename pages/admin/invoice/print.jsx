"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "../../../utils/supabaseClient"
import Navbar from "../../../components/Navbar"
import Loader from "../../../components/Loader"
import { Button } from "../../../components/ui/button"
import { Label } from "../../../components/ui/label"
import { Input } from "../../../components/ui/input"
import { ArrowLeft, Printer, Search, Download } from "lucide-react"
import { useToast } from "../../../hooks/use-toast"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// --- CONSTANTS ---
const SCHOOL_NAME = "DAR-E-ARQAM SCHOOL"
const CAMPUS_NAME = "Q MODEL TOWN CAMPUS"
const COPIES = ["BANK COPY", "SCHOOL COPY", "PARENT COPY"]

const COLORS = {
  brand: "#1F2937",    // Dark Charcoal
  accent: "#B91C1C",   // Dark Red
  sub_bg: "#F3F4F6",   // Light Grey
  text: "#111827",     // Near Black
  border: "#9CA3AF",   // Mid Grey
  white: "#FFFFFF",
  light_grey_bar: "#E5E7EB",
  total_bg: "#D1D5DB"
}

// --- HELPER: FORMAT CURRENCY ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'decimal', minimumFractionDigits: 0 }).format(amount || 0)
}

function PrintInvoicesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [processingPdf, setProcessingPdf] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [autoPrintMode, setAutoPrintMode] = useState(false)

  // Manual Selection State
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  })

  const paramInvoiceIds = searchParams.get('invoices')

  // --- 1. INITIALIZATION & AUTO-PRINT LOGIC ---
  useEffect(() => {
    if (paramInvoiceIds) {
      setAutoPrintMode(true)
      const cleanedIds = paramInvoiceIds.replace(/[\[\]"]/g, '')
      if (cleanedIds && cleanedIds.trim() !== "") {
        const ids = cleanedIds.split(',').filter(id => id.trim() !== '')
        fetchAndAutoPrint(ids)
      }
    } else {
      fetchClasses()
    }
  }, [paramInvoiceIds])

  // --- 2. DATA FETCHING ---
  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*").order('id')
    setClasses(data || [])
  }

  const fetchAndAutoPrint = async (ids) => {
    setLoading(true)
    const data = await fetchInvoicesByIds(ids)
    setLoading(false)
    
    if (data && data.length > 0) {
      setInvoices(data)
      // Small delay to ensure state updates before generating
      setTimeout(() => generatePDF(data, true), 500) 
    } else {
      toast({ title: "No invoices found", variant: "destructive" })
      setAutoPrintMode(false) // Fallback to manual view
    }
  }

  const fetchInvoicesByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from("fee_invoices")
        .select(`
          *,
          students (
            name, fathername, studentid,
            classes ( name )
          ),
          fee_invoice_details ( fee_type, amount )
        `)
        .in('id', ids)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  const handleManualSearch = async () => {
    if (!selectedClassId) return toast({ title: "Select a class", variant: "destructive" })

    setLoading(true)
    try {
      // Get Students in Class
      const { data: students } = await supabase
        .from("students").select("studentid").eq("class_id", selectedClassId)

      const studentIds = students.map(s => s.studentid)
      if (studentIds.length === 0) {
        setInvoices([])
        setLoading(false)
        return
      }

      // Get Invoices
      const { data, error } = await supabase
        .from("fee_invoices")
        .select(`
          *,
          students (
            name, fathername, studentid,
            classes ( name )
          ),
          fee_invoice_details ( fee_type, amount )
        `)
        .in("student_id", studentIds)
        .gte("invoice_date", dateRange.start)
        .lte("invoice_date", dateRange.end)
        .neq("status", "expired")

      if (error) throw error
      setInvoices(data || [])
      
    } catch (error) {
      console.error(error)
      toast({ title: "Search failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- 3. HEAVY CORPORATE DESIGN PDF GENERATOR (FIXED) ---
  const generatePDF = (dataToPrint = invoices, autoClose = false) => {
    if (!dataToPrint || dataToPrint.length === 0) return

    setProcessingPdf(true)
    
    try {
      // Landscape A4
      const doc = new jsPDF('l', 'mm', 'a4') 
      const pageWidth = 297
      const pageHeight = 210
      const margin = 10 
      const stripWidth = (pageWidth - (margin * 2)) / 3
      const stripHeight = pageHeight - 20
      
      // Dimensions for layout
      const contentWidth = stripWidth - 6 
      const startY = 10

      dataToPrint.forEach((inv, invIndex) => {
        if (invIndex > 0) doc.addPage()

        // Loop for 3 copies (Bank, School, Parent)
        COPIES.forEach((copyType, copyIndex) => {
          const startX = margin + (copyIndex * stripWidth) + 3 // +3 for padding inside strip
          
          let yCursor = startY

          // --- A. OUTER CONTAINER BORDER ---
          doc.setDrawColor(COLORS.brand)
          doc.setLineWidth(0.5)
          doc.rect(startX - 2, startY, contentWidth + 4, stripHeight)

          // --- B. HEADER BLOCK (Top) ---
          const headerHeight = 22
          
          doc.setFillColor(COLORS.brand)
          doc.rect(startX - 2, yCursor, contentWidth + 4, headerHeight, 'F')

          // School Name (White Text)
          doc.setTextColor(COLORS.white)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.text(SCHOOL_NAME, startX + (contentWidth / 2), yCursor + 8, { align: 'center' })

          // Campus Name
          doc.setFont("helvetica", "normal")
          doc.setFontSize(7)
          doc.setTextColor(220, 220, 220)
          doc.text(CAMPUS_NAME, startX + (contentWidth / 2), yCursor + 13, { align: 'center' })

          // Copy Label (e.g., BANK COPY)
          doc.setFontSize(8)
          doc.setTextColor(COLORS.white)
          doc.text(copyType, startX + contentWidth, yCursor + 18, { align: 'right' })

          yCursor += headerHeight

          // --- C. STATUS BAR (Invoice # & Due Date) ---
          doc.setFillColor(COLORS.light_grey_bar)
          doc.rect(startX - 2, yCursor, contentWidth + 4, 8, 'F')

          // Inv # (Left)
          doc.setTextColor(COLORS.brand)
          doc.setFontSize(8)
          doc.setFont("helvetica", "bold")
          doc.text(`INV #: ${inv.id}`, startX, yCursor + 5.5)

          // Due Date (Right - Red)
          doc.setTextColor(COLORS.accent)
          const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) : "10th"
          doc.text(`DUE: ${dueDate}`, startX + contentWidth, yCursor + 5.5, { align: 'right' })

          yCursor += 10 // Move down for Student Table

          // --- D. STUDENT DETAILS ---
          const studentData = [
            ["STUDENT:", inv.students?.name || "-"],
            ["FATHER:", inv.students?.fathername || "-"],
            ["REG ID:", inv.students?.studentid || "-"],
            ["CLASS:", inv.students?.classes?.name || "-"]
          ]

          autoTable(doc, {
            startY: yCursor,
            body: studentData,
            theme: 'grid',
            margin: { left: startX },
            tableWidth: contentWidth,
            styles: {
              font: 'helvetica',
              fontSize: 8,
              cellPadding: 1.5,
              lineColor: COLORS.border,
              lineWidth: 0.1,
              textColor: COLORS.text
            },
            columnStyles: {
              0: { 
                cellWidth: 18, 
                fillColor: COLORS.sub_bg, 
                fontStyle: 'bold', 
                textColor: COLORS.brand 
              },
              1: { 
                fillColor: COLORS.white 
              }
            }
          })

          // Ensure next table starts below this one
          yCursor = doc.lastAutoTable.finalY + 5

          // --- E. FEE TABLE ---
          const feeData = inv.fee_invoice_details.map(d => [d.fee_type, formatCurrency(d.amount)])
          // Add Total Row
          feeData.push(["TOTAL PAYABLE", formatCurrency(inv.total_amount)])

          autoTable(doc, {
            startY: yCursor,
            head: [['DESCRIPTION', 'AMOUNT']],
            body: feeData,
            theme: 'plain',
            margin: { left: startX },
            tableWidth: contentWidth,
            headStyles: {
              fillColor: COLORS.brand,
              textColor: COLORS.white,
              fontStyle: 'bold',
              fontSize: 8,
              halign: 'left',
              cellPadding: 2
            },
            bodyStyles: {
              fontSize: 8,
              textColor: COLORS.text,
              cellPadding: 2,
              lineColor: COLORS.light_grey_bar,
              lineWidth: { bottom: 0.1 }
            },
            columnStyles: {
              0: { cellWidth: 'auto' },
              1: { halign: 'right', cellWidth: 25 }
            },
            didParseCell: (data) => {
              // Style the Total Row (Last row)
              if (data.section === 'body' && data.row.index === feeData.length - 1) {
                data.cell.styles.fillColor = COLORS.total_bg
                data.cell.styles.fontStyle = 'bold'
                data.cell.styles.textColor = COLORS.brand
              }
            }
          })

          // --- F. FOOTER (Fixed at Bottom of Strip) ---
          const footerHeight = 35
          const footerY = startY + stripHeight - footerHeight
          
          // Instructions
          doc.setTextColor(COLORS.brand)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(7)
          doc.text("INSTRUCTIONS:", startX, footerY + 5)

          doc.setFont("helvetica", "normal")
          doc.setTextColor(COLORS.text)
          doc.setFontSize(6)
          const instructions = [
            "1. Due date is the 10th of every month.",
            "2. Late fee: Rs. 50/day after due date.",
            "3. Payment is non-refundable."
          ]
          let instY = footerY + 9
          instructions.forEach(line => {
             doc.text(line, startX, instY)
             instY += 3
          })

          // Signature Line
          const sigLineY = footerY + 25
          doc.setDrawColor(COLORS.brand)
          doc.setLineWidth(0.5)
          doc.line(startX + contentWidth - 35, sigLineY, startX + contentWidth, sigLineY)
          
          doc.setFont("helvetica", "bold")
          doc.setFontSize(7)
          doc.text("OFFICER SIGNATURE", startX + contentWidth - 17.5, sigLineY + 4, { align: 'center' })

          // --- G. SCISSOR CUT LINE ---
          if (copyIndex < 2) {
             const cutX = margin + ((copyIndex + 1) * stripWidth)
             doc.setDrawColor(180, 180, 180)
             doc.setLineWidth(0.5)
             doc.setLineDash([3, 3])
             doc.line(cutX, 5, cutX, pageHeight - 5)
             doc.setLineDash([]) // Reset
          }

        }) // End Copies Loop
      }) // End Invoices Loop

      // --- OUTPUT ---
      const pdfBlobUrl = doc.output('bloburl')
      window.open(pdfBlobUrl, '_blank')
      
      if (autoClose && autoPrintMode) {
         // router.push('/dashboard') 
      }
      
    } catch (e) {
      console.error(e)
      toast({ title: "PDF Generation Failed", variant: "destructive" })
    } finally {
      setProcessingPdf(false)
    }
  }

  // --- RENDER ---
  
  // 1. AUTO-PRINT MODE: Render ONLY a full-screen loader
  if (autoPrintMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader />
        <p className="mt-4 text-gray-500 animate-pulse">Generating Invoices...</p>
      </div>
    )
  }

  // 2. MANUAL MODE: Render the full UI
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1220] p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full h-9 w-9 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold">Print Invoices</h1>
            </div>
          </div>

          <div className="bg-white/40 dark:bg-black/40 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>Class</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>From Date</Label>
                <Input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
              </div>
              <div>
                <Label>To Date</Label>
                <Input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
              </div>
              <div>
                <Button onClick={handleManualSearch} className="w-full" disabled={loading}>
                  {loading ? <Loader small /> : <><Search className="w-4 h-4 mr-2" /> Find Invoices</>}
                </Button>
              </div>
            </div>
          </div>

          {invoices.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <h3 className="font-bold">Results ({invoices.length})</h3>
                 <Button 
                   onClick={() => generatePDF()} 
                   className="bg-green-600 hover:bg-green-700 text-white"
                   disabled={processingPdf}
                 >
                   {processingPdf ? <Loader small /> : <><Download className="w-4 h-4 mr-2" /> Download All PDFs</>}
                 </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {invoices.map(inv => (
                  <div key={inv.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm">{inv.students?.name}</h4>
                        <p className="text-xs text-gray-500">Inv #{inv.id}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-3 pt-3 border-t">
                      <span className="text-gray-500">Total</span>
                      <span className="font-bold">{formatCurrency(inv.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function PrintInvoicesPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader /></div>}>
      <PrintInvoicesContent />
    </Suspense>
  )
}
