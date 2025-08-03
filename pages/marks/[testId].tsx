import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Navbar from '../../components/Navbar'
import { useToast } from '../../hooks/use-toast'

interface Student {
  studentid: string
  name: string
  fathername: string
}

interface Test {
  id: number
  class_id: number
  test_name: string
}

export default function MarksEntryPage() {
  const router = useRouter()
  const { testId } = router.query
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<Record<string, { obtained: string }>>({})
  const [test, setTest] = useState<Test | null>(null)
  const [totalMarks, setTotalMarks] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!testId || Array.isArray(testId)) return

    const loadData = async () => {
      try {
        setLoading(true)

        const { data: testData, error: testErr } = await supabase
          .from('tests')
          .select('*')
          .eq('id', Number(testId))
          .single()

        if (testErr) throw testErr
        setTest(testData)

        if (testData?.class_id) {
          const { data: studentData, error: stuErr } = await supabase
            .from('students')
            .select('studentid, name, fathername')
            .eq('class_id', testData.class_id)

          if (stuErr) throw stuErr
          setStudents(studentData || [])
        }
      } catch (err) {
        console.error('Error loading marks page:', err)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load marks entry page'
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [testId, toast])

  const saveMarks = async () => {
    if (!testId || Array.isArray(testId)) return
    if (!totalMarks) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter total marks first' })
      return
    }

    const entries = Object.entries(marks).map(([studentid, { obtained }]) => ({
      test_id: Number(testId),
      studentid,
      total_marks: parseFloat(totalMarks),
      obtained_marks: parseFloat(obtained)
    }))

    const { error } = await supabase.from('marks').insert(entries)

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      toast({ variant: 'success', title: 'Saved', description: 'Marks saved successfully' })
      router.push('/marks')
    }
  }

  const deleteTest = async () => {
    if (!testId || Array.isArray(testId)) return

    if (!confirm('Are you sure you want to delete this test? All marks will be removed.')) return

    const { error } = await supabase.from('tests').delete().eq('id', Number(testId))
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      toast({ variant: 'success', title: 'Deleted', description: 'Test deleted successfully' })
      router.push('/marks')
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!test) return <div className="p-6">No test found.</div>

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Enter Marks for {test.test_name}</h1>
          <Button variant="destructive" onClick={deleteTest}>Delete Test</Button>
        </div>

        <div className="mb-6">
          <label className="block font-medium mb-2">Total Marks</label>
          <Input
            type="number"
            value={totalMarks}
            onChange={e => setTotalMarks(e.target.value)}
            placeholder="Enter total marks for this test"
          />
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Father Name</th>
              <th>Obtained Marks</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.studentid}>
                <td>{s.studentid}</td>
                <td>{s.name}</td>
                <td>{s.fathername}</td>
                <td>
                  <Input
                    type="number"
                    onChange={e =>
                      setMarks(prev => ({
                        ...prev,
                        [s.studentid]: { obtained: e.target.value }
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button onClick={saveMarks}>Save Marks</Button>
      </div>
    </div>
  )
}
