import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import Navbar from '../../components/Navbar'
import Loader from '../../components/Loader'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import { CheckCircle, XCircle } from "lucide-react"

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

const CHUNK_DAYS = 60

export default function MarksDashboard() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState<ClassData[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')

  const [endDate, setEndDate] = useState<Date>(new Date())
  const [hasMore, setHasMore] = useState(true)
  const loaderRef = useRef<HTMLDivElement | null>(null)

  // Fetch classes
  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .order('name')
    if (!error && data) setClasses(data)
  }

  // Fetch tests in a 60-day chunk
  const fetchTestsChunk = async () => {
    if (!hasMore || loading) return
    setLoading(true)

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - CHUNK_DAYS)

    let query = supabase
      .from('tests')
      .select('id, test_name, test_type, subject, date, class_name, class_id')
      .lte('date', endDate.toISOString())
      .gte('date', startDate.toISOString())
      .order('date', { ascending: false })

    if (selectedClass) query = query.eq('class_id', selectedClass)
    if (selectedType) query = query.eq('test_type', selectedType)

    const { data: testsData, error } = await query

    if (!error && testsData && testsData.length > 0) {
      const testIds = testsData.map(t => t.id)

      // Fetch all marks counts in a single query
      const { data: marksData } = await supabase
        .from('marks')
        .select('test_id', { count: 'exact' })
        .in('test_id', testIds)

      const marksCountMap = marksData?.reduce((acc: Record<number, number>, mark: any) => {
        acc[mark.test_id] = (acc[mark.test_id] || 0) + 1
        return acc
      }, {}) || {}

      const testsWithMarks = testsData.map(t => ({
        ...t,
        has_marks: (marksCountMap[t.id] ?? 0) > 0
      }))

      setTests(prev => [...prev, ...testsWithMarks])
      setEndDate(startDate)
      setHasMore(true)
    } else {
      setHasMore(false)
    }

    setLoading(false)
  }

  // Reset data when filters change
  useEffect(() => {
    setTests([])
    setEndDate(new Date())
    setHasMore(true)
    fetchTestsChunk()
  }, [selectedClass, selectedType])

  useEffect(() => {
    fetchClasses()
  }, [])

  // Infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0]
    if (target.isIntersecting && hasMore && !loading) {
      fetchTestsChunk()
    }
  }, [hasMore, loading])

  useEffect(() => {
    const option = { root: null, rootMargin: "20px", threshold: 0 }
    const observer = new IntersectionObserver(handleObserver, option)
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => { if (loaderRef.current) observer.unobserve(loaderRef.current) }
  }, [handleObserver])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between mb-4 gap-3">
          <h1 className="text-3xl font-bold">Marks Management</h1>
          <Link href="/marks/new-test">
            <Button>+ New Test</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Select onValueChange={(val) => setSelectedClass(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={(val) => setSelectedType(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Test Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Midterm-1">Midterm-1</SelectItem>
              <SelectItem value="Midterm-2">Midterm-2</SelectItem>
              <SelectItem value="Terminal-1">Terminal-1</SelectItem>
              <SelectItem value="Terminal-2">Terminal-2</SelectItem>
              <SelectItem value="Monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => { setTests([]); setEndDate(new Date()); setHasMore(true); fetchTestsChunk() }}
            variant="outline"
          >
            Apply Filters
          </Button>
        </div>

        {/* Tests Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length === 0 && !loading ? (
              <p className="text-muted-foreground">No tests found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm md:text-base">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Test Name</th>
                      <th className="text-left p-2 hidden md:table-cell">Type</th>
                      <th className="text-left p-2 hidden md:table-cell">Subject</th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2 hidden md:table-cell">Date</th>
                      <th className="text-center p-2">Status</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map(t => (
                      <tr key={t.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{t.test_name}</td>
                        <td className="p-2 hidden md:table-cell">{t.test_type}</td>
                        <td className="p-2 hidden md:table-cell">{t.subject}</td>
                        <td className="p-2">{t.class_name || 'N/A'}</td>
                        <td className="p-2 hidden md:table-cell">{t.date}</td>
                        <td className="text-center p-2">
                          {t.has_marks ? (
                            <CheckCircle className="w-5 h-5 text-green-600 inline" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 inline" />
                          )}
                        </td>
                        <td className="text-center p-2">
                          <Link href={`/marks/${t.id}`}>
                            <Button variant="outline" size="sm">Enter</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {loading && <Loader />}
            <div ref={loaderRef} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

