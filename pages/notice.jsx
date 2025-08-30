// pages/bulk-message.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabaseClient'
import Navbar from '../components/Navbar' // adjust path if needed
import { Button } from '../components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select'

export default function BulkMessagePage() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState([]) // { studentid, name, fathername, class_id, mobilenumber, class }
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    // Load classes
    supabase
      .from('classes')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Classes fetch error', error)
        else setClasses(data || [])
      })
  }, [])

  useEffect(() => {
    if (!selectedClass) {
      setStudents([])
      setSelectedIds(new Set())
      setSelectAll(false)
      return
    }

    setLoading(true)
    supabase
      .from('students')
      .select('studentid, name, fathername, class_id, mobilenumber, classes(name)')
      .eq('class_id', selectedClass)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) {
          console.error('Students fetch error', error)
          setStudents([])
        } else {
          // flatten class name
          const withClass = (data || []).map(s => ({
            ...s,
            class: s.classes?.name || ''
          }))
          setStudents(withClass)
          setSelectedIds(new Set())
          setSelectAll(false)
        }
      })
  }, [selectedClass])

  // filtered students by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.fathername || '').toLowerCase().includes(q) ||
      String(s.studentid).toLowerCase().includes(q) ||
      (s.mobilenumber || '').toLowerCase().includes(q) ||
      (s.class || '').toLowerCase().includes(q)
    )
  }, [students, query])

  const toggleSelect = (studentid) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(studentid)) next.delete(studentid)
      else next.add(studentid)
      setSelectAll(next.size === students.length && students.length > 0)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set())
      setSelectAll(false)
    } else {
      const all = new Set(students.map(s => s.studentid))
      setSelectedIds(all)
      setSelectAll(true)
    }
  }

  const invertSelection = () => {
    setSelectedIds(prev => {
      const next = new Set()
      students.forEach(s => {
        if (!prev.has(s.studentid)) next.add(s.studentid)
      })
      setSelectAll(next.size === students.length && students.length > 0)
      return next
    })
  }

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one student.')
      return
    }
    if (!message.trim()) {
      alert('Please enter a message before saving.')
      return
    }

    // Check for missing numbers
    const selectedArray = Array.from(selectedIds)
    const missingNumberStudents = selectedArray
      .map(id => students.find(s => s.studentid === id))
      .filter(s => !s || !s.mobilenumber)

    if (missingNumberStudents.length > 0) {
      const names = missingNumberStudents.map(s => (s ? `${s.name} (${s.studentid})` : '(unknown id)')).join(', ')
      alert(`Cannot save. The following selected students are missing mobile numbers:\n\n${names}\n\nPlease update their mobile number(s) before saving.`)
      return
    }

    const today = new Date().toLocaleDateString()

    setSaving(true)
    try {
      const payload = selectedArray.map(studentid => {
        const student = students.find(s => s.studentid === studentid)

        // replace placeholders
        let customizedMessage = message
          .replace(/{{name}}/g, student?.name || '')
          .replace(/{{fathername}}/g, student?.fathername || '')
          .replace(/{{id}}/g,student?.studentid || '')
          .replace(/{{class}}/g, student?.class || '')
          .replace(/{{date}}/g, today)

        return {
          student_id: studentid,
          number: student?.mobilenumber || '',
          sent: false,
          text: customizedMessage.trim(),
          created_at: new Date().toISOString()
        }
      })

      const { error } = await supabase
        .from('messages')
        .insert(payload)

      if (error) {
        console.error('Save error', error)
        alert('Failed to save messages. Check console for details.')
      } else {
        alert(`Saved personalized message for ${payload.length} student(s).`)
        setMessage('')
        setSelectedIds(new Set())
        setSelectAll(false)
      }
    } catch (err) {
      console.error('Unexpected save error', err)
      alert('Unexpected error while saving. Check console for details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Navbar />

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 dark:border-gray-700 border border-gray-100 dark:shadow-none rounded-lg shadow-md p-5 sm:p-6">
          {/* header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 mb-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">Send Message (bulk)</h1>
              <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                Use placeholders: <code>{`{{name}}`}</code>, <code>{`{{fathername}}`}</code>, <code>{`{{class}}`}</code>, <code>{`{{date}}`}</code>
              </p>
            </div>

            <div className="flex gap-3 flex-col sm:flex-row items-stretch sm:items-end">
              <div className="w-full sm:w-80">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Class</label>
                <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-64">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="name / id / mobile"
                  className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* body */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* left: student list */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {loading ? 'Loading students...' : `${filtered.length} students`}
                </div>
                <div className="flex gap-2">
                  <Button onClick={toggleSelectAll} disabled={!students.length} className="px-3 py-1.5">
                    {selectAll ? 'Unselect all' : 'Select all'}
                  </Button>
                  <Button onClick={invertSelection} disabled={!students.length} className="px-3 py-1.5">Invert</Button>
                </div>
              </div>

              <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                <div className="max-h-[56vh] overflow-auto">
                  {filtered.length === 0 && !loading && (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No students to show for selected class.</div>
                  )}

                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map(s => {
                      const checked = selectedIds.has(s.studentid)
                      return (
                        <li key={s.studentid} className={`flex items-center gap-4 p-3 sm:p-4 ${checked ? 'bg-blue-50 dark:bg-gray-800' : 'bg-transparent'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(s.studentid)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{s.studentid}</div>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
                              <div className="truncate">{s.fathername}</div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">{s.class}</div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* right: message composer */}
            <aside className="w-full lg:w-[420px] flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                placeholder="Write message using {{name}}, {{fathername}}, {{class}}, {{date}}"
                className="w-full h-56 sm:h-64 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
              />

              <div className="flex items-center gap-3 mt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || selectedIds.size === 0 || !message.trim()}
                  className="px-4 py-2"
                >
                  {saving ? 'Saving...' : `Save for ${selectedIds.size || 0} selected`}
                </Button>

                <Button
                  onClick={() => { setSelectedIds(new Set()); setSelectAll(false); setMessage('') }}
                  disabled={saving}
                  className="px-3 py-2"
                >
                  Reset
                </Button>

                <div className="ml-auto text-sm text-gray-600 dark:text-gray-300">
                  {students.length > 0 && <span><strong className="text-gray-800 dark:text-gray-100">{students.length}</strong> in class</span>}
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                <strong>Note:</strong> Use placeholders <code>{`{{name}}`}</code>, <code>{`{{fathername}}`}</code>, <code>{`{{class}}`}</code>, <code>{`{{date}}`}</code>.  
                They will be replaced with the student’s actual info when saving.
              </p>
            </aside>
          </div>
        </div>
      </main>
    </>
  )
}
