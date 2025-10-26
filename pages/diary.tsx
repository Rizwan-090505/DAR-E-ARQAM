import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '../components/ui/select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import Loader from '../components/Loader';

interface Class {
  id: number;
  name: string;
}

interface Diary {
  id: number;
  class_id: number;
  diary: string;
  created_at: string;
}

export default function DiaryPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [diary, setDiary] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null); // 👈 track which diary is expanded
  const { toast } = useToast();

  useEffect(() => {
    fetchClasses();
    fetchTodayDiaries();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('classes').select('id, name');
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch classes',
      });
    } else {
      setClasses(data || []);
    }
    setLoading(false);
  };

  const fetchTodayDiaries = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('diary')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch diaries',
      });
    } else {
      setDiaries(data || []);
    }
    setLoading(false);
  };

  const addDiary = async () => {
    if (!classId || !diary || !date) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'All fields are required',
      });
      return;
    }

    setLoading(true);

    const isoDate = new Date(date).toISOString();

    const { data: inserted, error } = await supabase
      .from('diary')
      .insert([
        {
          class_id: classId,
          diary,
          date: isoDate,
        },
      ])
      .select();

    if (error || !inserted || inserted.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Diary could not be saved',
      });
      setLoading(false);
      return;
    }

    const { data: students, error: stuError } = await supabase
      .from('students')
      .select('studentid, mobilenumber, name')
      .eq('class_id', classId);

    if (stuError) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch students',
      });
      setLoading(false);
      return;
    }

    if (students && students.length > 0) {
      const messages = students.map((s) => ({
        student_id: s.studentid,
        class_id: classId,
        number: s.mobilenumber || '',
        text: diary,
        created_at: isoDate,
      }));

      const { error: msgError } = await supabase
        .from('messages')
        .insert(messages);
      if (msgError) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Diary saved but messages failed',
        });
      }
    }

    toast({
      variant: 'success',
      title: 'Success',
      description: 'Diary saved and messages queued',
    });

    setDiary('');
    setDate('');
    setClassId('');
    fetchTodayDiaries();
    setLoading(false);
  };

  if (loading) return <Loader />;

  const diaryMap = new Map<number, Diary>();
  diaries.forEach((d) => {
    if (!diaryMap.has(d.class_id)) {
      diaryMap.set(d.class_id, d);
    }
  });

  const toggleExpand = (id: number) => {
    setExpanded(expanded === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Diary Management</h1>

        {/* Add Diary Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Diary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <textarea
              className="w-full min-h-[120px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Enter diary..."
              value={diary}
              onChange={(e) => setDiary(e.target.value)}
            />
            <Button onClick={addDiary}>Add Diary</Button>
          </CardContent>
        </Card>

        {/* Diary Status Section */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Diary Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {classes.map((c) => {
              const entry = diaryMap.get(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => entry && toggleExpand(c.id)}
                  className={`p-3 rounded-md cursor-pointer transition-all duration-200 ${
                    entry ? 'bg-green-100 hover:bg-green-200' : 'bg-red-100'
                  }`}
                >
                  <div className="font-bold">{c.name}</div>
                  {entry && (
                    <div className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                      {expanded === c.id
                        ? entry.diary
                        : entry.diary.length > 100
                        ? entry.diary.slice(0, 100) + '...'
                        : entry.diary}
                    </div>
                  )}
                  {entry && entry.diary.length > 100 && (
                    <div className="text-xs text-blue-600 mt-1">
                      {expanded === c.id ? 'Click to collapse' : 'Click to read more'}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
