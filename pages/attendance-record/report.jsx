"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../../components/ui/badge";
import Navbar from "../../components/Navbar";
import Loader from "../../components/Loader";
import Breadcrumbs from "../../components/Breadcrumbs";
import { ArrowLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function AttendanceReportPage() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [reportData, setReportData] = useState([]);
  const [overallPercentage, setOverallPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // fetch all classes on load
  useEffect(() => {
    const fetchClasses = async () => {
      const { data, error } = await supabase.from("classes").select("id, name");
      if (error) {
        console.error("❌ Error fetching classes:", error);
        toast({ variant: "destructive", title: "Error", description: error.message });
      } else {
        setClasses(data || []);
      }
    };
    fetchClasses();
  }, []);

  const fetchReport = async () => {
    if (!selectedClassId) {
      toast({ variant: "destructive", title: "Pick class", description: "Please select a class first." });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("attendance")
        .select("studentid, status, date, students(name, fathername, mobilenumber)")
        .eq("class_id", selectedClassId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;

      const map = new Map();
      (data || []).forEach((row) => {
        if (!map.has(row.studentid)) {
          map.set(row.studentid, {
            studentid: row.studentid,
            name: row.students?.name || "",
            fathername: row.students?.fathername || "",
            mobilenumber: row.students?.mobilenumber || "",
            present: 0,
            absent: 0,
            percentage: 0,
          });
        }
        const rec = map.get(row.studentid);
        if (row.status === "Present") rec.present += 1;
        else rec.absent += 1;
      });

      let totalPresent = 0;
      let totalRecords = 0;

      const aggregated = Array.from(map.values()).map((s) => {
        const total = s.present + s.absent;
        s.percentage = total > 0 ? ((s.present / total) * 100).toFixed(1) : 0;

        totalPresent += s.present;
        totalRecords += total;

        return s;
      });

      aggregated.sort((a, b) => b.percentage - a.percentage);

      const overall = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0;

      setReportData(aggregated);
      setOverallPercentage(overall);

      toast({
        variant: "success",
        title: "Report ready",
        description: `${aggregated.length} students included.`,
      });
    } catch (err) {
      console.error("❌ Report fetch error:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const getColorVariant = (percentage) => {
    if (percentage >= 90) return "success";
    if (percentage >= 70) return "warning";
    return "destructive";
  };

  const sendReports = async () => {
    if (reportData.length === 0) {
      toast({ title: "Nothing to send", description: "Generate the report first." });
      return;
    }

    const messages = reportData
      .filter((s) => (s.mobilenumber || "").trim() !== "")
      .map((s) => ({
        student_id: s.studentid,
        class_id: selectedClassId,
        number: s.mobilenumber,
        text: `Dear Mr./Mrs. ${s.fathername},\n\nHere is the attendance summary for your child *${s.name}* between *${startDate}* and *${endDate}*:\n\n✅ Presents: ${s.present}\n❌ Absents: ${s.absent}\n📊 Attendance: ${s.percentage}%\n\nWe encourage regular attendance as it plays a vital role in your child’s learning journey.\n\nWarm regards,\nDAR-E-ARQAM SCHOOL`,
      }));

    if (messages.length === 0) {
      toast({ title: "No phone numbers", description: "No valid parent numbers found to send." });
      return;
    }

    try {
      setIsSending(true);
      const { error } = await supabase.from("messages").insert(messages);
      if (error) throw error;
      toast({
        variant: "success",
        title: "Queued for sending",
        description: `${messages.length} report message(s) added to outbox.`,
      });
    } catch (err) {
      console.error("❌ Sending error:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Attendance", href: "/attendance" },
            { label: "Report", href: "#" },
          ]}
        />

        <div className="flex items-center gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Attendance Report</h1>
        </div>

        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm mb-1 block">Class</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm mb-1 block">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="text-sm mb-1 block">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchReport} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader /> : "Generate Report"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {reportData.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                Report ({format(new Date(startDate), "dd MMM yyyy")} →{" "}
                {format(new Date(endDate), "dd MMM yyyy")})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Father Name</TableHead>
                    <TableHead>Presents</TableHead>
                    <TableHead>Absents</TableHead>
                    <TableHead>Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((s) => (
                    <TableRow key={s.studentid}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.fathername}</TableCell>
                      <TableCell>
                        <Badge variant="success">{s.present}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{s.absent}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getColorVariant(s.percentage)}>{s.percentage}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-between items-center">
                <p className="text-lg font-semibold">
                  📊 Overall Class Attendance:{" "}
                  <span className={overallPercentage >= 90 ? "text-green-600" : overallPercentage >= 70 ? "text-yellow-600" : "text-red-600"}>
                    {overallPercentage}%
                  </span>
                </p>
                <Button onClick={sendReports} disabled={isSending}>
                  {isSending ? <Loader /> : "Send Report to Parents"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
