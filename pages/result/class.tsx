import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface ClassData {
  id: number
  name: string
}

interface StudentData {
  studentid: string
  name: string
  fathername: string
}

interface MarkRecord {
  studentid: string
  total_marks: number
  obtained_marks: number
  tests: {
    subject: string
    date: string
  }
}

export default function ClassResultsPage() {
  const [classes, setClasses] = useState<ClassData[]>([])
  const [students, setStudents] = useState<StudentData[]>([])
  const [marksData, setMarksData] = useState<MarkRecord[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)

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
    supabase
      .from('classes')
      .select('id, name')
      .then(({ data }) => setClasses(data || []))
  }, [])

  const fetchClassResults = async () => {
    if (!selectedClass || !startDate || !endDate) return
    setLoading(true)

    const { data: studentList } = await supabase
      .from('students')
      .select('studentid, name, fathername')
      .eq('class_id', selectedClass)

    setStudents(studentList || [])

    const { data: marks } = await supabase
      .from('marks')
      .select(`
        studentid,
        total_marks,
        obtained_marks,
        tests(subject, date)
      `)
      .eq('tests.class_id', selectedClass)
      .gte('tests.date', startDate)
      .lte('tests.date', endDate)

    setMarksData((marks as MarkRecord[]) || [])
    setGenerated(true)

    setTimeout(() => {
      generatePDFInNewTab()
    }, 500)

    setLoading(false)
  }

  const generatePDFInNewTab = async () => {
    const element = document.getElementById('class-results')
    if (!element) return
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const getStudentResults = (studentid: string) => {
    const studentMarks = marksData.filter(m => m.studentid === studentid)
    const totalObtained = studentMarks.reduce((acc, m) => acc + m.obtained_marks, 0)
    const totalMax = studentMarks.reduce((acc, m) => acc + m.total_marks, 0)
    const percent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
    const grade = gradeFromPercent(percent)
    return { totalObtained, totalMax, percent, grade }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">Generate Class Results</h1>

      {!generated && (
        <div className="space-y-4 mb-8">
          <div>
            <label className="block mb-1 font-medium">Select Class</label>
            <Select onValueChange={(val) => setSelectedClass(val)}>
              <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label>Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>End Date</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <Button onClick={fetchClassResults} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Results'}
          </Button>
        </div>
      )}

      {generated && (
        <div id="class-results" className="bg-white p-8 border rounded shadow-lg" style={{ minWidth: '21cm' }}>
          <h2 className="text-2xl font-bold text-center mb-4">DAR-E-ARQAM SCHOOL</h2>
          <p className="text-center mb-6">Class Results ({startDate} - {endDate})</p>

          <table className="w-full border">
            <thead>
              <tr>
                <th className="border p-2">Student ID</th>
                <th className="border p-2">Name</th>
                <th className="border p-2">Father Name</th>
                <th className="border p-2">Total Marks</th>
                <th className="border p-2">Obtained Marks</th>
                <th className="border p-2">Percentage</th>
                <th className="border p-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const result = getStudentResults(s.studentid)
                return (
                  <tr key={s.studentid}>
                    <td className="border p-2">{s.studentid}</td>
                    <td className="border p-2">{s.name}</td>
                    <td className="border p-2">{s.fathername}</td>
                    <td className="border p-2">{result.totalMax}</td>
                    <td className="border p-2">{result.totalObtained}</td>
                    <td className="border p-2">{result.percent.toFixed(2)}%</td>
                    <td className="border p-2">{result.grade}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mt-6 text-center text-sm">
            <p>This is a software-generated class result.</p>
            <p>© DAR-E-ARQAM</p>
          </div>
        </div>
      )}
    </div>
  )
}
