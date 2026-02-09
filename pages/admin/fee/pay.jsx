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
  History, User, Wallet
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
    
  // Data Maps
  const [paidHistoryMap, setPaidHistoryMap] = useState({}) 
  const [paymentInputs, setPaymentInputs] = useState({}) 
  const [notes, setNotes] = useState("")

  // --- Fetch Data ---
  useEffect(() => {
    if (!invoiceId) {
      router.push("/admin/invoices")
      return
    }
    fetchInvoiceData()
  }, [invoiceId])

  const fetchInvoiceData = async () => {
    try {
      setLoading(true)
       
      // 1. Fetch Current Invoice
      const { data: invData, error: invError } = await supabase
        .from("fee_invoices")
        .select("*")
        .eq("id", invoiceId)
        .single()
       
      if (invError) throw invError
      setInvoice(invData)

      // 2. Fetch Student
      if (invData.student_id) {
        const { data: stuData } = await supabase
          .from("students")
          .select("*")
          .eq("studentid", invData.student_id)
          .single()
        setStudent(stuData)

        // 3. Check for Newer Invoice
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

      // 4. Fetch Details
      const { data: detData, error: detError } = await supabase
        .from("fee_invoice_details")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order('id') 
      if (detError) throw detError
      setDetails(detData)

      // 5. Fetch Payment History
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
    // prevent negative
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
    
    // Allow a tiny margin for float point errors (0.1)
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
            payment_method: "cash",
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

  // --- Print Handler ---
  const handlePrint = () => {
    printReceipt({
      student,
      invoiceId,
      items: calculatedDetails,
      totalPaidNow: totalPayingNow,
      balanceAfterPayment: globalBalance - totalPayingNow
    })
    // Optional delay to allow print dialog to open before redirect
    setTimeout(() => router.push("/admin/invoices"), 1000)
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader /></div>

  // --- Styles ---
  const glassCardClass = "relative overflow-hidden rounded-2xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl p-6 transition-all"
  // Fixed: Added explicit text colors to inputs to prevent white-on-white issues
  const glassInputClass = "bg-white/50 dark:bg-white/5 border-white/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-500/70 text-gray-900 dark:text-white"
  const gradientBg = "min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-[#0b1220] dark:via-[#1a1c2e] dark:to-[#0f0718] p-4 md:p-8 transition-colors duration-500"

  // --- BLOCKING UI VIEW (Glassmorphic) ---
  if (newerInvoiceId) {
      return (
        <div className={gradientBg + " flex items-center justify-center"}>
            <div className={`${glassCardClass} max-w-lg w-full text-center space-y-6 border-red-200/30 bg-red-50/20`}>
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto backdrop-blur-md border border-red-500/20">
                    <Ban className="w-10 h-10 text-red-600 dark:text-red-400" />
                </div>
                
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Obsolete Invoice</h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        Invoice <strong>#{invoiceId}</strong> has been superseded. 
                        A newer invoice has already been generated for {student?.name}.
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <Button 
                        size="lg" 
                        onClick={() => router.replace(`/admin/fee/pay?invoice_id=${newerInvoiceId}`)}
                        className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg"
                    >
                        Go to Latest Invoice (#{newerInvoiceId}) <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        onClick={() => router.back()}
                        className="text-gray-500 hover:bg-white/20 dark:text-gray-400 dark:hover:bg-white/10"
                    >
                        Go Back
                    </Button>
                </div>
            </div>
        </div>
      )
  }

  // --- STANDARD PAYMENT UI ---
  return (
    <>
      <Navbar />
      <div className={gradientBg + " pb-32"}>
        <div className="max-w-7xl mx-auto space-y-6">
           
          {/* HEADER */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 bg-white/30 backdrop-blur border-white/20 hover:bg-white/50 dark:hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 dark:text-white" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-sm">Fee Collection</h1>
              <p className="text-gray-600 dark:text-slate-400 text-sm font-medium">Processing Invoice #{invoiceId}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT COLUMN: Student & Summary */}
            <div className="w-full lg:w-1/3 space-y-6 lg:sticky lg:top-24">
               
              {/* Student Card */}
              <div className={glassCardClass}>
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <User className="w-24 h-24 dark:text-white" />
                </div>
                
                <div className="flex items-center gap-4 mb-6 border-b border-gray-200/30 dark:border-white/10 pb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-600/10 backdrop-blur border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl">
                        {student?.name?.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{student?.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{student?.studentid}</p>
                    </div>
                </div>
                
                <div className="space-y-3 text-sm relative z-10">
                    <div className="flex justify-between p-2 rounded-lg bg-white/20 dark:bg-white/5">
                        <span className="text-gray-600 dark:text-gray-400">Father Name</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{student?.fathername}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/20 dark:bg-white/5">
                        <span className="text-gray-600 dark:text-gray-400">Class</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{student?.class_id}</span>
                    </div>
                </div>
              </div>

              {/* Summary Card (Darker/Distinct) */}
              <div className={`${glassCardClass} bg-slate-900/80 dark:bg-black/60 text-white border-slate-700/50`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Wallet className="w-24 h-24 text-white" />
                </div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">Payment Summary</h3>
                
                <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Grand Total</span>
                        <span className="font-mono text-lg text-white">{grandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-400">
                        <span className="text-sm flex items-center gap-2"><History className="w-4 h-4"/> Paid History</span>
                        <span className="font-mono text-lg">-{totalPreviouslyPaid.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-white/10 my-2"></div>
                    <div className="flex justify-between items-end">
                        <span className="text-blue-400 font-bold">Balance Due</span>
                        <span className="font-bold text-2xl text-white">{globalBalance.toLocaleString()}</span>
                    </div>
                </div>
              </div>

              {/* Notes Input */}
              <div className={glassCardClass + " py-4"}>
                 <Label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-2 block">Transaction Notes</Label>
                 <Input 
                   placeholder="e.g. Cash received by Admin..." 
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                   className={glassInputClass}
                 />
              </div>
            </div>

            {/* RIGHT COLUMN: Payment Table */}
            <div className={`w-full lg:w-2/3 ${glassCardClass} p-0 flex flex-col`}>
                <div className="p-6 border-b border-gray-200/30 dark:border-white/10 flex items-center gap-3 bg-white/20 dark:bg-white/5">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        <CreditCard className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">Fee Breakdown</h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 dark:bg-white/5 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">
                            <tr>
                                <th className="p-5">Fee Head</th>
                                <th className="p-5 text-right">Total</th>
                                <th className="p-5 text-right">Paid</th>
                                <th className="p-5 text-right w-32">Balance</th>
                                <th className="p-5 w-48 bg-blue-500/5 text-blue-600 dark:text-blue-300">Pay Now</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/30 dark:divide-white/10">
                            {calculatedDetails.map((item) => (
                                <tr key={item.id} className={`group hover:bg-white/40 dark:hover:bg-white/5 transition-colors ${item.isFullyPaid ? 'opacity-50 grayscale' : ''}`}>
                                    <td className="p-5 font-medium text-gray-700 dark:text-gray-200">
                                        {item.fee_type}
                                        {item.isFullyPaid && <span className="ml-2 text-[10px] bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full border border-green-500/20">Paid</span>}
                                    </td>
                                    <td className="p-5 text-right font-mono text-gray-500 dark:text-gray-400">{item.totalAmount.toLocaleString()}</td>
                                    <td className="p-5 text-right font-mono text-green-600 dark:text-green-400">{item.alreadyPaid > 0 ? item.alreadyPaid.toLocaleString() : '-'}</td>
                                    <td className="p-5 text-right font-mono font-bold text-gray-900 dark:text-gray-100">{item.remainingBalance.toLocaleString()}</td>
                                    <td className={`p-4 bg-blue-500/5 ${item.isOver ? 'bg-red-500/10' : ''}`}>
                                        <div className="relative">
                                            <Input 
                                                type="number" 
                                                disabled={item.remainingBalance <= 0}
                                                value={paymentInputs[item.id] === 0 ? '' : paymentInputs[item.id]}
                                                onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                                placeholder={item.remainingBalance > 0 ? item.remainingBalance.toString() : '-'}
                                                className={`text-right h-10 ${glassInputClass} 
                                                    ${item.isOver ? 'border-red-500/50 text-red-600 dark:text-red-400' : ''}
                                                `}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

          </div>
        </div>

        {/* STICKY ACTION BAR (Glassmorphic) */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/20 bg-white/80 dark:bg-[#0b1220]/80 backdrop-blur-lg p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Total Collecting</span>
                    <span className={`text-3xl font-black font-mono leading-none ${isAnyItemOverpaying ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                        <span className="text-lg text-gray-400 dark:text-gray-500 mr-1 font-normal">PKR</span>
                        {totalPayingNow.toLocaleString()}
                    </span>
                </div>

                <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => router.back()} className="hidden md:flex hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancel</Button>
                    <Button 
                        size="lg"
                        onClick={handlePaymentSubmit} 
                        disabled={submitting || totalPayingNow <= 0 || isAnyItemOverpaying}
                        className={`min-w-[180px] h-12 font-bold shadow-lg transition-all rounded-xl ${isAnyItemOverpaying 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25'}`}
                    >
                        {submitting ? <Loader small /> : (
                            <>Confirm Payment <CheckCircle className="w-5 h-5 ml-2" /></>
                        )}
                    </Button>
                </div>
            </div>
        </div>

        {/* SUCCESS MODAL (Glassmorphic) */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`${glassCardClass} max-w-sm w-full bg-white/90 dark:bg-black/90 animate-in zoom-in-95 duration-200`}>
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Success!</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Transaction recorded successfully.</p>
                </div>

                <div className="bg-gray-50/50 dark:bg-white/5 rounded-xl p-4 w-full border border-dashed border-gray-300 dark:border-gray-700">
                   <p className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Amount Received</p>
                   <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalPayingNow.toLocaleString()} <span className="text-sm text-gray-400">PKR</span></p>
                </div>

                <div className="flex flex-col w-full gap-3">
                  <Button onClick={handlePrint} className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold shadow-lg shadow-blue-500/20">
                    <Printer className="w-5 h-5 mr-2" /> Print Receipt
                  </Button>
                  <Button variant="ghost" onClick={() => router.push("/admin/invoices")} className="w-full text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10">
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
