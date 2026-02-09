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
  DollarSign, CheckSquare, Send, AlertCircle, Settings
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

  // Selections
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())
    
  // Configuration
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [config, setConfig] = useState({
    feeLabel: "", 
    annualCharges: 0,
    stationeryCharges: 0,
    dueDate: new Date().toISOString().split('T')[0]
  })

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

  // --- CORE LOGIC: Fetch Students ---
  const fetchEligibleStudents = async (classId, dateStr) => {
    setFetchingStudents(true)
    setSelectedStudentIds(new Set()) 
      
    try {
      // 1. Get all active students in class
      const { data: allStudents, error: sError } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("name")

      if (sError) throw sError

      // 2. Get invoices generated for THIS selected month (prevent duplicates)
      const selectedDate = new Date(dateStr)
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().split('T')[0]

      const { data: existingInvoices, error: iError } = await supabase
        .from("fee_invoices")
        .select("student_id")
        .gte("invoice_date", startOfMonth)
        .lte("invoice_date", endOfMonth)
        .neq("status", "expired") // Ignore expired invoices when checking for duplicates

      if (iError) throw iError

      const invoicedStudentIds = new Set(existingInvoices.map(inv => inv.student_id))
      const eligibleStudents = allStudents.filter(s => !invoicedStudentIds.has(s.studentid))
      
      setStudents(eligibleStudents)
      setExcludedCount(allStudents.length - eligibleStudents.length)

    } catch (error) {
      console.error(error)
      toast({ title: "Error fetching data", variant: "destructive" })
    } finally {
      setFetchingStudents(false)
    }
  }

  // --- Selection Logic ---
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

  // --- Generator Logic (Modified for Exact Column Carry-Over & Expiration) ---
  const handleGenerate = async () => {
    if (selectedStudentIds.size === 0) {
      toast({ title: "No students selected", variant: "destructive" })
      return
    }

    setSubmitting(true)
    let successCount = 0
    let failCount = 0
    let expiredCount = 0

    try {
      const selectedStudentsList = students.filter(s => selectedStudentIds.has(s.studentid))
      const startOfCurrentMonth = new Date(new Date(invoiceDate).getFullYear(), new Date(invoiceDate).getMonth(), 1).toISOString()

      for (const student of selectedStudentsList) {
        
        // ---------------------------------------------------------
        // 1. FETCH OLD INVOICES & DETAILS
        // ---------------------------------------------------------
        // We strictly only look for 'unpaid' or 'partial' statuses.
        const { data: oldInvoices } = await supabase
          .from("fee_invoices")
          .select(`
            id, invoice_date, status, total_amount,
            fee_invoice_details ( id, fee_type, description, amount ),
            fee_payments ( invoice_detail_id, amount )
          `)
          .eq("student_id", student.studentid)
          .lt("invoice_date", startOfCurrentMonth) // Strictly older than current month
          .in("status", ["unpaid", "partial"]) // Only active debts

        let carriedOverDetails = []
        let totalCarryOverAmount = 0
        let oldInvoiceIdsToExpire = []

        if (oldInvoices && oldInvoices.length > 0) {
            oldInvoices.forEach(oldInv => {
                // LOGIC UPDATE: If we retrieved this invoice, it means it is unpaid/partial
                // and older than today. We will attempt to carry its balance forward.
                // Regardless of the specific math, we mark this invoice ID to be expired
                // so the debt is consolidated into the new invoice.
                oldInvoiceIdsToExpire.push(oldInv.id)

                // Loop through each item (e.g., Tuition, Lab)
                oldInv.fee_invoice_details.forEach(detail => {
                    // Sum payments for THIS specific item
                    const paidForItem = oldInv.fee_payments
                        ?.filter(p => p.invoice_detail_id === detail.id)
                        .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
                    
                    const remainingForItem = detail.amount - paidForItem;

                    if (remainingForItem > 0) {
                        totalCarryOverAmount += remainingForItem;
                        
                        // Add to new list, keeping EXACT fee_type and adding audit note
                        carriedOverDetails.push({
                            fee_type: detail.fee_type, 
                            description: `${detail.description} (Arrears: ${new Date(oldInv.invoice_date).toLocaleDateString()})`,
                            amount: remainingForItem
                        })
                    }
                })
            })
        }

        // ---------------------------------------------------------
        // 2. Calculate New Totals
        // ---------------------------------------------------------
        const monthlyFee = Number(student.monthly_fee) || 0
        const annual = Number(config.annualCharges) || 0
        const stationery = Number(config.stationeryCharges) || 0
        
        // Grand Total = Current Month + Carry Over Sum
        const grandTotal = monthlyFee + annual + stationery + totalCarryOverAmount

        // ---------------------------------------------------------
        // 3. Create Master Invoice
        // ---------------------------------------------------------
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

        // ---------------------------------------------------------
        // 4. Create Details
        // ---------------------------------------------------------
        const detailsPayload = []
        
        // A. Current Month Items
        if (monthlyFee > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: config.feeLabel || "Tuition Fee", description: "Monthly Tuition Charges", amount: monthlyFee })
        if (annual > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: "Annual Charges", description: "Annual / Paper Funds", amount: annual })
        if (stationery > 0) detailsPayload.push({ invoice_id: invData.id, fee_type: "Stationery", description: "Stationery / Books", amount: stationery })

        // B. Carried Over Items (Exact Columns)
        carriedOverDetails.forEach(item => {
            detailsPayload.push({ ...item, invoice_id: invData.id })
        })

        if (detailsPayload.length > 0) {
          await supabase.from("fee_invoice_details").insert(detailsPayload)
        }

        // ---------------------------------------------------------
        // 5. Expire Old Invoices (The Critical Update)
        // ---------------------------------------------------------
        if (oldInvoiceIdsToExpire.length > 0) {
            const { error: expireError } = await supabase
                .from("fee_invoices")
                .update({ 
                    status: "expired",  // Set status to expired
                    notes: `Consolidated into Invoice #${invData.id}` // Audit trail
                })
                .in("id", oldInvoiceIdsToExpire) // Targets the specific IDs we found earlier
            
            if (!expireError) {
                expiredCount += oldInvoiceIdsToExpire.length
            } else {
                console.error("Error expiring invoices", expireError)
            }
        }

        successCount++
      }

      toast({ 
        title: "Generation Complete", 
        description: `Generated ${successCount} invoices. Expired ${expiredCount} old unpaid invoices.`,
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
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1220] p-4 transition-colors duration-500">
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

          {/* TOP CONFIGURATION BAR (Compact Horizontal Layout) */}
          <div className={glassCardClass}>
             <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
                
                {/* Col 1: Class Selection */}
                <div className="lg:col-span-1">
                   <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Class</Label>
                   <select 
                      className={`w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`}
                      value={selectedClassId}
                      onChange={handleClassChange}
                    >
                      <option value="">-- Select Class --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Col 2: Month & Due Date */}
                <div className="lg:col-span-1">
                   <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Invoice Date</Label>
                   <Input 
                        type="date" 
                        value={invoiceDate} 
                        onChange={(e) => setInvoiceDate(e.target.value)} 
                        className={inputClass}
                   />
                </div>
                <div className="lg:col-span-1">
                   <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Due Date</Label>
                   <Input 
                        type="date" 
                        value={config.dueDate} 
                        onChange={(e) => setConfig({...config, dueDate: e.target.value})}
                        className={inputClass}
                   />
                </div>

                {/* Col 3: Fee Config */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                   <div>
                      <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Annual Charges</Label>
                      <Input 
                        type="number" 
                        placeholder="0"
                        value={config.annualCharges} 
                        onChange={(e) => setConfig({...config, annualCharges: e.target.value})}
                        className={inputClass}
                      />
                   </div>
                   <div>
                      <Label className="text-xs text-gray-500 font-semibold uppercase mb-1">Stationery</Label>
                      <Input 
                        type="number" 
                        placeholder="0"
                        value={config.stationeryCharges} 
                        onChange={(e) => setConfig({...config, stationeryCharges: e.target.value})}
                        className={inputClass}
                      />
                   </div>
                </div>

                {/* Col 4: Action */}
                <div className="lg:col-span-1">
                    <Button 
                     onClick={handleGenerate} 
                     disabled={submitting || selectedStudentIds.size === 0}
                     className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-md text-xs font-bold"
                    >
                      {submitting ? <Loader small /> : "GENERATE"}
                    </Button>
                </div>
             </div>
             
             {/* Optional Label Row */}
             <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-4 items-center">
                <div className="flex-1">
                    <Label className="text-[10px] text-gray-400 uppercase font-bold">Main Fee Label</Label>
                    <Input 
                      value={config.feeLabel} 
                      onChange={(e) => setConfig({...config, feeLabel: e.target.value})}
                      className="h-7 text-xs bg-transparent border-none p-0 focus-visible:ring-0 placeholder:text-gray-300"
                      placeholder="e.g. Tuition Fee"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
                     <AlertCircle className="w-3 h-3" />
                     <span>Unpaid invoices will be expired & moved here.</span>
                </div>
             </div>
          </div>

          {/* MAIN CONTENT: STUDENT GRID (Horizontal Spread) */}
          <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                  <h3 className="font-bold flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <Users className="w-4 h-4" /> Eligible Students
                    <span className="text-xs font-normal text-gray-400">({students.length})</span>
                  </h3>
                  
                  {students.length > 0 && (
                      <div className="flex items-center gap-2">
                        <input 
                            type="checkbox"
                            id="select-all" 
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                            checked={selectedStudentIds.size === students.length}
                            onChange={toggleSelectAll}
                        />
                        <Label htmlFor="select-all" className="cursor-pointer text-sm font-medium">Select All</Label>
                      </div>
                  )}
              </div>

              {!selectedClassId ? (
                   <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                     <Filter className="w-8 h-8 mb-2 opacity-20" />
                     <p className="text-sm">Select a class above to start</p>
                   </div>
              ) : fetchingStudents ? (
                   <div className="h-64 flex items-center justify-center">
                     <Loader />
                   </div>
              ) : students.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <CheckSquare className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">No eligible students found.</p>
                  </div>
              ) : (
                  // GRID VIEW for Compactness
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {students.map((student) => {
                        const isSelected = selectedStudentIds.has(student.studentid)
                        return (
                          <div 
                            key={student.studentid}
                            onClick={() => toggleStudent(student.studentid)}
                            className={`
                              cursor-pointer relative overflow-hidden rounded-lg border p-3 transition-all duration-200
                              ${isSelected 
                                ? "bg-blue-50 border-blue-400 dark:bg-blue-900/30" 
                                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-300"}
                            `}
                          >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100 line-clamp-1">{student.name}</h4>
                                    <p className="text-xs text-gray-500 line-clamp-1">{student.fathername}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">ID: {student.studentid}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400">Fee</span>
                                    <span className="text-sm font-mono font-bold text-green-600">{Number(student.monthly_fee).toLocaleString()}</span>
                                </div>
                            </div>
                            
                            {/* Selection Indicator */}
                            <div className={`absolute bottom-0 right-0 p-1 ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                                <CheckSquare className="w-4 h-4 text-blue-500" />
                            </div>
                          </div>
                        )
                      })}
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
