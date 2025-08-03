import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import Navbar from '../../components/Navbar';
import Loader from '../../components/Loader';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isPast,
  isFuture,
  getYear,
  getMonth,
} from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useToast } from '../../hooks/use-toast';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from 'next-themes';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ArrowLeft } from 'lucide-react';

interface Student {
  studentid: string;
  name: string;
  fathername?: string;
  mobilenumber?: string;
}

interface Attendance {
  id: string;
  studentid: string;
  date: string;
  status: 'Present' | 'Absent';
}

interface AttendanceWithStudent extends Attendance {
  student: Student;
}

interface StudentAttendanceRecord {
  student: Student;
  totalPresent: number;
  totalAbsent: number;
  totalDays: number;
  percentage: number;
}

export default function AttendanceRecordPage() {
  const [classData, setClassData] = useState<{ name: string; description: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceWithStudent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [studentRecords, setStudentRecords] = useState<StudentAttendanceRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendanceRecord | null>(null);
  const { theme } = useTheme();

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
      fetchAllAttendance();
    }
  }, [id, students, selectedDate]);

  const fetchClassData = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('name, description')
        .eq('id', id)
        .single();
      if (error) throw error;
      setClassData(data);
    } catch (error) {
      console.error('Error fetching class data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch class data.' });
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('studentid, name, fathername, mobilenumber')
        .eq('class_id', id);
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch students.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, studentid, date, status')
        .eq('class_id', id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));
      if (error) throw error;

      const fullAttendanceData = students.map(student => {
        const attendanceRecord = data.find(record => record.studentid === student.studentid);
        return {
          id: attendanceRecord?.id || '',
          studentid: student.studentid,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status: attendanceRecord ? attendanceRecord.status : 'Present',
          student: student,
        };
      });

      setAttendanceData(fullAttendanceData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch attendance.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllAttendance = async () => {
    setIsLoading(true);
    try {
      const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('attendance')
        .select('id, studentid, date, status')
        .eq('class_id', id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));
      if (error) throw error;

      const studentMap = new Map<string, StudentAttendanceRecord>();
      students.forEach(student => {
        studentMap.set(student.studentid, {
          student,
          totalPresent: 0,
          totalAbsent: 0,
          totalDays: 0,
          percentage: 0,
        });
      });

      data.forEach(item => {
        const record = studentMap.get(item.studentid);
        if (record) {
          record.totalDays++;
          if (item.status === 'Present') record.totalPresent++;
          else record.totalAbsent++;
        }
      });

      studentMap.forEach(record => {
        record.percentage = record.totalDays > 0
          ? (record.totalPresent / record.totalDays) * 100
          : 0;
      });

      setStudentRecords(Array.from(studentMap.values()));
    } catch (error) {
      console.error('Error fetching all attendance:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch all attendance.' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderYearMonthSelector = () => (
    <div className="flex space-x-4 mb-4">
      <Select
        value={getYear(selectedDate).toString()}
        onValueChange={value =>
          setSelectedDate(new Date(parseInt(value), getMonth(selectedDate), 1))
        }
      >
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select year" /></SelectTrigger>
        <SelectContent>
          {years.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={getMonth(selectedDate).toString()}
        onValueChange={value =>
          setSelectedDate(new Date(getYear(selectedDate), parseInt(value), 1))
        }
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
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-4 text-lg font-semibold text-center">{format(selectedDate, 'MMMM yyyy')}</div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <Button
              key={day.toString()}
              variant={isSameDay(day, selectedDate) ? 'default' : 'outline'}
              className={`h-8 w-8 p-0 ${index === 0 && `col-start-${day.getDay() + 1}`}`}
              onClick={() => setSelectedDate(day)}
            >
              <time dateTime={format(day, 'yyyy-MM-dd')}>{format(day, 'd')}</time>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderAttendanceSummary = () => {
    const totalStudents = students.length;
    const presentStudents = attendanceData.filter(a => a.status === 'Present').length;
    const absentStudents = totalStudents - presentStudents;

    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><h3 className="text-2xl font-bold text-green-500">{presentStudents}</h3><p>Present</p></div>
            <div><h3 className="text-2xl font-bold text-red-500">{absentStudents}</h3><p>Absent</p></div>
            <div><h3 className="text-2xl font-bold text-blue-500">{totalStudents}</h3><p>Total</p></div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAttendanceTable = () => {
    if (isFuture(selectedDate)) return <p>Attendance for future dates is not available.</p>;
    if (isPast(selectedDate) && !isToday(selectedDate) && attendanceData.every(a => !a.id))
      return <p>No attendance was taken on this date.</p>;

    return (
      <>
        {renderAttendanceSummary()}
        <h3 className="text-xl font-semibold mb-4">
          Attendance for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Father Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceData.map(attendance => (
              <TableRow key={attendance.studentid}>
                <TableCell>{attendance.student.name}</TableCell>
                <TableCell>{attendance.student.fathername}</TableCell>
                
                <TableCell>
                  <Badge variant={attendance.status === 'Present' ? 'success' : 'destructive'}>
                    {attendance.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };

  if (isLoading) return <Loader />;
  if (!classData) return <div>No class data available. Please try again.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto p-8">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: classData?.name || 'Class', href: `/class/${id}` },
            { label: 'Attendance Record', href: `/attendance-record/${id}` },
          ]}
        />
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-4xl font-bold mb-4">{classData?.name}</h1>
        <p className="text-xl text-muted-foreground mb-8">{classData?.description}</p>
        <Card className="mb-8">
          <CardHeader><CardTitle>Attendance Record</CardTitle></CardHeader>
          <CardContent>
            {renderYearMonthSelector()}
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/3">{renderCalendar()}</div>
              <div className="w-full lg:w-2/3">
                {students.length > 0 ? renderAttendanceTable() : <p>No students in this class.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
