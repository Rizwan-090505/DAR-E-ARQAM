import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../utils/supabaseClient' // Adjust path as needed
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Navbar from '../../components/Navbar' // Adjust path as needed
import { ArrowLeft, CheckSquare, Square, Send, Filter, RefreshCcw } from 'lucide-react' // Assuming you have lucide-react or use standard icons

export default function SendResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. Get Filters from URL
  const classId = searchParams.get('classId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const attnStartDate = searchParams.get('attnStartDate')
  const attnEndDate = searchParams.get('attnEndDate')
  const className = searchParams.get('className') // Optional: Pass name to avoid fetching it

  // 2. State
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [sending, setSending] = useState(false)
  const [filterType, setFilterType] = useState('all') // 'all', 'cleared', 'pending'

  // Helper: Calculate Grade
  const gradeFromPercent = (percent) => {
    if (percent >= 90) return 'A+'
    if (percent >= 80) return 'A'
    if (percent >= 70) return 'B'
    if (percent >= 60) return 'C'
    if (percent >= 50) return 'D'
    if (percent >= 33) return 'E'
    return 'F'
  }

  // 3. Fetch Data Logic (Reused from previous page)
  useEffect(() => {
    if (!classId || !startDate || !endDate) {
      alert("Missing parameters. Returning to dashboard.")
      router.back()
      return
    }
    fetchData()
  }, [classId, startDate, endDate])

  const fetchAllAttendance = async (studentIds) => {
    let allRows = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('attendance')
            .select('studentid, date, status')
            .in('studentid', studentIds)
            .gte('date', attnStartDate)
            .lte('date', attnEndDate)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data.length > 0) {
            allRows = [...allRows, ...data];
            if (data.length < pageSize) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }
    return allRows;
  };

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch Students
      const { data: studentsData, error: sError } = await supabase
        .from('students')
        .select('studentid, name, fathername, mobilenumber, Clear')
        .eq('class_id', classId)

      if (sError) throw sError
      if (!studentsData || studentsData.length === 0) {
        setStudents([])
        setLoading(false)
        return
      }

      const studentIds = studentsData.map(s => s.studentid)

      // Fetch Marks & Attendance in Parallel
      const [marksResponse, allAttendance] = await Promise.all([
        supabase
            .from('marks')
            .select(`studentid, total_marks, obtained_marks, tests!inner(test_name, date)`)
            .in('studentid', studentIds)
            .gte('tests.date', startDate)
            .lte('tests.date', endDate),
        fetchAllAttendance(studentIds)
      ])

      const allMarks = marksResponse.data || []
      const uniqueDates = [...new Set(allAttendance.map(item => item.date))].sort();
      const classTotalDays = uniqueDates.length;

      // Process Data
      const results = studentsData.map(student => {
        const studentMarks = allMarks.filter(m => m.studentid === student.studentid)
        const studentAttendance = allAttendance.filter(a => a.studentid === student.studentid)
        
        const presentDays = studentAttendance.filter(a => a.status === 'Present').length
        const absentDays = classTotalDays - presentDays
        const attnPercent = classTotalDays > 0 ? (presentDays / classTotalDays) * 100 : 0
        
        // Marks Calculations for Table Display
        const totalObtained = studentMarks.reduce((acc, m) => acc + m.obtained_marks, 0)
        const totalMax = studentMarks.reduce((acc, m) => acc + m.total_marks, 0)
        const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0

        return {
            studentName: student.name,
            fatherName: student.fathername,
            mobilenumber: student.mobilenumber,
            dasNumber: student.studentid,
            isClear: student.Clear,
            stats: {
                totalObtained,
                totalMax,
                overallPercent,
                grade: gradeFromPercent(overallPercent)
            },
            attendance: {
                total: classTotalDays,
                present: presentDays,
                percent: attnPercent
            },
            marksData: studentMarks.map(m => ({
                subject: m.tests?.test_name || '',
                total_marks: m.total_marks,
                obtained_marks: m.obtained_marks
            }))
        }
      })

      // Only show students who actually have data (optional, remove filter if you want everyone)
      const activeStudents = results.filter(s => s.marksData.length > 0 || s.attendance.total > 0)
      
      setStudents(activeStudents)
    } catch (err) {
      console.error(err)
      alert("Error fetching data")
    } finally {
      setLoading(false)
    }
  }

  // 4. Selection Logic
  const filteredStudents = useMemo(() => {
    if (filterType === 'cleared') return students.filter(s => s.isClear)
    if (filterType === 'pending') return students.filter(s => !s.isClear)
    return students
  }, [students, filterType])

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSelectAll = () => {
    const allIds = filteredStudents.map(s => s.dasNumber)
    if (selectedIds.length === allIds.length && allIds.length > 0) {
        setSelectedIds([]) // Deselect all
    } else {
        setSelectedIds(allIds) // Select all currently visible
    }
  }

  // 5. Send Logic
  const handleSendMessages = async () => {
    if (selectedIds.length === 0) return
    setSending(true)

    const targetStudents = students.filter(s => selectedIds.includes(s.dasNumber))
    
    const messages = targetStudents.map(student => {
        // Construct Message Body (Identical to previous page)
        const subjectsText = student.marksData
            .map(m => {
                const percent = (m.obtained_marks / m.total_marks) * 100
                const grade = gradeFromPercent(percent)
                return `- *${m.subject}:* ${m.obtained_marks}/${m.total_marks} (${percent.toFixed(1)}%, ${grade})`
            })
            .join("\n")

        const attnText = `\n *Attendance:* ${student.attendance.percent.toFixed(1)}% (P:${student.attendance.present}/T:${student.attendance.total})`

        const body = `📊 *Report Card*\n\n *Name:* ${student.studentName}\n *Father:* ${student.fatherName}\n *Class:* ${className || 'Class'}\n${subjectsText}\n${attnText}\n\n *Total:* ${student.stats.totalObtained}/${student.stats.totalMax}\n *Percentage:* ${student.stats.overallPercent.toFixed(2)}%\n *Grade:* ${student.stats.grade}\n\n *Regards,* \n *Management* \n DAR-E-ARQAM`

        return { 
            number: student.mobilenumber, 
            text: body, 
            sent: false, 
            student_id: student.dasNumber, 
            class_id: classId 
        }
    })

    const { error } = await supabase.from('messages').insert(messages)

    setSending(false)
    if (error) {
        alert("❌ Failed to queue messages.")
        console.error(error)
    } else {
        alert(`✅ Successfully queued ${messages.length} messages!`)
        router.push('/messages') // Redirect to messages outbox or dashboard
    }
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent text-gray-500" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Generator
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">Send WhatsApp Results</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {className} • {startDate} to {endDate}
                </p>
            </div>
            
            <div className="flex gap-2">
                 <div className="bg-white border rounded-md p-1 flex">
                    <button 
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${filterType === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        All
                    </button>
                    <button 
                        onClick={() => setFilterType('cleared')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${filterType === 'cleared' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Cleared
                    </button>
                    <button 
                        onClick={() => setFilterType('pending')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${filterType === 'pending' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Pending
                    </button>
                 </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col h-[65vh]">
            
            {/* Table Header / Controls */}
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-blue-600"
                        onChange={handleSelectAll}
                        checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                    />
                    <span className="text-sm font-semibold text-gray-700">
                        Select All ({filteredStudents.length})
                    </span>
                </div>
                <div className="text-sm text-gray-500">
                    {selectedIds.length} students selected
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <RefreshCcw className="w-8 h-8 animate-spin mb-2" />
                        <p>Loading student results...</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No students found for this criteria.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 w-12"></th>
                                <th className="p-3">Student Info</th>
                                <th className="p-3 text-center">Marks</th>
                                <th className="p-3 text-center">Attendance</th>
                                <th className="p-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredStudents.map(student => (
                                <tr 
                                    key={student.dasNumber} 
                                    className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedIds.includes(student.dasNumber) ? 'bg-blue-50' : ''}`}
                                    onClick={() => toggleSelect(student.dasNumber)}
                                >
                                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 accent-blue-600 cursor-pointer"
                                            checked={selectedIds.includes(student.dasNumber)}
                                            onChange={() => toggleSelect(student.dasNumber)}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <p className="font-bold text-gray-800">{student.studentName}</p>
                                        <p className="text-xs text-gray-500">{student.fatherName}</p>
                                        <p className="text-xs text-gray-400">{student.mobilenumber}</p>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-gray-700">{student.stats.overallPercent.toFixed(1)}%</span>
                                            <span className="text-xs text-gray-500">{student.stats.totalObtained}/{student.stats.totalMax}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-gray-700">{student.attendance.percent.toFixed(1)}%</span>
                                            <span className="text-xs text-gray-500">{student.attendance.present} / {student.attendance.total} days</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${student.isClear ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {student.isClear ? 'Cleared' : 'Pending'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Sticky Footer Action */}
            <div className="p-4 border-t bg-white flex justify-between items-center">
                <div className="text-sm text-gray-600">
                    Preparing to send to <strong>{selectedIds.length}</strong> students.
                </div>
                <Button 
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 shadow-md"
                    onClick={handleSendMessages}
                    disabled={selectedIds.length === 0 || sending}
                >
                    {sending ? (
                         <>Sending...</>
                    ) : (
                         <><Send className="w-4 h-4 mr-2" /> Send WhatsApp Messages</>
                    )}
                </Button>
            </div>
        </div>
      </div>
    </>
  )
}
