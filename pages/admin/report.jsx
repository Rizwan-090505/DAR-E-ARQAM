"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../utils/supabaseClient"
import Navbar from "../../components/Navbar"
import Loader from "../../components/Loader"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { 
  ArrowLeft, Calendar, FileText, 
  Download, AlertTriangle, FileBarChart, Users
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { generateCollectionReportBlob } from "../../utils/collectionReport" // Adjust path if needed

export default function ReportsPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // --- States ---
  const [loadingCollection, setLoadingCollection] = useState(false)
  
  // Date Range State
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0], // Defaults to today
    endDate: new Date().toISOString().split('T')[0]
  })

  // --- Handlers ---
  const handleGenerateCollection = async (e) => {
    e.preventDefault()
    setLoadingCollection(true)

    try {
      // 1. Fetch data from Supabase using Pagination (Bypass 1000 row limit)
      let allReceipts = []
      let fetchMore = true
      let from = 0
      const pageSize = 1000 // Supabase default max

      while (fetchMore) {
        const to = from + pageSize - 1

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
          .gte("paid_at", `${dateRange.startDate}T00:00:00.000Z`)
          .lte("paid_at", `${dateRange.endDate}T23:59:59.999Z`)
          .order('paid_at', { ascending: false })
          .range(from, to) // Added range for pagination

        if (error) throw error

        if (receiptsChunk && receiptsChunk.length > 0) {
          allReceipts.push(...receiptsChunk)
          from += pageSize
          
          // If the chunk is smaller than the page size, we've reached the end
          if (receiptsChunk.length < pageSize) {
            fetchMore = false
          }
        } else {
          // No more records returned
          fetchMore = false
        }
      }

      if (!allReceipts || allReceipts.length === 0) {
        toast({ title: "No collections found for this date range.", variant: "destructive" })
        setLoadingCollection(false)
        return
      }

      // 2. Grouping Logic (Matching the Fee Receipts Page)
      const groupedMap = new Map()
      const groupedData = []

      // Use allReceipts instead of receipts
      allReceipts.forEach((rcpt) => {
        const dateStr = new Date(rcpt.paid_at).toLocaleDateString()
        const key = `${rcpt.invoice_id}_${dateStr}` // Group by invoice and date

        if (!groupedMap.has(key)) {
          const newGroup = {
            ...rcpt, // Base record
            amount: rcpt.amount || 0, // We will aggregate this
            feeLabels: new Set([rcpt.fee_invoice_details?.fee_type || "General Payment"]),
            paymentMethods: new Set([rcpt.payment_method || "Cash"]),
            groupedPayments: [rcpt] // Keep all raw payments
          }
          groupedMap.set(key, newGroup)
          groupedData.push(newGroup)
        } else {
          const existing = groupedMap.get(key)
          existing.amount += (rcpt.amount || 0)
          existing.feeLabels.add(rcpt.fee_invoice_details?.fee_type || "General Payment")
          existing.paymentMethods.add(rcpt.payment_method || "Cash")
          existing.groupedPayments.push(rcpt)
        }
      })

      // 3. Format data to match what the PDF util expects
      const formattedReceipts = groupedData.map(g => ({
        ...g,
        displayFeeLabel: Array.from(g.feeLabels).join(", "),
        displayMethod: Array.from(g.paymentMethods).join(", ")
      }))

      // 4. Format Date Range string for the PDF header
      const startStr = new Date(dateRange.startDate).toLocaleDateString()
      const endStr = new Date(dateRange.endDate).toLocaleDateString()
      const dateRangeString = startStr === endStr ? startStr : `${startStr} to ${endStr}`

      // 5. Generate the Blob
      const pdfBlob = generateCollectionReportBlob(formattedReceipts, dateRangeString)

      // 6. Create a URL and open it in a new tab for preview/printing
      const blobUrl = URL.createObjectURL(pdfBlob)
      window.open(blobUrl, "_blank")
      
      toast({ title: "Report generated successfully! 📄" })

      // Cleanup memory after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)

    } catch (error) {
      console.error(error)
      toast({ title: "Failed to generate report", description: error.message, variant: "destructive" })
    } finally {
      setLoadingCollection(false)
    }
  }

  const handleDefaultersList = () => {
    toast({ 
      title: "Coming Soon", 
      description: "Defaulters list functionality will be implemented later.",
      variant: "default"
    })
  }

  // --- Glassmorphic Styles ---
  const glassCardClass = "relative overflow-hidden rounded-2xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl p-6 transition-all hover:border-white/30"
  const glassInputClass = "bg-white/50 dark:bg-white/5 border-white/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-500/70"

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-[#0b1220] dark:via-[#1a1c2e] dark:to-[#0f0718] p-4 md:p-8 transition-colors duration-500">
        <div className="max-w-5xl mx-auto">
            
          {/* HEADER */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 bg-white/30 backdrop-blur border-white/20 hover:bg-white/50 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-sm">
                Reports & Analytics
              </h1>
              <p className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                Generate dynamic financial and academic reports
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* OPTION A: COLLECTION REPORT (Glass Card) */}
            <div className={`${glassCardClass} flex flex-col`}>
              {/* Background Icon Detail */}
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <FileBarChart className="w-24 h-24 text-blue-500" />
              </div>
              
              <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-gray-800 dark:text-white relative z-10">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" /> 
                Collection Report
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 relative z-10">
                Generate a PDF report of all fee collections within a specific date range.
              </p>

              <form onSubmit={handleGenerateCollection} className="space-y-5 flex-1 flex flex-col relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="ml-1 text-gray-700 dark:text-gray-300">Start Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        type="date" 
                        required
                        className={`pl-9 ${glassInputClass} [color-scheme:light] dark:[color-scheme:dark]`} 
                        value={dateRange.startDate} 
                        onChange={e => setDateRange({...dateRange, startDate: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="ml-1 text-gray-700 dark:text-gray-300">End Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        type="date" 
                        required
                        className={`pl-9 ${glassInputClass} [color-scheme:light] dark:[color-scheme:dark]`} 
                        value={dateRange.endDate} 
                        onChange={e => setDateRange({...dateRange, endDate: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button 
                    type="submit" 
                    disabled={loadingCollection}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-blue-500/30 transition-all rounded-lg h-12 border-0"
                  >
                    {loadingCollection ? <Loader small /> : (
                      <>
                        <Download className="w-5 h-5 mr-2" /> 
                        Generate Report
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* OPTION B: DEFAULTERS LIST (Glass Card) */}
            <div className={`${glassCardClass} flex flex-col border-red-200/50 dark:border-red-900/30`}>
              {/* Background Icon Detail */}
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Users className="w-24 h-24 text-red-500" />
              </div>

              <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-gray-800 dark:text-white relative z-10">
                <AlertTriangle className="w-6 h-6 text-red-500" /> 
                Defaulters List
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 relative z-10">
                View and export a list of students who have pending dues or unpaid invoices.
              </p>

              <div className="flex-1 flex flex-col relative z-10">
                {/* Visual Placeholder for future filters */}
                <div className="space-y-4 opacity-50 pointer-events-none mb-6">
                   <div className="space-y-1.5">
                    <Label className="ml-1 text-gray-700 dark:text-gray-300">Target Month (Coming Soon)</Label>
                    <Input type="month" disabled className={glassInputClass} />
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button 
                    type="button" 
                    onClick={handleDefaultersList}
                    variant="outline"
                    className="w-full bg-white/30 dark:bg-black/30 backdrop-blur border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all rounded-lg h-12"
                  >
                    <AlertTriangle className="w-5 h-5 mr-2" /> 
                    Generate Defaulters List
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

