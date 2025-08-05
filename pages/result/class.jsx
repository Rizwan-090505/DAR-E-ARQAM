"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export default function ResultCard() {
  const [results, setResults] = useState({});
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const gradeFromPercent = (percent) => {
    if (percent >= 90) return "A+";
    if (percent >= 80) return "A";
    if (percent >= 70) return "B";
    if (percent >= 60) return "C";
    if (percent >= 50) return "D";
    if (percent >= 33) return "E";
    return "F";
  };

  useEffect(() => {
    async function fetchClasses() {
      const { data, error } = await supabase.from("classes").select("id, name");
      if (!error) setClasses(data);
    }
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass && startDate && endDate) fetchResults();
  }, [selectedClass, startDate, endDate]);

  const fetchResults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marks")
      .select(`
        studentid,
        total_marks,
        obtained_marks,
        students(studentid, name, fathername),
        tests(test_name, date)
      `)
      .eq("class_id", selectedClass)
      .gte("tests.date", startDate)
      .lte("tests.date", endDate);

    if (error) {
      console.error("Error fetching:", error);
      setLoading(false);
      return;
    }

    // Group by studentid
    const grouped = {};
    data.forEach((m) => {
      const sid = m.studentid;
      if (!grouped[sid]) {
        grouped[sid] = {
          studentid: sid,
          name: m.students?.name || "-",
          fathername: m.students?.fathername || "-",
          tests: [],
        };
      }
      grouped[sid].tests.push({
        subject: m.tests?.test_name || "-",
        date: m.tests?.date || "-",
        total: m.total_marks,
        obtained: m.obtained_marks,
        percent: (m.obtained_marks / m.total_marks) * 100,
        grade: gradeFromPercent((m.obtained_marks / m.total_marks) * 100),
      });
    });

    setResults(grouped);
    setLoading(false);
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const studentIds = Object.keys(results);

    for (let i = 0; i < studentIds.length; i++) {
      const id = studentIds[i];
      const element = document.getElementById(`report-${id}`);
      if (!element) continue;
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      if (i !== 0) doc.addPage();
      doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    }

    doc.save("class-results.pdf");
  };

  return (
    <div className="p-4 max-w-5xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">Generate Class Report Cards</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label>Select Class</label>
          <select
            className="w-full border p-2 rounded"
            onChange={(e) => setSelectedClass(e.target.value)}
            value={selectedClass}
          >
            <option value="">-- Choose Class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <Button onClick={generatePDF} disabled={loading || !Object.keys(results).length}>
        {loading ? "Loading..." : "Download All as PDF"}
      </Button>

      {!loading && Object.keys(results).length > 0 && (
        <>
          {Object.entries(results).map(([sid, student]) => {
            const totalMax = student.tests.reduce((acc, t) => acc + t.total, 0);
            const totalObtained = student.tests.reduce((acc, t) => acc + t.obtained, 0);
            const overallPercent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
            const overallGrade = gradeFromPercent(overallPercent);

            return (
              <div
                key={sid}
                id={`report-${sid}`}
                className="bg-white text-black p-8 border rounded shadow-lg mt-8"
                style={{ minHeight: "29.7cm", width: "21cm", margin: "0 auto" }}
              >
                <h2 className="text-3xl font-bold text-center mb-1">DAR-E-ARQAM SCHOOL</h2>
                <p className="text-center mb-6">Report Card</p>

                <div className="mb-4">
                  <p><strong>Name:</strong> {student.name}</p>
                  <p><strong>Father Name:</strong> {student.fathername}</p>
                  <p><strong>DAS Number:</strong> {student.studentid}</p>
                  <p><strong>Date Range:</strong> {startDate} to {endDate}</p>
                </div>

                <table className="w-full border mb-6">
                  <thead>
                    <tr>
                      <th className="border p-2">Subject</th>
                      <th className="border p-2">Total Marks</th>
                      <th className="border p-2">Obtained</th>
                      <th className="border p-2">%</th>
                      <th className="border p-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.tests.map((t, i) => (
                      <tr key={i}>
                        <td className="border p-2">{t.subject}</td>
                        <td className="border p-2">{t.total}</td>
                        <td className="border p-2">{t.obtained}</td>
                        <td className="border p-2">{t.percent.toFixed(2)}%</td>
                        <td className="border p-2">{t.grade}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="border p-2">Overall</td>
                      <td className="border p-2">{totalMax}</td>
                      <td className="border p-2">{totalObtained}</td>
                      <td className="border p-2">{overallPercent.toFixed(2)}%</td>
                      <td className="border p-2">{overallGrade}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-sm text-center mt-10">
                  <p>This is a software-generated report card and does not require a signature.</p>
                  <p>© DAR-E-ARQAM</p>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
