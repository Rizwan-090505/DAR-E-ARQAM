import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import Navbar from '../../components/Navbar'

export default function ClassResultPage() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [studentsResults, setStudentsResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [subjects, setSubjects] = useState([]);
  const [subjectAverages, setSubjectAverages] = useState({});
  const [gradeCounts, setGradeCounts] = useState({ 'A+': 0, 'A': 0, 'B': 0 });
  
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
    setSubjects([])
    setSubjectAverages({})
    setGradeCounts({ 'A+': 0, 'A': 0, 'B': 0 });

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

    const allSubjects = new Set();
    const allStudentData = [];

    for (const student of studentsData) {
      const { data: marks } = await supabase
        .from('marks')
        .select(`
          total_marks,
          obtained_marks,
          tests!inner(test_name)
        `)
        .eq('studentid', student.studentid)
        .gte('tests.date', startDate)
        .lte('tests.date', endDate)

      if (marks && marks.length > 0) {
        let totalObtained = 0;
        let totalMax = 0;
        const studentMarksMap = new Map();

        marks.forEach(m => {
          const subject = m.tests?.test_name || '';
          allSubjects.add(subject);

          if (!studentMarksMap.has(subject)) {
            studentMarksMap.set(subject, { obtained_marks: 0, total_marks: 0 });
          }
          const currentMarks = studentMarksMap.get(subject);
          currentMarks.obtained_marks += m.obtained_marks;
          currentMarks.total_marks += m.total_marks;
        });

        // Convert the map back to an array for rendering
        const studentMarksData = Array.from(studentMarksMap.entries()).map(([subject, data]) => ({
          subject,
          ...data
        }));

        totalObtained = studentMarksData.reduce((acc, m) => acc + m.obtained_marks, 0);
        totalMax = studentMarksData.reduce((acc, m) => acc + m.total_marks, 0);

        const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
        const overallGrade = gradeFromPercent(overallPercent);

        allStudentData.push({
          studentName: student.name,
          fatherName: student.fathername,
          mobilenumber: student.mobilenumber,
          dasNumber: student.studentid,
          marksData: studentMarksData,
          overallPercent,
          overallGrade
        });
      }
    }
    
    // Sort students by overall percentage in descending order
    allStudentData.sort((a, b) => b.overallPercent - a.overallPercent);
    const studentsWithPosition = allStudentData.map((student, index) => ({
      ...student,
      position: index + 1
    }));
    setStudentsResults(studentsWithPosition);

    // Calculate subject-wise average percentages
    const subjectTotals = {};
    studentsWithPosition.forEach(student => {
      student.marksData.forEach(mark => {
        if (!subjectTotals[mark.subject]) {
          subjectTotals[mark.subject] = { totalObtained: 0, totalMax: 0, studentCount: 0 };
        }
        subjectTotals[mark.subject].totalObtained += mark.obtained_marks;
        subjectTotals[mark.subject].totalMax += mark.total_marks;
        subjectTotals[mark.subject].studentCount++;
      });
    });

    const calculatedAverages = {};
    for (const subject in subjectTotals) {
      if (subjectTotals[subject].totalMax > 0) {
        const average = (subjectTotals[subject].totalObtained / subjectTotals[subject].totalMax) * 100;
        calculatedAverages[subject] = average.toFixed(2);
      } else {
        calculatedAverages[subject] = 0;
      }
    }
    setSubjectAverages(calculatedAverages);

    // Count grades
    const counts = { 'A+': 0, 'A': 0, 'B': 0 };
    studentsWithPosition.forEach(student => {
      if (student.overallGrade === 'A+') counts['A+']++;
      if (student.overallGrade === 'A') counts['A']++;
      if (student.overallGrade === 'B') counts['B']++;
    });
    setGradeCounts(counts);

    // Convert set to array and sort alphabetically for consistent column order
    setSubjects(Array.from(allSubjects).sort());
    setGenerated(true)
    setLoading(false)
  }
  
  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    if (studentsResults.length === 0) return;

    // Create the header row
    let header = "Name of Student,Student ID,Position";
    subjects.forEach(subject => {
      header += `,"${subject} - Marks","${subject} - Percentage","${subject} - Grade"`;
    });
    header += ",\"Overall Percentage\",\"Overall Grade\"\n";

    // Create the data rows
    const rows = studentsResults.map(student => {
      const marksMap = new Map(student.marksData.map(m => [m.subject, m]));
      let row = `"${student.studentName}","${student.dasNumber}",${student.position}`;

      subjects.forEach(subject => {
        const mark = marksMap.get(subject);
        const obtained = mark?.obtained_marks;
        const total = mark?.total_marks;
        const percent = (obtained !== undefined) ? (obtained / total) * 100 : undefined;
        const grade = (percent !== undefined) ? gradeFromPercent(percent) : '-';
        
        row += `,"${obtained !== undefined ? obtained : '-'}","${percent !== undefined ? `${percent.toFixed(1)}%` : '-'}","${grade}"`;
      });

      row += `,"${student.overallPercent.toFixed(2)}%","${student.overallGrade}"`;
      return row;
    }).join('\n');

    const csvContent = header + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'class_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <style>{`
        /* Forces the print dialog to use landscape mode */
        @page { size: A4 landscape; }
        @media print {
          body { font-size: 9px; }
          .no-print { display: none; }
          .print-table { table-layout: fixed; width: 100%; }
          .print-table th, .print-table td { 
            font-size: 9px; 
            padding: 2px 4px; 
            border: 1px solid #ddd;
            overflow-wrap: break-word; /* Prevents text overflow */
            word-wrap: break-word;
          }
          .print-col-id { width: 5%; }
          .print-col-name { width: 15%; }
          .print-col-pos { width: 5%; }
          .print-col-marks { width: 5%; }
          .print-col-percent { width: 5%; }
          .print-col-grade { width: 5%; }
          .print-col-overall { width: 10%; }
        }
        .highlight-f {
          background-color: #fca5a5 !important;
          color: #7f1d1d !important;
          font-weight: bold;
        }
        .highlight-pos {
          background-color: #fde68a !important;
          color: #92400e !important;
          font-weight: bold;
        }
      `}</style>
      <Navbar />

      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 no-print">
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Class</label>
                <Select
                  onValueChange={(val) => setSelectedClass(val)}
                  value={selectedClass}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <div className="w-full md:w-auto mt-4 md:mt-0 flex gap-2">
            <Button 
              onClick={fetchClassResults} 
              disabled={loading || !selectedClass || !startDate || !endDate}
              className="w-full md:w-auto"
            >
              {loading ? 'Loading...' : 'Generate Class Results'}
            </Button>
            <Button 
              onClick={exportToExcel} 
              disabled={!generated || studentsResults.length === 0}
              className="w-full md:w-auto"
            >
              Save as Excel
            </Button>
            <Button 
              onClick={handlePrint} 
              disabled={!generated || studentsResults.length === 0}
              className="w-full md:w-auto"
            >
              Print Report
            </Button>
          </div>
        </div>
        
        {generated && studentsResults.length === 0 && (
          <p className="text-center font-semibold mt-6 text-gray-800 dark:text-gray-200">
            No results found for this class and date range.
          </p>
        )}

        {generated && studentsResults.length > 0 && (
          <div className="mt-8 rounded-lg shadow-lg">
            {/* Grade Summary and Print Button */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 no-print p-4 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
              <div className="flex gap-4 items-center flex-wrap">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Overall Grade Summary:</h3>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-bold">A+:</span> {gradeCounts['A+']}
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-bold">A:</span> {gradeCounts['A']}
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-bold">B:</span> {gradeCounts['B']}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print-table">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th rowSpan="2" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider print-col-name">Name of Student</th>
                    <th rowSpan="2" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider print-col-id">ID</th>
                    <th rowSpan="2" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider print-col-pos">Pos.</th>
                    {subjects.map(subject => (
                      <th key={subject} colSpan="3" className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-l border-r border-gray-200 dark:border-gray-700">
                        {subject}
                      </th>
                    ))}
                    <th colSpan="2" className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-l border-gray-200 dark:border-gray-700">
                      Overall
                    </th>
                  </tr>
                  <tr>
                    {subjects.map(subject => (
                      <>
                        <td key={`${subject}-obt`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider print-col-marks">Marks</td>
                        <td key={`${subject}-perc`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider print-col-percent">Percent</td>
                        <td key={`${subject}-grade`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 print-col-grade">Grade</td>
                      </>
                    ))}
                    <td className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider print-col-overall">Total %</td>
                    <td className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider print-col-overall">Grade</td>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                  {studentsResults.map(student => {
                    const marksMap = new Map(student.marksData.map(m => [m.subject, m]));
                    const isTopPosition = student.position <= 3;
                    const isOverallF = student.overallGrade === 'F';

                    return (
                      <tr key={student.dasNumber} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{student.studentName}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{student.dasNumber}</td>
                        <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold ${isTopPosition ? 'highlight-pos' : ''}`}>{student.position}</td>
                        
                        {subjects.map(subject => {
                          const mark = marksMap.get(subject);
                          const obtained = mark?.obtained_marks;
                          const total = mark?.total_marks;
                          const percent = (obtained !== undefined) ? (obtained / total) * 100 : undefined;
                          const grade = (percent !== undefined) ? gradeFromPercent(percent) : '-';
                          const isF = grade === 'F';

                          return (
                            <>
                              <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{obtained !== undefined ? obtained : '-'}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{percent !== undefined ? `${percent.toFixed(1)}%` : '-'}</td>
                              <td className={`px-2 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 ${isF ? 'highlight-f' : ''}`}>{grade}</td>
                            </>
                          );
                        })}
                        <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 ${isOverallF ? 'highlight-f' : ''}`}>{student.overallPercent.toFixed(2)}%</td>
                        <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 ${isOverallF ? 'highlight-f' : ''}`}>{student.overallGrade}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Subject-wise average percentages */}
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
                    <td colSpan="3" className="px-3 py-2 text-center text-xs uppercase text-gray-700 dark:text-gray-300">Subject Averages</td>
                    {subjects.map(subject => (
                      <td colSpan="3" key={`avg-${subject}`} className="px-3 py-2 text-center text-sm text-gray-900 dark:text-gray-100 border-l border-r border-gray-200 dark:border-gray-700">
                        {subjectAverages[subject]}%
                      </td>
                    ))}
                    <td colSpan="2" className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
