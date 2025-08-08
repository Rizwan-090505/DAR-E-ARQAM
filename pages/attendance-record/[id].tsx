import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import Navbar from '../../components/Navbar';
import Loader from '../../components/Loader';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getYear, getMonth, isSameDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../hooks/use-toast';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ArrowLeft } from 'lucide-react';

interface Student {
  studentid: string;
  name: string;
  fathername?: string;
  mobilenumber?: string;
}

interface AttendanceRecord {
  studentid: string;
  date: string;
  status: 'Present' | 'Absent';
  student: Student;
}

export default function AttendanceRecordPage() {
  const [classData, setClassData] = useState<{ name: string; description: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  useEffect(() => {
    if (id) {
      console.log("🔵 ID found:", id);
      fetchClassData();
      fetchStudents();
    }
  }, [id]);

  useEffect(() => {
    if (id && students.length > 0) {
      console.log("🟡 Students loaded, fetching attendance...");
      fetchAttendance();
    }
  }, [id, students, selectedDate]);

  const fetchClassData = async () => {
    console.log("📡 Fetching class data for ID:", id);
    const { data, error } = await supabase
      .from('classes')
      .select('name, description')
      .eq('id', id)
      .single();
    if (error) {
      console.error("❌ Error fetching class data:", error);
    } else {
      console.log("✅ Class data:", data);
      setClassData(data);
    }
  };

  const fetchStudents = async () => {
    console.log("📡 Fetching students for class:", id);
    setIsLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber')
      .eq('class_id', id);
    if (error) {
      console.error("❌ Error fetching students:", error);
    } else {
      console.log("✅ Students fetched:", data);
      setStudents(data || []);
    }
    setIsLoading(false);
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    console.log(`📡 Fetching attendance for class ${id} on ${dateStr}`);

    const { data, error } = await supabase
      .from('attendance')
      .select('studentid, date, status, students(name, fathername, mobilenumber)')
      .eq('class_id', id)
      .eq('date', dateStr);

    if (error) {
      console.error("❌ Attendance fetch error:", error);
      setAttendanceData([]);
    } else if (data && data.length > 0) {
      console.log("✅ Attendance data from DB:", data);
      const mapped = data.map((row: any) => ({
        studentid: row.studentid,
        date: row.date,
        status: row.status,
        student: {
          studentid: row.studentid,
          name: row.students?.name || '',
          fathername: row.students?.fathername || '',
          mobilenumber: row.students?.mobilenumber || ''
        }
      }));
      setAttendanceData(mapped);
    } else {
      console.log("ℹ️ No attendance records found, marking all Present by default.");
      setAttendanceData(
        students.map(s => ({
          studentid: s.studentid,
          date: dateStr,
          status: 'Present',
          student: s
        }))
      );
    }

    setIsLoading(false);
  };

  const markAllPresent = () => {
    console.log("🔄 Marking all students as Present");
    setAttendanceData(prev => prev.map(a => ({ ...a, status: 'Present' })));
  };

  const toggleStatus = (studentid: string) => {
    console.log(`🔄 Toggling status for student: ${studentid}`);
    setAttendanceData(prev =>
      prev.map(a =>
        a.studentid === studentid
          ? { ...a, status: a.status === 'Present' ? 'Absent' : 'Present' }
          : a
      )
    );
  };

  const saveAttendance = async () => {
    try {
      setIsSubmitting(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log("💾 Saving attendance for date:", dateStr);
      console.log("📤 Attendance data to save:", attendanceData);

      // Delete old
      console.log("🗑 Deleting old attendance...");
      let { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', id)
        .eq('date', dateStr);
      if (delErr) throw delErr;
      console.log("✅ Old attendance deleted.");

      // Insert new attendance
      console.log("📥 Inserting new attendance...");
      let { error: attErr } = await supabase
        .from('attendance')
        .insert(
          attendanceData.map(a => ({
            studentid: a.studentid,
            class_id: id,
            date: a.date,
            status: a.status
          }))
        );
      if (attErr) throw attErr;
      console.log("✅ Attendance inserted.");

      // Prepare messages for absentees
      const absentMessages = attendanceData
        .filter(a => a.status === 'Absent')
        .map(a => ({
          student_id: a.studentid,
          class_id: id,
          number: a.student.mobilenumber || '',
          text: `*Mr./Mrs. ${a.student.fathername}*,\n\nKindly be informed that your child *${a.student.name}* is absent on *${format(selectedDate, 'dd-MM-yyyy')}* \n*Best Regards,*\nManagement\nDAR-E-ARQAM SCHOOL `
        }));

      console.log("📤 Messages to insert:", absentMessages);

      if (absentMessages.length > 0) {
        const { error: msgErr } = await supabase
          .from('messages')
          .insert(absentMessages);
        if (msgErr) throw msgErr;
        console.log("✅ Messages inserted into DB.");
      } else {
        console.log("ℹ️ No absent students, no messages inserted.");
      }

      toast({ variant: 'success', title: 'Saved', description: 'Attendance & messages saved.' });
    } catch (error: any) {
      console.error('❌ Error saving attendance/messages:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save.' });
    }
  };

  const renderYearMonthSelector = () => (
    <div className="flex space-x-4 mb-4">
      <Select
        value={getYear(selectedDate).toString()}
        onValueChange={value => setSelectedDate(new Date(parseInt(value), getMonth(selectedDate), 1))}
      >
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select year" /></SelectTrigger>
        <SelectContent>
          {years.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={getMonth(selectedDate).toString()}
        onValueChange={value => setSelectedDate(new Date(getYear(selectedDate), parseInt(value), 1))}
      >
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select month" /></SelectTrigger>
        <SelectContent>
          {months.map((month, index) => <SelectItem key={month} value={index.toString()}>{month}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const renderCalendar = () => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="w-full max-w-sm mx-auto mb-6">
  <div className="mb-2 text-lg font-semibold text-center">
    {format(selectedDate, 'MMMM yyyy')}
  </div>
  <div className="grid grid-cols-7 gap-1 mb-2">
    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
      <div key={day} className="text-center text-sm font-medium text-gray-500">{day}</div>
    ))}
  </div>
  <div className="grid grid-cols-7 gap-1">
    {days.map((day, index) => {
      const isSelected = isSameDay(day, selectedDate);
      const isFirstDay = index === 0;
      const dayOfWeek = day.getDay(); // 0 (Sun) to 6 (Sat)

      const colStartClass = isFirstDay ? `col-start-${dayOfWeek + 1}` : '';

      return (
        <Button
          key={day.toString()}
          variant={isSelected ? 'default' : 'outline'}
          className={`h-8 w-8 p-0 ${colStartClass}`}
          onClick={() => {
            console.log("📅 Date selected:", day);
            setSelectedDate(day);
          }}
        >
          {format(day, 'd')}
        </Button>
      );
    })}
  </div>
</div>

    );
  };

  if (isLoading) return <Loader />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto p-8">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: classData?.name || 'Class', href: `/class/${id}` },
            { label: 'Attendance', href: `/attendance-record/${id}` },
          ]}
        />
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <h1 className="text-3xl font-bold mb-4">{classData?.name}</h1>
        <p className="text-muted-foreground mb-6">{classData?.description}</p>

        {renderYearMonthSelector()}
        {renderCalendar()}

        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Attendance for {format(selectedDate, 'dd-MM-yyyy')}</CardTitle>
            <Button variant="secondary" onClick={markAllPresent}>Mark All Present</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Father Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map(a => (
                  <TableRow key={a.studentid}>
                    <TableCell>{a.student.name}</TableCell>
                    <TableCell>{a.student.fathername}</TableCell>
                    <TableCell>
                      <Badge
                        variant={a.status === 'Present' ? 'success' : 'destructive'}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(a.studentid)}
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              {isSubmitting?<p>Submitting</p>:<Button onClick={saveAttendance}>Save Attendance</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
