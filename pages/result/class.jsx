import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Image from 'next/image'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import logo from "../../public/logo-1.png"

export default function ClassResultPage() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [studentsResults, setStudentsResults] = useState([]) // array of {studentName, fatherName, dasNumber, marksData}
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

  const fetchClassResults = async () => {
    if (!selectedClass || !startDate || !endDate) return
    setLoading(true)
    setGenerated(false)
    setStudentsResults([])

    // Fetch students in class
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('studentid, name, fathername')
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

    // For each student, fetch marks within date range
    const results = []

    for (const student of studentsData) {
      const { data: marks, error: marksError } = await supabase
        .from('marks')
        .select(`
          total_marks,
          obtained_marks,
          tests:test_id(test_name, date)
        `)
        .eq('studentid', student.studentid)
        .gte('tests.date', startDate)
        .lte('tests.date', endDate)

      if (marksError) {
        console.error(marksError)
        continue
      }

      if (marks && marks.length > 0) {
        results.push({
          studentName: student.name,
          fatherName: student.fathername,
          dasNumber: student.studentid,
          marksData: marks.map(m => ({
            subject: m.tests?.test_name || '',
            total_marks: m.total_marks,
            obtained_marks: m.obtained_marks
          }))
        })
      }
    }

    setStudentsResults(results)
    setGenerated(true)
    setLoading(false)
  }

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
        #container {
          max-width: 190mm;
          margin: auto;
          padding: 10mm 15mm 8mm 15mm;
          box-sizing: border-box;
        }
        .controls {
          max-width: 600px;
          margin: 0 auto 20px auto;
          text-align: left;
        }
        label {
          font-weight: 600;
          font-size: 14px;
          display: block;
          margin-top: 10px;
          margin-bottom: 4px;
        }
        button {
          margin-top: 15px;
          display: block;
        }
        .report-card {
          width: 100%;
          max-height: 277mm;
          margin: auto;
          padding: 10mm 15mm 8mm 15mm;
          box-sizing: border-box;
          background: white;
          color: black;
          page-break-after: always;
          border: 1px solid #bbb;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          break-inside: avoid;
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
          .controls, button, input, select, label {
            display: none !important;
          }
          .report-card {
            page-break-after: always;
          }
        }
      `}</style>

      <div id="container">
        <div className="controls">
          <label htmlFor="class-select">Select Class</label>
          <Select
            id="class-select"
            onValueChange={(val) => setSelectedClass(val)}
            value={selectedClass}
          >
            <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <label htmlFor="start-date">Start Date</label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />

          <label htmlFor="end-date">End Date</label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />

          <Button onClick={fetchClassResults} disabled={loading || !selectedClass || !startDate || !endDate}>
            {loading ? 'Loading...' : 'Generate Class Results'}
          </Button>
        </div>

        {generated && studentsResults.length === 0 && (
          <p style={{ textAlign: 'center', fontWeight: '600', marginTop: '20px' }}>No results found for this class and date range.</p>
        )}

        {generated && studentsResults.length > 0 && (
          <>
            {studentsResults.map(({ studentName, fatherName, dasNumber, marksData }, index) => {
              const totalObtained = marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
              const totalMax = marksData.reduce((acc, m) => acc + m.total_marks, 0)
              const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
              const overallGrade = gradeFromPercent(overallPercent)

              return (
                <section
                  key={dasNumber}
                  className="report-card"
                  role="region"
                  aria-label={`Report Card for ${studentName}`}
                >
                  <div className="logo-container">
                    <Image src={logo} alt="DAR-E-ARQAM Logo" />
                  </div>

                  <p className="title">Report Card</p>

                  <div className="info-grid">
                    <p><strong>Name:</strong> {studentName}</p>
                    <p><strong>Father Name:</strong> {fatherName}</p>
                    <p><strong>DAS Number:</strong> {dasNumber}</p>
                    <p><strong>Date Range:</strong> {startDate} to {endDate}</p>
                  </div>

                  <table aria-describedby={`report-summary-${dasNumber}`} role="table">
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
                      {marksData.slice(0,8).map((m, i) => {
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
                    id={`report-summary-${dasNumber}`}
                  >
                    <p>This is a software-generated report card and does not require a signature.</p>
                    <p>© DAR-E-ARQAM</p>
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
