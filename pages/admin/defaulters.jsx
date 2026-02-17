"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../utils/supabaseClient"
import { exportToCSV, exportToPDF } from "../../utils/exportUtils"
import Navbar from "../../components/Navbar"
import Loader from "../../components/Loader"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { 
  ArrowLeft, Users, Filter, Send, Download, 
  Printer, CheckSquare, MessageSquare
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"

function DefaulterListContent() {
  const router = useRouter()
  const { toast } = useToast()

  // --- State ---
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Data Lists
  const [classes, setClasses] = useState([])
  const [defaulters, setDefaulters] = useState([]) 
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())

  // Configuration & Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClasses, setSelectedClasses] = useState(new Set())

  // --- Initialization ---
  useEffect(() => {
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*").order('id')
    setClasses(data || [])
  }

  // --- CORE LOGIC: Paginated Fetch & Grouping ---
  const fetchDefaulters = async () => {
    if (selectedClasses.size === 0) {
      toast({ title: "Please select at least one class", variant: "destructive" })
      return
    }

    setFetching(true)
    setSelectedStudentIds(new Set())
    
    try {
      const classIdsArray = Array.from(selectedClasses)

      // 1. Fetch Students (Paginated to bypass 1000 limit)
      let students = []
      let fromStudents = 0
      const limit = 1000
      let hasMoreStudents = true

      while (hasMoreStudents) {
        const { data: sData, error: sError } = await supabase
          .from("students")
          .select("studentid, name, fathername, class_id, mobilenumber, classes(name)")
          .in("class_id", classIdsArray)
          .order("name")
          .range(fromStudents, fromStudents + limit - 1)

        if (sError) throw sError
        if (sData && sData.length > 0) {
          students = [...students, ...sData]
          fromStudents += limit
          if (sData.length < limit) hasMoreStudents = false
        } else {
          hasMoreStudents = false
        }
      }

      if (students.length === 0) {
        setDefaulters([])
        setFetching(false)
        return
      }

      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()

      // 2. Fetch Invoices (Chunked by Student IDs & Paginated)
      const chunkSize = 150
      let allInvoices = []
      const studentIds = students.map(s => s.studentid)

      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize)
        let fromInvoices = 0
        let hasMoreInvoices = true

        while (hasMoreInvoices) {
          const { data: invoices, error: iError } = await supabase
            .from("fee_invoices")
            .select(`
              id, student_id, invoice_date, status, total_amount,
              fee_invoice_details ( id, fee_type, description, amount ),
              fee_payments ( invoice_detail_id, amount, paid_at )
            `)
            .in("student_id", chunk)
            .gte("invoice_date", startDate)
            .lte("invoice_date", endDate)
            .in("status", ["unpaid", "partial"])
            .range(fromInvoices, fromInvoices + limit - 1)

          if (iError) throw iError
          if (invoices && invoices.length > 0) {
            allInvoices = [...allInvoices, ...invoices]
            fromInvoices += limit
            if (invoices.length < limit) hasMoreInvoices = false
          } else {
            hasMoreInvoices = false
          }
        }
      }

      // 3. Process and Merge Fee Data
      const defaulterData = []

      students.forEach(student => {
        const studentInvoices = allInvoices.filter(inv => inv.student_id === student.studentid)
        if (studentInvoices.length === 0) return

        // Grab latest forwarded invoice
        studentInvoices.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date))
        const latestInvoice = studentInvoices[0]

        let currentTuition = 0
        let prevTuition = 0
        let annualCharges = 0
        let stationeryCharges = 0
        let arrears = 0
        let amountReceivedThisMonth = 0

        // Track payments made THIS calendar month across ALL unpaid invoices
        studentInvoices.forEach(inv => {
          inv.fee_payments?.forEach(p => {
            const payDate = p.paid_at ? new Date(p.paid_at) : new Date(inv.invoice_date); 
            if (payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear) {
              amountReceivedThisMonth += (p.amount || 0)
            }
          })
        })

        // Merge and categorize remaining balances from the latest invoice details
        latestInvoice.fee_invoice_details?.forEach(detail => {
          const paidForDetail = latestInvoice.fee_payments
            ?.filter(p => p.invoice_detail_id === detail.id)
            .reduce((sum, p) => sum + (p.amount || 0), 0) || 0

          const pendingForDetail = (detail.amount || 0) - paidForDetail

          if (pendingForDetail > 0) {
            const descLow = ((detail.fee_type || "") + " " + (detail.description || "")).toLowerCase()
            
            if (descLow.includes("tuition")) {
                const targetDate = new Date(endDate)
                const currentMonthIndex = targetDate.getMonth()
                const currentFilterYear = targetDate.getFullYear()

                // Check string for specific month mentioning
                const monthsRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
                const match = descLow.match(monthsRegex)

                if (match) {
                    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
                    const mentionedMonth = monthMap[match[0].toLowerCase()]

                    if (mentionedMonth === currentMonthIndex) {
                        currentTuition += pendingForDetail
                    } else {
                        prevTuition += pendingForDetail
                    }
                } else {
                    // Fallback to the invoice creation date
                    const invDate = new Date(latestInvoice.invoice_date)
                    if (invDate.getMonth() === currentMonthIndex && invDate.getFullYear() === currentFilterYear) {
                        currentTuition += pendingForDetail
                    } else {
                        prevTuition += pendingForDetail
                    }
                }
            } else if (descLow.includes("annual")) {
                annualCharges += pendingForDetail
            } else if (descLow.includes("stationery") || descLow.includes("stationary")) {
                stationeryCharges += pendingForDetail
            } else {
                arrears += pendingForDetail
            }
          }
        })

        const totalPending = currentTuition + prevTuition + annualCharges + stationeryCharges + arrears

        if (totalPending > 0) {
          defaulterData.push({
            ...student,
            className: student.classes?.name || 'Unknown',
            currentTuition,
            prevTuition,
            annualCharges,
            stationeryCharges,
            arrears,
            totalPending,
            amountReceivedThisMonth
          })
        }
      })

      setDefaulters(defaulterData)
      toast({ title: `Found ${defaulterData.length} defaulters`, variant: "default" })

    } catch (error) {
      console.error(error)
      toast({ title: "Error fetching data", variant: "destructive" })
    } finally {
      setFetching(false)
    }
  }

  // --- Selection Logic ---
  const toggleClass = (id) => {
    const newSet = new Set(selectedClasses)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedClasses(newSet)
  }

  const toggleStudent = (id) => {
    const newSet = new Set(selectedStudentIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedStudentIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === defaulters.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(defaulters.map(s => s.studentid)))
    }
  }

  // --- Formal Messaging Logic ---
  const handleSendMessages = async () => {
    if (selectedStudentIds.size === 0) {
      toast({ title: "No students selected", variant: "destructive" })
      return
    }

    setSubmitting(true)

    try {
      const selectedDefaulters = defaulters.filter(d => selectedStudentIds.has(d.studentid))
      const messagesPayload = []

      for (const student of selectedDefaulters) {
        let finalMessage = `Subject: Notice of Outstanding Fee Dues\n\nDear Parent/Guardian of ${student.name},\n\nWe hope this message finds you well.\n\nThis is a formal reminder regarding the outstanding account balance for ${student.name}. Below is the summary of the pending dues:\n\n`
        
        if (student.currentTuition > 0) finalMessage += `- Current Tuition: Rs. ${student.currentTuition}\n`
        if (student.prevTuition > 0) finalMessage += `- Previous Tuition: Rs. ${student.prevTuition}\n`
        if (student.annualCharges > 0) finalMessage += `- Annual Charges: Rs. ${student.annualCharges}\n`
        if (student.stationeryCharges > 0) finalMessage += `- Stationery Charges: Rs. ${student.stationeryCharges}\n`
        if (student.arrears > 0) finalMessage += `- Arrears / Other: Rs. ${student.arrears}\n`
        
        finalMessage += `\nTotal Amount Payable: Rs. ${student.totalPending}\n\nWe kindly request you to clear these dues at your earliest convenience to ensure uninterrupted access to school services. If you have already made this payment, please disregard this notice.\n\nSincerely,\nAdministration`

        messagesPayload.push({
          student_id: student.studentid,
          class_id: student.class_id,
          text: finalMessage,
          number: student.mobilenumber || null,
          sent: false
        })
      }

      // Chunk inserts to avoid Supabase 1000 row limit
      const insertChunkSize = 500
      for (let i = 0; i < messagesPayload.length; i += insertChunkSize) {
         const chunk = messagesPayload.slice(i, i + insertChunkSize)
         const { error } = await supabase.from("messages").insert(chunk)
         if (error) throw error
      }

      toast({ title: "Messages Queued", description: `Queued formal reminders for ${messagesPayload.length} students.`, variant: "default" })
      setSelectedStudentIds(new Set()) 
    } catch (error) {
      console.error(error)
      toast({ title: "Failed to queue messages", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // --- Styles ---
  const glassCardClass = "relative overflow-hidden rounded-xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm p-4 print:hidden"
  const inputClass = "h-9 bg-white/50 dark:bg-white/5 border-white/20 focus:border-blue-500/50"

  return (
    <>
      <div className="print:hidden">
        <Navbar />
      </div>
      
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1220] p-4 transition-colors duration-500 pb-20 print:bg-white print:p-0 print:m-0">
        <div className="max-w-7xl mx-auto space-y-4 print:max-w-full">
          
          {/* HEADER */}
          <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full bg-white backdrop-blur h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Defaulter List</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={() => exportToCSV(defaulters)} variant="outline" className="h-9 gap-2 text-xs font-semibold bg-white dark:bg-transparent text-gray-800 dark:text-gray-200">
                <Download className="w-4 h-4" /> Export Excel
              </Button>
              <Button onClick={() => exportToPDF(defaulters, startDate, endDate)} variant="outline" className="h-9 gap-2 text-xs font-semibold bg-white dark:bg-transparent text-gray-800 dark:text-gray-200">
                <Printer className="w-4 h-4" /> Print / PDF
              </Button>
            </div>
          </div>

          {/* TOP CONFIGURATION BAR */}
          <div className={glassCardClass}>
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
               
               {/* Date Range */}
               <div className="lg:col-span-1 space-y-3 border-r border-gray-200 dark:border-gray-700 pr-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Invoice Date Range</h3>
                  <div>
                    <Label className="text-[10px] text-gray-500 font-semibold uppercase mb-1">From</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500 font-semibold uppercase mb-1">To</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                  </div>
               </div>

               {/* Multi-Class Selection */}
               <div className="lg:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Classes</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px]"
                      onClick={() => setSelectedClasses(new Set(classes.map(c => c.id)))}
                    >
                      Select All
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                    {classes.map(c => (
                      <label 
                        key={c.id} 
                        className={`flex items-start gap-2 p-2 w-full rounded-md border cursor-pointer transition-colors text-xs font-medium ${
                          selectedClasses.has(c.id) 
                            ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-100' 
                            : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedClasses.has(c.id)}
                          onChange={() => toggleClass(c.id)}
                          className="w-3.5 h-3.5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="break-words whitespace-normal leading-tight">{c.name}</span>
                      </label>
                    ))}
                  </div>
               </div>

               {/* Actions */}
               <div className="lg:col-span-1 flex flex-col justify-end h-full">
                  <Button onClick={fetchDefaulters} disabled={fetching} className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-md text-sm font-bold">
                    {fetching ? <Loader small /> : ( <><Filter className="w-4 h-4 mr-2" /> FETCH DEFAULTERS</> )}
                  </Button>
               </div>

             </div>
          </div>

          {/* BULK MESSAGING BAR */}
          {defaulters.length > 0 && (
            <div className={`${glassCardClass} flex flex-col md:flex-row items-center justify-between gap-4`}>
               <div className="flex items-center gap-3">
                 <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                   <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                 </div>
                 <div>
                   <h3 className="font-bold text-sm text-gray-900 dark:text-white">Bulk Formal Reminders</h3>
                   <p className="text-[11px] text-gray-500">Send formal WhatsApp/SMS notices to selected defaulters.</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-3 w-full md:w-auto">
                 <Button 
                   onClick={handleSendMessages} 
                   disabled={submitting || selectedStudentIds.size === 0} 
                   className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white text-xs font-bold gap-2"
                 >
                   {submitting ? <Loader small /> : <><Send className="w-4 h-4" /> SEND {selectedStudentIds.size > 0 ? `TO (${selectedStudentIds.size})` : ''}</>}
                 </Button>
               </div>
            </div>
          )}

          {/* MAIN CONTENT: DEFAULTER TABLE */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden print:border-none print:shadow-none print:bg-transparent">
             
             <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 print:hidden">
                 <h3 className="font-bold flex items-center gap-2 text-gray-700 dark:text-gray-200">
                   <Users className="w-4 h-4" /> Defaulter Records
                   <span className="text-xs font-normal text-gray-400">({defaulters.length})</span>
                 </h3>
             </div>

             {fetching ? (
                 <div className="h-64 flex items-center justify-center print:hidden">
                   <Loader />
                 </div>
             ) : defaulters.length === 0 ? (
                 <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 m-4 rounded-xl print:hidden">
                   <CheckSquare className="w-8 h-8 mb-2 opacity-20" />
                   <p className="text-sm">No defaulters found for the selected criteria.</p>
                 </div>
             ) : (
                 <div className="overflow-x-auto print:overflow-visible custom-scrollbar">
                     <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300 print:text-black print:text-[10px]">
                         <thead className="bg-gray-100/50 dark:bg-gray-800/50 text-[11px] uppercase text-gray-500 dark:text-gray-400 border-b dark:border-gray-800 print:bg-gray-100 print:text-black">
                             <tr>
                                 <th className="p-3 w-10 text-center print:hidden">
                                     <input 
                                         type="checkbox"
                                         className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                         checked={selectedStudentIds.size === defaulters.length && defaulters.length > 0}
                                         onChange={toggleSelectAll}
                                     />
                                 </th>
                                 <th className="p-3 font-semibold">Student Name</th>
                                 <th className="p-3 font-semibold">Class</th>
                                 <th className="p-3 font-semibold text-right text-blue-600 dark:text-blue-400 print:text-black">Curr Tuition</th>
                                 <th className="p-3 font-semibold text-right text-blue-600 dark:text-blue-400 print:text-black">Prev Tuition</th>
                                 <th className="p-3 font-semibold text-right text-purple-600 dark:text-purple-400 print:text-black">Annual</th>
                                 <th className="p-3 font-semibold text-right text-orange-600 dark:text-orange-400 print:text-black">Stationery</th>
                                 <th className="p-3 font-semibold text-right">Arrears</th>
                                 <th className="p-3 font-bold text-right text-red-600 dark:text-red-400 print:text-black">Total Pending</th>
                                 <th className="p-3 font-semibold text-right text-green-600 dark:text-green-500 print:text-black">Rec. This Mth</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-gray-800 print:divide-gray-300">
                             {defaulters.map((student) => {
                               const isSelected = selectedStudentIds.has(student.studentid)
                               return (
                                 <tr 
                                   key={student.studentid} 
                                   className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} print:bg-transparent`}
                                 >
                                     <td className="p-3 text-center print:hidden">
                                         <input 
                                             type="checkbox"
                                             className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                             checked={isSelected}
                                             onChange={() => toggleStudent(student.studentid)}
                                         />
                                     </td>
                                     <td className="p-3">
                                         <div className="font-bold text-gray-900 dark:text-white print:text-black">{student.name}</div>
                                         <div className="text-[11px] text-gray-400 print:text-gray-600">{student.fathername} • {student.studentid}</div>
                                     </td>
                                     <td className="p-3 font-medium text-gray-700 dark:text-gray-300 print:text-black">
                                         {student.className}
                                     </td>
                                     <td className="p-3 text-right font-medium text-blue-600 dark:text-blue-400 print:text-black">
                                         {student.currentTuition > 0 ? student.currentTuition.toLocaleString() : "-"}
                                     </td>
                                     <td className="p-3 text-right font-medium text-blue-600 dark:text-blue-400 print:text-black">
                                         {student.prevTuition > 0 ? student.prevTuition.toLocaleString() : "-"}
                                     </td>
                                     <td className="p-3 text-right font-medium text-purple-600 dark:text-purple-400 print:text-black">
                                         {student.annualCharges > 0 ? student.annualCharges.toLocaleString() : "-"}
                                     </td>
                                     <td className="p-3 text-right font-medium text-orange-600 dark:text-orange-400 print:text-black">
                                         {student.stationeryCharges > 0 ? student.stationeryCharges.toLocaleString() : "-"}
                                     </td>
                                     <td className="p-3 text-right font-medium text-gray-500 print:text-black">
                                         {student.arrears > 0 ? student.arrears.toLocaleString() : "-"}
                                     </td>
                                     <td className="p-3 text-right">
                                         <div className="font-mono font-bold text-red-600 dark:text-red-500 print:text-black">
                                            {student.totalPending.toLocaleString()}
                                         </div>
                                     </td>
                                     <td className="p-3 text-right">
                                         <div className="font-mono font-bold text-green-600 dark:text-green-500 print:text-black">
                                            {student.amountReceivedThisMonth > 0 ? student.amountReceivedThisMonth.toLocaleString() : "-"}
                                         </div>
                                     </td>
                                 </tr>
                               )
                             })}
                             
                             <tr className="bg-gray-50 dark:bg-gray-800/30 font-bold print:bg-gray-100">
                               <td colSpan={3} className="p-3 text-right print:hidden">Grand Totals:</td>
                               <td colSpan={2} className="p-3 text-right hidden print:table-cell">Grand Totals:</td>
                               <td className="p-3 text-right text-blue-600 dark:text-blue-400 print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.currentTuition, 0).toLocaleString()}
                               </td>
                               <td className="p-3 text-right text-blue-600 dark:text-blue-400 print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.prevTuition, 0).toLocaleString()}
                               </td>
                               <td className="p-3 text-right text-purple-600 dark:text-purple-400 print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.annualCharges, 0).toLocaleString()}
                               </td>
                               <td className="p-3 text-right text-orange-600 dark:text-orange-400 print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.stationeryCharges, 0).toLocaleString()}
                               </td>
                               <td className="p-3 text-right print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.arrears, 0).toLocaleString()}
                               </td>
                               <td className="p-3 text-right text-red-600 dark:text-red-500 print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.totalPending, 0).toLocaleString()}
                               </td>
                               <td className="p-3 text-right text-green-600 dark:text-green-500 print:text-black">
                                 {defaulters.reduce((acc, curr) => acc + curr.amountReceivedThisMonth, 0).toLocaleString()}
                               </td>
                             </tr>
                         </tbody>
                     </table>
                 </div>
             )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function DefaultersPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader /></div>}>
      <DefaulterListContent />
    </Suspense>
  )
}
