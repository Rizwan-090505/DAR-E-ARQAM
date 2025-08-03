import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import Navbar from '../../components/Navbar'
import Loader from '../../components/Loader'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'

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
  classes?: ClassData[] // updated to match Supabase's array format
}

export default function MarksDashboard() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassData[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('id, name').order('name')
    if (!error && data) setClasses(data)
  }

  const fetchTests = async () => {
    setLoading(true)
    let query = supabase
      .from('tests')
      .select('id, test_name, test_type, subject, date, classes(id, name)')
      .order('date', { ascending: false })

    if (selectedClass) query = query.eq('class_id', selectedClass)
    if (selectedType) query = query.eq('test_type', selectedType)

    const { data, error } = await query
    if (!error && data) setTests(data as Test[])
    setLoading(false)
  }

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchTests()
  }, [selectedClass, selectedType])

  if (loading) return <Loader />

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
          {/* Class Filter */}
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

          {/* Test Type Filter */}
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

          <Button onClick={fetchTests} variant="outline">Apply Filters</Button>
        </div>

        {/* Tests Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <p className="text-muted-foreground">No tests found.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Class</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(t => (
                    <tr key={t.id}>
                      <td>{t.test_name}</td>
                      <td>{t.test_type}</td>
                      <td>{t.subject}</td>
                      <td>{t.classes && t.classes.length > 0 ? t.classes[0].name : 'N/A'}</td>
                      <td>{t.date}</td>
                      <td>
                        <Link href={`/marks/${t.id}`}>
                          <Button variant="outline" size="sm">Enter Marks</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
