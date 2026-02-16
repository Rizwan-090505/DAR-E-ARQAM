"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../utils/supabaseClient"
import Navbar from "../../../components/Navbar"
import Loader from "../../../components/Loader"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { 
  ArrowLeft, Users, Filter, Calendar, 
  DollarSign, CheckSquare, Send, AlertCircle, Settings, MessageSquare, PlusCircle
} from "lucide-react"
import { useToast } from "../../../hooks/use-toast"

function GenerateInvoicesContent() {
  const router = useRouter()
  const { toast } = useToast()

  // --- State ---
  const [loading, setLoading] = useState(false)
  const [fetchingStudents, setFetchingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
    
  // Data Lists
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([]) 
  const [excludedCount, setExcludedCount] = useState(0) 

  // Selections & Per-Student Configuration
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())
  const [studentFees, setStudentFees] = useState({}) // Stores per-student overrides { [id]: { annual, stationery, custom } }
    
  // Configuration
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [config, setConfig] = useState({
    feeLabel: "", 
    annualCharges: 0,
    stationeryCharges: 0,
    customFeeLabel: "", 
    customFeeDefault: 0, 
    dueDate: new Date().toISOString().split('T')[0]
  })

  // Messaging State
  const [sendMessage, setSendMessage] = useState(true)

  // --- Initialization ---
  useEffect(() => {
    fetchClasses()
    updateDefaultLabel(invoiceDate)
  }, [])

  useEffect(() => {
    updateDefaultLabel(invoiceDate)
    if (selectedClassId) {
      fetchEligibleStudents(selectedClassId, invoiceDate)
    }
  }, [invoiceDate])

  const updateDefaultLabel = (dateStr) => {
    const dateObj = new Date(dateStr)
    const month = dateObj.toLocaleString('default', { month: 'long' })
    const year = dateObj.getFullYear()
    setConfig(prev => ({ ...prev, feeLabel: `Tuition Fee - ${month} - ${year}` }))
  }

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*").order('id')
    setClasses(data || [])
  }

  // --- CORE LOGIC: Fetch Students & Arrears ---
  const fetchEligibleStudents = async (classId, dateStr) => {
    setFetchingStudents(true)
    setSelectedStudentIds(new Set()) 
    setStudentFees({}) 
      
    try {
      const { data: allStudents, error: sError } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("name")

      if (sError) throw sError

      const selectedDate = new Date(dateStr)
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().split('T')[0]

      // 1. Fetch Existing Invoices (to exclude students already invoiced this month)
      const { data: existingInvoices, error: iError } = await supabase
        .from("fee_invoices")
        .select("student_id")
        .gte("invoice_date", startOfMonth)
        .lte("invoice_date", endOfMonth)
        .neq("status", "expired")

      if (iError) throw iError

      const invoicedStudentIds = new Set(existingInvoices.map(inv => inv.student_id))
      const eligibleStudents = allStudents.filter(s => !invoicedStudentIds.has(s.studentid))
      
      // 2. Fetch Arrears for Eligible Students
      const eligibleIds = eligibleStudents.map(s => s.studentid);
      let arrearsMap = {};

      if (eligibleIds.length > 0) {
          const { data: oldInvoices } = await supabase
            .from("fee_invoices")
            .select(`
              student_id,
              fee_invoice_details ( id, amount ),
              fee_payments ( invoice_detail_id, amount )
            `)
            .in("student_id", eligibleIds)
            .lt("invoice_date", startOfMonth)
            .in("status", ["unpaid", "partial"]);
          
          if (oldInvoices) {
              oldInvoices.forEach(inv => {
                  let carryOver = 0;
                  inv.fee_invoice_details.forEach(detail => {
                      const paid = inv.fee_payments
                          ?.filter(p => p.invoice_detail_id === detail.id)
                          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
                      carryOver += (detail.amount - paid);
                  });
                  arrearsMap[inv.student_id] = (arrearsMap[inv.student_id] || 0) + carryOver;
              });
          }
      }

      const studentsWithArrears = eligibleStudents.map(s => ({
          ...s,
          arrears: arrearsMap[s.studentid] || 0
      }));

      setStudents(studentsWithArrears)
      setExcludedCount(allStudents.length - eligibleStudents.length)

    } catch (error) {
      console.error(error)
      toast({ title: "Error fetching data", variant: "destructive" })
    } finally {
      setFetchingStudents(false)
    }
  }

  // --- Selection & Input Logic ---
  const handleClassChange = (e) => {
    const cid = e.target.value
    setSelectedClassId(cid)
    if (cid) fetchEligibleStudents(cid, invoiceDate)
    else setStudents([])
  }

  const toggleStudent = (id) => {
    const newSet = new Set(selectedStudentIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedStudentIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(students.map(s => s.studentid)))
    }
  }

  const handleStudentFeeChange = (studentId, field, value) => {
    setStudentFees(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }))
  }

  const getCharge = (studentId, field, globalFallback) => {
    const val = studentFees[studentId]?.[field]
    return val !== undefined && val !== "" ? Number(val) : Number(globalFallback) || 0
  }

  // --- Generator Logic ---
  const handleGenerate = async () => {
    if (selectedStudentIds.size === 0) {
      toast({ title: "No students selected", variant: "destructive" })
      return
    }

    setSubmitting(true)
    let successCount = 0
    let failCount = 0
    let expiredCount = 0
    
    // Array to hold IDs for batch updating 'Clear' status later
    let successfullyInvoicedIds = [] 

    try {
      const selectedStudentsList = students.filter(s => selectedStudentIds.has(s.studentid))
      const startOfCurrentMonth = new Date(new Date(invoiceDate).getFullYear(), new Date(invoiceDate).getMonth(), 1).toISOString()

      for (const student of selectedStudentsList) {
        
        // 1. FETCH OLD INVOICES & DETAILS
        const { data: oldInvoices } = await supabase
          .from("fee_invoices")
          .select(`
            id, invoice_date, status, total_amount,
            fee_invoice_details ( id, fee_type, description, amount ),
            fee_payments ( invoice_detail_id, amount )
          `)
          .eq("student_id", student.studentid)
          .lt("invoice_date", startOfCurrentMonth)
          .in("status", ["unpaid", "partial"]) 

        let carriedOverDetails = []
        let totalCarryOverAmount = 0
        let oldInvoiceIdsToExpire = []

        if (oldInvoices && oldInvoices.length > 0) {
            oldInvoices.forEach(oldInv => {
                oldInvoiceIdsToExpire.push(oldInv.id)
                oldInv.fee_invoice_details.forEach(detail => {
                    const paidForItem = oldInv.fee_payments
                        ?.filter(p => p.invoice_detail_id === detail.id)
                        .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
                    
                    const remainingForItem = detail.amount - paidForItem;

                    if (remainingForItem > 0) {
                        totalCarryOverAmount += remainingForItem;
                        carriedOverDetails.push({
                            fee_type: detail.fee_type, 
                            description: `${detail.description} (Arrears: ${new Date(oldInv.invoice_date).toLocaleDateString()})`,
                            amount: remainingForItem
                        })
                    }
                })
            })
        }

        // 2. Calculate New Totals
        const monthlyFee = Number(student.monthly_fee) || 0
        const annual = getCharge(student.studentid, 'annual', config.annualCharges)
        const stationery = getCharge(student.studentid, 'stationery', config.stationeryCharges)
        const customFee = getCharge(student.studentid, 'custom', config.customFeeDefault)
        
        const grandTotal = monthlyFee + annual + stationery + customFee + totalCarryOverAmount

        // 3. Create Master Invoice
        const { data: invData, error: invError } = await supabase
          .from("fee_invoices")
          .insert({
            student_id: student.studentid,
            invoice_date: invoiceDate,
            due_date: config.dueDate,
            total_amount: grandTotal,
            status: "unpaid"
          })
          .select()
          .single()

        if (invError || !invData) {
          console.error(`Failed for ${student.name}`, invError)
          failCount++
          continue
        }

        // 4. Create Details
        const detailsPayload = []
        
        if (monthlyFee > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: config.feeLabel || "Tuition Fee", description: "Monthly Tuition Charges", amount: monthlyFee })
        if (annual > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: "Annual Charges", description: "Annual / Paper Funds", amount: annual })
        if (stationery > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: "Stationery", description: "Stationery / Books", amount: stationery })
        if (customFee > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: config.customFeeLabel || "Other Charges", description: "Custom Charges", amount: customFee })

        carriedOverDetails.forEach(item => {
            detailsPayload.push({ ...item, invoice_id: invData.id })
        })

        if (detailsPayload.length > 0) {
          await supabase.from("fee_invoice_details").insert(detailsPayload)
        }

        // 5. Expire Old Invoices
        if (oldInvoiceIdsToExpire.length > 0) {
            const { error: expireError } = await supabase
                .from("fee_invoices")
                .update({ 
                    status: "expired", 
                    notes: `Consolidated into Invoice #${invData.id}` 
                })
                .in("id", oldInvoiceIdsToExpire) 
            
            if (!expireError) expiredCount += oldInvoiceIdsToExpire.length
        }

        // 6. Messaging Integration (Standardized Template)
        if (sendMessage) {
            let finalMessage = `*Fee Invoice Alert* 🔔\n\nDear *${student.name}*,\nYour fee invoice for *${config.feeLabel}* has been generated.\n\n*Fee Breakdown:*\nTuition Fee: Rs. ${monthlyFee}`;
            if (annual > 0) finalMessage += `\nAnnual Charges: Rs. ${annual}`;
            if (stationery > 0) finalMessage += `\nStationery: Rs. ${stationery}`;
            if (customFee > 0) finalMessage += `\n${config.customFeeLabel || 'Custom Charges'}: Rs. ${customFee}`;
            if (totalCarryOverAmount > 0) finalMessage += `\nArrears: Rs. ${totalCarryOverAmount}`;
            
            finalMessage += `\n\n💰 *Total Due:* Rs. ${grandTotal}\n📅 *Due Date:* ${config.dueDate}\n\nPlease clear the dues before the deadline. Thank you! 🏫`;

            // Updated per new schema
            await supabase.from("messages").insert({
               student_id: student.studentid,
               class_id: student.class_id,
               text: finalMessage,
               number: student.mobilenumber || null,
               sent: false
            })
        }

        successCount++
        successfullyInvoicedIds.push(student.studentid)
      }

      // 7. Update Student Clear Status in Batch
      if (successfullyInvoicedIds.length > 0) {
        const { error: clearUpdateError } = await supabase
            .from("students")
            .update({ Clear: false })
            .in("studentid", successfullyInvoicedIds)

        if (clearUpdateError) {
             console.error("Failed to update Clear status:", clearUpdateError)
        }
      }

      toast({ 
        title: "Generation Complete", 
        description: `Generated ${successCount} invoices. ${sendMessage ? 'Messages Queued.' : ''}`,
        variant: "default"
      })

      fetchEligibleStudents(selectedClassId, invoiceDate)

    } catch (error) {
      console.error(error)
      toast({ title: "System Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // --- Styles ---
  const glassCardClass = "relative overflow-hidden rounded-xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm p-4"
  const inputClass = "h-9 bg-white/50 dark:bg-white/5 border-white/20 focus:border-blue-500/50"

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1220] p-4 transition-colors duration-500 pb-20">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* HEADER */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full bg-white backdrop-blur h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Generation</h1>
            </div>
          </div>

          {/* TOP CONFIGURATION BAR */}
          <div className={glassCardClass}>
             <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
                
                <div className="lg:col-span-1">
                   <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Class</Label>
                   <select 
                      className={`w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`}
                      value={selectedClassId}
                      onChange={handleClassChange}
                    >
                      <option value="">-- Select --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="lg:col-span-1">
                   <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Invoice Date</Label>
                   <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputClass} />
                </div>

                <div className="lg:col-span-1">
                   <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Due Date</Label>
                   <Input type="date" value={config.dueDate} onChange={(e) => setConfig({...config, dueDate: e.target.value})} className={inputClass}/>
                </div>

                <div className="lg:col-span-3 grid grid-cols-3 gap-2 border-l pl-3 border-gray-200 dark:border-white/10">
                   <div>
                      <Label className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Global Annual</Label>
                      <Input type="number" placeholder="0" value={config.annualCharges} onChange={(e) => setConfig({...config, annualCharges: e.target.value})} className={inputClass} />
                   </div>
                   <div>
                      <Label className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Global Stationery</Label>
                      <Input type="number" placeholder="0" value={config.stationeryCharges} onChange={(e) => setConfig({...config, stationeryCharges: e.target.value})} className={inputClass} />
                   </div>
                   <div>
                      <Label className="text-[10px] text-gray-500 font-semibold uppercase mb-1 flex items-center gap-1">
                        <PlusCircle className="w-3 h-3 text-blue-500"/>
                        <input 
                          type="text" 
                          placeholder="Custom Label" 
                          value={config.customFeeLabel} 
                          onChange={(e) => setConfig({...config, customFeeLabel: e.target.value})} 
                          className="bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 w-full font-semibold placeholder:text-gray-400 placeholder:font-normal"
                        />
                      </Label>
                      <Input type="number" placeholder="0" value={config.customFeeDefault} onChange={(e) => setConfig({...config, customFeeDefault: e.target.value})} className={inputClass} />
                   </div>
                </div>

                <div className="lg:col-span-1">
                    <Button onClick={handleGenerate} disabled={submitting || selectedStudentIds.size === 0} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-md text-xs font-bold">
                      {submitting ? <Loader small /> : "GENERATE"}
                    </Button>
                </div>
             </div>
             
             {/* Labels Row */}
             <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="flex flex-col">
                    <Label className="text-[10px] text-gray-400 uppercase font-bold">Main Fee Label (e.g. Tuition Fee)</Label>
                    <Input value={config.feeLabel} onChange={(e) => setConfig({...config, feeLabel: e.target.value})} className="h-7 w-64 text-xs bg-transparent border-none p-0 focus-visible:ring-0 placeholder:text-gray-300" placeholder="e.g. Tuition Fee - Oct" />
                </div>
                <div className="flex justify-end">
                    <div className="flex items-center gap-2 text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full w-max">
                         <AlertCircle className="w-3 h-3" />
                         <span>Unpaid arrears are automatically fetched and carried over.</span>
                    </div>
                </div>
             </div>
          </div>

          {/* MESSAGING CONFIGURATION */}
          <div className={`${glassCardClass} !p-3 flex flex-col gap-2`}>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <input 
                       type="checkbox" 
                       id="send-sms"
                       checked={sendMessage}
                       onChange={(e) => setSendMessage(e.target.checked)}
                       className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 accent-green-600 cursor-pointer"
                    />
                    <Label htmlFor="send-sms" className="cursor-pointer font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1">
                       <MessageSquare className="w-4 h-4 text-green-600" /> WhatsApp / SMS Alert on Generation
                    </Label>
                </div>
             </div>
             
             {sendMessage && (
               <div className="pl-6 pt-1">
                 <Label className="text-[10px] text-gray-500 font-semibold mb-1 block">Standardized Message Preview</Label>
                 <div className="w-full mt-1 p-3 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/50 text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">
                   *Fee Invoice Alert* 🔔{"\n\n"}
                   Dear *[Student Name]*,{"\n"}
                   Your fee invoice for *{config.feeLabel || "Tuition Fee"}* has been generated.{"\n\n"}
                   *Fee Breakdown:*{"\n"}
                   Tuition Fee: Rs. [Monthly Amount]{"\n"}
                   {config.annualCharges > 0 ? `Annual Charges: Rs. [Amount]\n` : ""}
                   {config.stationeryCharges > 0 ? `Stationery: Rs. [Amount]\n` : ""}
                   {config.customFeeDefault > 0 ? `${config.customFeeLabel || 'Custom Charges'}: Rs. [Amount]\n` : ""}
                   Arrears: Rs. [Amount] (if any){"\n\n"}
                   💰 *Total Due:* Rs. [Grand Total]{"\n"}
                   📅 *Due Date:* {config.dueDate}{"\n\n"}
                   Please clear the dues before the deadline. Thank you! 🏫
                 </div>
               </div>
             )}
          </div>

          {/* MAIN CONTENT: STUDENT TABLE */}
          <div className="space-y-2 bg-white dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
             
              <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5">
                  <h3 className="font-bold flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <Users className="w-4 h-4" /> Eligible Students
                    <span className="text-xs font-normal text-gray-400">({students.length})</span>
                  </h3>
              </div>

              {!selectedClassId ? (
                   <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 m-4 rounded-xl">
                     <Filter className="w-8 h-8 mb-2 opacity-20" />
                     <p className="text-sm">Select a class above to load students</p>
                   </div>
              ) : fetchingStudents ? (
                   <div className="h-64 flex items-center justify-center">
                     <Loader />
                   </div>
              ) : students.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 m-4 rounded-xl">
                    <CheckSquare className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">No eligible students found.</p>
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                          <thead className="bg-gray-100/50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b dark:border-gray-800">
                              <tr>
                                  <th className="p-3 w-10 text-center">
                                      <input 
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                        checked={selectedStudentIds.size === students.length && students.length > 0}
                                        onChange={toggleSelectAll}
                                      />
                                  </th>
                                  <th className="p-3 font-semibold">Student Info</th>
                                  <th className="p-3 font-semibold w-24">Monthly</th>
                                  <th className="p-3 font-semibold w-24">Arrears</th>
                                  <th className="p-3 font-semibold w-28">Annual Rs.</th>
                                  <th className="p-3 font-semibold w-28">Stat. Rs.</th>
                                  <th className="p-3 font-semibold w-28 text-blue-600 dark:text-blue-400">{config.customFeeLabel || "Custom"} Rs.</th>
                                  <th className="p-3 font-semibold text-right w-24">Est. Total</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {students.map((student) => {
                                const isSelected = selectedStudentIds.has(student.studentid)
                                
                                const mFee = Number(student.monthly_fee) || 0;
                                const arrearsAmt = Number(student.arrears) || 0;
                                const ann = getCharge(student.studentid, 'annual', config.annualCharges)
                                const stat = getCharge(student.studentid, 'stationery', config.stationeryCharges)
                                const cust = getCharge(student.studentid, 'custom', config.customFeeDefault)
                                const estTotal = mFee + arrearsAmt + ann + stat + cust;

                                return (
                                  <tr 
                                    key={student.studentid} 
                                    className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                  >
                                      <td className="p-3 text-center">
                                          <input 
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                            checked={isSelected}
                                            onChange={() => toggleStudent(student.studentid)}
                                          />
                                      </td>
                                      <td className="p-3">
                                          <div className="font-bold text-gray-900 dark:text-white line-clamp-1">{student.name}</div>
                                          <div className="text-[11px] text-gray-400">{student.fathername} • {student.studentid}</div>
                                      </td>
                                      <td className="p-3 text-gray-500 font-medium">
                                          {mFee.toLocaleString()}
                                      </td>
                                      <td className={`p-3 font-medium ${arrearsAmt > 0 ? "text-red-500" : "text-gray-400"}`}>
                                          {arrearsAmt > 0 ? arrearsAmt.toLocaleString() : "-"}
                                      </td>
                                      <td className="p-3">
                                          <Input 
                                            type="number" 
                                            className="h-7 w-20 text-xs" 
                                            placeholder={config.annualCharges}
                                            value={studentFees[student.studentid]?.annual !== undefined ? studentFees[student.studentid].annual : ""}
                                            onChange={(e) => handleStudentFeeChange(student.studentid, 'annual', e.target.value)}
                                          />
                                      </td>
                                      <td className="p-3">
                                          <Input 
                                            type="number" 
                                            className="h-7 w-20 text-xs" 
                                            placeholder={config.stationeryCharges}
                                            value={studentFees[student.studentid]?.stationery !== undefined ? studentFees[student.studentid].stationery : ""}
                                            onChange={(e) => handleStudentFeeChange(student.studentid, 'stationery', e.target.value)}
                                          />
                                      </td>
                                      <td className="p-3">
                                          <Input 
                                            type="number" 
                                            className="h-7 w-20 text-xs" 
                                            placeholder={config.customFeeDefault}
                                            value={studentFees[student.studentid]?.custom !== undefined ? studentFees[student.studentid].custom : ""}
                                            onChange={(e) => handleStudentFeeChange(student.studentid, 'custom', e.target.value)}
                                          />
                                      </td>
                                      <td className="p-3 text-right">
                                          <div className="font-mono font-bold text-green-600 dark:text-green-500">
                                            {estTotal.toLocaleString()}
                                          </div>
                                      </td>
                                  </tr>
                                )
                              })}
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

export default function GenerateInvoicesPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader /></div>}>
      <GenerateInvoicesContent />
    </Suspense>
  )
}
