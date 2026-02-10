"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../../utils/supabaseClient"
import Navbar from "../../../components/Navbar"
import Loader from "../../../components/Loader"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useToast } from "../../../hooks/use-toast"
import { printReceipt } from "../../../utils/printReceipt"
import { 
  ArrowLeft, Printer, CreditCard, 
  CheckCircle, Ban, ArrowRight, 
  History, User, Wallet, Search,
  FileQuestion, Banknote, Smartphone
} from "lucide-react"

function PayInvoiceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get("invoice_id")
  const { toast } = useToast()

  // --- State ---
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
    
  const [invoice, setInvoice] = useState(null)
  const [student, setStudent] = useState(null)
  const [details, setDetails] = useState([]) 
    
  // Blocking State
  const [newerInvoiceId, setNewerInvoiceId] = useState(null)
  const [notFound, setNotFound] = useState(false)
    
  // Data Maps
  const [paidHistoryMap, setPaidHistoryMap] = useState({}) 
  const [paymentInputs, setPaymentInputs] = useState({}) 
  const [notes, setNotes] = useState("")
  
  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState("cash") // Default: Cash

  // Manual Entry State
  const [manualIdInput, setManualIdInput] = useState("")

  // --- Fetch Data ---
  useEffect(() => {
    if (!invoiceId) {
      setLoading(false)
      setNotFound(false) 
      return
    }
    setNotFound(false) 
    fetchInvoiceData()
  }, [invoiceId])

  const fetchInvoiceData = async () => {
    try {
      setLoading(true)
      
      const { data: invData, error: invError } = await supabase
        .from("fee_invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle() 
        
      if (invError) throw invError

      if (!invData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setInvoice(invData)

      if (invData.student_id) {
        const { data: stuData } = await supabase
          .from("students")
          .select("*")
          .eq("studentid", invData.student_id)
          .single()
        setStudent(stuData)

        const { data: newerData } = await supabase
            .from("fee_invoices")
            .select("id, invoice_date")
            .eq("student_id", invData.student_id)
            .gt("invoice_date", invData.invoice_date)
            .neq("status", "expired")
            .order("invoice_date", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (newerData) {
            setNewerInvoiceId(newerData.id)
            setLoading(false)
            return
        }
      }

      const { data: detData, error: detError } = await supabase
        .from("fee_invoice_details")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order('id') 
      if (detError) throw detError
      setDetails(detData)

      const { data: payHistory, error: payError } = await supabase
        .from("fee_payments")
        .select("invoice_detail_id, amount")
        .eq("invoice_id", invoiceId)
      if (payError) throw payError

      const historyMap = {}
      payHistory.forEach(p => {
        if(p.invoice_detail_id) {
          historyMap[p.invoice_detail_id] = (historyMap[p.invoice_detail_id] || 0) + p.amount
        }
      })
      setPaidHistoryMap(historyMap)

      const initialInputs = {}
      detData.forEach(d => { initialInputs[d.id] = 0 })
      setPaymentInputs(initialInputs)

    } catch (error) {
      console.error(error)
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- Calculations ---
  const handleAmountChange = (detailId, val) => {
    if (parseFloat(val) < 0) return
    const numVal = val === '' ? 0 : parseFloat(val)
    setPaymentInputs(prev => ({ ...prev, [detailId]: numVal }))
  }

  let totalPayingNow = 0
  let isAnyItemOverpaying = false
    
  const calculatedDetails = details.map(item => {
    const totalAmount = item.amount || 0
    const alreadyPaid = paidHistoryMap[item.id] || 0
    const remainingBalance = totalAmount - alreadyPaid
    const payingNow = paymentInputs[item.id] || 0
    
    const isOver = payingNow > (remainingBalance + 0.1) 
    if (isOver) isAnyItemOverpaying = true
    totalPayingNow += payingNow

    return {
      ...item,
      totalAmount,
      alreadyPaid,
      remainingBalance,
      payingNow,
      isOver,
      isFullyPaid: remainingBalance <= 0
    }
  })

  const grandTotal = invoice?.total_amount || 0
  const totalPreviouslyPaid = Object.values(paidHistoryMap).reduce((a, b) => a + b, 0)
  const globalBalance = grandTotal - totalPreviouslyPaid

  // --- Handlers ---
  const handleManualIdSubmit = (e) => {
    e.preventDefault()
    if (!manualIdInput.trim()) return
    router.push(`?invoice_id=${manualIdInput.trim()}`)
  }

  const handlePaymentSubmit = async () => {
    if (totalPayingNow <= 0 || isAnyItemOverpaying) return
    setSubmitting(true)

    try {
      const paymentInserts = []
      calculatedDetails.forEach(item => {
        if (item.payingNow > 0) {
          paymentInserts.push({
            invoice_id: invoiceId,
            invoice_detail_id: item.id,
            amount: item.payingNow,
            payment_method: paymentMethod,
            notes: notes,
            paid_at: new Date().toISOString()
          })
        }
      })

      if (paymentInserts.length > 0) {
        const { error: payError } = await supabase.from("fee_payments").insert(paymentInserts)
        if (payError) throw payError
      }

      const totalPaidAfter = totalPreviouslyPaid + totalPayingNow
      let newStatus = "unpaid"
      if (totalPaidAfter >= grandTotal) newStatus = "paid"
      else if (totalPaidAfter > 0) newStatus = "partial"

      await supabase.from("fee_invoices").update({ status: newStatus }).eq("id", invoiceId)

      setSubmitting(false)
      setShowPrintModal(true)

    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      setSubmitting(false)
    }
  }

  const handlePrint = () => {
    printReceipt({
      student,
      invoiceId,
      items: calculatedDetails,
      totalPaidNow: totalPayingNow,
      balanceAfterPayment: globalBalance - totalPayingNow
    })
    setTimeout(() => router.push("/admin/invoices"), 1000)
  }

  // --- Styles ---
  
  const pageBackground = `min-h-screen pb-20 transition-colors duration-300
    bg-gray-50
    dark:bg-[#0f172a] dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-slate-900 dark:via-[#0a0f1d] dark:to-black
    text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30`

  const cardClass = `relative overflow-hidden rounded-xl transition-all duration-300
    bg-white border border-gray-200 shadow-sm
    dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none`

  const inputClass = `h-10 w-full rounded-md px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
    bg-white border-gray-300 text-gray-100 focus:border-blue-500
    dark:bg-black/20 dark:border-white/10 dark:text-whitedark:placeholder:text-gray-600 dark:focus:border-blue-500/50`

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a]"><Loader /></div>

  // --- NOT FOUND VIEW ---
  if (notFound) {
    return (
      <>
        <Navbar />
        <div className={pageBackground + " flex items-center justify-center pt-20"}>
            <div className={`${cardClass} max-w-lg w-full text-center space-y-6 p-8 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-500/20`}>
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-200 dark:border-orange-500/20">
                    <FileQuestion className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-2">Invoice Not Found</h1>
                    <p className="text-gray-600 dark:text-blue-300">
                        We couldn't locate an invoice with ID <strong>#{invoiceId}</strong>. 
                        It may have been deleted or the ID is incorrect.
                    </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                    <Button size="lg" onClick={() => router.push('/admin/fee/pay')} className="w-full bg-orange-600 hover:bg-orange-700 text-white">Try Another ID</Button>
                    <Button variant="ghost" onClick={() => router.push('/admin/invoices')}>Return to Dashboard</Button>
                </div>
            </div>
        </div>
      </>
    )
  }

  // --- MANUAL ENTRY VIEW ---
  if (!invoiceId) {
    return (
        <>
            <Navbar />
            <div className={pageBackground + " flex items-center justify-center pt-20"}>
                <div className={`${cardClass} max-w-md w-full text-center space-y-6 p-8`}>
                    <div className="w-16 h-16 bg-blue-5 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-500/20">
                        <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Find Invoice</h1>
                        <p className="text-gray-600 dark:text-blue-300 text-sm">
                            Please enter the Invoice ID to proceed.
                        </p>
                    </div>
                    <form onSubmit={handleManualIdSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2 text-left">
                            <Label className="text-xs uppercase font-bold text-gray-500">Invoice ID</Label>
                            <Input 
                                autoFocus
                                placeholder="e.g. 1024"
                                value={manualIdInput}
                                onChange={(e) => setManualIdInput(e.target.value)}
                                className={inputClass + " h-12 text-lg tracking-wider"}
                            />
                        </div>
                        <Button type="submit" size="lg" disabled={!manualIdInput} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12">
                            Search Invoice <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </form>
                </div>
            </div>
        </>
    )
  }

  // --- BLOCKING UI VIEW ---
  if (newerInvoiceId) {
      return (
        <div className={pageBackground + " flex items-center justify-center pt-20"}>
            <div className={`${cardClass} max-w-lg w-full text-center space-y-6 p-8 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-500/20`}>
                <div className="w-20 h-20 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-200 dark:border-red-500/20">
                    <Ban className="w-10 h-10 text-red-600 dark:text-red-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-2">Obsolete Invoice</h1>
                    <p className="text-gray-600 dark:text-blue-300">
                        Invoice <strong>#{invoiceId}</strong> has been superseded. 
                        A newer invoice has already been generated.
                    </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                    <Button size="lg" onClick={() => router.replace(`/admin/fee/pay?invoice_id=${newerInvoiceId}`)} className="w-full bg-red-600 hover:bg-red-700 text-white">
                        Go to Latest Invoice (#{newerInvoiceId}) <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="ghost" onClick={() => router.back()}>Go Back</Button>
                </div>
            </div>
        </div>
      )
  }

  // --- STANDARD PAYMENT UI ---
  return (
    <>
      <Navbar />
      <div className={pageBackground}>
        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
            
          {/* HEADER */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full bg-white dark:bg-white/10 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Fee Collection</h1>
              <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Processing Invoice #{invoiceId}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT COLUMN: Student & Summary */}
            <div className="w-full lg:w-1/3 space-y-6">
                
              {/* Student Card */}
              <div className={`${cardClass} p-6`}>
                <div className="flex items-center gap-4 mb-6 border-b border-gray-100 dark:border-white/10 pb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl border border-blue-100 dark:border-blue-500/20">
                        {student?.name?.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{student?.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-blue-400 font-mono">{student?.studentid}</p>
                    </div>
                </div>
                
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                        <span className="text-gray-500 dark:text-blue-400">Father Name</span>
                        <span className="font-semibold text-gray-800 dark:text-white">{student?.fathername}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                        <span className="text-gray-500 dark:text-blue-400">Class</span>
                        <span className="font-semibold text-gray-800 dark:text-white">{student?.class_id}</span>
                    </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className={`${cardClass} p-6 bg-slate-900 text-slate-100 border-slate-800 dark:bg-black/40`}>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">Payment Summary</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Grand Total</span>
                        <span className="font-mono text-lg text-white">{grandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-400">
                        <span className="text-sm flex items-center gap-2"><History className="w-4 h-4"/> Paid History</span>
                        <span className="font-mono text-lg">-{totalPreviouslyPaid.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-slate-700 dark:bg-white/10 my-2"></div>
                    <div className="flex justify-between items-end">
                        <span className="text-blue-400 font-bold">Balance Due</span>
                        <span className="font-bold text-2xl text-white">{globalBalance.toLocaleString()}</span>
                    </div>
                </div>
              </div>

              {/* Notes Input */}
              <div className={`${cardClass} p-4`}>
                 <Label className="text-xs text-gray-500 dark:text-blue-400 uppercase font-bold mb-2 block">Transaction Notes</Label>
                 <Input 
                   placeholder="e.g. Received by Admin..." 
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                   className={inputClass}
                 />
              </div>
            </div>

            {/* RIGHT COLUMN: Payment Table */}
            <div className="w-full lg:w-2/3 space-y-6">
                <div className={`${cardClass} p-0 flex flex-col`}>
                    <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center gap-3 bg-gray-50 dark:bg-white/5">
                        <CreditCard className="w-5 h-5 text-gray-500 dark:text-blue-400" />
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Fee Breakdown</h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            {/* Fixed Table Header Colors */}
                            <thead className="bg-gray-50 dark:bg-white/10 text-xs uppercase text-gray-500 dark:text-blue-300 font-medium">
                                <tr>
                                    <th className="p-5">Fee Head</th>
                                    <th className="p-5 text-right">Total</th>
                                    <th className="p-5 text-right">Paid</th>
                                    <th className="p-5 text-right w-32">Balance</th>
                                    {/* Pay Now Header background fixed for dark mode contrast */}
                                    <th className="p-5 w-48 bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-white">Pay Now</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {calculatedDetails.map((item) => (
                                    <tr key={item.id} className={`group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${item.isFullyPaid ? 'opacity-50 grayscale' : ''}`}>
                                        <td className="p-5 font-medium text-gray-900 dark:text-white">
                                            {item.fee_type}
                                            {item.isFullyPaid && <span className="ml-2 text-[10px] bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 px-2 py-0.5 rounded-full">Paid</span>}
                                        </td>
                                        <td className="p-5 text-right font-mono text-gray-500 dark:text-blue-400">{item.totalAmount.toLocaleString()}</td>
                                        <td className="p-5 text-right font-mono text-green-600 dark:text-green-400">{item.alreadyPaid > 0 ? item.alreadyPaid.toLocaleString() : '-'}</td>
                                        <td className="p-5 text-right font-mono font-bold text-gray-900 dark:text-blue-100">{item.remainingBalance.toLocaleString()}</td>
                                        <td className={`p-4 bg-blue-50 dark:bg-blue-900/10 ${item.isOver ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                            <Input 
                                                type="number" 
                                                disabled={item.remainingBalance <= 0}
                                                value={paymentInputs[item.id] === 0 ? '' : paymentInputs[item.id]}
                                                onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                                placeholder={item.remainingBalance > 0 ? item.remainingBalance.toString() : '-'}
                                                // Fixed Input class to include dark mode specific styles for the table context
                                                className={`text-right h-10 ${inputClass} 
                                                  ${item.isOver 
                                                    ? 'border-red-500 text-red-600 dark:text-red-400 focus:ring-red-500' 
                                                    : 'focus:ring-blue-500'}`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* STATIC BOTTOM ACTION SECTION (Formerly Sticky) */}
                <div className={`${cardClass} p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6`}>
                    
                    {/* Total Display */}
                    <div className="flex flex-col items-start w-full md:w-auto">
                        <span className="text-xs text-gray-500 dark:text-blue-400 uppercase font-bold tracking-wider">Total Collecting</span>
                        <span className={`text-4xl font-black font-mono leading-none ${isAnyItemOverpaying ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                            <span className="text-lg text-gray-400 dark:text-blue-500 mr-2 font-normal">PKR</span>
                            {totalPayingNow.toLocaleString()}
                        </span>
                    </div>

                    {/* Right Side: Payment Methods + Button */}
                    <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                        
                        {/* Payment Method Selector */}
                        <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 w-full md:w-auto justify-center">
                            {/* Option: Cash */}
                            <button
                                onClick={() => setPaymentMethod("cash")}
                                className={`flex flex-col items-center justify-center min-w-[80px] py-3 px-4 rounded-lg text-xs font-bold transition-all duration-200
                                    ${paymentMethod === "cash" 
                                        ? "bg-white shadow-md text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-600 dark:text-white dark:ring-0 dark:shadow-blue-900/30" 
                                        : "text-gray-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-white/10"
                                    }`}
                            >
                                <Banknote className="w-5 h-5 mb-1.5" />
                                CASH
                            </button>
                            
                            {/* Option: JazzCash */}
                            <button
                                onClick={() => setPaymentMethod("jazzcash")}
                                className={`flex flex-col items-center justify-center min-w-[80px] py-3 px-4 rounded-lg text-xs font-bold transition-all duration-200
                                    ${paymentMethod === "jazzcash" 
                                        ? "bg-white shadow-md text-red-600 ring-1 ring-red-500/20 dark:bg-red-600 dark:text-white dark:ring-0 dark:shadow-red-900/30" 
                                        : "text-gray-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-white/10"
                                    }`}
                            >
                                <Smartphone className="w-5 h-5 mb-1.5" />
                                JAZZCASH
                            </button>

                            {/* Option: EasyPaisa */}
                            <button
                                onClick={() => setPaymentMethod("easypaisa")}
                                className={`flex flex-col items-center justify-center min-w-[80px] py-3 px-4 rounded-lg text-xs font-bold transition-all duration-200
                                    ${paymentMethod === "easypaisa" 
                                        ? "bg-white shadow-md text-green-600 ring-1 ring-green-500/20 dark:bg-green-600 dark:text-white dark:ring-0 dark:shadow-green-900/30" 
                                        : "text-gray-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-white/10"
                                    }`}
                            >
                                <Smartphone className="w-5 h-5 mb-1.5" />
                                EASYPAISA
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="h-12 w-px bg-gray-200 dark:bg-white/10 hidden md:block"></div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 w-full md:w-auto">
                            <Button 
                                size="lg"
                                onClick={handlePaymentSubmit} 
                                disabled={submitting || totalPayingNow <= 0 || isAnyItemOverpaying}
                                className={`w-full md:w-auto min-w-[200px] h-14 font-bold shadow-xl transition-all rounded-xl text-lg
                                    ${isAnyItemOverpaying 
                                        ? 'bg-blue-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-blue-400 to-indigo-400 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25 dark:from-blue-600 dark:to-blue-500'}`}
                            >
                                {submitting ? <Loader small /> : (
                                    <span className="flex items-center">
                                        Pay Now <ArrowRight className="w-5 h-5 ml-2" />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

          </div>
        </div>

        {/* SUCCESS MODAL */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`${cardClass} max-w-sm w-full bg-white dark:bg-[#0b1220] border-gray-200 dark:border-white/10 p-6 animate-in zoom-in-95 duration-200 shadow-2xl`}>
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-green-50 dark:bg-green-500/20 rounded-full flex items-center justify-center border border-green-100 dark:border-green-500/30">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Success!</h2>
                    <p className="text-gray-500 dark:text-blue-400 text-sm">Transaction recorded via <span className="capitalize font-bold text-gray-700 dark:text-blue-300">{paymentMethod}</span>.</p>
                </div>

                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 w-full border border-dashed border-gray-300 dark:border-gray-700">
                   <p className="text-xs uppercase font-bold text-gray-500 dark:text-blue-400">Amount Received</p>
                   <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalPayingNow.toLocaleString()} <span className="text-sm text-gray-400">PKR</span></p>
                </div>

                <div className="flex flex-col w-full gap-3">
                  <Button onClick={handlePrint} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-semibold">
                    <Printer className="w-5 h-5 mr-2" /> Print Receipt
                  </Button>
                  <Button variant="ghost" onClick={() => router.push("/admin/invoices")} className="w-full text-gray-500 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-white/10">
                    Skip & Return to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function PayInvoicePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader /></div>}>
      <PayInvoiceContent />
    </Suspense>
  )
}
