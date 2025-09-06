import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import Image from 'next/image'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import logo from "../../public/logo-1.png"
import Navbar from '../../components/Navbar'

export default function ClassResultPage() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [studentsResults, setStudentsResults] = useState([])
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

    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber')
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

    const results = []
    for (const student of studentsData) {
      const { data: marks } = await supabase
        .from('marks')
        .select(`
          total_marks,
          obtained_marks,
          tests!inner(test_name, date)
        `)
        .eq('studentid', student.studentid)
        .gte('tests.date', startDate)
        .lte('tests.date', endDate)

      if (marks && marks.length > 0) {
        results.push({
          studentName: student.name,
          fatherName: student.fathername,
          mobilenumber: student.mobilenumber,
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

  const sendAllResults = async () => {
  if (studentsResults.length === 0) {
    alert("⚠️ No results to send")
    return
  }

  const messages = studentsResults.map(student => {
    const totalObtained = student.marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
    const totalMax = student.marksData.reduce((acc, m) => acc + m.total_marks, 0)
    const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
    const overallGrade = gradeFromPercent(overallPercent)

    // 🔹 Build subject-wise breakdown
    const subjectsText = student.marksData
      .map(m => {
        const percent = (m.obtained_marks / m.total_marks) * 100
        const grade = gradeFromPercent(percent)
        return `📘 ${m.subject}: ${m.obtained_marks}/${m.total_marks} (${percent.toFixed(1)}%, ${grade})`
      })
      .join("\n")

    const body = `📊 Report Card\n\n Name: ${student.studentName}\n Father: ${student.fatherName}\n${subjectsText}\n\n Total: ${totalObtained}/${totalMax}\n Percentage: ${overallPercent.toFixed(2)}%\n Grade: ${overallGrade}\n\n Regards, \n Management \n DAR-E-ARQAM`

    return { 
      number: student.mobilenumber, 
      text: body, 
      sent: false, 
      student_id: student.studentid, 
      class_id: selectedClass 
    }
  })

  const { error } = await supabase.from('messages').insert(messages)

  if (error) {
    console.error(error)
    alert("❌ Failed to queue class results")
  } else {
    alert("✅ All results queued for WhatsApp")
  }
}


  return (
    <>
      <style>{`
  @media print {
    .page-break { page-break-after: always; }
    .no-print { display: none; }
    body { -webkit-print-color-adjust: exact; }
  }

  .report-card {
    border: 2px solid #444;
    border-radius: 8px;
    padding: 16px;
    margin: 12px auto;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    max-width: 800px;
    height: 950px; /* lock to A4 */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    page-break-inside: avoid;
    overflow: hidden;
    position: relative;
  }

  .logo-container {
    text-align: center;
    margin-bottom: 4px;
  }
  .logo-container img {
    width: 180px;
    height: auto;
    margin:auto;
    margin-bottom: 18px;
  }

  .urdu-text {
    font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Noto Naskh Arabic", serif;
    direction: rtl;
    unicode-bidi: isolate;
    font-size: 15px;
    margin: 0;
  }

  .title {
    font-size: 20px;
    font-weight: bold;
    text-align: center;
    margin: 6px 0;
    color: #222;
  }

  .student-info {
    font-size: 14px;
    margin: 4px 0;
    line-height: 1.3;
  }
.report-card table {
  border-collapse: collapse; /* avoids extra gaps */
}

.report-card th,
.report-card td {
  height: 30px;          /* fixed row height in px */
  padding: 0 4px;        /* no vertical padding */
  line-height: 30px;     /* matches height for vertical centering */
  font-size: 16px;
  border: 5px solid #bbb;
  text-align: center;
  white-space: nowrap;   /* prevent wrapping which increases height */
  overflow: hidden;      /* clip if text is too long */
}

  .report-card th {
    background: #bbb;
    font-weight: bold;
  }

  .footer-text {
    position: absolute;
    bottom: 8px; /* always at bottom */
    left: 0;
    right: 0;
    text-align: center;
    font-size: 12px;
    color: #555;
    margin: 0;
    padding-top: 4px;
  }
`}</style>






      <Navbar />

      <div className="p-6">
        <div className="controls no-print mb-6">
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
          <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />

          <label htmlFor="end-date">End Date</label>
          <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />

          <Button onClick={fetchClassResults} disabled={loading || !selectedClass || !startDate || !endDate}>
            {loading ? 'Loading...' : 'Generate Class Results'}
          </Button>

          {generated && studentsResults.length > 0 && (
            <>
              <Button className="ml-2" onClick={() => window.print()}>
                🖨 Print All
              </Button>
              <Button className="ml-2" onClick={sendAllResults}>
                📲 Send All Results to WA
              </Button>
            </>
          )}
        </div>

        {generated && studentsResults.length === 0 && (
          <p className="text-center font-semibold mt-6">
            No results found for this class and date range.
          </p>
        )}

        {generated && studentsResults.length > 0 && (
          studentsResults.map((student) => {
            const totalObtained = student.marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
            const totalMax = student.marksData.reduce((acc, m) => acc + m.total_marks, 0)
            const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
            const overallGrade = gradeFromPercent(overallPercent)

            return (
              <section key={student.dasNumber} className="report-card page-break">
                <div className="logo-container">
                  <Image src={logo} alt="DAR-E-ARQAM Logo" />
                  <p className="urdu-text ">تعلیم، تہذیب ساتھ ساتھ</p>
                </div>

                <p className="title">📑 Report Card</p>

                <div className="text-lg mb-4">
                  <p><strong>Name:</strong> {student.studentName}</p>
                  <p><strong>Father Name:</strong> {student.fatherName}</p>
                  <p><strong>DAS Number:</strong> {student.dasNumber}</p>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Total Marks</th>
                      <th>Obtained Marks</th>
                      <th>Percentage</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.marksData.map((m, i) => {
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
                      <td><strong>Overall</strong></td>
                      <td>{totalMax}</td>
                      <td>{totalObtained}</td>
                      <td>{overallPercent.toFixed(2)}%</td>
                      <td>{overallGrade}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="footer-text">
                  <p>This is a software-generated report card and does not require a signature.</p>
                  <p>© DAR-E-ARQAM</p>
                </div>
              </section>
            )
          })
        )}
      </div>
    </>
  )
}
