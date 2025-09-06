import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import Navbar from '../../components/Navbar'
import Loader from '../../components/Loader'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog'
import { useToast } from "../../hooks/use-toast"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import Link from 'next/link'
import Breadcrumbs from '../../components/Breadcrumbs'

interface Class {
  id: string
  name: string
  description: string
}

interface Student {
  studentid: string
  name: string
  fathername?: string
  mobilenumber?: string
}

interface Attendance {
  id: string
  studentid: string
  date: string
  status: 'Present' | 'Absent' | null
}

export default function ClassPage() {
  const [classData, setClassData] = useState<Class | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [newstudentid, setNewstudentid] = useState('')
  const [newStudentName, setNewStudentName] = useState('')
  const [newfathername, setNewfathername] = useState('')
  const [newmobilenumber, setNewmobilenumber] = useState('')
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([])
  const router = useRouter()
  const { id } = router.query
  const { toast } = useToast()
  const [deletestudentid, setDeletestudentid] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (id) {
      fetchClassData()
      fetchStudents()
    }
  }, [id])

  useEffect(() => {
    if (id && students.length > 0) {
      fetchAttendance()
    }
  }, [id, students, selectedDate])

  const fetchClassData = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single()
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch class data." })
    } else {
      setClassData(data)
    }
    setIsLoading(false)
  }

  const fetchStudents = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('studentid, name, fathername, mobilenumber')
      .eq('class_id', id)
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch students." })
    } else {
      // Sort by name for display
      setStudents((data || []).sort((a, b) => a.name.localeCompare(b.name)))
    }
    setIsLoading(false)
  }

  const addStudent = async () => {
    const { data, error } = await supabase
      .from('students')
      .insert([{
        studentid: newstudentid,
        name: newStudentName,
        fathername: newfathername,
        mobilenumber: newmobilenumber,
        class_id: id
      }])
      .select()
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add student." })
    } else {
      setStudents([...students, data[0]].sort((a, b) => a.name.localeCompare(b.name)))
      setNewstudentid('')
      setNewStudentName('')
      setNewfathername('')
      setNewmobilenumber('')
      setIsAddStudentDialogOpen(false)
      toast({ variant: "success", title: "Success", description: "Student added successfully." })
    }
  }

  const deleteStudent = async () => {
    if (!deletestudentid) return
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('studentid', deletestudentid)
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete student." })
    } else {
      setStudents(students.filter(s => s.studentid !== deletestudentid))
      toast({ variant: "success", title: "Success", description: "Student deleted successfully." })
    }
    setDeletestudentid(null)
    setIsDeleteDialogOpen(false)
  }

  const fetchAttendance = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_id', id)
      .eq('date', format(selectedDate, 'yyyy-MM-dd'))

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch attendance." })
    } else {
      setAttendanceData(data || [])
    }
  }

  const renderCalendar = () => {
    const start = startOfMonth(selectedDate)
    const end = endOfMonth(selectedDate)
    const days = eachDayOfInterval({ start, end })
    return (
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-4 text-lg font-semibold text-center">
          {format(selectedDate, 'MMMM yyyy')}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm text-gray-500">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <Button
              key={day.toString()}
              variant={isSameDay(day, selectedDate) ? "default" : "outline"}
              className={`h-8 w-8 p-0 ${index === 0 && `col-start-${day.getDay() + 1}`}`}
              onClick={() => setSelectedDate(day)}
            >
              <time dateTime={format(day, 'yyyy-MM-dd')}>{format(day, 'd')}</time>
            </Button>
          ))}
        </div>
      </div>
    )
  }

  if (isLoading) return <Loader />
  if (!classData) return <div>No class data found.</div>

  return (
    <>
      <style jsx>{`
        /* subtle animated gradient background */
        .page-bg {
          background: linear-gradient(135deg, rgba(236,72,153,0.06) 0%, rgba(99,102,241,0.04) 35%, rgba(56,189,248,0.04) 100%);
        }
        @media (prefers-color-scheme: dark) {
          .page-bg {
            background: linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.03) 50%, rgba(139,92,246,0.05) 100%);
          }
        }
        .card-glass {
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(8px);
        }
        @media (prefers-color-scheme: dark) {
          .card-glass {
            background: rgba(13,18,25,0.6);
          }
        }
        .btn-gradient {
          background: linear-gradient(90deg, #6366f1, #ec4899);
          color: white;
        }
        .btn-gradient:hover { opacity: .95; transform: translateY(-1px); }
        .status-present { background: linear-gradient(90deg, #34d399, #10b981); color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 600; }
        .status-absent { background: linear-gradient(90deg, #fb7185, #f43f5e); color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 600; }
        .status-unmarked { background: linear-gradient(90deg, #9ca3af, #6b7280); color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 600; }
        .table-row-hover:hover { background: rgba(99,102,241,0.04); }
        @media (prefers-color-scheme: dark) {
          .table-row-hover:hover { background: rgba(99,102,241,0.06); }
        }
      `}</style>

      <div className="min-h-screen page-bg text-foreground transition-colors">
        <Navbar />
        <div className="max-w-6xl mx-auto p-8">
          <Breadcrumbs items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: classData?.name || 'Class', href: `/class/${id}` }
          ]} />

          <div className="flex items-center justify-between mb-6">
            <div>
              <Button variant="outline" onClick={() => router.back()} className="mb-0 mr-3">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <h1 className="text-4xl font-extrabold tracking-tight mt-2">{classData?.name}</h1>
              <p className="text-muted-foreground mt-1 text-lg">{classData?.description}</p>
            </div>

            <div className="flex items-center space-x-3">
              <Link href={`/attendance-record/${id}`}>
                <Button className="btn-gradient shadow-md">
                  Mark Attendance
                </Button>
              </Link>
              <Link href={`/attendance-record/report`}>
                <Button className="btn-gradient shadow-md">
                  Report
                </Button>
              </Link>

              <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2 bg-white dark:bg-gray-800 border shadow-sm">
                    <Plus className="w-4 h-4 text-primary" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Add Student</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl card-glass border shadow-lg">
                  <DialogHeader><DialogTitle className="text-lg font-semibold">Add New Student</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input placeholder="Student ID" value={newstudentid} onChange={e => setNewstudentid(e.target.value)} />
                    <Input placeholder="Name" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
                    <Input placeholder="Father Name" value={newfathername} onChange={e => setNewfathername(e.target.value)} />
                    <Input placeholder="Mobile Number" value={newmobilenumber} onChange={e => setNewmobilenumber(e.target.value)} />
                    <div className="flex justify-end">
                      <Button onClick={addStudent} className="btn-gradient">Add Student</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-1">
              <Card className="card-glass border shadow">
                <CardHeader><CardTitle className="text-lg font-semibold">Calendar</CardTitle></CardHeader>
                <CardContent>
                  <div className="py-2">{renderCalendar()}</div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="card-glass border shadow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Today's Attendance <span className="ml-2 text-sm text-muted-foreground">({format(selectedDate, 'dd MMM yyyy')})</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2 text-sm font-medium">Name</th>
                          <th className="pb-2 text-sm font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(student => {
                          const attendance = attendanceData.find(a => a.studentid === student.studentid)
                          return (
                            <tr key={student.studentid} className="table-row-hover transition-colors">
                              <td className="py-3 pr-4">{student.name}</td>
                              <td className="py-3">
                                {attendance?.status === 'Present' && <span className="status-present">Present</span>}
                                {attendance?.status === 'Absent' && <span className="status-absent">Absent</span>}
                                {!attendance?.status && <span className="status-unmarked">Unmarked</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="card-glass border shadow">
            <CardHeader><CardTitle>Students</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Father Name</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.studentid} className="border-t">
                        <td className="py-3">{student.name}</td>
                        <td className="py-3 text-muted-foreground">{student.fathername}</td>
                        <td className="py-3 text-right">
                          <Button variant="outline" size="icon" onClick={() => {
                            setDeletestudentid(student.studentid)
                            setIsDeleteDialogOpen(true)
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="rounded-xl card-glass border shadow-lg">
            <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
            <p>Are you sure you want to delete this student?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={deleteStudent}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
