"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { 
  Trophy, 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  User,
  School,
  FileSpreadsheet
} from 'lucide-react';

export default function ClassResultPage() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [studentsResults, setStudentsResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [subjectAverages, setSubjectAverages] = useState({});
  const [gradeCounts, setGradeCounts] = useState({ 'A+': 0, 'A': 0, 'B': 0 });
  
  // Mobile: State to track which student card is expanded
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  const gradeFromPercent = (percent) => {
    if (percent >= 90) return 'A+';
    if (percent >= 80) return 'A';
    if (percent >= 70) return 'B';
    if (percent >= 60) return 'C';
    if (percent >= 50) return 'D';
    if (percent >= 33) return 'E';
    return 'F';
  };

  useEffect(() => {
    supabase.from('classes').select('id, name').then(({ data }) => setClasses(data || []));
  }, []);

  const fetchClassResults = async () => {
    if (!selectedClass || !startDate || !endDate) return;
    setLoading(true);
    setGenerated(false);
    setStudentsResults([]);
    setSubjects([]);
    setSubjectAverages({});
    setGradeCounts({ 'A+': 0, 'A': 0, 'B': 0 });

    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber')
      .eq('class_id', selectedClass);

    if (studentsError) {
      console.error(studentsError);
      setLoading(false);
      return;
    }

    if (!studentsData || studentsData.length === 0) {
      setStudentsResults([]);
      setLoading(false);
      return;
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
        .lte('tests.date', endDate);

      if (marks && marks.length > 0) {
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

        const studentMarksData = Array.from(studentMarksMap.entries()).map(([subject, data]) => ({
          subject,
          ...data
        }));

        const totalObtained = studentMarksData.reduce((acc, m) => acc + m.obtained_marks, 0);
        const totalMax = studentMarksData.reduce((acc, m) => acc + m.total_marks, 0);

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
    setSubjects(Array.from(allSubjects).sort());
    setGenerated(true);
    setLoading(false);
  };
  
  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    if (studentsResults.length === 0) return;

    let header = "Name of Student,Student ID,Position";
    subjects.forEach(subject => {
      header += `,"${subject} - Marks","${subject} - Percentage","${subject} - Grade"`;
    });
    header += ",\"Overall Percentage\",\"Overall Grade\"\n";

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
    link.setAttribute('download', `Result_Class_${classes.find(c=>c.id == selectedClass)?.name || 'Report'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleStudentCard = (id) => {
    setExpandedStudentId(expandedStudentId === id ? null : id);
  };

  return (
    // Main Container: Deep dark background for high contrast with glass elements
    <div className="min-h-screen bg-gray-50 dark:bg-[#020817] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <style>{`
        @page { size: A4 landscape; margin: 5mm; }
        @media print {
          body { background-color: white !important; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .desktop-table-container { display: block !important; }
          .mobile-card-view { display: none !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .print-table th, .print-table td { border: 1px solid #000; padding: 4px; text-align: center; }
          .print-table th { background-color: #f0f0f0 !important; color: black !important; font-weight: bold; }
        }
      `}</style>
      
      <Navbar />

      <main className="container mx-auto p-4 md:p-6 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 no-print">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <School className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              Class Results
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Generate comprehensive grade reports and performance analytics.</p>
          </div>
        </div>

        {/* Controls Card - Glass Effect */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm mb-8 no-print transition-all">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Class</label>
              <Select onValueChange={setSelectedClass} value={selectedClass}>
                <SelectTrigger className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#1e293b] dark:border-white/10 dark:text-gray-100">
                  {classes.map(c => <SelectItem key={c.id} value={String(c.id)} className="focus:bg-gray-100 dark:focus:bg-white/10">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                 <Calendar className="w-3 h-3" /> Start Date
              </label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]" 
              />
            </div>

            <div className="space-y-2">
               <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                 <Calendar className="w-3 h-3" /> End Date
              </label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]" 
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={fetchClassResults} 
                disabled={loading || !selectedClass || !startDate || !endDate}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20"
              >
                {loading ? (
                   <div className="flex items-center gap-2"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Processing...</div>
                ) : (
                   <div className="flex items-center gap-2"><Search className="w-4 h-4" /> Generate Report</div>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Results Area */}
        {generated && studentsResults.length > 0 && (
          <div className="space-y-6">
            
            {/* Actions Toolbar - Glassy */}
            <div className="flex flex-wrap items-center justify-between gap-4 no-print bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-white/5 backdrop-blur-sm">
              <div className="flex gap-4 text-sm">
                 <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-full border border-green-200 dark:border-transparent">
                    <span className="font-bold">A+:</span> {gradeCounts['A+']}
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-transparent">
                    <span className="font-bold">A:</span> {gradeCounts['A']}
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded-full border border-yellow-200 dark:border-transparent">
                    <span className="font-bold">B:</span> {gradeCounts['B']}
                 </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={exportToExcel} className="flex-1 md:flex-none border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 dark:text-gray-200">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" /> Excel
                </Button>
                <Button variant="outline" onClick={handlePrint} className="flex-1 md:flex-none border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 dark:text-gray-200">
                  <Printer className="w-4 h-4 mr-2 text-gray-600 dark:text-gray-300" /> Print
                </Button>
              </div>
            </div>

            {/* --- MOBILE VIEW: Cards --- */}
            <div className="md:hidden space-y-4 mobile-card-view no-print">
               <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 italic text-center">
                 Tap a student to view subject details
               </div>
               {studentsResults.map((student) => {
                 const isExpanded = expandedStudentId === student.dasNumber;
                 const marksMap = new Map(student.marksData.map(m => [m.subject, m]));

                 return (
                   <div key={student.dasNumber} 
                        onClick={() => toggleStudentCard(student.dasNumber)}
                        className={`bg-white dark:bg-white/5 backdrop-blur-xl border rounded-xl overflow-hidden transition-all duration-200 shadow-sm ${
                          isExpanded ? 'border-blue-400 dark:border-blue-500/50 ring-1 ring-blue-400/30' : 'border-gray-200 dark:border-white/10'
                        }`}
                   >
                      <div className="p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className={`
                               flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-inner
                               ${student.position === 1 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                                 student.position === 2 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                                 student.position === 3 ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'}
                            `}>
                               {student.position <= 3 ? <Trophy className="w-4 h-4" /> : student.position}
                            </div>
                            <div>
                               <h3 className="font-semibold text-gray-900 dark:text-gray-100">{student.studentName}</h3>
                               <p className="text-xs text-gray-500 dark:text-gray-400">ID: {student.dasNumber}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className={`text-lg font-bold ${student.overallGrade === 'F' ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                               {student.overallPercent.toFixed(1)}%
                            </div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-500">Grade: {student.overallGrade}</div>
                         </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-gray-50 dark:bg-[#000000]/30 border-t border-gray-100 dark:border-white/5 p-4">
                           <div className="grid grid-cols-1 gap-2">
                              {subjects.map(subject => {
                                 const mark = marksMap.get(subject);
                                 const obtained = mark?.obtained_marks || 0;
                                 const total = mark?.total_marks || 0;
                                 const percent = total > 0 ? (obtained / total) * 100 : 0;
                                 const grade = total > 0 ? gradeFromPercent(percent) : '-';
                                 
                                 return (
                                   <div key={subject} className="flex justify-between items-center text-sm py-2 border-b border-gray-200/50 dark:border-white/5 last:border-0">
                                      <span className="font-medium text-gray-600 dark:text-gray-300">{subject}</span>
                                      <div className="text-right flex gap-3">
                                         <span className="text-gray-500 dark:text-gray-400">{obtained}/{total}</span>
                                         <span className={`font-mono w-12 text-right ${grade === 'F' ? 'text-red-500 font-bold' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {grade}
                                         </span>
                                      </div>
                                   </div>
                                 )
                              })}
                           </div>
                        </div>
                      )}
                      
                      <div className="bg-gray-50/50 dark:bg-white/5 p-1 flex justify-center border-t border-gray-100 dark:border-white/5">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500"/> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                      </div>
                   </div>
                 );
               })}
            </div>


            {/* --- DESKTOP VIEW: Table --- */}
            <div className="hidden md:block desktop-table-container bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left print-table">
                  <thead className="bg-gray-50 dark:bg-white/5 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                    <tr>
                      {/* Sticky Header Fix: Dark mode background set to #111a2d to simulate the glass effect visually while remaining opaque */}
                      <th rowSpan="2" className="px-4 py-3 border-r border-gray-200 dark:border-white/10 sticky left-0 z-10 bg-gray-50 dark:bg-[#111a2d]">Student</th>
                      <th rowSpan="2" className="px-4 py-3 text-center border-r border-gray-200 dark:border-white/10">Pos.</th>
                      {subjects.map(subject => (
                        <th key={subject} colSpan="3" className="px-2 py-2 text-center border-r border-gray-200 dark:border-white/10 last:border-0">
                          {subject}
                        </th>
                      ))}
                      <th colSpan="2" className="px-2 py-2 text-center bg-blue-50/30 dark:bg-blue-900/20">Overall</th>
                    </tr>
                    <tr>
                      {subjects.map(subject => (
                        <>
                          <th key={`${subject}-obt`} className="px-2 py-2 text-center font-medium border-b border-gray-200 dark:border-white/10 text-[10px] tracking-wider w-12">Mrk</th>
                          <th key={`${subject}-perc`} className="px-2 py-2 text-center font-medium border-b border-gray-200 dark:border-white/10 text-[10px] tracking-wider w-12">%</th>
                          <th key={`${subject}-grd`} className="px-2 py-2 text-center font-medium border-b border-r border-gray-200 dark:border-white/10 text-[10px] tracking-wider w-10">Grd</th>
                        </>
                      ))}
                      <th className="px-2 py-2 text-center border-b border-gray-200 dark:border-white/10 bg-blue-50/30 dark:bg-blue-900/20 text-[10px]">%</th>
                      <th className="px-2 py-2 text-center border-b border-gray-200 dark:border-white/10 bg-blue-50/30 dark:bg-blue-900/20 text-[10px]">Grd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-gray-300">
                    {studentsResults.map((student) => {
                      const marksMap = new Map(student.marksData.map(m => [m.subject, m]));
                      const isTop3 = student.position <= 3;
                      const isFail = student.overallGrade === 'F';

                      return (
                        <tr key={student.dasNumber} className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group">
                          {/* Sticky Column Body Fix: Matches table header bg strategy */}
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-white/5 sticky left-0 bg-white dark:bg-[#020817] group-hover:dark:bg-[#111a2d] z-10 transition-colors">
                            <div className="flex flex-col">
                              <span>{student.studentName}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">{student.dasNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center border-r border-gray-100 dark:border-white/5">
                            {isTop3 ? (
                              <span className={`
                                inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                ${student.position === 1 ? 'bg-yellow-100 text-yellow-700' : 
                                  student.position === 2 ? 'bg-gray-200 text-gray-700' : 
                                  'bg-orange-100 text-orange-800'}
                              `}>
                                {student.position}
                              </span>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-500">{student.position}</span>
                            )}
                          </td>
                          {subjects.map(subject => {
                            const mark = marksMap.get(subject);
                            const obtained = mark?.obtained_marks;
                            const total = mark?.total_marks;
                            const percent = (obtained !== undefined) ? (obtained / total) * 100 : undefined;
                            const grade = (percent !== undefined) ? gradeFromPercent(percent) : '-';
                            const gradeIsF = grade === 'F';

                            return (
                              <>
                                <td className="px-2 py-3 text-center text-xs text-gray-600 dark:text-gray-400">{obtained ?? '-'}</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-500 dark:text-gray-500">{percent ? percent.toFixed(0) : '-'}</td>
                                <td className={`px-2 py-3 text-center text-xs font-medium border-r border-gray-100 dark:border-white/5 ${gradeIsF ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {grade}
                                </td>
                              </>
                            );
                          })}
                          <td className={`px-2 py-3 text-center font-bold text-xs bg-blue-50/10 dark:bg-blue-900/10 ${isFail ? 'text-red-600' : 'text-blue-700 dark:text-blue-300'}`}>
                            {student.overallPercent.toFixed(1)}%
                          </td>
                          <td className={`px-2 py-3 text-center font-bold text-xs bg-blue-50/10 dark:bg-blue-900/10 ${isFail ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-blue-700 dark:text-blue-300'}`}>
                            {student.overallGrade}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer - Subject Averages */}
                  <tfoot className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 font-semibold text-xs text-gray-700 dark:text-gray-300">
                    <tr>
                      <td colSpan="2" className="px-4 py-3 text-right uppercase tracking-wider border-r border-gray-200 dark:border-white/10 sticky left-0 bg-gray-50 dark:bg-[#111a2d]">Class Avg.</td>
                      {subjects.map(subject => (
                         <td key={`avg-${subject}`} colSpan="3" className="px-2 py-3 text-center border-r border-gray-200 dark:border-white/10">
                            {subjectAverages[subject]}%
                         </td>
                      ))}
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>
        )}
        
        {/* Empty State */}
        {generated && studentsResults.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl border-dashed">
             <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 mb-4">
                <Search className="w-6 h-6 text-gray-400 dark:text-gray-400" />
             </div>
             <h3 className="text-lg font-medium text-gray-900 dark:text-white">No results found</h3>
             <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
               We couldn't find any marks for this class within the selected date range. Try adjusting your dates.
             </p>
          </div>
        )}
      </main>
    </div>
  );
}