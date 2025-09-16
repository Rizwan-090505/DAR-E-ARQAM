import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import Navbar from '../components/Navbar'
import Loader from '../components/Loader'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from "../hooks/use-toast"

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [allStudents, setAllStudents] = useState([]) // <- keep original list
  const [classes, setClasses] = useState([])
  const [formData, setFormData] = useState({ name: '', fathername: '', mobilenumber: '', class_id: '' })
  const [filterClass, setFilterClass] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loadingClear, setLoadingClear] = useState(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => { fetchClasses() }, [])
  useEffect(() => { fetchStudents() }, [])

  useEffect(() => {
    // Client-side filtering + sorting
    let filtered = allStudents

    if (filterClass) {
      filtered = filtered.filter(s => s.class_id === parseInt(filterClass))
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q))
    }

    // Sort class-wise then name
    filtered.sort((a, b) => {
      if (a.class_id === b.class_id) return a.name.localeCompare(b.name)
      return a.class_id - b.class_id
    })

    setStudents(filtered)
  }, [filterClass, searchQuery, allStudents])

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('*')
    if (!error) setClasses(data)
  }

  const fetchStudents = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('students').select('*, classes(name)')
    if (!error) {
      setAllStudents(data)
      setStudents(data)
    }
    setLoading(false)
  }

  const handleInputChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (editingId) {
      await supabase.from('students').update(formData).eq('studentid', editingId)
      toast({ title: "Student updated successfully ✅" })
    } else {
      await supabase.from('students').insert([formData])
      toast({ title: "Student added successfully 🎉" })
    }
    setFormData({ name: '', fathername: '', mobilenumber: '', class_id: '' })
    setEditingId(null)
    fetchStudents()
  }

  const handleEdit = student => {
    setFormData({
      name: student.name,
      fathername: student.fathername,
      mobilenumber: student.mobilenumber,
      class_id: student.class_id
    })
    setEditingId(student.studentid)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async id => {
    await supabase.from('students').delete().eq('studentid', id)
    toast({ title: "Student deleted ❌" })
    fetchStudents()
  }

  const handleClearChange = async (id, value) => {
    setLoadingClear(id)
    await supabase.from('students').update({ Clear: value }).eq('studentid', id)
    setAllStudents(prev => prev.map(s => (s.studentid === id ? { ...s, Clear: value } : s)))
    setLoadingClear(null)
    toast({ title: `Clear set to ${value ? "TRUE" : "FALSE"} for student #${id}` })
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Form & Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Student Management
            </CardTitle>
            <CardDescription>Manage students, classes, and their Clear status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="font-semibold text-sm mb-1 block">Filter by Class:</label>
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-sm mb-1 block">Search by Name:</label>
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Enter student name..."
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Input name="name" value={formData.name} onChange={handleInputChange} placeholder="Name" required />
              <Input name="fathername" value={formData.fathername} onChange={handleInputChange} placeholder="Father Name" required />
              <Input name="mobilenumber" value={formData.mobilenumber} onChange={handleInputChange} placeholder="Mobile Number" required />
              <select
                name="class_id"
                value={formData.class_id}
                onChange={handleInputChange}
                required
                className="border rounded px-3 py-2"
              >
                <option value="">Select Class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">
                  {editingId ? <Edit className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingId ? "Update Student" : "Add Student"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>Students List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">DAS #</th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Father</th>
                      <th className="p-3 text-left">Mobile</th>
                      <th className="p-3 text-left">Class</th>
                      <th className="p-3 text-center">Clear</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {students.map(s => (
                        <motion.tr
                          key={s.studentid}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-3">{s.studentid}</td>
                          <td className="p-3">{s.name}</td>
                          <td className="p-3">{s.fathername}</td>
                          <td className="p-3">{s.mobilenumber}</td>
                          <td className="p-3">{s.classes?.name || "—"}</td>
                          <td className="p-3 text-center">
                            {loadingClear === s.studentid ? (
                              <Loader small />
                            ) : (
                              <select
                                value={s.Clear ? "TRUE" : "FALSE"}
                                onChange={e => handleClearChange(s.studentid, e.target.value === "TRUE")}
                                className="border rounded px-2 py-1"
                              >
                                <option value="TRUE">TRUE</option>
                                <option value="FALSE">FALSE</option>
                              </select>
                            )}
                          </td>
                          <td className="p-3 text-center space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(s)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(s.studentid)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Delete
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
                {students.length === 0 && (
                  <p className="text-center text-gray-500 py-6">No students found.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
