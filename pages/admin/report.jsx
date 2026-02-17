"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "../../components/Navbar"
import Loader from "../../components/Loader"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { 
  ArrowLeft, Calendar, FileText, 
  Download, FileBarChart, Users 
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { generateCollectionReportBlob } from "../../utils/collectionReport" 

export default function ReportsPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // --- States ---
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState("collection") // "collection" | "defaulter"
  
  // Date Range State
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date().toISOString().split('T')[0]
  })

  // --- Handlers ---
  const handleSubmit = async (e) => {
    e.preventDefault()

    // IF DEFAULTER LIST: Navigate to /admin/defaulters with URL params (dates only)
    if (reportType === "defaulter") {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })
      router.push(`/admin/defaulters?${params.toString()}`)
      return; // Stop execution here for defaulters
    }

    // IF COLLECTION REPORT: Generate PDF blob
    setLoading(true)
    try {
      // 1. Await the blob generation from our utility function
      const pdfBlob = await generateCollectionReportBlob(dateRange.startDate, dateRange.endDate)

      // 2. Create a URL and open it in a new tab for preview/printing
      const blobUrl = URL.createObjectURL(pdfBlob)
      window.open(blobUrl, "_blank")
      
      toast({ title: "Report generated successfully! 📄" })

      // Cleanup memory after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)

    } catch (error) {
      console.error(error)
      toast({ 
        title: "Failed to generate report", 
        description: error.message, 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  // --- Glassmorphic Styles ---
  const glassCardClass = "relative overflow-hidden rounded-2xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl p-6 transition-all hover:border-white/30"
  const glassInputClass = "flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-white/50 dark:bg-white/5 border-white/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-500/70"

  // --- Dynamic Content based on Report Type ---
  const isDefaulter = reportType === "defaulter"
  const title = isDefaulter ? "Defaulter List" : "Collection Report"
  const description = isDefaulter 
    ? "View list of students with pending fees for a specific date range."
    : "Generate financial collection reports by date range."

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-[#0b1220] dark:via-[#1a1c2e] dark:to-[#0f0718] p-4 md:p-8 transition-colors duration-500">
        <div className="max-w-2xl mx-auto">
            
          {/* HEADER */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 bg-white/30 backdrop-blur border-white/20 hover:bg-white/50 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-sm transition-all">
                {title}
              </h1>
              <p className="text-gray-600 dark:text-slate-400 text-sm font-medium transition-all">
                {description}
              </p>
            </div>
          </div>

          {/* REPORT CARD */}
          <div className={`${glassCardClass} flex flex-col`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none transition-all">
              {isDefaulter ? (
                <Users className="w-24 h-24 text-red-500" />
              ) : (
                <FileBarChart className="w-24 h-24 text-blue-500" />
              )}
            </div>
            
            <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-gray-800 dark:text-white relative z-10 transition-all">
              <FileText className={`w-6 h-6 ${isDefaulter ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} /> 
              Generate {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 relative z-10">
              {isDefaulter ? "Select a date range to fetch the defaulters." : "Generate a PDF report of all fee collections within a specific date range."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col relative z-10">
              
              {/* Report Type Dropdown */}
              <div className="space-y-1.5">
                <Label className="ml-1 text-gray-700 dark:text-gray-300">Report Type</Label>
                <select 
                  className={`${glassInputClass} appearance-none cursor-pointer outline-none`}
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  <option value="collection" className="text-black dark:text-white dark:bg-slate-800">Collection Report</option>
                  <option value="defaulter" className="text-black dark:text-white dark:bg-slate-800">Defaulter List</option>
                </select>
              </div>

              {/* Date Range Selectors */}
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
                  disabled={loading}
                  className={`w-full ${isDefaulter ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 hover:shadow-red-500/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/30'} dark:bg-white/5 text-white shadow-lg transition-all rounded-lg h-12 border-0`}
                >
                  {loading ? <Loader small /> : (
                    <>
                      <Download className="w-5 h-5 mr-2" /> 
                      {isDefaulter ? "View Defaulters" : "Generate Report"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </>
  )
}
