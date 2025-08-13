import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Navbar from '../../components/Navbar'
import { useToast } from '../../hooks/use-toast'
import { Loader2, Trash2 } from 'lucide-react'

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
type MarkState = Record<string, { obtained: string; markId?: number }>

export default function MarksEntryPage() {
  const router = useRouter()
  const { testId } = router.query
  const { toast } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<MarkState>({})
  const [test, setTest] = useState<Test | null>(null)
  const [totalMarks, setTotalMarks] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // computed helpers
  const parsedTotal = useMemo(() => {
    const n = Number(totalMarks)
    return Number.isFinite(n) && n >= 0 ? n : NaN
  }, [totalMarks])

  useEffect(() => {
    if (!testId || Array.isArray(testId)) return
    const loadData = async () => {
      try {
        setLoading(true)

        // 1) Test
        const { data: testData, error: testErr } = await supabase
          .from('tests')
          .select('*')
          .eq('id', Number(testId))
          .single()
        if (testErr) throw testErr
        setTest(testData)

        // 2) Students of that class
        const { data: studentData, error: stuErr } = await supabase
          .from('students')
          .select('studentid, name, fathername')
          .eq('class_id', testData.class_id)
          .order('studentid', { ascending: true })
        if (stuErr) throw stuErr

        // 3) Existing marks for this test
        const { data: marksData, error: marksErr } = await supabase
          .from('marks')
          .select('*')
          .eq('test_id', Number(testId))
        if (marksErr) throw marksErr

        // map into state
        const mm: MarkState = {}
        for (const s of (studentData || [])) {
          const existing = marksData?.find(m => m.studentid === s.studentid)
          mm[s.studentid] = existing
            ? { obtained: String(existing.obtained_marks ?? 0), markId: existing.id }
            : { obtained: '0' }
        }
        setStudents(studentData || [])
        setMarks(mm)

        // pick a total if present
        if (marksData && marksData.length > 0 && marksData[0].total_marks != null) {
          setTotalMarks(String(marksData[0].total_marks))
        }
      } catch (err) {
        console.error(err)
        toast({ variant: 'destructive', title: 'Load failed', description: 'Could not load marks page.' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [testId, toast])

  // Clamp & sanitize a single obtained value (0..total)
  const sanitizeObtained = (val: string) => {
    let n = Number(val)
    if (!Number.isFinite(n)) n = 0
    if (parsedTotal === parsedTotal) { // not NaN
      if (n < 0) n = 0
      if (n > parsedTotal) n = parsedTotal
    } else if (n < 0) n = 0
    return String(n)
  }

  const saveMarks = async () => {
    if (!testId || Array.isArray(testId) || saving) return

    if (parsedTotal !== parsedTotal) {
      toast({ variant: 'destructive', title: 'Invalid total', description: 'Please enter a valid Total Marks.' })
      return
    }

    setSaving(true)
    try {
      const tid = Number(testId)

      // 0) Optional: quick client-side normalization (clamp to 0..total)
      const normalizedPayload = Object.entries(marks).map(([studentid, { obtained }]) => ({
        test_id: tid,
        studentid,
        total_marks: parsedTotal,
        obtained_marks: Number(sanitizeObtained(obtained))
      }))

      // 1) Hard cleanup inside DB for this test (keep MIN(id) per student)
      //    This prevents historical multi-saves from lingering.
      await supabase.rpc('remove_duplicates_for_test', { testid_param: tid })

      // 2) Upsert so repeated clicks / multi-saves only update
      //    NOTE: Requires a UNIQUE constraint on (test_id, studentid)
      const { error: upsertErr } = await supabase
        .from('marks')
        .upsert(normalizedPayload, { onConflict: 'test_id,studentid' })
      if (upsertErr) throw upsertErr

      toast({ variant: 'success', title: 'Saved', description: 'Marks updated successfully.' })
      router.push('/marks')
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error?.message ?? 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteTest = async () => {
    if (!testId || Array.isArray(testId)) return
    if (!confirm('Delete this test and all associated marks?')) return
    const { error } = await supabase.from('tests').delete().eq('id', Number(testId))
    if (error) {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message })
    } else {
      toast({ variant: 'success', title: 'Deleted', description: 'Test removed.' })
      router.push('/marks')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    )
  }
  if (!test) return <div className="p-6 text-slate-200">No test found.</div>

  return (
    <div className="min-h-screen text-slate-100 bg-[radial-gradient(70%_60%_at_50%_0%,#0b1220_0%,#05070c_100%)]">
      <Navbar />
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {test.test_name}
            </h1>
            <p className="text-sm text-slate-400">Marks Entry</p>
          </div>
          <Button
            variant="destructive"
            onClick={deleteTest}
            className="rounded-full bg-red-600 hover:bg-red-700 shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_24px_0_rgba(220,38,38,0.35)] transition-all"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Test
          </Button>
        </div>

        {/* Total marks card */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl">
          <div className="p-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Total Marks</label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                placeholder="e.g., 100"
                disabled={saving}
                className="bg-transparent border-slate-600 focus:border-slate-300 text-slate-100"
              />
              
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-xl">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="text-slate-300 border-b border-white/10">
                <th className="p-3 font-medium">Student ID</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Father Name</th>
                <th className="p-3 font-medium">Obtained</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => (
                <tr
                  key={s.studentid}
                  className={`${idx % 2 ? 'bg-white/0' : 'bg-white/[0.03]'} transition-colors`}
                >
                  <td className="p-3 text-slate-300">{s.studentid}</td>
                  <td className="p-3">{s.name}</td>
                  <td className="p-3 text-slate-300">{s.fathername}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      inputMode="numeric"
                      disabled={saving}
                      value={marks[s.studentid]?.obtained ?? '0'}
                      onChange={(e) =>
                        setMarks((prev) => ({
                          ...prev,
                          [s.studentid]: {
                            ...prev[s.studentid],
                            obtained: e.target.value
                          }
                        }))
                      }
                      onBlur={(e) =>
                        setMarks((prev) => ({
                          ...prev,
                          [s.studentid]: {
                            ...prev[s.studentid],
                            obtained: sanitizeObtained(e.target.value)
                          }
                        }))
                      }
                      className="bg-transparent border-slate-600 focus:border-slate-300 text-slate-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end">
          <Button
            onClick={saveMarks}
            disabled={saving}
            className="rounded-full px-6 py-2 font-medium bg-slate-200 text-slate-900 hover:bg-white transition-all shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_28px_0_rgba(255,255,255,0.15)]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Marks'}
          </Button>
        </div>
      </div>
    </div>
  )
}
