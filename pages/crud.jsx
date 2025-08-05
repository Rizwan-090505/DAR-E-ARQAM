import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [formData, setFormData] = useState({ name: '', fathername: '', mobilenumber: '', class_id: '' })
  const [filterClass, setFilterClass] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [filterClass, searchQuery])

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('*')
    if (!error) setClasses(data)
  }

  const fetchStudents = async () => {
    let query = supabase
      .from('students')
      .select('*, classes(name)')
      .order('studentid', { ascending: true })

    if (filterClass) query = query.eq('class_id', filterClass)
    if (searchQuery) query = query.ilike('name', `%${searchQuery}%`)

    const { data, error } = await query
    if (!error) setStudents(data)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editingId) {
      await supabase.from('students').update(formData).eq('studentid', editingId)
    } else {
      await supabase.from('students').insert([formData])
    }
    setFormData({ name: '', fathername: '', mobilenumber: '', class_id: '' })
    setEditingId(null)
    fetchStudents()
  }

  const handleEdit = (student) => {
    setFormData({
      name: student.name,
      fathername: student.fathername,
      mobilenumber: student.mobilenumber,
      class_id: student.class_id
    })
    setEditingId(student.studentid)
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this student?')) {
      await supabase.from('students').delete().eq('studentid', id)
      fetchStudents()
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-sans">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-700">Student Management</h1>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div className="flex flex-col gap-1 w-full md:w-1/3">
          <label className="font-semibold">Filter by Class:</label>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="border rounded px-3 py-2">
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 w-full md:w-1/3">
          <label className="font-semibold">Search by Name:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Enter student name..."
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-6 rounded shadow mb-10">
        <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Name" required className="border p-2 rounded" />
        <input type="text" name="fathername" value={formData.fathername} onChange={handleInputChange} placeholder="Father Name" required className="border p-2 rounded" />
        <input type="text" name="mobilenumber" value={formData.mobilenumber} onChange={handleInputChange} placeholder="Mobile Number" required className="border p-2 rounded" />
        <select name="class_id" value={formData.class_id} onChange={handleInputChange} required className="border p-2 rounded">
          <option value="">Select Class</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="bg-blue-600 text-white font-semibold px-4 py-2 rounded hover:bg-blue-700 md:col-span-2">
          {editingId ? 'Update Student' : 'Add Student'}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-200 text-gray-800">
            <tr>
              <th className="border p-2">DAS #</th>
              <th className="border p-2">Name</th>
              <th className="border p-2">Father</th>
              <th className="border p-2">Mobile</th>
              <th className="border p-2">Class</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.studentid} className="text-center">
                <td className="border p-2">{s.studentid}</td>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">{s.fathername}</td>
                <td className="border p-2">{s.mobilenumber}</td>
                <td className="border p-2">{s.classes?.name || '—'}</td>
                <td className="border p-2 space-x-2">
                  <button onClick={() => handleEdit(s)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(s.studentid)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">No students found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}