import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import Navbar from '../../components/Navbar'
import { useToast } from '../../hooks/use-toast'

interface ClassData {
  id: number
  name: string
}

type TestType = 'Midterm-1' | 'Midterm-2' | 'Terminal-1' | 'Terminal-2' | 'Monthly'

type SubjectName =
  | 'English' | 'Urdu' | 'Waqfiyat-e-Aama' | 'Muashrati Uloom' | 'Islamiyat'
  | 'Mathematics' | 'Science' | 'SVT' | 'Computer' | 'General Knowledge'
  | 'Conversation' | 'Meri Dilchasp Dunya' | 'Chemistry' | 'Physics'
  | 'Biology' | 'Tarjuma-tul-Quran' | 'Nazra' | 'History' | 'Geography'
  | 'Pak Studies' | 'Civics' | 'Arts' | 'Physical Education'

export default function NewTestPage() {
  const [classes, setClasses] = useState<ClassData[]>([])
  const [form, setForm] = useState<{ test_name: string; test_type: TestType | ''; subject: SubjectName | ''; class_id: string; date: string }>({
    test_name: '',
    test_type: '',
    subject: '',
    class_id: '',
    date: ''
  })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    supabase.from('classes').select('id, name').then(({ data }) => setClasses(data || []))
  }, [])

  const handleSubmit = async () => {
    const { error } = await supabase.from('tests').insert([form])
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      toast({ variant: 'success', title: 'Created', description: 'Test created successfully' })
      router.push('/marks')
    }
  }

  const testTypes: TestType[] = ['Midterm-1','Midterm-2','Terminal-1','Terminal-2','Monthly']
  const subjects: SubjectName[] = [
    'English','Urdu','Waqfiyat-e-Aama','Muashrati Uloom','Islamiyat',
    'Mathematics','Science','SVT','Computer','General Knowledge','Conversation',
    'Meri Dilchasp Dunya','Chemistry','Physics','Biology','Tarjuma-tul-Quran',
    'Nazra','History','Geography','Pak Studies','Civics','Arts','Physical Education'
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Create New Test</h1>
        <div className="space-y-4 max-w-lg">
          <Input placeholder="Test Name" value={form.test_name} onChange={e => setForm({ ...form, test_name: e.target.value })} />
          <Select onValueChange={v => setForm({ ...form, test_type: v as TestType })}>
            <SelectTrigger><SelectValue placeholder="Select Test Type" /></SelectTrigger>
            <SelectContent>{testTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={v => setForm({ ...form, subject: v as SubjectName })}>
            <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
            <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={v => setForm({ ...form, class_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Button onClick={handleSubmit}>Create Test</Button>
        </div>
      </div>
    </div>
  )
}
