// Rewrite with same UI but fresh implementation of attendanceMarkedToday

import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import Navbar from '../components/Navbar'
import Loader from '../components/Loader'
import { Plus, Edit, Trash2, Users, Calendar } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog"
import { useToast } from "../hooks/use-toast"
import { motion, AnimatePresence } from 'framer-motion'
import Breadcrumbs from '../components/Breadcrumbs'

interface Class {
  id: string
  name: string
  description: string
  studentCount: number
  totalClassDays: number
  attendanceMarkedToday: boolean
}

export default function Dashboard() {
  const [classes, setClasses] = useState<Class[]>([])
  const [newClassName, setNewClassName] = useState('')
  const [newClassDescription, setNewClassDescription] = useState('')
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => { fetchClasses() }, [])

  const fetchClasses = async () => {
    setIsLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('*')

    if (classesError) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch classes." })
      setIsLoading(false)
      return
    }

    // fetch all today's attendance once
    const { data: todaysAttendance, error: todaysError } = await supabase
      .from('attendance')
      .select('class_id, date')
      .eq('date', today)

    if (todaysError) console.error("Error fetching today's attendance", todaysError)

    const todaysMap = new Set((todaysAttendance || []).map(a => a.class_id))

    const classesWithDetails = await Promise.all(
      classesData.map(async (cls: any) => {
        const { count: studentCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', cls.id)

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('date')
          .eq('class_id', cls.id)

        const uniqueDates = new Set((attendanceData || []).map(r => r.date))

        const attendanceMarkedToday = todaysMap.has(cls.id)
        console.log(`Class "${cls.name}" (${cls.id}) marked today? →`, attendanceMarkedToday)

        return {
          ...cls,
          studentCount: studentCount || 0,
          totalClassDays: uniqueDates.size,
          attendanceMarkedToday
        }
      })
    )

    setClasses(classesWithDetails)
    setIsLoading(false)
  }

  const createClass = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)
      return toast({ variant: "destructive", title: "Error", description: "Login required." })

    const { data, error } = await supabase
      .from('classes')
      .insert([{ name: newClassName, description: newClassDescription }])
      .select()

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message })
      return
    }

    setClasses([
      ...classes,
      {
        ...data![0],
        studentCount: 0,
        totalClassDays: 0,
        attendanceMarkedToday: false
      }
    ])

    setNewClassName('')
    setNewClassDescription('')
    setIsCreateDialogOpen(false)
    toast({ variant: "success", title: "Class created!" })
  }

  const updateClass = async () => {
    if (!editingClass) return

    const { error } = await supabase
      .from('classes')
      .update({ name: newClassName, description: newClassDescription })
      .eq('id', editingClass.id)

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Update failed." })
      return
    }

    setClasses(classes.map(c =>
      c.id === editingClass.id
        ? { ...c, name: newClassName, description: newClassDescription }
        : c
    ))

    setEditingClass(null)
    setNewClassName('')
    setNewClassDescription('')
    setIsEditDialogOpen(false)
    toast({ variant: "success", title: "Class updated!" })
  }

  const deleteClass = async () => {
    if (!deleteClassId) return

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', deleteClassId)

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Deletion failed." })
    } else {
      setClasses(classes.filter(c => c.id !== deleteClassId))
      toast({ variant: "success", title: "Class deleted." })
    }

    setDeleteClassId(null)
    setIsDeleteDialogOpen(false)
  }

  if (isLoading) return <Loader />

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }]} />

        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-transparent bg-clip-text">
            CLASSES
          </h1>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition">
                <Plus className="w-4 h-4 mr-2" /> New Class
              </Button>
            </DialogTrigger>

            <DialogContent className="rounded-2xl shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Create New Class</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <Input placeholder="Class Name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
                <Input placeholder="Class Description" value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} />
                <Button className="w-full bg-gradient-to-r from-green-400 to-blue-500" onClick={createClass}>Create Class</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* CLASS GRID */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {classes.map((cls, index) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="group rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-semibold">{cls.name}</CardTitle>

                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium text-white ${cls.attendanceMarkedToday ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`}
                      >
                        {cls.attendanceMarkedToday ? 'Today Marked' : 'Pending'}
                      </span>
                    </div>
                    <CardDescription className="mt-1 text-muted-foreground">{cls.description}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" /> {cls.studentCount} Students
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {cls.totalClassDays} Days
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="bg-gradient-to-r from-blue-400 to-blue-600 text-white"
                        size="sm"
                        onClick={() => router.push(`/class/${cls.id}`)}
                      >
                        View
                      </Button>

                      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setEditingClass(cls)
                              setNewClassName(cls.name)
                              setNewClassDescription(cls.description)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Class</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-4 mt-4">
                            <Input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
                            <Input value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} />
                            <Button className="bg-gradient-to-r from-yellow-400 to-orange-500" onClick={updateClass}>
                              Update Class
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          setDeleteClassId(cls.id)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </main>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this class? This action cannot be undone.</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteClass}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

