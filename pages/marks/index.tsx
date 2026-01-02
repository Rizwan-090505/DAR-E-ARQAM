import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import Navbar from '../../components/Navbar'
import Loader from '../../components/Loader'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '../../components/ui/select'
import { CheckCircle, XCircle } from 'lucide-react'

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

  /* ---------------- Fetch Tests (ALL for class) ---------------- */
  const fetchTests = async () => {
    if (!selectedClass) return

    setLoading(true)
    setTests([])

    let query = supabase
      .from('tests')
      .select('id, test_name, test_type, subject, date, class_name')
      .eq('class_id', selectedClass)
      .order('date', { ascending: false })

    if (selectedType) {
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
  }

  /* ---------------- Apply Filters ---------------- */
  const applyFilters = () => {
    if (!selectedClass) return
    fetchTests()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
          <h1 className="text-3xl font-bold">Marks Management</h1>
          <Link href="/marks/new-test">
            <Button>+ New Test</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Select onValueChange={v => setSelectedClass(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select Class *" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select Class</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={v => setSelectedType(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Test Type (optional)" />
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

          <Button onClick={applyFilters} disabled={!selectedClass || loading}>
            Apply Filters
          </Button>
        </div>

        {/* Tests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tests</CardTitle>
          </CardHeader>

          <CardContent>
            {!selectedClass && (
              <p className="text-sm text-muted-foreground">
                Please select a class to view tests.
              </p>
            )}

            {loading && (
              <div className="flex justify-center py-6">
                <Loader />
              </div>
            )}

            {!loading && tests.length === 0 && selectedClass && (
              <p className="text-sm text-muted-foreground">
                No tests found for the selected filters.
              </p>
            )}

            {tests.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border border-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="border p-3 text-left">Test</th>
                      <th className="border p-3 text-left hidden sm:table-cell">
                        Type
                      </th>
                      <th className="border p-3 text-left hidden md:table-cell">
                        Subject
                      </th>
                      <th className="border p-3 text-center">Status</th>
                      <th className="border p-3 text-center">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tests.map(t => (
                      <tr key={t.id} className="hover:bg-muted/40 transition">
                        <td className="border p-3 font-medium">
                          {t.test_name}
                        </td>

                        <td className="border p-3 hidden sm:table-cell">
                          {t.test_type}
                        </td>

                        <td className="border p-3 hidden md:table-cell">
                          {t.subject}
                        </td>

                        <td className="border p-3 text-center">
                          {t.has_marks ? (
                            <CheckCircle className="inline w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="inline w-5 h-5 text-red-500" />
                          )}
                        </td>

                        <td className="border p-3 text-center">
                          <Link href={`/marks/${t.id}`}>
                            <Button size="sm" variant="outline">
                              Enter
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

