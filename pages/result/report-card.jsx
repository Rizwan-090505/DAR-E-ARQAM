import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Image from 'next/image'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import logo from "../../public/logo-1.png"

export default function ReportCardPage() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [dasNumber, setDasNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [marksData, setMarksData] = useState([])
  const [studentName, setStudentName] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

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

  const fetchStudents = async (classId) => {
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
        tests:test_id(test_name, date),
        students:studentid(name, fathername)
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
      const firstMark = marks[0]
      setStudentName(firstMark.students?.name || 'Unknown')
      setFatherName(firstMark.students?.fathername || 'Unknown')

      setMarksData(
        marks.map((m) => ({
          subject: m.tests?.test_name || '',
          total_marks: m.total_marks,
          obtained_marks: m.obtained_marks
        }))
      )

      setGenerated(true)
    } else {
      setMarksData([])
    }

    setLoading(false)
  }

  const totalObtained = marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
  const totalMax = marksData.reduce((acc, m) => acc + m.total_marks, 0)
  const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
  const overallGrade = gradeFromPercent(overallPercent)

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 5mm !important;
        }
        html, body {
          margin: 0; padding: 0; height: 100%; background: white;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
          font-family: 'Inter', sans-serif;
          color: black;
          text-align: center;
          line-height: 1.25;
        }
        #report-card {
          width: 190mm;
          max-height: 277mm;
          margin: auto;
          padding: 10mm 15mm 8mm 15mm;
          box-sizing: border-box;
          background: white;
          color: black;
          page-break-inside: avoid;
          border: 1px solid #bbb;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .logo-container {
          text-align: center;
          margin-bottom: 4px;
          page-break-inside: avoid;
          page-break-after: avoid;
        }
        .logo-container img {
          width: 180px;
          height: auto;
          margin: 0 auto;
          display: block;
        }
        .title {
          font-size: 26px;
          font-weight: 900;
          margin: 4px 0 10px 0;
          letter-spacing: 1.2px;
          color: #222;
          page-break-after: avoid;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px 16px;
          font-size: 13px;
          margin-bottom: 12px;
          font-weight: 600;
          color: #333;
          text-align: center;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          font-size: 12.5px;
          margin: 0 auto 6px auto;
          page-break-inside: avoid;
          text-align: center;
        }
        th, td {
          border: 1px solid #666;
          padding: 5px 6px;
          vertical-align: middle;
          font-weight: 600;
          color: #111827;
        }
        th {
          background: #1e40af;
          color: white;
          font-weight: 700;
          font-size: 13px;
        }
        td:first-child {
          font-weight: 700;
          color: #1e40af;
        }
        tr:last-child td {
          font-weight: 800;
          background: #bfdbfe;
          font-size: 13px;
          color: #1e3a8a;
        }
        .footer-text {
          font-size: 11px;
          color: #666;
          margin-top: 12px;
          font-weight: 500;
          letter-spacing: 0.6px;
        }
        /* Hide inputs and buttons on print */
        @media print {
          button, input, select, label {
            display: none !important;
          }
        }
      `}</style>

      <div className="p-8 max-w-4xl mx-auto font-sans">
        {!generated && (
          <div className="space-y-4 mb-8">
            <h1 className="text-3xl font-bold text-center mb-4">Generate Report Card</h1>

            <div>
              <label className="block mb-1 font-medium">DAS Number (Optional)</label>
              <Input
                placeholder="Enter DAS Number"
                value={dasNumber}
                onChange={e => setDasNumber(e.target.value)}
              />
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
          <section id="report-card" role="region" aria-label="Student Report Card">
            <div className="logo-container">
              <Image src={logo} alt="DAR-E-ARQAM Logo" />
            </div>

            <p className="title">Report Card</p>

            <div className="info-grid">
              <p><strong>Name:</strong> {studentName}</p>
              <p><strong>Father Name:</strong> {fatherName}</p>
              <p><strong>DAS Number:</strong> {dasNumber || selectedStudent}</p>
              <p><strong>Date Range:</strong> {startDate} to {endDate}</p>
            </div>

            <table aria-describedby="report-summary" role="table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Total Marks</th>
                  <th scope="col">Obtained Marks</th>
                  <th scope="col">Percentage</th>
                  <th scope="col">Grade</th>
                </tr>
              </thead>
              <tbody>
                {marksData.slice(0, 8).map((m, i) => { /* limit to 8 rows */
                  const percent = (m.obtained_marks / m.total_marks) * 100
                  return (
                    <tr key={i}>
                      <td>{m.subject}</td>
                      <td>{m.total_marks}</td>
                      <td>{m.obtained_marks}</td>
                      <td>{percent.toFixed(2)}%</td>
                      <td>{gradeFromPercent(percent)}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td>Overall</td>
                  <td>{totalMax}</td>
                  <td>{totalObtained}</td>
                  <td>{overallPercent.toFixed(2)}%</td>
                  <td>{overallGrade}</td>
                </tr>
              </tbody>
            </table>

            <div
              className="footer-text"
              id="report-summary"
            >
              <p>This is a software-generated report card and does not require a signature.</p>
              <p>© DAR-E-ARQAM</p>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
