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
  Download, FileBarChart 
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { generateCollectionReportBlob } from "../../utils/collectionReport" 

export default function CollectionReportPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // --- States ---
  const [loadingCollection, setLoadingCollection] = useState(false)
  
  // Date Range State
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date().toISOString().split('T')[0]
  })

  // --- Handlers ---
  const handleGenerateCollection = async (e) => {
    e.preventDefault()
    setLoadingCollection(true)

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
      setLoadingCollection(false)
    }
  }

  // --- Glassmorphic Styles ---
  const glassCardClass = "relative overflow-hidden rounded-2xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl p-6 transition-all hover:border-white/30"
  const glassInputClass = "bg-white/50 dark:bg-white/5 border-white/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-500/70"

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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-sm">
                Collection Report
              </h1>
              <p className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                Generate financial collection reports by date range
              </p>
            </div>
          </div>

          {/* COLLECTION REPORT CARD */}
          <div className={`${glassCardClass} flex flex-col`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <FileBarChart className="w-24 h-24 text-blue-500" />
            </div>
            
            <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-gray-800 dark:text-white relative z-10">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" /> 
              Generate Report
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
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:bg-white/5 text-white shadow-lg hover:shadow-blue-500/30 transition-all rounded-lg h-12 border-0"
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

        </div>
      </div>
    </>
  )
}
