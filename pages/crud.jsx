import { useState, useEffect } from "react"
import { supabase } from "../utils/supabaseClient"
import Navbar from "../components/Navbar"
import Loader from "../components/Loader"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Plus, Edit, Trash2, X, Filter, Search, ChevronDown, CheckCircle2, Check, XCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "../hooks/use-toast"

export default function StudentsPage() {
  const { toast } = useToast()

  // --- State ---
  const [students, setStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [classes, setClasses] = useState([])

  const [filterClasses, setFilterClasses] = useState([])
  const [filterClear, setFilterClear] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
    
  // Selection & Bulk Action State
  const [selectedStudents, setSelectedStudents] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)

  // Modal & Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({ studentid: "", name: "", fathername: "", mobilenumber: "", class_id: "", dob: "" })
  const [editingId, setEditingId] = useState(null)
    
  const [loading, setLoading] = useState(false)
  const [loadingClear, setLoadingClear] = useState(null)

  // --- Data Fetching ---
  useEffect(() => {
    fetchClasses()
    fetchStudents()
  }, [])

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*").order('id', { ascending: true })
    setClasses(data || [])
  }

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase.from("students").select("*, classes(name)")
    setAllStudents(data || [])
    setStudents(data || [])
    setLoading(false)
  }

  // --- Filtering Logic ---
  useEffect(() => {
    let filtered = [...allStudents]

    if (filterClasses.length > 0) {
      filtered = filtered.filter(s => filterClasses.includes(String(s.class_id)))
    }

    if (filterClear.length > 0) {
      filtered = filtered.filter(s => filterClear.includes(s.Clear ? "TRUE" : "FALSE"))
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || String(s.studentid).includes(q))
    }

    filtered.sort((a, b) => {
      if (a.class_id === b.class_id) return a.name.localeCompare(b.name)
      return a.class_id - b.class_id
    })

    setStudents(filtered)
  }, [filterClasses, filterClear, searchQuery, allStudents])

  // --- Actions ---
  const openForm = (student = null) => {
    if (student) {
      setFormData({
        studentid: student.studentid,
        name: student.name,
        fathername: student.fathername,
        mobilenumber: student.mobilenumber,
        class_id: student.class_id,
        dob: student.dob || "", 
      })
      setEditingId(student.studentid)
    } else {
      setFormData({ studentid: "", name: "", fathername: "", mobilenumber: "", class_id: "", dob: "" }) 
      setEditingId(null)
    }
    setIsFormOpen(true)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    try {
      if (editingId) {
        const { error } = await supabase.from("students").update(formData).eq("studentid", editingId)
        if (error) throw error
        toast({ title: "Updated successfully ✅" })
      } else {
        const { error } = await supabase.from("students").insert([formData])
        if (error) throw error
        toast({ title: "Student added 🎉" })
      }
      setIsFormOpen(false)
      setEditingId(null)
      fetchStudents()
    } catch (error) {
      console.error(error)
      toast({ title: "Error saving student", description: error.message, variant: "destructive" })
    }
  }

  const handleDelete = async id => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return
    await supabase.from("students").delete().eq("studentid", id)
    toast({ title: "Student deleted 🗑️" })
    fetchStudents()
  }

  // Single Status Update
  const handleClearChange = async (id, value) => {
    setLoadingClear(id)
    await supabase.from("students").update({ Clear: value }).eq("studentid", id)
    setAllStudents(prev => prev.map(s => (s.studentid === id ? { ...s, Clear: value } : s)))
    setLoadingClear(null)
  }

  // --- Bulk Status Update ---
  const handleBulkStatus = async (status) => {
    if (selectedStudents.length === 0) return
    setBulkLoading(true)
    
    try {
      const { error } = await supabase
        .from("students")
        .update({ Clear: status })
        .in("studentid", selectedStudents)

      if (error) throw error

      setAllStudents(prev => prev.map(s => 
        selectedStudents.includes(s.studentid) ? { ...s, Clear: status } : s
      ))

      toast({ title: `Updated ${selectedStudents.length} students to ${status ? "Cleared" : "Pending"} ✅` })
      setSelectedStudents([])

    } catch (error) {
      console.error(error)
      toast({ title: "Bulk update failed", variant: "destructive" })
    } finally {
      setBulkLoading(false)
    }
  }

  const toggleClassFilter = (id) => {
    setFilterClasses(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // INPUT STYLE - UPDATED: Added h-9 and text-sm for compactness
  const inputClassName = `
    w-full h-9 text-sm px-3 bg-gray-50 text-gray-900 border-gray-200 
    focus:ring-blue-500 focus:border-blue-500 rounded-md
    dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:focus:ring-blue-500 dark:placeholder:text-slate-500
    transition-colors
  `

  return (
    <>
      <Navbar />
      
      <div className="min-h-screen transition-colors duration-300
        bg-gradient-to-b from-gray-50 to-gray-200 
        dark:from-[#0b1220] dark:to-[#05070c] 
        text-gray-900 dark:text-slate-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
          {/* --- HEADER ROW --- */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Students</h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1">Manage enrollments and fee clearance.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-grow sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-slate-500" />
                <Input
                  placeholder="Search name or ID..."
                  className="pl-10 h-10 rounded-lg 
                  bg-white border-gray-200 text-gray-900
                  dark:bg-white/10 dark:border-white/10 dark:text-slate-100 dark:placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={() => openForm()} 
                className="bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-blue-500/20 rounded-full sm:rounded-lg h-10 px-6 transition-all"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Student
              </Button>
            </div>
          </div>

          {/* --- FILTERS --- */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mr-2 shrink-0">
                 <Filter className="w-4 h-4" />
                 <span className="text-xs font-bold uppercase tracking-wider">Class</span>
              </div>

              <button
                 onClick={() => setFilterClasses([])}
                 className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                   filterClasses.length === 0
                     ? "bg-blue-600 text-white border-blue-600 shadow-md"
                     : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:border-white/20"
                 }`}
              >
                All
              </button>

              {classes.map(c => {
                const isActive = filterClasses.includes(String(c.id))
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClassFilter(String(c.id))}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:border-white/20"
                    }`}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-6 ml-1">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mr-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Status</span>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                   <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                     filterClear.includes("TRUE") 
                        ? "bg-green-600 border-green-600" 
                        : "bg-white border-gray-300 group-hover:border-green-500 dark:bg-white/5 dark:border-white/20 dark:group-hover:border-green-400"
                    }`}>
                      {filterClear.includes("TRUE") && <ChevronDown className="w-3 h-3 text-white" />}
                      <input type="checkbox" className="hidden" checked={filterClear.includes("TRUE")} onChange={e => setFilterClear(prev => e.target.checked ? [...prev, "TRUE"] : prev.filter(x => x !== "TRUE"))} />
                   </div>
                   <span className="text-sm font-medium text-green-700 dark:text-green-400">Cleared</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group select-none">
                   <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                     filterClear.includes("FALSE") 
                        ? "bg-red-500 border-red-500" 
                        : "bg-white border-gray-300 group-hover:border-red-400 dark:bg-white/5 dark:border-white/20 dark:group-hover:border-red-400"
                    }`}>
                      {filterClear.includes("FALSE") && <ChevronDown className="w-3 h-3 text-white" />}
                      <input type="checkbox" className="hidden" checked={filterClear.includes("FALSE")} onChange={e => setFilterClear(prev => e.target.checked ? [...prev, "FALSE"] : prev.filter(x => x !== "FALSE"))} />
                   </div>
                   <span className="text-sm font-medium text-red-600 dark:text-red-400">Pending</span>
                </label>
            </div>
          </div>

          {/* --- BULK ACTION BAR --- */}
          <AnimatePresence>
              {selectedStudents.length > 0 && (
                  <motion.div 
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="mb-4 overflow-hidden"
                  >
                      <div className="bg-blue-50/80 backdrop-blur-md border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                          <div className="flex items-center gap-3">
                              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md">
                                  {selectedStudents.length} Selected
                              </span>
                              <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                                  Update status for selected students:
                              </span>
                          </div>
                          <div className="flex items-center gap-2">
                               {bulkLoading ? (
                                  <Loader small /> 
                               ) : (
                                  <>
                                      <Button 
                                          size="sm" 
                                          onClick={() => handleBulkStatus(true)}
                                          className="bg-green-600 hover:bg-green-700 text-white border-none h-8"
                                      >
                                          <Check className="w-3 h-3 mr-1.5" /> Mark Cleared
                                      </Button>
                                      <Button 
                                          size="sm" 
                                          onClick={() => handleBulkStatus(false)}
                                          className="bg-red-500 hover:bg-red-600 text-white border-none h-8"
                                      >
                                          <XCircle className="w-3 h-3 mr-1.5" /> Mark Pending
                                      </Button>
                                      <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setSelectedStudents([])}
                                          className="text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 h-8"
                                      >
                                          Cancel
                                      </Button>
                                  </>
                               )}
                          </div>
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>

          {/* TABLE CONTAINER */}
          <div className="rounded-xl overflow-hidden
            border border-gray-200 dark:border-white/10 
            bg-white dark:bg-white/5 
            backdrop-blur-xl shadow-sm dark:shadow-xl"
          >
            {loading ? (
               <div className="p-12 flex justify-center"><Loader /></div>
            ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left min-w-[800px]">
                   <thead className="text-xs uppercase font-semibold
                     bg-gray-50 text-gray-500 border-b border-gray-200
                     dark:bg-white/5 dark:text-slate-400 dark:border-white/10">
                     <tr>
                       <th className="py-4 pl-6 w-10">
                         <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer dark:border-white/20 dark:bg-white/10 dark:checked:bg-blue-600"
                            onChange={e => setSelectedStudents(e.target.checked ? students.map(s => s.studentid) : [])}
                            checked={students.length > 0 && selectedStudents.length === students.length}
                         />
                       </th>
                       <th className="py-4 px-3">ID</th>
                       <th className="py-4 px-3">Name</th>
                       <th className="py-4 px-3">Father Name</th>
                       <th className="py-4 px-3">Mobile</th>
                       <th className="py-4 px-3">DOB</th>
                       <th className="py-4 px-3">Class</th>
                       <th className="py-4 px-3">Status</th>
                       <th className="py-4 pr-6 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                     {students.length === 0 ? (
                       <tr><td colSpan="9" className="py-12 text-center text-gray-500 dark:text-slate-500 italic">No students match your filters.</td></tr>
                     ) : (
                       students.map(s => (
                         <tr key={s.studentid} className={`group transition-colors 
                           ${selectedStudents.includes(s.studentid) 
                             ? "bg-blue-50 dark:bg-blue-900/20" 
                             : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                           }`}>
                           <td className="py-3 pl-6">
                             <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer dark:border-white/20 dark:bg-white/10 dark:checked:bg-blue-600"
                               checked={selectedStudents.includes(s.studentid)}
                               onChange={e => setSelectedStudents(prev => e.target.checked ? [...prev, s.studentid] : prev.filter(id => id !== s.studentid))}
                             />
                           </td>
                           <td className="py-3 px-3 font-mono text-xs text-gray-500 dark:text-slate-500">#{s.studentid}</td>
                           <td className="py-3 px-3 font-semibold text-gray-900 dark:text-slate-200">{s.name}</td>
                           <td className="py-3 px-3 text-gray-600 dark:text-slate-400">{s.fathername}</td>
                           <td className="py-3 px-3 text-gray-600 dark:text-slate-400 font-mono text-xs">{s.mobilenumber}</td>
                           <td className="py-3 px-3 text-gray-600 dark:text-slate-400 font-mono text-xs">{s.dob || "-"}</td>

                           <td className="py-3 px-3">
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                               bg-gray-100 text-gray-800 border border-gray-200
                               dark:bg-white/10 dark:text-slate-300 dark:border-white/10">
                               {s.classes?.name}
                             </span>
                           </td>
                           
                           <td className="py-3 px-3">
                              <div className="relative inline-block w-full max-w-[100px]">
                                  {loadingClear === s.studentid ? (
                                    <Loader small />
                                  ) : (
                                    <select
                                      value={s.Clear ? "TRUE" : "FALSE"}
                                      onChange={(e) => handleClearChange(s.studentid, e.target.value === "TRUE")}
                                      className={`w-full bg-transparent font-bold cursor-pointer outline-none focus:ring-0 border-none p-0 pr-2 text-xs ${
                                        s.Clear ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                                      }`}
                                    >
                                      <option className="bg-white text-gray-900 dark:bg-white/5 dark:text-gray-100" value="TRUE">Cleared</option>
                                      <option className="bg-white text-gray-900 dark:bg-white/5 dark:text-gray-100" value="FALSE">Pending</option>
                                    </select>
                                  )}
                              </div>
                           </td>
                           
                           <td className="py-3 pr-6 text-right">
                             <div className="flex justify-end gap-2">
                               <button onClick={() => openForm(s)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30" title="Edit">
                                 <Edit className="w-4 h-4" />
                               </button>
                               <button onClick={() => handleDelete(s.studentid)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-900/30" title="Delete">
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODAL --- */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsFormOpen(false)} 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              // UPDATED: Changed max-w-lg to max-w-md for smaller width
              className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100
                dark:bg-slate-900 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()} 
            >
              {/* UPDATED: Reduced padding (px-5 py-3) */}
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50 
                dark:bg-slate-900 dark:border-slate-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingId ? "Edit Student" : "Add New Student"}
                </h2>
                <button 
                  onClick={() => setIsFormOpen(false)} 
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* UPDATED: Reduced padding (p-5) */}
              <div className="p-5 bg-white dark:bg-slate-900">
                {/* UPDATED: Reduced gap (space-y-4) */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* UPDATED: Reduced grid gap (gap-3) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Student ID</label>
                         <Input 
                           name="studentid" 
                           value={formData.studentid} 
                           onChange={e => setFormData({...formData, studentid: e.target.value})} 
                           required 
                           disabled={!!editingId} 
                           placeholder="e.g. 1001"
                           className={`${inputClassName} ${editingId ? "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-800" : ""}`} 
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Full Name</label>
                         <Input 
                           name="name" 
                           value={formData.name} 
                           onChange={e => setFormData({...formData, name: e.target.value})} 
                           required 
                           placeholder="e.g. Ali Khan"
                           className={inputClassName} 
                         />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Father Name</label>
                         <Input 
                           name="fathername" 
                           value={formData.fathername} 
                           onChange={e => setFormData({...formData, fathername: e.target.value})} 
                           required 
                           placeholder="e.g. Ahmed Khan"
                           className={inputClassName} 
                         />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Class</label>
                          {/* UPDATED: Changed h-10 to h-9 */}
                          <select 
                            name="class_id" 
                            value={formData.class_id} 
                            onChange={e => setFormData({...formData, class_id: e.target.value})} 
                            className={`flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 ${inputClassName}`} 
                            required
                          >
                            <option value="" className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white">Select Class...</option>
                            {classes.map(c => <option key={c.id} value={c.id} className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white">{c.name}</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Mobile Number</label>
                         <Input 
                           name="mobilenumber" 
                           value={formData.mobilenumber} 
                           onChange={e => setFormData({...formData, mobilenumber: e.target.value})} 
                           required 
                           placeholder="0300..."
                           className={inputClassName} 
                         />
                      </div>
                      
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Date of Birth</label>
                         <Input 
                           type="date"
                           name="dob" 
                           value={formData.dob} 
                           onChange={e => setFormData({...formData, dob: e.target.value})} 
                           required 
                           className={`${inputClassName} dark:[color-scheme:dark]`} 
                         />
                      </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => setIsFormOpen(false)} 
                      className="flex-1 h-9 border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800">
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-md dark:bg-blue-600 dark:hover:bg-blue-500">
                      {editingId ? "Save Changes" : "Create Student"}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}