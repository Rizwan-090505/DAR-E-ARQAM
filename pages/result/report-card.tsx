import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface MarkRecord {
  subject: string
  total_marks: number
  obtained_marks: number
}

interface ClassData {
  id: number
  name: string
}

interface StudentData {
  studentid: string
  name: string
  fathername: string
}

interface SupabaseMark {
  total_marks: number
  obtained_marks: number
  tests: {
    subject: string
    date: string
  }[]
  students: {
    name: string
    fathername: string
  }[]
}

export default function ReportCardPage() {
  const [classes, setClasses] = useState<ClassData[]>([])
  const [students, setStudents] = useState<StudentData[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [dasNumber, setDasNumber] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [marksData, setMarksData] = useState<MarkRecord[]>([])
  const [studentName, setStudentName] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const gradeFromPercent = (percent: number) => {
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

  const fetchStudents = async (classId: string) => {
    setSelectedStudent('')
    const { data } = await supabase
      .from('students')
      .select('studentid, name, fathername')
      .eq('class_id', classId)
    setStudents(data || [])
  }

  const fetchReport = async () => {
    const sid = dasNumber || selectedStudent
    if (!sid || !startDate || !endDate) return
    setLoading(true)

    const { data: marks, error } = await supabase
      .from('marks')
      .select(`
        total_marks,
        obtained_marks,
        tests(subject, date),
        students(name, fathername)
      `)
      .eq('studentid', sid)
      .gte('tests.date', startDate)
      .lte('tests.date', endDate)

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    if (marks && marks.length > 0) {
      const firstMark = marks[0] as SupabaseMark
      setStudentName(firstMark.students[0]?.name || '')
      setFatherName(firstMark.students[0]?.fathername || '')

      setMarksData(
        (marks as SupabaseMark[]).map((m) => ({
          subject: m.tests[0]?.subject || '',
          total_marks: m.total_marks,
          obtained_marks: m.obtained_marks
        }))
      )

      setGenerated(true)

      // Generate PDF after DOM updates
      setTimeout(() => {
        generatePDFInNewTab()
      }, 500)
    } else {
      setMarksData([])
    }

    setLoading(false)
  }

  const generatePDFInNewTab = async () => {
    const element = document.getElementById('report-card')
    if (!element) return
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

    const pdfBlob = pdf.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
  }

  const totalObtained = marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
  const totalMax = marksData.reduce((acc, m) => acc + m.total_marks, 0)
  const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
  const overallGrade = gradeFromPercent(overallPercent)

  return (
    <div className="p-8 max-w-3xl mx-auto font-sans">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Revue&display=swap');
        .revue-font { font-family: 'Revue', serif; }
      `}</style>

      {!generated && (
        <div className="space-y-4 mb-8">
          <h1 className="text-2xl font-bold text-center mb-4">Generate Report Card</h1>

          <div>
            <label className="block mb-1 font-medium">DAS Number (Optional)</label>
            <Input placeholder="Enter DAS Number" value={dasNumber} onChange={e => setDasNumber(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1 font-medium">Select Class</label>
            <Select onValueChange={(val) => { setSelectedClass(val); fetchStudents(val) }}>
              <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {students.length > 0 && (
            <div>
              <label className="block mb-1 font-medium">Select Student</label>
              <Select onValueChange={(val) => setSelectedStudent(val)}>
                <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.studentid} value={s.studentid}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label>Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>End Date</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>
      )}

      {generated && marksData.length > 0 && (
        <div id="report-card" className="bg-white text-black p-8 border rounded shadow-lg" style={{ minHeight: '29.7cm', width: '21cm', margin: '0 auto' }}>
          <h2 className="text-3xl font-bold text-center mb-1 revue-font">DAR-E-ARQAM SCHOOL</h2>
          <p className="text-center mb-6">Report Card</p>

          <div className="mb-4">
            <p><strong>Name:</strong> {studentName}</p>
            <p><strong>Father Name:</strong> {fatherName}</p>
            <p><strong>DAS Number:</strong> {dasNumber || selectedStudent}</p>
            <p><strong>Date Range:</strong> {startDate} to {endDate}</p>
          </div>

          <table className="w-full border mb-6">
            <thead>
              <tr>
                <th className="border p-2">Subject</th>
                <th className="border p-2">Total Marks</th>
                <th className="border p-2">Obtained Marks</th>
                <th className="border p-2">Percentage</th>
                <th className="border p-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {marksData.map((m, i) => {
                const percent = (m.obtained_marks / m.total_marks) * 100
                return (
                  <tr key={i}>
                    <td className="border p-2">{m.subject}</td>
                    <td className="border p-2">{m.total_marks}</td>
                    <td className="border p-2">{m.obtained_marks}</td>
                    <td className="border p-2">{percent.toFixed(2)}%</td>
                    <td className="border p-2">{gradeFromPercent(percent)}</td>
                  </tr>
                )
              })}
              <tr className="font-bold">
                <td className="border p-2">Overall</td>
                <td className="border p-2">{totalMax}</td>
                <td className="border p-2">{totalObtained}</td>
                <td className="border p-2">{overallPercent.toFixed(2)}%</td>
                <td className="border p-2">{overallGrade}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-10 text-sm text-center">
            <p>This is a software-generated report card and does not require a signature.</p>
            <p>© DAR-E-ARQAM</p>
          </div>
        </div>
      )}
    </div>
  )
}
