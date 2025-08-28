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
          tests!inner(test_name, date)
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
    margin: 12mm !important;
  }

  html, body {
    margin: 0; padding: 0; height: 100%; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-family: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    color: #111;
  }

  #report-wrapper {
    padding: 18px 0;
  }

  #report-card {
    width: 100%;
    max-width: 180mm;
    margin: 0 auto;
    padding: 18mm;
    box-sizing: border-box;
    background: #ffffff;
    color: #111;
    border: 1px solid #cfcfcf;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    min-height: 245mm;
    page-break-inside: avoid;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .logo-container {
    display: block;
    margin: 0 auto 8px auto;
  }
  .logo-container img {
    width: 270px; /* 1.5x original ~180px */
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
  }
  .school-name {
    font-size: 26px;
    font-weight: 900;
    margin: 4px 0;
    color: #0b2a66;
  }
  .school-sub {
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 10px;
  }

  .title {
    font-size: 30px;
    font-weight: 900;
    margin: 10px 0 14px;
    color: #111827;
    text-align: center;
    page-break-after: avoid;
  }

  /* Info grid (student details) */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 20px;
    font-size: 16px;
    margin-bottom: 18px;
    font-weight: 700;
    color: #222;
    page-break-inside: avoid;
    justify-items: start;
  }
  .info-grid p {
    margin: 0;
  }
  .info-grid p strong {
    display: inline-block;
    width: 120px;
    font-weight: 800;
    color: #0b2a66;
  }

  .date-range { display: none !important; } /* Hide date range completely */

  /* Table styling */
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 16px;
    margin: 8px 0 14px;
    page-break-inside: avoid;
    text-align: center;
  }
  thead th {
    background: #1e40af;
    color: #fff;
    padding: 10px 8px;
    font-weight: 800;
    font-size: 16px;
    border: 1px solid #1541a1;
  }
  tbody td {
    border: 1px solid #c4c4c4;
    padding: 10px 8px;
    font-weight: 700;
    color: #111827;
  }
  tbody tr:nth-child(even) td { background: #fbfdff; }
  tbody tr:last-child td {
    background: #dbeafe;
    font-weight: 900;
    color: #0b3a8a;
  }

  /* Remarks */
  .remarks-box {
    width: 100%;
    min-height: 64px;
    border-radius: 8px;
    border: 1px dashed #cfcfcf;
    padding: 12px;
    margin-top: 14px;
    text-align: left;
    font-size: 15px;
    color: #222;
    page-break-inside: avoid;
  }
      /* Force page break after each result card */
  .report-card {
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: always;
  }
  .report-card:last-child {
    page-break-after: auto;
  }

  .remarks-title { font-weight: 800; margin-bottom: 6px; }

  /* Footer */
  .footer-row {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    page-break-inside: avoid;
    font-size: 15px;
  }
  .printed-on { color: #444; font-weight: 600; }
  .footer-text { color: #666; font-weight: 600; text-align: right; }

  /* Small screen adjustments */
  @media (max-width: 900px) {
    #report-card { padding: 16px; min-height: auto; }
    .info-grid { grid-template-columns: 1fr; }
    .footer-row { flex-direction: column; align-items: flex-start; gap: 6px; }
  }

  /* Print view */
  @media print {
    button, input, select, label {
      display: none !important;
    }
    body { background: #fff; }
    #report-card { box-shadow: none; border-radius: 0; margin: 0; padding: 14mm; }
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
                      {marksData.map((m, i) => {
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
