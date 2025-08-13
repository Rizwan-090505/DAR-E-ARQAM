import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Image from 'next/image'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import logo from "../../public/logo-1.png"

export default function ReportCardPage() {
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [dasNumber, setDasNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [marksData, setMarksData] = useState<any[]>([])
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
    setGenerated(false)
    setMarksData([])
    setStudentName('')
    setFatherName('')

    try {
      // 1) Fetch student details
      const { data: studentRow, error: studentError } = await supabase
        .from('students')
        .select('name, fathername, studentid')
        .eq('studentid', sid)
        .maybeSingle()

      if (studentError || !studentRow) {
        setStudentName('Unknown')
        setFatherName('Unknown')
      } else {
        setStudentName(studentRow.name || 'Unknown')
        setFatherName(studentRow.fathername || 'Unknown')
      }

      // 2) Fetch marks (inner join to tests, filtered by date)
      const { data: marks, error } = await supabase
        .from('marks')
        .select(`
          total_marks,
          obtained_marks,
          tests!inner(test_name, date)
        `)
        .eq('studentid', sid)
        .gte('tests.date', startDate)
        .lte('tests.date', endDate)

      if (error) {
        console.error('Marks fetch error', error)
        setLoading(false)
        return
      }

      if (marks && marks.length > 0) {
        setMarksData(
          marks.map((m: any) => ({
            subject: m.tests?.test_name || '',
            total_marks: m.total_marks,
            obtained_marks: m.obtained_marks
          }))
        )
        setGenerated(true)
      } else {
        setMarksData([])
        setGenerated(true) // still show generated (no rows) state
      }
    } catch (err) {
      console.error('Unexpected error fetching report', err)
    } finally {
      setLoading(false)
    }
  }

  const totalObtained = marksData.reduce((acc, m) => acc + (m.obtained_marks || 0), 0)
  const totalMax = marksData.reduce((acc, m) => acc + (m.total_marks || 0), 0)
  const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
  const overallGrade = gradeFromPercent(overallPercent)

  // printed on text (use current datetime)
  const printedOn = new Date().toLocaleString('en-GB', { hour12: false })

  return (
    <>
      <style>{`
        /* Print setup: use modest page margin so the card occupies most of the page */
        @page {
          size: A4 portrait;
          margin: 12mm !important;
        }

        /* Base */
        html, body {
          margin: 0; padding: 0; height: 100%; background: #fff;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
          font-family: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          color: #111;
        }

        /* Container that holds the preview/print card.
           Use a max-width close to A4 content area and center it horizontally.
           Increase min-height so the card visually occupies more of the printed page. */
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
          min-height: 245mm; /* fill most of A4 (297mm) minus margins */
          page-break-inside: avoid;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }

        /* Header */
        .header {
          text-align: center;
          margin-bottom: 8px;
          page-break-inside: avoid;
        }
        .logo-container {
          display: block;
          margin: 0 auto 6px auto;
        }
        .school-name {
          font-size: 22px;
          font-weight: 900;
          margin: 2px 0;
          color: #0b2a66;
        }
        .school-sub {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .title {
          font-size: 28px;
          font-weight: 900;
          margin: 6px 0 10px;
          color: #111827;
          page-break-after: avoid;
        }

        /* Info grid (student details) */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 18px;
          font-size: 15px;
          margin-bottom: 14px;
          font-weight: 700;
          color: #222;
          page-break-inside: avoid;
        }

        .info-grid p { margin: 0; text-align: left; }
        .info-grid p strong { display: inline-block; width: 110px; font-weight: 800; }

        /* Hide the date range when printing (user request) but show on screen */
        .date-range { display: block; }
        @media print {
          .date-range { display: none !important; }
        }

        /* Table styling: more official — solid header band, clear rows */
        table {
          border-collapse: collapse;
          width: 100%;
          font-size: 15px;
          margin: 6px 0 12px;
          page-break-inside: avoid;
        }
        thead th {
          background: #1e40af;
          color: #fff;
          padding: 10px 8px;
          font-weight: 800;
          font-size: 15px;
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

        /* Remarks box - rounded with subtle border */
        .remarks-box {
          width: 100%;
          min-height: 64px;
          border-radius: 8px;
          border: 1px dashed #cfcfcf;
          padding: 12px;
          margin-top: 14px;
          text-align: left;
          font-size: 14px;
          color: #222;
          page-break-inside: avoid;
        }
        .remarks-title { font-weight: 800; margin-bottom: 6px; }

        /* Footer row: place at bottom of the card */
        .footer-row {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          page-break-inside: avoid;
        }
        .printed-on { font-size: 13px; color: #444; font-weight: 600; }
        .footer-text { font-size: 13px; color: #666; font-weight: 600; text-align: right; }

        /* small screen preview adjustments (no effect on print) */
        @media (max-width: 900px) {
          #report-card { padding: 16px; min-height: auto; }
          .info-grid { grid-template-columns: 1fr; }
          .footer-row { flex-direction: column; align-items: flex-start; gap: 6px; }
        }

        /* Hide controls on print */
        @media print {
          button, input, select, label {
            display: none !important;
          }
          body { background: #fff; }
          #report-card { box-shadow: none; border-radius: 0; margin: 0; padding: 14mm; }
        }
      `}</style>

      <div id="report-wrapper" className="p-4">
        {!generated && (
          <div style={{ maxWidth: 720, margin: '0 auto 18px' }}>
            <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 12 }}>Generate Report Card</h1>

            <div style={{ marginBottom: 10 }}>
              <label className="block mb-1 font-medium">DAS Number (Optional)</label>
              <Input
                placeholder="Enter DAS Number"
                value={dasNumber}
                onChange={e => setDasNumber(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="block mb-1 font-medium">Select Class</label>
              <Select onValueChange={(val) => { setSelectedClass(val); fetchStudents(val) }}>
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {students.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <label className="block mb-1 font-medium">Select Student</label>
                <Select onValueChange={(val) => setSelectedStudent(val)}>
                  <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s: any) => (
                      <SelectItem key={s.studentid} value={s.studentid}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label>Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>

            <Button onClick={fetchReport} disabled={loading}>
              {loading ? 'Loading...' : 'Generate'}
            </Button>
          </div>
        )}

        {generated && marksData.length === 0 && (
          <p style={{ textAlign: 'center', fontWeight: 700, marginTop: 20, fontSize: 15 }}>
            No marks found for this student and date range.
          </p>
        )}

        {generated && marksData.length > 0 && (
          <section id="report-card" role="region" aria-label="Student Report Card">
            <div className="header">
              <div className="logo-container">
                
              </div>
              <Image className="logo-container" src={logo} alt="DAR-E-ARQAM Logo" width={200} height={200} />
             <div className="school-sub">تعلیم، تہذیب ساتھ ساتھ</div>
              <p className="title">Report Card</p>
            </div>

            <div className="info-grid" aria-hidden={false}>
              <p><strong>Name:</strong> <span style={{ fontWeight: 700 }}>{studentName}</span></p>
              <p><strong>Father Name:</strong> <span style={{ fontWeight: 700 }}>{fatherName}</span></p>
              <p><strong>DAS Number:</strong> <span style={{ fontWeight: 700 }}>{dasNumber || selectedStudent}</span></p>
              <p className="date-range"><strong>Date Range:</strong> <span style={{ fontWeight: 700 }}>{startDate} to {endDate}</span></p>
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
                {marksData.map((m: any, i: number) => {
                  const percent = m.total_marks ? (m.obtained_marks / m.total_marks) * 100 : 0
                  return (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', paddingLeft: 12 }}>{m.subject}</td>
                      <td>{m.total_marks}</td>
                      <td>{m.obtained_marks}</td>
                      <td>{percent.toFixed(2)}%</td>
                      <td>{gradeFromPercent(percent)}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td style={{ textAlign: 'left', paddingLeft: 12 }}>Overall</td>
                  <td>{totalMax}</td>
                  <td>{totalObtained}</td>
                  <td>{overallPercent.toFixed(2)}%</td>
                  <td>{overallGrade}</td>
                </tr>
              </tbody>
            </table>


            <div className="footer-row" aria-hidden={false}>
              <div className="printed-on">Printed on: {printedOn}</div>
              <div className="footer-text" id="report-summary">
                <div>This is a software-generated report card and does not require a signature.</div>
                <div>© DAR-E-ARQAM</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
