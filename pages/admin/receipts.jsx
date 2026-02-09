"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../utils/supabaseClient"
import { printReceipt } from "../../utils/printReceipt"
import Navbar from "../../components/Navbar"
import Loader from "../../components/Loader"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { 
  Search, FileText, 
  Calendar, CheckCircle2, RefreshCcw,
  Filter, Printer, Banknote
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"

function FeeReceiptsContent() {
  const router = useRouter()
  const { toast } = useToast()

  // --- State ---
  const [loading, setLoading] = useState(true)
  const [printingId, setPrintingId] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [classes, setClasses] = useState([])
    
  // Pagination State
  const [page, setPage] = useState(0)
  const ITEMS_PER_PAGE = 20
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    classId: "",
    startDate: "",
    endDate: ""
  })

  // --- Initialization ---
  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchReceipts()
  }, [page, filters.classId, filters.startDate, filters.endDate]) 

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search !== undefined) {
        setPage(0)
        fetchReceipts()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [filters.search])

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name")
    setClasses(data || [])
  }

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const from = page * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      // UPDATED QUERY: Fetching from fee_payments instead of fee_invoices
      // We use !inner joins to ensure we can filter by class or student name
      let query = supabase
        .from("fee_payments")
        .select(`
          *,
          fee_invoices!inner (
            id,
            status,
            invoice_date,
            students!inner (
              studentid,
              name,
              fathername,
              class_id,
              classes ( name )
            )
          )
        `, { count: 'exact' })
        .order('paid_at', { ascending: false })
        .range(from, to)

      // Apply Filters
      if (filters.startDate) query = query.gte("paid_at", filters.startDate)
      if (filters.endDate) query = query.lte("paid_at", filters.endDate)
      
      // Filter by nested Class ID
      if (filters.classId) {
        query = query.eq("fee_invoices.students.class_id", filters.classId)
      }

      // Filter by Search (Payment ID or Student Name)
      if (filters.search) {
        if (!isNaN(filters.search)) {
          // If number, search exact Payment ID
          query = query.eq("id", filters.search)
        } else {
          // If text, search Student Name
          query = query.ilike("fee_invoices.students.name", `%${filters.search}%`)
        }
      }

      const { data, error, count } = await query

      if (error) throw error

      setReceipts(data || [])
      setTotalCount(count || 0)

    } catch (error) {
      console.error(error)
      toast({ title: "Failed to load receipts", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- PRINT LOGIC ---
  const handlePrintReceipt = async (payment) => {
    setPrintingId(payment.id)
    try {
      // Get the invoice ID from the payment record
      const invoiceId = payment.invoice_id
      const studentData = payment.fee_invoices?.students

      // Fetch line items specifically for this invoice
      const { data: items, error } = await supabase
        .from("fee_invoice_details")
        .select("*")
        .eq("invoice_id", invoiceId)

      if (error) throw error

      const printData = {
        student: studentData,
        invoiceId: invoiceId, // Using Invoice ID for reference
        receiptId: payment.id, // Passing Payment ID specifically
        items: items || [],
        totalPaidNow: payment.amount, // Using the specific payment amount
        balanceAfterPayment: 0 // You might want to calculate this if needed
      }

      printReceipt(printData)
      toast({ title: "Receipt downloaded successfully" })

    } catch (error) {
      console.error("Print Error:", error)
      toast({ title: "Failed to generate receipt", variant: "destructive" })
    } finally {
      setPrintingId(null)
    }
  }

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  }

  // --- Styles ---
  const glassPanel = "bg-white/70 dark:bg-white/5 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-xl shadow-indigo-100/20 dark:shadow-none rounded-2xl"
  const glassInput = "bg-white/50 dark:bg-white/5 border-indigo-100 dark:border-white/10 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all duration-300 placeholder:text-slate-400 text-sm"
  const tableHead = "px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-indigo-50/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-20"
   
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] from-indigo-100 via-purple-50 to-pink-100 dark:from-[#0f172a] dark:via-[#1e1b4b] dark:to-[#17101f] p-4 md:p-8 font-sans">
        
        <div className="w-full max-w-7xl mx-auto space-y-6">

          {/* --- HEADER --- */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
                  <FileText className="h-5 w-5" />
                </span>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Payment Receipts</h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium ml-1">
                View and download transaction history.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => router.push('/admin/fee/pay')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 border-0"
              >
                <Banknote className="w-4 h-4 mr-2" />
                Pay Fee
              </Button>
              <Button variant="ghost" onClick={fetchReceipts} className="h-10 w-10 p-0 rounded-full bg-white/40 hover:bg-white/80 border border-white/40 shadow-sm transition-all">
                <RefreshCcw className="w-4 h-4 text-slate-600" />
              </Button>
            </div>
          </div>

          {/* --- MAIN CARD --- */}
          <div className={`${glassPanel} flex flex-col overflow-hidden`}>
            
            {/* FILTERS */}
            <div className="p-5 border-b border-indigo-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-white/30 dark:bg-black/20">
              <div className="lg:col-span-6 relative group">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input 
                  placeholder="Search student or payment ID..." 
                  className={`pl-10 h-10 ${glassInput}`}
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                />
              </div>

              <div className="lg:col-span-2">
                <select 
                  className={`h-10 w-full rounded-xl px-3 text-sm outline-none cursor-pointer ${glassInput}`}
                  value={filters.classId}
                  onChange={(e) => setFilters({...filters, classId: e.target.value})}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="lg:col-span-4 flex gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                   <Input 
                    type="date" 
                    className={`pl-9 h-10 text-xs ${glassInput} [color-scheme:light]`} 
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  />
                </div>
                <div className="relative flex-1">
                   <Input 
                    type="date" 
                    className={`px-3 h-10 text-xs ${glassInput} [color-scheme:light]`} 
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto min-h-[500px] relative">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className={`${tableHead} w-24`}>Payment #</th>
                    <th className={tableHead}>Student Information</th>
                    <th className={tableHead}>Payment Date</th>
                    <th className={`${tableHead} text-right`}>Amount</th>
                    <th className={`${tableHead} text-center`}>Method</th>
                    <th className={`${tableHead} text-right pr-8`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent text-slate-600 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="h-64">
                          <div className="flex flex-col items-center justify-center h-full gap-3">
                             <Loader small={false} />
                             <p className="text-sm text-slate-400 animate-pulse">Loading payments...</p>
                          </div>
                      </td>
                    </tr>
                  ) : receipts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center opacity-60">
                           <Filter className="w-12 h-12 text-slate-300 mb-2" />
                           <p className="text-lg font-medium text-slate-500">No payments found</p>
                        </div>
                      </td>
                    </tr>
                  ) : receipts.map((rcpt) => {
                    // Extract nested student data for cleaner code in JSX
                    const student = rcpt.fee_invoices?.students;
                    const className = student?.classes?.name;

                    return (
                      <tr key={rcpt.id} className="group border-b border-indigo-50/50 dark:border-white/5 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all duration-200">
                        
                        {/* ID */}
                        <td className="px-6 py-5 text-xs font-mono text-slate-400">
                          #{rcpt.id}
                        </td>

                        {/* Student Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white dark:ring-white/10 bg-gradient-to-br from-emerald-100 to-teal-200 text-teal-700">
                              {getInitials(student?.name)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-[15px]">
                                {student?.name || "Unknown"}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="bg-slate-100 dark:bg-white/10 px-1.5 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                                  {className || "N/A"}
                                </span>
                                <span>F: {student?.fathername}</span>
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Date - Using paid_at */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-sm">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {new Date(rcpt.paid_at).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5">
                              {new Date(rcpt.paid_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-lg tracking-tight text-emerald-700 dark:text-emerald-400">
                                {Number(rcpt.amount).toLocaleString()}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-slate-400">PKR</span>
                            </div>
                        </td>

                        {/* Payment Method */}
                        <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {rcpt.payment_method || "Cash"}
                            </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right pr-8">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handlePrintReceipt(rcpt)}
                            disabled={printingId === rcpt.id}
                            className="h-8 text-xs font-medium border-emerald-200 hover:border-emerald-300 text-emerald-700 hover:bg-emerald-50 shadow-sm rounded-lg"
                          >
                            {printingId === rcpt.id ? (
                              <Loader small />
                            ) : (
                              <>
                                <Printer className="w-3.5 h-3.5 mr-1.5" /> Receipt
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* --- PAGINATION --- */}
            <div className="px-6 py-4 border-t border-indigo-100 dark:border-white/5 bg-white/40 dark:bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="text-xs text-slate-500 font-medium order-2 sm:order-1">
                 Showing <span className="text-slate-900 dark:text-white font-bold">{receipts.length > 0 ? page * ITEMS_PER_PAGE + 1 : 0}</span> - <span className="text-slate-900 dark:text-white font-bold">{Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)}</span> of <span className="text-slate-900 dark:text-white font-bold">{totalCount}</span>
               </div>
               
               <div className="flex items-center gap-2 order-1 sm:order-2">
                 <Button 
                   variant="outline" size="sm" 
                   onClick={() => setPage(p => Math.max(0, p - 1))}
                   disabled={page === 0 || loading}
                   className="h-8 text-xs bg-white/50 hover:bg-white border-transparent shadow-sm"
                 >
                   Previous
                 </Button>
                 <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md min-w-[3rem] text-center dark:bg-indigo-900/30 dark:text-indigo-300">
                    {page + 1}
                 </span>
                 <Button 
                   variant="outline" size="sm" 
                   onClick={() => setPage(p => p + 1)}
                   disabled={(page + 1) * ITEMS_PER_PAGE >= totalCount || loading}
                   className="h-8 text-xs bg-white/50 hover:bg-white border-transparent shadow-sm"
                 >
                   Next
                 </Button>
               </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

export default function FeeReceiptsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-indigo-50"><Loader /></div>}>
      <FeeReceiptsContent />
    </Suspense>
  )
}
