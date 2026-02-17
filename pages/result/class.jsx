import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import Navbar from '../../components/Navbar'
import { generateClassResultPDF } from '../../utils/resultCardGenerator' // Import the new util

// 🔹 Action Modal (Unchanged logic, just keeping it clean)
const ActionModal = ({ isOpen, onClose, onConfirm, actionType, onManualSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-200">
        <h3 className="text-xl font-bold mb-4">
          {actionType === 'print' ? '📄 PDF Options' : '📲 WhatsApp Options'}
        </h3>
        <p className="mb-6 text-gray-700">
          How would you like to proceed with the <strong>{actionType === 'print' ? 'generation' : 'sending'}</strong> process?
        </p>
        <div className="flex flex-col gap-3">
          <Button 
            className="w-full bg-gray-800 hover:bg-gray-900 text-white shadow font-semibold" 
            onClick={() => onConfirm(false)}
          >
            ✅ Only Cleared Students (Exclude Pending)
          </Button>
          
          <Button 
            className="w-full light:bg-gray-700 hover:bg-gray-800 text-white shadow font-semibold" 
            onClick={() => onConfirm(true)}
          >
            👥 Include All Students (Pending & Cleared)
          </Button>

          {actionType === 'whatsapp' && (
              <Button 
                className="w-full light:bg-gray-700  hover:bg-blue-700 text-white shadow font-semibold border border-blue-800" 
                onClick={onManualSelect}
              >
                📝 Select Students Manually
              </Button>
          )}
          
          <Button 
            className="w-full mt-2 bg-white border border-gray-400 text-gray-900 hover:bg-gray-100" 
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ClassResultPage() {
  const router = useRouter()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [attnStartDate, setAttnStartDate] = useState('')
  const [attnEndDate, setAttnEndDate] = useState('')

  const [studentsResults, setStudentsResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
    
  const [showModal, setShowModal] = useState(false)
   
  const [pendingAction, setPendingAction] = useState(null)

  const gradeFromPercent = (percent) => {
    if (percent >= 90) return 'A+'
    if (percent >= 80) return 'A'
    if (percent >= 70) return 'B'
    if (percent >= 60) return 'C'
    if (percent >= 50) return 'D'
    if (percent >= 33) return 'E'
    return 'F'
  }

  useEffect(() => {
    supabase.from('classes').select('id, name').then(({ data }) => setClasses(data || []))
  }, [])

  const fetchAllAttendance = async (studentIds, start, end) => {
    let allRows = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('attendance')
            .select('studentid, date, status')
            .in('studentid', studentIds)
            .gte('date', start)
            .lte('date', end)
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

  const fetchClassResults = async () => {
    if (!selectedClass || !startDate || !endDate || !attnStartDate || !attnEndDate) {
        alert("Please fill in all date fields (both Marks and Attendance ranges).")
        return
    }
    setLoading(true)
    setGenerated(false)
    setStudentsResults([])

    const currentClassObj = classes.find(c => String(c.id) === selectedClass)
    const classNameStr = currentClassObj ? currentClassObj.name : ''

    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber, Clear')
      .eq('class_id', selectedClass)

    if (studentsError) {
      console.error(studentsError)
      setLoading(false)
      return
    }

    if (!studentsData || studentsData.length === 0) {
      setStudentsResults([])
      setLoading(false)
      return
    }

    const studentIds = studentsData.map(s => s.studentid)

    try {
        const marksPromise = supabase
            .from('marks')
            .select(`
                studentid,
                total_marks,
                obtained_marks,
                tests!inner(test_name, date)
            `)
            .in('studentid', studentIds)
            .gte('tests.date', startDate)
            .lte('tests.date', endDate)
            .limit(10000); 
        
        const attendancePromise = fetchAllAttendance(studentIds, attnStartDate, attnEndDate);

        const [marksResponse, allAttendance] = await Promise.all([
            marksPromise,
            attendancePromise
        ])

        const allMarks = marksResponse.data || []
        
        const uniqueDates = [...new Set(allAttendance.map(item => item.date))].sort();
        const classTotalDays = uniqueDates.length;

        const results = []

        for (const student of studentsData) {
            const studentMarks = allMarks.filter(m => m.studentid === student.studentid)
            const studentAttendance = allAttendance.filter(a => a.studentid === student.studentid)

            if (studentMarks && studentMarks.length > 0) {
                
                const presentDays = studentAttendance.filter(a => a.status === 'Present').length
                const absentDays = classTotalDays - presentDays; 
                const attnPercent = classTotalDays > 0 ? (presentDays / classTotalDays) * 100 : 0

                results.push({
                    studentName: student.name,
                    fatherName: student.fathername,
                    mobilenumber: student.mobilenumber,
                    dasNumber: student.studentid,
                    className: classNameStr,
                    isClear: student.Clear, 
                    attendance: {
                        total: classTotalDays,
                        present: presentDays,
                        absent: absentDays,
                        percent: attnPercent
                    },
                    marksData: studentMarks.map(m => ({
                        subject: m.tests?.test_name || '',
                        total_marks: m.total_marks,
                        obtained_marks: m.obtained_marks
                    }))
                })
            }
        }

        setStudentsResults(results)
        setGenerated(true)
    } catch (err) {
        console.error("Error generating results:", err);
        alert("An error occurred while fetching data.");
    } finally {
        setLoading(false)
    }
  }

  const handlePrintClick = () => {
    setPendingAction('print')
    setShowModal(true)
  }

  const handleWAClick = () => {
    setPendingAction('whatsapp')
    setShowModal(true)
  }

  const handleActionConfirm = (includeUncleared) => {
    setShowModal(false)

    if (pendingAction === 'whatsapp') {
      sendResults(includeUncleared)
    } else if (pendingAction === 'print') {
      executePdfGeneration(includeUncleared)
    }
  }

  const handleManualSelectionTrigger = () => {
    setShowModal(false);
    router.push({
      pathname: '/result/selection',
      query: {
        classId: selectedClass,
        startDate: startDate,
        endDate: endDate,
        attnStartDate: attnStartDate,
        attnEndDate: attnEndDate
      }
    });
  }

  // 🔹 REPLACED window.print() with PDF Generation Utility
  const executePdfGeneration = async (includeUncleared) => {
    const listToPrint = includeUncleared 
        ? studentsResults 
        : studentsResults.filter(s => s.isClear === true);
    
    if (listToPrint.length === 0) {
        alert("No students match the criteria for PDF generation.");
        return;
    }

    const currentClassObj = classes.find(c => String(c.id) === selectedClass);
    
    // Call the utility function
    await generateClassResultPDF(
        listToPrint, 
        { name: currentClassObj ? currentClassObj.name : 'Class' },
        { 
            start: startDate, 
            end: endDate,
            attnStart: attnStartDate,
            attnEnd: attnEndDate
        }
    );
  }

  const sendResults = async (includeUncleared, specificList = null) => {
    let targetList = specificList 
        ? specificList 
        : (includeUncleared ? studentsResults : studentsResults.filter(s => s.isClear === true));

    if (targetList.length === 0) {
      alert("⚠️ No results to send based on your selection.")
      return
    }

    const messages = targetList.map(student => {
      const totalObtained = student.marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
      const totalMax = student.marksData.reduce((acc, m) => acc + m.total_marks, 0)
      const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
      const overallGrade = gradeFromPercent(overallPercent)

      const subjectsText = student.marksData
        .map(m => {
          const percent = (m.obtained_marks / m.total_marks) * 100
          const grade = gradeFromPercent(percent)
          return `- *${m.subject}:* ${m.obtained_marks}/${m.total_marks} (${percent.toFixed(1)}%, ${grade})`
        })
        .join("\n")

      const attnText = `\n *Attendance:* ${student.attendance.percent.toFixed(1)}% (P:${student.attendance.present}/T:${student.attendance.total})`

      const body = `📊 *Report Card*\n\n *Name:* ${student.studentName}\n *Father:* ${student.fatherName}\n *Class:* ${student.className}\n${subjectsText}\n${attnText}\n\n *Total:* ${totalObtained}/${totalMax}\n *Percentage:* ${overallPercent.toFixed(2)}%\n *Grade:* ${overallGrade}\n\n *Regards,* \n *Management* \n DAR-E-ARQAM`

      return { 
        number: student.mobilenumber, 
        text: body, 
        sent: false, 
        student_id: student.dasNumber, 
        class_id: selectedClass 
      }
    })

    const { error } = await supabase.from('messages').insert(messages)

    if (error) {
      console.error(error)
      alert("❌ Failed to queue class results")
    } else {
      alert(`✅ ${messages.length} results queued for WhatsApp`)
    }
  }

  return (
    <>
      <Navbar />

      <div className="p-6">
        <div className="mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Generate Report Cards</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-48">
              <label htmlFor="class-select" className="block text-sm font-medium mb-1 text-gray-600">Select Class</label>
              <Select id="class-select" onValueChange={setSelectedClass} value={selectedClass}>
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="p-2 border rounded bg-gray-50 flex gap-4">
                <div>
                    <label className="block text-xs font-bold mb-1 text-blue-600 uppercase">Tests Date Range</label>
                    <div className="flex gap-2">
                        <div>
                        <span className="text-xs text-gray-500 block">From</span>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                        <span className="text-xs text-gray-500 block">To</span>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" />
                        </div>
                    </div>
                </div>

                <div className="border-l border-gray-300 pl-4">
                    <label className="block text-xs font-bold mb-1 text-green-600 uppercase">Attendance Date Range</label>
                    <div className="flex gap-2">
                        <div>
                        <span className="text-xs text-gray-500 block">From</span>
                        <Input type="date" value={attnStartDate} onChange={e => setAttnStartDate(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                        <span className="text-xs text-gray-500 block">To</span>
                        <Input type="date" value={attnEndDate} onChange={e => setAttnEndDate(e.target.value)} className="h-8 text-sm" />
                        </div>
                    </div>
                </div>
            </div>

            <Button 
                className="light:bg-gray-900  hover:bg-gray-800 light:text-white font-semibold px-6 py-2 h-10 mb-1" 
                onClick={fetchClassResults} 
                disabled={loading || !selectedClass || !startDate || !endDate || !attnStartDate || !attnEndDate}
            >
              {loading ? 'Processing...' : 'Generate Results'}
            </Button>
            
            {generated && studentsResults.length > 0 && (
              <div className="flex gap-2 ml-auto mb-1">
                <Button 
                    className="bg-white border-2 border-gray-800 text-gray-900 hover:bg-gray-100 font-semibold h-10" 
                    onClick={handlePrintClick}
                >
                    ⬇️ Download PDF
                </Button>
                <Button 
                    className="bg-white border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold h-10" 
                    onClick={handleWAClick}
                >
                    📲 WhatsApp
                </Button>
              </div>
            )}
          </div>
        </div>

        {generated && studentsResults.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded border border-dashed border-gray-300">
            <p className="text-gray-500 font-medium">No results found for the selected criteria.</p>
          </div>
        )}

        {/* Preview Section:
            I have removed the complex HTML map here because we are now generating PDFs via JS.
            However, if you want a visual list of who was fetched, you can leave a simple list here.
            For now, I've cleaned it up to focus on the controls.
        */}
        {generated && studentsResults.length > 0 && (
            <div className="bg-white p-4 rounded shadow border">
                <h3 className="font-bold text-lg mb-2">Generated List Preview</h3>
                <div className="text-sm text-gray-600 mb-2">
                    {studentsResults.length} students found. Click "Download PDF" to save result cards.
                </div>
                <div className="max-h-64 overflow-y-auto border rounded">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="p-2 border-b">Name</th>
                                <th className="p-2 border-b">Father Name</th>
                                <th className="p-2 border-b text-center">Cleared?</th>
                                <th className="p-2 border-b text-center">Marks %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsResults.map(s => {
                                const totalObtained = s.marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
                                const totalMax = s.marksData.reduce((acc, m) => acc + m.total_marks, 0)
                                const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
                                return (
                                    <tr key={s.dasNumber} className="hover:bg-gray-50">
                                        <td className="p-2 border-b">{s.studentName}</td>
                                        <td className="p-2 border-b">{s.fatherName}</td>
                                        <td className="p-2 border-b text-center">
                                            {s.isClear ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-red-600 font-bold">No</span>}
                                        </td>
                                        <td className="p-2 border-b text-center">{overallPercent.toFixed(1)}%</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </div>

      <ActionModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onConfirm={handleActionConfirm}
        actionType={pendingAction}
        onManualSelect={handleManualSelectionTrigger}
      />
    </>
  )
}
