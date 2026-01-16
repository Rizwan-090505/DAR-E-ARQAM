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
  Printer, 
  Search, 
  ChevronDown, 
  ChevronUp, 
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
        .select(`total_marks, obtained_marks, tests!inner(test_name)`)
        .eq('studentid', student.studentid)
        .gte('tests.date', startDate)
        .lte('tests.date', endDate);

      if (marks && marks.length > 0) {
        const studentMarksMap = new Map();
        marks.forEach(m => {
          const subject = m.tests?.test_name || '';
          allSubjects.add(subject);
          if (!studentMarksMap.has(subject)) studentMarksMap.set(subject, { obtained_marks: 0, total_marks: 0 });
          const currentMarks = studentMarksMap.get(subject);
          currentMarks.obtained_marks += m.obtained_marks;
          currentMarks.total_marks += m.total_marks;
        });

        const studentMarksData = Array.from(studentMarksMap.entries()).map(([subject, data]) => ({ subject, ...data }));
        const totalObtained = studentMarksData.reduce((acc, m) => acc + m.obtained_marks, 0);
        const totalMax = studentMarksData.reduce((acc, m) => acc + m.total_marks, 0);
        const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

        allStudentData.push({
          studentName: student.name,
          fatherName: student.fathername,
          mobilenumber: student.mobilenumber,
          dasNumber: student.studentid,
          marksData: studentMarksData,
          overallPercent,
          overallGrade: gradeFromPercent(overallPercent)
        });
      }
    }
    
    allStudentData.sort((a, b) => b.overallPercent - a.overallPercent);
    const studentsWithPosition = allStudentData.map((student, index) => ({ ...student, position: index + 1 }));
    setStudentsResults(studentsWithPosition);

    const subjectTotals = {};
    studentsWithPosition.forEach(student => {
      student.marksData.forEach(mark => {
        if (!subjectTotals[mark.subject]) subjectTotals[mark.subject] = { totalObtained: 0, totalMax: 0, studentCount: 0 };
        subjectTotals[mark.subject].totalObtained += mark.obtained_marks;
        subjectTotals[mark.subject].totalMax += mark.total_marks;
        subjectTotals[mark.subject].studentCount++;
      });
    });

    const calculatedAverages = {};
    for (const subject in subjectTotals) {
      if (subjectTotals[subject].totalMax > 0) {
        calculatedAverages[subject] = ((subjectTotals[subject].totalObtained / subjectTotals[subject].totalMax) * 100).toFixed(2);
      } else {
        calculatedAverages[subject] = 0;
      }
    }
    setSubjectAverages(calculatedAverages);

    const counts = { 'A+': 0, 'A': 0, 'B': 0 };
    studentsWithPosition.forEach(student => {
      if (counts[student.overallGrade] !== undefined) counts[student.overallGrade]++;
    });
    setGradeCounts(counts);
    setSubjects(Array.from(allSubjects).sort());
    setGenerated(true);
    setLoading(false);
  };
  
  const handlePrint = () => window.print();

  const exportToExcel = () => {
    if (studentsResults.length === 0) return;
    let header = "Name of Student,Student ID,Position";
    subjects.forEach(subject => header += `,"${subject} - Marks","${subject} - Percentage","${subject} - Grade"`);
    header += ",\"Overall Percentage\",\"Overall Grade\"\n";
    const rows = studentsResults.map(student => {
      const marksMap = new Map(student.marksData.map(m => [m.subject, m]));
      let row = `"${student.studentName}","${student.dasNumber}",${student.position}`;
      subjects.forEach(subject => {
        const mark = marksMap.get(subject);
        const percent = (mark?.total_marks > 0) ? (mark.obtained_marks / mark.total_marks) * 100 : undefined;
        row += `,"${mark?.obtained_marks ?? '-'}","${percent !== undefined ? percent.toFixed(1) + '%' : '-'}","${percent !== undefined ? gradeFromPercent(percent) : '-'}"`;
      });
      row += `,"${student.overallPercent.toFixed(2)}%","${student.overallGrade}"`;
      return row;
    }).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Result_Class_${classes.find(c=>c.id == selectedClass)?.name || 'Report'}.csv`;
    link.click();
  };

  const toggleStudentCard = (id) => setExpandedStudentId(expandedStudentId === id ? null : id);

  return (
    // FIX 1: Gradient changed to Slate 800/900 mix. Removed 'white' bg completely.
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-slate-100 relative overflow-x-hidden selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* AMBIENT GLOWS - Adjusted to Blue/Slate to match new theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none no-print">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-5%] w-[40%] h-[40%] bg-slate-700/10 rounded-full blur-[100px]" />
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 5mm; }
        @media print {
          body { background-color: white !important; color: black !important; }
          .no-print { display: none !important; }
          .glass-panel, .glass-card, .glass-table { 
             background: white !important; 
             border: 1px solid #ccc !important;
             box-shadow: none !important;
             backdrop-filter: none !important;
          }
          .desktop-table-container { display: block !important; }
          .mobile-card-view { display: none !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .print-table th, .print-table td { border: 1px solid #000; padding: 4px; text-align: center; color: black !important; }
          .print-table th { background-color: #f0f0f0 !important; font-weight: bold; }
        }
      `}</style>
      
      <div className="relative z-10">
        <Navbar />

        <main className="container mx-auto p-4 md:p-6 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 no-print">
            <div>
              {/* FIX 2: Text forced to white so it is visible in light mode (since bg is dark) */}
              <h1 className="text-4xl font-bold tracking-tight  drop-shadow-lg flex items-center gap-3">
                <School className="w-10 h-10 text-blue-400" />
                <span className="text-black dark:text-white">
                  Class Results
                </span>
              </h1>
              <p className="text-slate-300/80 mt-2 text-lg font-light">Generate comprehensive grade reports and analytics.</p>
            </div>
          </div>

          {/* CONTROLS CARD - Slate Glass */}
          <div className="glass-panel backdrop-blur-2xl bg-slate-900/40 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/20 mb-10 no-print transition-all hover:bg-slate-900/50 ring-1 ring-white/5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-300 pl-1">Class</label>
                <Select onValueChange={setSelectedClass} value={selectedClass}>
                  <SelectTrigger className="h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm rounded-xl focus:ring-blue-500 transition-all hover:bg-slate-50">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-xl">
                    {classes.map(c => <SelectItem key={c.id} value={String(c.id)} className="cursor-pointer py-3 hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-300 pl-1 flex items-center gap-1">
                   <Calendar className="w-3 h-3" /> Start Date
                </label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="h-12 bg-white border-slate-200 text-slate-900 shadow-sm rounded-xl focus:ring-blue-500 transition-all hover:bg-slate-50 [color-scheme:light]" 
                />
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-slate-300 pl-1 flex items-center gap-1">
                   <Calendar className="w-3 h-3" /> End Date
                </label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="h-12 bg-white border-slate-200 text-slate-900 shadow-sm rounded-xl focus:ring-blue-500 transition-all hover:bg-slate-50 [color-scheme:light]" 
                />
              </div>

              <div className="flex items-end">
                {/* FIX 3: Fixed Button visibility. Replaced 'bg-blue' (invalid) with 'bg-blue-600'. */}
                <Button 
                  onClick={fetchClassResults} 
                  disabled={loading || !selectedClass || !startDate || !endDate}
                  className="h-12 w-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 rounded-xl border border-white/10 font-bold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                     <div className="flex items-center gap-2"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Processing...</div>
                  ) : (
                     <div className="flex items-center gap-2"><Search className="w-4 h-4 text-white" /> Generate Report</div>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          {generated && studentsResults.length > 0 && (
            <div className="space-y-8">
              
              {/* Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 no-print bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg">
                <div className="flex gap-4 text-sm">
                   <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-300 rounded-lg border border-emerald-500/20 shadow-inner">
                      <span className="font-bold text-emerald-200">A+:</span> {gradeCounts['A+']}
                   </div>
                   <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-300 rounded-lg border border-blue-500/20 shadow-inner">
                      <span className="font-bold text-blue-200">A:</span> {gradeCounts['A']}
                   </div>
                   <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-300 rounded-lg border border-amber-500/20 shadow-inner">
                      <span className="font-bold text-amber-200">B:</span> {gradeCounts['B']}
                   </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <Button variant="outline" onClick={exportToExcel} className="flex-1 md:flex-none h-10 border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 backdrop-blur-sm rounded-lg hover:text-white transition-all">
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" /> Excel
                  </Button>
                  <Button variant="outline" onClick={handlePrint} className="flex-1 md:flex-none h-10 border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 backdrop-blur-sm rounded-lg hover:text-white transition-all">
                    <Printer className="w-4 h-4 mr-2 text-blue-400" /> Print
                  </Button>
                </div>
              </div>

              {/* --- MOBILE VIEW: Glass Cards --- */}
              <div className="md:hidden space-y-4 mobile-card-view no-print">
                 <div className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2 text-center">
                   Tap for details
                 </div>
                 {studentsResults.map((student) => {
                   const isExpanded = expandedStudentId === student.dasNumber;
                   const marksMap = new Map(student.marksData.map(m => [m.subject, m]));

                   return (
                     <div key={student.dasNumber} 
                          onClick={() => toggleStudentCard(student.dasNumber)}
                          className={`glass-card relative overflow-hidden backdrop-blur-xl bg-slate-900/40 border rounded-2xl transition-all duration-300 shadow-lg ${
                            isExpanded 
                              ? 'border-blue-500/40 bg-slate-800/60 shadow-blue-900/20 ring-1 ring-blue-500/30' 
                              : 'border-white/10 hover:bg-white/5'
                          }`}
                     >
                        <div className="p-5 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className={`
                                 flex items-center justify-center w-12 h-12 rounded-2xl text-base font-bold shadow-lg
                                 ${student.position === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-950' : 
                                   student.position === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-600 text-slate-900' :
                                   student.position === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950' :
                                   'bg-white/10 text-slate-200 border border-white/10'}
                              `}>
                                 {student.position <= 3 ? <Trophy className="w-5 h-5 drop-shadow-sm" /> : student.position}
                              </div>
                              <div>
                                 {/* FIX 4A: Forced text-white for mobile cards */}
                                 <h3 className="font-bold text-lg text-black dark:text-white tracking-wide">{student.studentName}</h3>
                                 <p className="text-xs text-slate-400 font-mono">#{student.dasNumber}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <div className={`text-xl font-black drop-shadow-sm ${student.overallGrade === 'F' ? 'text-red-400' : 'text-blue-400'}`}>
                                 {student.overallPercent.toFixed(1)}%
                              </div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grade: {student.overallGrade}</div>
                           </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-black/20 border-t border-white/5 p-4 animate-in slide-in-from-top-2">
                             <div className="grid grid-cols-1 gap-2">
                                {subjects.map(subject => {
                                   const mark = marksMap.get(subject);
                                   const grade = (mark?.total_marks > 0) ? gradeFromPercent((mark.obtained_marks / mark.total_marks) * 100) : '-';
                                   return (
                                     <div key={subject} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                                        <span className="font-medium text-slate-200">{subject}</span>
                                        <div className="text-right flex gap-4">
                                           <span className="text-slate-400 font-mono">{mark?.obtained_marks || 0}/{mark?.total_marks || 0}</span>
                                           <span className={`font-mono font-bold w-8 text-right ${grade === 'F' ? 'text-red-400' : 'text-white'}`}>
                                              {grade}
                                           </span>
                                        </div>
                                     </div>
                                   )
                                })}
                             </div>
                          </div>
                        )}
                        
                        <div className="bg-white/5 p-1 flex justify-center border-t border-white/5">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                     </div>
                   );
                 })}
              </div>

              {/* --- DESKTOP VIEW: Premium Glass Table --- */}
              <div className="hidden md:block desktop-table-container relative">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-slate-500/20 via-blue-500/20 to-slate-500/20 rounded-3xl blur-sm opacity-50 pointer-events-none"></div>
                
                <div className="glass-table backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left print-table border-collapse">
                      <thead className="bg-black/20 text-xs uppercase text-slate-300 font-bold tracking-wider">
                        <tr>
                          {/* Sticky Header Background matches Slate Theme */}
                          <th rowSpan="2" className="px-5 py-4 border-r border-white/5 sticky left-0 z-20 bg-slate-900 backdrop-blur-xl text-left shadow-[4px_0_24px_rgba(0,0,0,0.5)]">Student</th>
                          <th rowSpan="2" className="px-4 py-4 text-center border-r border-white/5">Pos.</th>
                          {subjects.map(subject => (
                            <th key={subject} colSpan="3" className="px-2 py-3 text-center border-r border-white/5 last:border-0 text-blue-200">{subject}</th>
                          ))}
                          <th colSpan="2" className="px-2 py-3 text-center bg-blue-500/10 text-blue-200">Overall</th>
                        </tr>
                        <tr className="border-b border-white/10">
                          {subjects.map(subject => (
                            <>
                              <th key={`${subject}-obt`} className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-white/5 w-14">Mrk</th>
                              <th key={`${subject}-perc`} className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-white/5 w-14">%</th>
                              <th key={`${subject}-grd`} className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-white/5 w-12">Grd</th>
                            </>
                          ))}
                          <th className="px-2 py-2 text-center bg-blue-500/10 text-[10px] text-blue-300 border-r border-white/5">%</th>
                          <th className="px-2 py-2 text-center bg-blue-500/10 text-[10px] text-blue-300">Grd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {studentsResults.map((student) => {
                          const marksMap = new Map(student.marksData.map(m => [m.subject, m]));
                          const isFail = student.overallGrade === 'F';

                          return (
                            <tr key={student.dasNumber} className="hover:bg-white/5 transition-colors group relative">
                              {/* FIX 4B: Sticky Column - forced text-white and bg-slate-900 to fix white-on-white issue */}
                              <td className="px-5 py-4 font-medium border-r border-white/5 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold dark:text-white">{student.studentName}</span>
                                  <span className="text-[10px] text-slate-400 font-mono tracking-wide">{student.dasNumber}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center border-r border-white/5">
                                {student.position <= 3 ? (
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow-lg 
                                    ${student.position === 1 ? 'bg-yellow-400 text-black shadow-yellow-400/20' : 
                                      student.position === 2 ? 'bg-slate-300 text-black shadow-slate-400/20' : 
                                      'bg-orange-400 text-black shadow-orange-400/20'}`}>
                                    {student.position}
                                  </span>
                                ) : <span className="text-slate-500 font-mono">{student.position}</span>}
                              </td>
                              {subjects.map(subject => {
                                const mark = marksMap.get(subject);
                                const percent = (mark?.total_marks > 0) ? (mark.obtained_marks / mark.total_marks) * 100 : undefined;
                                const grade = percent !== undefined ? gradeFromPercent(percent) : '-';
                                return (
                                  <>
                                    <td className="px-2 py-3 text-center text-xs text-slate-300/70 border-r border-white/5">{mark?.obtained_marks ?? '-'}</td>
                                    <td className="px-2 py-3 text-center text-xs text-slate-400 border-r border-white/5">{percent ? percent.toFixed(0) : '-'}</td>
                                    <td className={`px-2 py-3 text-center text-xs font-bold border-r border-white/5 ${grade === 'F' ? 'text-red-400 bg-red-500/10' : 'text-slate-200'}`}>{grade}</td>
                                  </>
                                );
                              })}
                              <td className={`px-2 py-3 text-center font-bold text-xs bg-blue-500/5 ${isFail ? 'text-red-400' : 'text-blue-300'}`}>{student.overallPercent.toFixed(1)}%</td>
                              <td className={`px-2 py-3 text-center font-bold text-xs bg-blue-500/5 ${isFail ? 'text-red-400 bg-red-500/10' : 'text-blue-300'}`}>{student.overallGrade}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-black/30 border-t border-white/10 font-bold text-xs text-slate-300">
                        <tr>
                          {/* Footer Sticky matches Slate Theme */}
                          <td colSpan="2" className="px-5 py-4 text-right uppercase tracking-wider border-r border-white/5 sticky left-0 bg-slate-900 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">Class Avg.</td>
                          {subjects.map(subject => <td key={`avg-${subject}`} colSpan="3" className="px-2 py-3 text-center border-r border-white/5 text-slate-500">{subjectAverages[subject]}%</td>)}
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}
          
          {generated && studentsResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/10 rounded-3xl border-dashed backdrop-blur-sm">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4 shadow-inner border border-white/5">
                  <Search className="w-8 h-8 text-slate-400" />
               </div>
               <h3 className="text-xl font-medium text-white">No results found</h3>
               <p className="text-slate-400 max-w-sm mx-auto mt-2 text-center">We couldn't find any marks for this class within the selected date range.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}