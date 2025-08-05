import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function ReportCardPage() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('classes').select('id, name').then(({ data }) => setClasses(data || []))
  }, [])

  const gradeFromPercent = (percent) => {
    if (percent >= 90) return 'A+'
    if (percent >= 80) return 'A'
    if (percent >= 70) return 'B'
    if (percent >= 60) return 'C'
    if (percent >= 50) return 'D'
    if (percent >= 33) return 'E'
    return 'F'
  }

  const fetchAndGenerateAllReports = async () => {
    if (!selectedClass || !startDate || !endDate) return
    setLoading(true)

    const { data: studentList } = await supabase
      .from('students')
      .select('studentid, name, fathername')
      .eq('class_id', selectedClass)

    const pages = []

    for (let student of studentList) {
      const { data: marks } = await supabase
        .from('marks')
        .select(`
          total_marks,
          obtained_marks,
          tests:test_id(test_name, date),
          students:studentid(name, fathername)
        `)
        .eq('studentid', student.studentid)
        .gte('tests.date', startDate)
        .lte('tests.date', endDate)

      if (!marks || marks.length === 0) continue

      const marksData = marks.map(m => ({
        subject: m.tests?.test_name || '',
        total_marks: m.total_marks,
        obtained_marks: m.obtained_marks
      }))

      const totalObtained = marksData.reduce((acc, m) => acc + m.obtained_marks, 0)
      const totalMax = marksData.reduce((acc, m) => acc + m.total_marks, 0)
      const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
      const overallGrade = gradeFromPercent(overallPercent)

      const content = `
        <div style="padding: 30px; width: 794px; height:1123px;">
          <h2 style="text-align: center; font-size: 24px; font-weight: bold;">DAR-E-ARQAM SCHOOL</h2>
          <p style="text-align: center; margin-bottom: 20px;">Report Card</p>
          <p><strong>Name:</strong> ${student.name}</p>
          <p><strong>Father Name:</strong> ${student.fathername}</p>
          <p><strong>DAS Number:</strong> ${student.studentid}</p>
          <p><strong>Date Range:</strong> ${startDate} to ${endDate}</p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr>
                <th style="border: 1px solid #000; padding: 5px;">Subject</th>
                <th style="border: 1px solid #000; padding: 5px;">Total</th>
                <th style="border: 1px solid #000; padding: 5px;">Obtained</th>
                <th style="border: 1px solid #000; padding: 5px;">%</th>
                <th style="border: 1px solid #000; padding: 5px;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${marksData.map(m => {
                const percent = (m.obtained_marks / m.total_marks) * 100
                return `<tr>
                  <td style='border: 1px solid #000; padding: 5px;'>${m.subject}</td>
                  <td style='border: 1px solid #000; padding: 5px;'>${m.total_marks}</td>
                  <td style='border: 1px solid #000; padding: 5px;'>${m.obtained_marks}</td>
                  <td style='border: 1px solid #000; padding: 5px;'>${percent.toFixed(2)}%</td>
                  <td style='border: 1px solid #000; padding: 5px;'>${gradeFromPercent(percent)}</td>
                </tr>`
              }).join('')}
              <tr style="font-weight: bold;">
                <td style='border: 1px solid #000; padding: 5px;'>Overall</td>
                <td style='border: 1px solid #000; padding: 5px;'>${totalMax}</td>
                <td style='border: 1px solid #000; padding: 5px;'>${totalObtained}</td>
                <td style='border: 1px solid #000; padding: 5px;'>${overallPercent.toFixed(2)}%</td>
                <td style='border: 1px solid #000; padding: 5px;'>${overallGrade}</td>
              </tr>
            </tbody>
          </table>

          <p style="margin-top: 20px; font-size: 12px; text-align: center;">This is a software-generated report card and does not require a signature.<br/>© DAR-E-ARQAM</p>
        </div>
      `

      pages.push(content)
    }

    const pdf = new jsPDF('p', 'mm', 'a4')
    for (let i = 0; i < pages.length; i++) {
      const div = document.createElement('div')
      div.innerHTML = pages[i]
      document.body.appendChild(div)
      const canvas = await html2canvas(div, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const imgProps = pdf.getImageProperties(imgData)
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      if (i !== 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297) // A4 in mm
        document.body.removeChild(div)
    }

    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto font-sans">
      <h1 className="text-2xl font-bold text-center mb-6">Generate Report Cards (Batch)</h1>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block mb-1 font-medium">Select Class</label>
          <Select onValueChange={(val) => setSelectedClass(val)}>
            <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
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

        <Button onClick={fetchAndGenerateAllReports} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Report Cards'}
        </Button>
      </div>
    </div>
  )
}