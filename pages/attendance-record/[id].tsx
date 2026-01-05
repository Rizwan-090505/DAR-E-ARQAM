import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import Navbar from '../../components/Navbar';
import Loader from '../../components/Loader';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getYear, getMonth, isSameDay, getDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../hooks/use-toast';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface Student {
  studentid: string;
  name: string;
  fathername?: string;
  mobilenumber?: string;
}

interface AttendanceRecord {
  studentid: string;
  date: string;
  status: 'Present' | 'Absent' | 'Unmarked';
  student: Student;
}

export default function AttendanceRecordPage() {
  const [classData, setClassData] = useState<{ name: string; description: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendAbsenteeMessages, setSendAbsenteeMessages] = useState(true);
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
      fetchClassData();
      fetchStudents();
    }
  }, [id]);

  useEffect(() => {
    if (id && students.length > 0) {
      fetchAttendance();
    }
  }, [id, students, selectedDate]);

  const fetchClassData = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('name, description')
      .eq('id', id)
      .single();
    if (error) {
      console.error("Error fetching class data:", error);
    } else {
      setClassData(data);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber')
      .eq('class_id', id);
    if (error) {
      console.error("Error fetching students:", error);
    } else {
      setStudents(data || []);
    }
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('attendance')
      .select('studentid, date, status, students(name, fathername, mobilenumber)')
      .eq('class_id', id)
      .eq('date', dateStr);

    if (error) {
      console.error("Attendance fetch error:", error);
      setAttendanceData([]);
    } else if (data && data.length > 0) {
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
      setAttendanceData(
        students.map(s => ({
          studentid: s.studentid,
          date: dateStr,
          status: 'Unmarked',
          student: s
        }))
      );
    }
    setIsLoading(false);
  };

  const markAllPresent = () => {
    setAttendanceData(prev => prev.map(a => ({ ...a, status: 'Present' })));
  };

  const toggleStatus = (studentid: string) => {
    setAttendanceData(prev =>
      prev.map(a =>
        a.studentid === studentid
          ? { 
              ...a, 
              status: a.status === 'Present' ? 'Absent' : 'Present' 
            }
          : a
      )
    );
  };

  const saveAttendance = async () => {
    const hasUnmarked = attendanceData.some(a => a.status === 'Unmarked');
    if (hasUnmarked) {
      toast({ 
        variant: 'destructive', 
        title: 'Incomplete Attendance', 
        description: 'Please mark attendance (Present/Absent) for all students before saving.' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', id)
        .eq('date', dateStr);
      if (delErr) throw delErr;

      const { error: attErr } = await supabase
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

      if (sendAbsenteeMessages) {
        const absentMessages = attendanceData
          .filter(a => a.status === 'Absent' && a.student.mobilenumber)
          .map(a => ({
            student_id: a.studentid,
            class_id: id,
            number: a.student.mobilenumber,
            text: `*Mr./Mrs. ${a.student.fathername}*,\n\nKindly be informed that your child *${a.student.name}* is absent on *${format(selectedDate, 'dd-MM-yyyy')}*. \n*Best Regards,*\nManagement\nDAR-E-ARQAM SCHOOL`
          }));

        if (absentMessages.length > 0) {
          const { error: msgErr } = await supabase
            .from('messages')
            .insert(absentMessages);
          if (msgErr) throw msgErr;
        }
      } else {
        console.log("Message sending skipped by user.");
      }

      toast({ variant: 'success', title: 'Saved', description: 'Attendance has been saved successfully.' });
    } catch (error: any) {
      console.error('Error saving attendance/messages:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save.' });
    } finally {
      setIsSubmitting(false);
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
    
    // Calculate how many empty cells we need before the 1st of the month
    // getDay returns 0 for Sunday, 1 for Monday... 6 for Saturday.
    const startDayIndex = getDay(start); 

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
          {/* Render empty cells for padding */}
          {Array.from({ length: startDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8 w-8" />
          ))}
          
          {/* Render actual days */}
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            return (
              <Button
                key={day.toString()}
                variant={isSelected ? 'default' : 'outline'}
                className={`h-8 w-8 p-0`} 
                onClick={() => setSelectedDate(day)}
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
      <div className="container mx-auto p-4 md:p-8">
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
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Attendance for {format(selectedDate, 'dd MMMM, yyyy')}</CardTitle>
            <Button variant="secondary" onClick={markAllPresent}>Mark All Present</Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Father Name</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map(a => (
                    <TableRow key={a.studentid}>
                      <TableCell>{a.student.name}</TableCell>
                      <TableCell>{a.student.fathername}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            a.status === 'Present' ? 'success' : 
                            a.status === 'Absent' ? 'destructive' : 
                            'secondary'
                          }
                          className="cursor-pointer min-w-[80px] justify-center"
                          onClick={() => toggleStatus(a.studentid)}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendMessages"
                  checked={sendAbsenteeMessages}
                  onChange={(e) => setSendAbsenteeMessages(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="sendMessages"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Send absentee messages to parents
                </label>
              </div>
              <Button onClick={saveAttendance} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
