import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Image from 'next/image'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import logo from "../../public/logo-1.png"
import Navbar from '../../components/Navbar'

// 🔹 Updated Action Modal with correct button color
const ActionModal = ({ isOpen, onClose, onConfirm, actionType, onManualSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 no-print">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-200">
        <h3 className="text-xl font-bold mb-4">
          {actionType === 'print' ? '🖨 Print Options' : '📲 WhatsApp Options'}
        </h3>
        <p className="mb-6 text-gray-700">
          How would you like to proceed with the <strong>{actionType === 'print' ? 'printing' : 'sending'}</strong> process?
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

          {/* Updated Button Color */}
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
  const [printFilter, setPrintFilter] = useState('all')

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

        if (error) {
            console.error("Error fetching attendance page:", error);
            throw error;
        }

        if (data.length > 0) {
            allRows = [...allRows, ...data];
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                page++; 
            }
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
    setPrintFilter('all') 

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
        alert("An error occurred while fetching data. Check console for details.");
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
      executePrint(includeUncleared)
    }
  }

  // 🔹 Redirects to /result/selection with query params
  const handleManualSelectionTrigger = () => {
    setShowModal(false);
    
    // We forward the filter params so the selection page can fetch or process context
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

  const executePrint = (includeUncleared) => {
    if (includeUncleared) {
      setPrintFilter('all')
      setTimeout(() => window.print(), 100)
    } else {
      setPrintFilter('cleared')
      setTimeout(() => window.print(), 100)
    }
  }

  const sendResults = async (includeUncleared, specificList = null) => {
    let targetList = [];

    if (specificList) {
        targetList = specificList;
    } else {
        targetList = includeUncleared 
            ? studentsResults 
            : studentsResults.filter(s => s.isClear === true)
    }

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

  const displayedResults = printFilter === 'all' 
    ? studentsResults 
    : studentsResults.filter(s => s.isClear === true)

  return (
    <>
      <style>{`
  @page { size: A4; margin: 5mm; }
  @media print {
    .page-break { page-break-after: always; }
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; background-color: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    main, nav, header, footer { display: none; }
  }
  
  /* Report Card Container */
  .report-card { 
    border: 1px solid #ccc; 
    padding: 15px 20px; 
    margin: 0 auto; 
    background: #fff; 
    width: 100%; 
    max-width: 210mm; /* A4 Width */
    min-height: 260mm; 
    height: auto; 
    box-sizing: border-box; 
    display: flex; 
    flex-direction: column; 
    justify-content: space-between; 
    position: relative; 
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
    color: #000;
  }

  /* Responsive Mobile Fix */
  @media screen and (max-width: 768px) {
    .report-card {
        margin-bottom: 20px;
        min-height: auto;
        width: 100% !important;
        max-width: 100% !important;
    }
  }

  .logo-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 1rem; position: relative; }
  .logo-container img { width: 250px !important; height: auto; display: block; object-fit: contain; }
  .urdu-text { font-family: "Noto Nastaliq Urdu", serif; direction: rtl; font-size: 14px; margin-top: 0.5rem; margin-bottom: 0.75rem; color: #333; font-weight: normal; }
  .report-title-box { text-align: center; border-top: 2px solid #000; border-bottom: 2px solid #000; margin: 0.75rem 0 1.5rem 0; padding: 5px 0; }
  .title { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0; color: #000; }
  .student-details { display: flex; flex-wrap: wrap; justify-content: space-between; background-color: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 10px 15px; margin-bottom: 15px; }
  .detail-group { display: flex; flex-direction: column; min-width: 22%; }
  .detail-label { font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 2px; font-weight: 600; }
  .detail-value { font-size: 15px; font-weight: bold; color: #000; }
  
  /* 🛑 TABLE FIXES FOR MOBILE 🛑 */
  .marks-table-container { 
      flex-grow: 1; 
      width: 100%;
      overflow-x: auto; /* Allows table to scroll horizontally on small screens */
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
  th { background-color: #222; color: #fff; font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 8px 6px; border: 1px solid #222; }
  td { 
      border: 1px solid #ddd; 
      padding: 6px 6px; 
      font-size: 13px; 
      color: #333; 
      vertical-align: middle;
      word-break: break-word; /* Prevents long text from breaking layout */
  }
  tbody tr:nth-child(even) { background-color: #f9f9f9; }
  .col-subject { text-align: left; padding-left: 10px; font-weight: 500; }
  .col-center { text-align: center; }
  .row-total td { background-color: #f0f0f0; font-weight: bold; color: #000; border-top: 3px double #000; font-size: 14px; }
  
  .attn-table { width: 60%; margin-top: 15px; border: 1px solid #000; }
  .attn-table th { background-color: #444; color: #fff; padding: 5px; font-size: 10px; }
  .attn-table td { padding: 5px; font-size: 12px; text-align: center; font-weight: bold; }
  
  .footer-section { margin-top: 10px; text-align: center; border-top: 1px solid #eee; padding-top: 5px; padding-bottom: 0; }
  .footer-note { font-size: 10px; color: #777; margin: 2px 0; font-style: italic; }
  .footer-copyright { font-size: 11px; color: #000; font-weight: 600; margin-top: 5px; }
`}</style>

      <Navbar />

      <div className="p-6">
        <div className="controls no-print mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
                    🖨 Print Report
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

        {generated && displayedResults.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded border border-dashed border-gray-300">
            <p className="text-gray-500 font-medium">No results found for the selected criteria.</p>
          </div>
        )}

        <div id="print-area">
          {generated && displayedResults.length > 0 && (
            displayedResults.map((student) => {
              const totalObtained = student.marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
              const totalMax = student.marksData.reduce((acc, m) => acc + m.total_marks, 0)
              const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
              const overallGrade = gradeFromPercent(overallPercent)

              return (
                <section key={student.dasNumber} className="report-card page-break">
                  
                  <div>
                    <div className="logo-container">
                        <Image src={logo} alt="Logo" width={250} height={150} priority />
                        <p className="urdu-text">تعلیم، تہذیب ساتھ ساتھ</p>
                    </div>

                    <div className="report-title-box">
                        <h1 className="title">Result Card</h1>
                    </div>

                    <div className="student-details">
                        <div className="detail-group">
                        <span className="detail-label">Student Name</span>
                        <span className="detail-value">{student.studentName}</span>
                        </div>
                        <div className="detail-group">
                        <span className="detail-label">Father Name</span>
                        <span className="detail-value">{student.fatherName}</span>
                        </div>
                        <div className="detail-group">
                        <span className="detail-label">Class</span>
                        <span className="detail-value">{student.className}</span>
                        </div>
                        <div className="detail-group">
                        <span className="detail-label">Roll / ID No</span>
                        <span className="detail-value">{student.dasNumber}</span>
                        </div>
                    </div>

                    {!student.isClear && (
                        <div className="no-print mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-center text-sm font-bold">
                        ⚠️ Outstanding Dues Pending
                        </div>
                    )}

                    <div className="marks-table-container">
                        <table>
                        <thead>
                            <tr>
                            <th className="text-left pl-4">Subject</th>
                            <th>Total Marks</th>
                            <th>Obtained</th>
                            <th>Percentage</th>
                            <th>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {student.marksData.map((m, i) => {
                            const percent = (m.obtained_marks / m.total_marks) * 100
                            return (
                                <tr key={i}>
                                <td className="col-subject">{m.subject}</td>
                                <td className="col-center">{m.total_marks}</td>
                                <td className="col-center">{m.obtained_marks}</td>
                                <td className="col-center">{percent.toFixed(0)}%</td>
                                <td className="col-center">{gradeFromPercent(percent)}</td>
                                </tr>
                            )
                            })}
                            <tr className="row-total">
                            <td className="text-right pr-4">OVERALL RESULT</td>
                            <td className="col-center">{totalMax}</td>
                            <td className="col-center">{totalObtained}</td>
                            <td className="col-center">{overallPercent.toFixed(1)}%</td>
                            <td className="col-center">{overallGrade}</td>
                            </tr>
                        </tbody>
                        </table>

                        {/* Attendance Table */}
                        <div className="mt-4">
                            <h4 className="text-xs font-bold uppercase mb-1">Attendance Summary ({attnStartDate} to {attnEndDate})</h4>
                            <table className="attn-table">
                                <thead>
                                    <tr>
                                        <th>Total Working Days</th>
                                        <th>Days Present</th>
                                        <th>Days Absent</th>
                                        <th>Attendance %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>{student.attendance.total}</td>
                                        <td>{student.attendance.present}</td>
                                        <td style={{color: student.attendance.absent > 0 ? 'red' : 'inherit'}}>{student.attendance.absent}</td>
                                        <td>{student.attendance.percent.toFixed(1)}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                  </div>

                  <div className="footer-section">
                    <p className="footer-note">This document is computer-generated and does not require a signature.</p>
                    <p className="footer-copyright">© DAR-E-ARQAM SCHOOLS</p>
                  </div>
                </section>
              )
            })
          )}
        </div>
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
