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
import AttendanceRecord from '../../components/AttendanceRecord'
import Link from 'next/link'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'
import { Label } from '../../components/ui/label'
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

interface UpdatedAttendance extends Attendance {}

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
            setStudents(data || [])
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
            setStudents([...students, data[0]])
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
            const fullAttendanceData = students.map(student => ({
                id: '',
                studentid: student.studentid,
                date: format(selectedDate, 'yyyy-MM-dd'),
                status: null
            }))
            data.forEach(record => {
                const index = fullAttendanceData.findIndex(a => a.studentid === record.studentid)
                if (index !== -1) {
                    fullAttendanceData[index] = record
                }
            })
            setAttendanceData(fullAttendanceData)
        }
    }

    const toggleAttendance = async (studentid: string, status: 'Present' | 'Absent' | null) => {
        const existingRecord = attendanceData.find(a => a.studentid === studentid)
        try {
            let updatedRecord: UpdatedAttendance | null = null
            if (existingRecord && existingRecord.id) {
                if (status === null) {
                    await supabase.from('attendance').delete().eq('id', existingRecord.id)
                } else {
                    const { data } = await supabase
                        .from('attendance')
                        .update({ status })
                        .eq('id', existingRecord.id)
                        .select()
                    if (data) updatedRecord = data[0]
                }
            } else if (status !== null) {
                const { data } = await supabase
                    .from('attendance')
                    .insert({
                        class_id: id,
                        studentid,
                        date: format(selectedDate, 'yyyy-MM-dd'),
                        status
                    })
                    .select()
                if (data) updatedRecord = data[0]
            }
            setAttendanceData(prev =>
                updatedRecord === null
                    ? prev.filter(a => a.studentid !== studentid)
                    : prev.map(a => a.studentid === studentid ? { ...a, ...updatedRecord } : a)
            )
        } catch {
            toast({ variant: "destructive", title: "Error", description: "Failed to update attendance." })
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

    const renderAttendanceList = () => (
        <div className="space-y-4 overflow-y-auto max-h-[400px]">
            {students.map(student => {
                const attendance = attendanceData.find(a => a.studentid === student.studentid)
                return (
                    <div key={student.studentid} className="flex items-center justify-between p-4 bg-card rounded-md">
                        <span className="font-medium">{student.name} - {student.fathername} ({student.mobilenumber})</span>
                        <RadioGroup
                            value={
                                attendance?.status === null
                                    ? 'unmarked'
                                    : attendance?.status === 'Present'
                                    ? 'present'
                                    : 'absent'
                            }
                            onValueChange={value => {
                                if (value === 'unmarked') toggleAttendance(student.studentid, null)
                                else toggleAttendance(student.studentid, value === 'present' ? 'Present' : 'Absent')
                            }}
                            className="flex space-x-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="present" id={`present-${student.studentid}`} />
                                <Label htmlFor={`present-${student.studentid}`}>Present</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="absent" id={`absent-${student.studentid}`} />
                                <Label htmlFor={`absent-${student.studentid}`}>Absent</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="unmarked" id={`unmarked-${student.studentid}`} />
                                <Label htmlFor={`unmarked-${student.studentid}`}>Unmarked</Label>
                            </div>
                        </RadioGroup>
                    </div>
                )
            })}
        </div>
    )

    if (isLoading) return <Loader />
    if (!classData) return <div>No class data found.</div>

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />
            <div className="container mx-auto p-8">
                <Breadcrumbs items={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: classData?.name || 'Class', href: `/class/${id}` }
                ]} />
                <Button variant="outline" onClick={() => router.back()} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <h1 className="text-4xl font-bold mb-4">{classData?.name}</h1>
                <p className="text-xl mb-8">{classData?.description}</p>
                <Card className="mb-8">
                    <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex flex-col lg:flex-row gap-8">
                            <div className="w-full lg:w-1/3">{renderCalendar()}</div>
                            <div className="w-full lg:w-2/3">{renderAttendanceList()}</div>
                        </div>
                        <div className="mt-8">
                            <Link href={`/attendance-record/${id}`}>
                                <Button>View Detailed Attendance Record</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
                <Card className="mb-8">
                    <CardHeader><CardTitle>Today's Attendance Record</CardTitle></CardHeader>
                    <CardContent>
                        <AttendanceRecord
                            classId={id as string}
                            date={format(selectedDate, 'yyyy-MM-dd')}
                            attendanceData={attendanceData.map(a => ({ ...a, status: a.status || 'Absent' }))}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Students</CardTitle></CardHeader>
                    <CardContent>
                        <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="mb-4"><Plus className="w-4 h-4 mr-2" /> Add Student</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <Input placeholder="Student ID" value={newstudentid} onChange={e => setNewstudentid(e.target.value)} />
                                    <Input placeholder="Name" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
                                    <Input placeholder="Father Name" value={newfathername} onChange={e => setNewfathername(e.target.value)} />
                                    <Input placeholder="Mobile Number" value={newmobilenumber} onChange={e => setNewmobilenumber(e.target.value)} />
                                    <Button onClick={addStudent}>Add Student</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Father Name</th>
                                        <th>Mobile Number</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => (
                                        <tr key={student.studentid}>
                                            <td>{student.name}</td>
                                            <td>{student.fathername}</td>
                                            <td>{student.mobilenumber}</td>
                                            <td className="text-right">
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
                <DialogContent>
                    <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
                    <p>Are you sure you want to delete this student?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={deleteStudent}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
