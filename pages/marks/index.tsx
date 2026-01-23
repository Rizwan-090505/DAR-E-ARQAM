import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import Navbar from '../../components/Navbar'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '../../components/ui/select'
import { 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Filter,
  Loader2,
  Search
} from 'lucide-react'

interface ClassData {
  id: number
  name: string
}

interface Test {
  id: number
  test_name: string
  test_type: string
  subject: string
  date: string
  class_name: string
  has_marks?: boolean
}

export default function MarksDashboard() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState<ClassData[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')

  /* ---------------- Fetch Classes ---------------- */
  useEffect(() => {
    supabase
      .from('classes')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setClasses(data)
      })
  }, [])

  /* ---------------- Fetch Tests ---------------- */
  // Wrapped in useCallback so it can be used in useEffect dependencies if needed
  const fetchTests = useCallback(async () => {
    // If no class selected, clear tests and return
    if (!selectedClass) {
        setTests([])
        return
    }

    setLoading(true)
    setTests([])

    let query = supabase
      .from('tests')
      .select('id, test_name, test_type, subject, date, class_name')
      .eq('class_id', selectedClass)
      .order('date', { ascending: false })

    // Only apply type filter if selected
    if (selectedType && selectedType !== 'all') {
      query = query.eq('test_type', selectedType)
    }

    const { data: testsData, error } = await query

    if (error || !testsData || testsData.length === 0) {
      setLoading(false)
      setTests([])
      return
    }

    const testIds = testsData.map(t => t.id)

    const { data: marksData } = await supabase
      .from('marks')
      .select('test_id')
      .in('test_id', testIds)

    const marksMap =
      marksData?.reduce((acc: Record<number, number>, m: any) => {
        acc[m.test_id] = (acc[m.test_id] || 0) + 1
        return acc
      }, {}) || {}

    setTests(
      testsData.map(t => ({
        ...t,
        has_marks: (marksMap[t.id] ?? 0) > 0
      }))
    )

    setLoading(false)
  }, [selectedClass, selectedType])

  /* ---------------- Auto-Fetch on Class Change ---------------- */
  // This effect runs immediately when selectedClass changes
  useEffect(() => {
    fetchTests()
    // We intentionally disable the exhaustive-deps rule here.
    // We ONLY want to auto-fetch when the Class changes.
    // We do NOT want to auto-fetch when 'selectedType' changes 
    // (users should still click "Apply Filters" for type changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass])

  /* ---------------- Apply Filters (Manual Trigger) ---------------- */
  const applyFilters = () => {
    fetchTests()
  }

  /* ---------------- Helper: Date Formatter ---------------- */
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <div className="container mx-auto max-w-6xl p-4 md:p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Marks Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage tests and enter student marks.</p>
          </div>
          <Link href="/marks/new-test">
            <Button className="w-full sm:w-auto rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-blue-500/20 transition-all">
              <Plus className="mr-2 h-4 w-4" /> New Test
            </Button>
          </Link>
        </div>

        {/* Filters Card */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-xl p-5">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            <div className="w-full md:w-auto flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Select Class</label>
              <Select onValueChange={v => setSelectedClass(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full bg-gray-50 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-900 dark:text-slate-100">
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-auto flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Test Type</label>
              <Select onValueChange={v => setSelectedType(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full bg-gray-50 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-900 dark:text-slate-100">
                  <SelectValue placeholder="Filter by type (Optional)" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Midterm-1">Midterm-1</SelectItem>
                  <SelectItem value="Midterm-2">Midterm-2</SelectItem>
                  <SelectItem value="Terminal-1">Terminal-1</SelectItem>
                  <SelectItem value="Terminal-2">Terminal-2</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={applyFilters} 
              disabled={!selectedClass || loading}
              className="w-full md:w-auto rounded-full bg-gray-900 text-white hover:bg-black dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white transition-all shadow-lg"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Filter className="mr-2 h-4 w-4" />} 
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Tests List / Table */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-xl shadow-sm dark:shadow-xl overflow-hidden">
          
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Active Tests
            </h2>
            <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-full">
              {tests.length} found
            </span>
          </div>

          <div className="relative min-h-[300px]">
            {/* Loading State */}
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">Fetching tests...</p>
              </div>
            )}

            {/* Empty States */}
            {!loading && tests.length === 0 && selectedClass && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-gray-100 dark:bg-white/10 p-4 rounded-full mb-3">
                  <BookOpen className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-slate-200">No Tests Found</h3>
                <p className="text-gray-500 dark:text-slate-400 max-w-xs mt-1 text-sm">
                  We couldn't find any tests matching your filters.
                </p>
              </div>
            )}

            {!loading && !selectedClass && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-gray-100 dark:bg-white/10 p-4 rounded-full mb-3">
                  <Search className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                </div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">Please select a class above to load data.</p>
              </div>
            )}

            {/* Table */}
            {tests.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-gray-200 dark:border-white/10">
                    <tr>
                      <th className="px-6 py-4">Test Details</th>
                      <th className="px-6 py-4 hidden md:table-cell">Type</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {tests.map(t => (
                      <tr key={t.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        
                        {/* Column 1: Name */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-slate-200 text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {t.test_name}
                            </span>
                            <span className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{t.subject}</span>
                            {/* Mobile Badge */}
                            <span className="md:hidden mt-2 inline-flex">
                               <span className="bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10">
                                 {t.test_type}
                               </span>
                            </span>
                          </div>
                        </td>

                        {/* Column 2: Type (Desktop) */}
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/10 font-medium">
                            {t.test_type}
                          </span>
                        </td>

                        {/* Column 3: Date */}
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                            {formatDate(t.date)}
                          </div>
                        </td>

                        {/* Column 4: Status */}
                        <td className="px-6 py-4 text-center">
                          {t.has_marks ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Entered</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Column 5: Action */}
                        <td className="px-6 py-4 text-right">
                          <Link href={`/marks/${t.id}`}>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className={`rounded-full px-4 border transition-all ${
                                t.has_marks 
                                  ? "border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-white/10 dark:text-slate-300"
                                  : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                              }`}
                            >
                              {t.has_marks ? 'Edit' : 'Enter'}
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
