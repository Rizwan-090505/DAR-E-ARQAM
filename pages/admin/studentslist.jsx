"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "../../utils/supabaseClient"
import Navbar from "../../components/Navbar"
import Loader from "../../components/Loader"
import { Button } from "../../components/ui/button"
import {
  Download, FileText, FileSpreadsheet, Filter,
  CheckSquare, Square, Layers, Medal, Users, Settings2,
  GraduationCap, TableProperties, Sparkles
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { motion, AnimatePresence } from "framer-motion"

const AVAILABLE_COLUMNS = [
  { key: "studentid", label: "Student ID" },
  { key: "name", label: "Name" },
  { key: "fathername", label: "Father Name" },
  { key: "class_name", label: "Class" },
  { key: "gender", label: "Gender" },
  { key: "mobilenumber", label: "Mobile Number" },
  { key: "dob", label: "Date of Birth" },
  { key: "joining_date", label: "Joining Date" },
  { key: "address", label: "Address" },
  { key: "monthly_fee", label: "Monthly Fee" },
  { key: "Clear", label: "Clear Status" },
]

export default function ReportGeneratorPage() {
  const { toast } = useToast()

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedClassId, setSelectedClassId] = useState("all")
  const [isAwardSheet, setIsAwardSheet] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState([
    "studentid", "name", "fathername", "mobilenumber"
  ])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name")
      .order("id", { ascending: true })

    const { data: studentData, error: studentError } = await supabase
      .from("active_students")
      .select("*")
      .order("name", { ascending: true })

    if (classError || studentError) {
      toast({ title: "Failed to fetch data", variant: "destructive" })
    } else {
      setClasses(classData || [])
      const mappedStudents = (studentData || []).map(student => {
        const studentClass = classData?.find(c => c.id === student.class_id)
        return {
          ...student,
          class_name: studentClass ? studentClass.name : "Unknown",
          // Normalize fee: coerce to string so it never shows as empty
          mothly_fee: student.mothly_fee != null ? String(student.mothly_fee) : "",
          Clear: student.Clear === true || student.Clear === "true" ? "Yes" : "No"
        }
      })
      setStudents(mappedStudents)
    }
    setLoading(false)
  }

  const handleAwardSheetToggle = () => {
    const newState = !isAwardSheet
    setIsAwardSheet(newState)
    if (newState) {
      setSelectedColumns(["studentid", "name", "fathername"])
    }
  }

  const toggleColumn = (colKey) => {
    if (isAwardSheet) return
    setSelectedColumns(prev =>
      prev.includes(colKey)
        ? prev.filter(k => k !== colKey)
        : [...prev, colKey]
    )
  }

  const filteredStudents = useMemo(() => {
    if (selectedClassId === "all") return students
    return students.filter(s => s.class_id.toString() === selectedClassId)
  }, [students, selectedClassId])

  const activeColumns = useMemo(() => {
    return AVAILABLE_COLUMNS.filter(col => selectedColumns.includes(col.key))
  }, [selectedColumns])

  // --- EXPORTS ---

  const exportCSV = () => {
    if (filteredStudents.length === 0) {
      return toast({ title: "No data to export", variant: "destructive" })
    }

    const headers = activeColumns.map(col => col.label).join(",")
    const rows = filteredStudents.map(student =>
      activeColumns.map(col => `"${String(student[col.key] ?? "").replace(/"/g, '""')}"`).join(",")
    )

    const csvContent = [headers, ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `Data_Export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({ title: "CSV Exported Successfully! 📊" })
  }

  const exportPDF = () => {
    if (filteredStudents.length === 0) {
      return toast({ title: "No data to export", variant: "destructive" })
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    const targetClasses = selectedClassId === "all"
      ? classes.filter(c => filteredStudents.some(s => s.class_id === c.id))
      : classes.filter(c => c.id.toString() === selectedClassId)

    let isFirstPage = true

    targetClasses.forEach((cls) => {
      const classStudents = filteredStudents.filter(s => s.class_id === cls.id)
      if (classStudents.length === 0) return

      if (!isFirstPage) doc.addPage()
      isFirstPage = false

      let currentY = 15

      if (isAwardSheet) {
        doc.setFontSize(16)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(20)
        doc.text("AWARD SHEET", doc.internal.pageSize.width / 2, currentY, { align: "center" })
        currentY += 8
      }

      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(60)
      doc.text(`Class: ${cls.name}`, 14, currentY)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Total Students: ${classStudents.length}`, doc.internal.pageSize.width - 14, currentY, { align: "right" })
      currentY += 6

      let head = []
      let body = []
      let columnStyles = {}

      if (isAwardSheet) {
        head = [["Sr#", "ID", "Name", "Father Name", "      ", "      ", "      ", "      ", "      ", "      "]]
        body = classStudents.map((s, idx) => [
          idx + 1,
          s.studentid || "-",
          s.name || "-",
          s.fathername || "-",
          "", "", "", "", "", ""
        ])
        const emptyColIndices = [4, 5, 6, 7, 8, 9]
        emptyColIndices.forEach(colIdx => {
          columnStyles[colIdx] = { minCellWidth: 15, halign: 'center' }
        })
        columnStyles[0] = { minCellWidth: 8, halign: 'center' }
      } else {
        head = [["Sr#", ...activeColumns.map(col => col.label)]]
        body = classStudents.map((student, idx) => [
          idx + 1,
          // FIX: use ?? "" so numeric 0 and falsy numbers aren't replaced by "-"
          ...activeColumns.map(col => {
            const val = student[col.key]
            return val != null && val !== "" ? String(val) : "-"
          })
        ])
        columnStyles[0] = { minCellWidth: 8, halign: 'center' }
      }

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [240, 245, 250], textColor: 20, fontStyle: 'bold', lineColor: [200, 200, 200], lineWidth: 0.1 },
        bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.1 },
        styles: { fontSize: 9, cellPadding: 3, textColor: 40 },
        columnStyles: columnStyles,
      })
    })

    doc.save(`${isAwardSheet ? 'Award_Sheet' : 'Class_Report'}_${new Date().toISOString().split('T')[0]}.pdf`)
    toast({ title: "PDF Generated Successfully! 📄" })
  }

  const totalStudentCount = filteredStudents.length
  const selectedClass = classes.find(c => c.id.toString() === selectedClassId)

  return (
    <>
      <Navbar />

      <div className="min-h-screen transition-colors duration-300 bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* --- HEADER --- */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Report Generator</h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1">
                Configure and download student reports or printable award sheets.
              </p>
            </div>

            {!loading && totalStudentCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-100 dark:border-blue-800/50">
                <Users className="w-4 h-4" />
                {totalStudentCount} Student{totalStudentCount !== 1 ? "s" : ""}{selectedClass ? ` · ${selectedClass.name}` : " · All Classes"}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader /></div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-xl">

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* --- LEFT: SETTINGS --- */}
                <div className="md:col-span-5 space-y-6">

                  {/* Target Class */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5" /> Target Class
                    </label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10 dark:text-white"
                    >
                      <option value="all">All Classes (Combined)</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Report Format Toggle */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                      <Medal className="w-3.5 h-3.5" /> Report Format
                    </label>
                    <button
                      onClick={handleAwardSheetToggle}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${
                        isAwardSheet
                          ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-300 shadow-sm"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-transparent dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Printable Award Sheet
                      </span>
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${isAwardSheet ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                        {isAwardSheet && <CheckSquare className="w-3 h-3" />}
                      </div>
                    </button>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      {isAwardSheet
                        ? "Locks columns to ID/Name and adds blank grid spaces for entering marks."
                        : "Standard report. Select custom columns to include from the panel on the right."}
                    </p>
                  </div>

                  {/* Export Actions */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                      <Download className="w-3.5 h-3.5" /> Export
                    </label>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={exportPDF}
                        disabled={selectedColumns.length === 0 || filteredStudents.length === 0}
                        className="h-10 text-sm bg-blue-600 hover:bg-blue-700 text-white w-full justify-start px-4"
                      >
                        <FileText className="w-4 h-4 mr-2" /> Download PDF Report
                      </Button>
                      <Button
                        onClick={exportCSV}
                        disabled={selectedColumns.length === 0 || filteredStudents.length === 0 || isAwardSheet}
                        variant="outline"
                        className="h-10 text-sm bg-white border-gray-200 dark:bg-transparent dark:border-white/10 dark:text-slate-300 w-full justify-start px-4"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
                      </Button>
                    </div>
                  </div>

                </div>

                {/* --- RIGHT: COLUMN PICKER --- */}
                <div className="md:col-span-7 md:border-l md:border-gray-100 dark:md:border-white/5 md:pl-6">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <TableProperties className="w-3.5 h-3.5" /> Data Columns
                    </label>
                    <span className="text-[10px] bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-slate-400 px-2 py-0.5 rounded font-semibold uppercase">
                      {isAwardSheet ? "Locked" : `${selectedColumns.length} Selected`}
                    </span>
                  </div>

                  <div className={`grid grid-cols-2 gap-2 transition-opacity ${isAwardSheet ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    {AVAILABLE_COLUMNS.map(col => {
                      const isSelected = selectedColumns.includes(col.key)
                      return (
                        <button
                          key={col.key}
                          onClick={() => toggleColumn(col.key)}
                          disabled={isAwardSheet}
                          className={`flex items-center gap-2 p-2.5 rounded-lg text-sm transition-colors text-left border ${
                            isSelected
                              ? "bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/60 dark:text-blue-300 font-medium"
                              : "bg-transparent border-gray-100 text-gray-600 hover:border-gray-300 dark:border-white/5 dark:text-slate-400 dark:hover:border-white/20 dark:hover:bg-white/[0.03]"
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                          )}
                          <span className="truncate">{col.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Live summary strip */}
                  {!isAwardSheet && activeColumns.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
                      <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-1.5">Columns in report</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeColumns.map(col => (
                          <span key={col.key} className="text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded font-medium">
                            {col.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* --- PREVIEW TABLE --- */}
              {filteredStudents.length > 0 && !isAwardSheet && activeColumns.length > 0 && (
                <div className="border-t border-gray-100 dark:border-white/5">
                  <div className="px-5 sm:px-6 py-3 flex items-center gap-2 bg-gray-50/70 dark:bg-white/[0.02]">
                    <Settings2 className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      Preview — first 5 rows
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/5 text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 pl-5 w-8 text-center">#</th>
                          {activeColumns.map(col => (
                            <th key={col.key} className="py-2.5 px-3">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filteredStudents.slice(0, 5).map((student, idx) => (
                          <tr key={student.studentid || idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-2.5 pl-5 text-center text-gray-400 dark:text-slate-600">{idx + 1}</td>
                            {activeColumns.map(col => (
                              <td key={col.key} className="py-2.5 px-3 text-gray-700 dark:text-slate-300 truncate max-w-[160px]">
                                {student[col.key] != null && student[col.key] !== "" ? student[col.key] : <span className="text-gray-300 dark:text-slate-600">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredStudents.length > 5 && (
                      <p className="text-center text-xs text-gray-400 dark:text-slate-600 py-2">
                        +{filteredStudents.length - 5} more rows in export
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </>
  )
}
