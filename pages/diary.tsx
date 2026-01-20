"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { 
  Loader2, 
  BookOpen, 
  Calendar, 
  Send, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  RefreshCw
} from "lucide-react";

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
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { toast } = useToast();

  // --- DESIGN TOKENS ---
  const glassCardClass = "rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-xl";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block";
  const inputClass = "w-full bg-gray-50 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 rounded-md p-2.5 text-sm";
  
  // Glow Logic
  const glowGreen = "text-green-600 dark:text-green-400 font-bold drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]";
  const glowRed = "text-red-500 dark:text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]";

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchClasses(), fetchTodayDiaries()]);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('id, name').order('name');
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch classes' });
    } else {
      setClasses(data || []);
    }
  };

  const fetchTodayDiaries = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('diary')
      .select('*')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch diaries' });
    } else {
      setDiaries(data || []);
    }
  };

  const addDiary = async () => {
    if (!classId || !diary || !date) {
      toast({ variant: 'destructive', title: 'Error', description: 'All fields are required' });
      return;
    }

    setSubmitting(true);
    const isoDate = new Date(date).toISOString();

    // 1. Insert Diary
    const { data: inserted, error } = await supabase
      .from('diary')
      .insert([{ class_id: Number(classId), diary, date: isoDate }])
      .select();

    if (error || !inserted || inserted.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Diary could not be saved' });
      setSubmitting(false);
      return;
    }

    // 2. Fetch Students for Message Queue
    const { data: students, error: stuError } = await supabase
      .from('students')
      .select('studentid, mobilenumber, name')
      .eq('class_id', classId);

    if (stuError) {
      toast({ variant: 'destructive', title: 'Error', description: 'Diary saved, but failed to fetch students' });
    } else if (students && students.length > 0) {
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
        toast({ variant: 'destructive', title: 'Warning', description: 'Diary saved but messages failed to queue' });
      }
    }

    toast({ variant: 'default', className: "bg-green-600 text-white border-none", title: 'Success', description: 'Diary saved and messages queued' });

    setDiary('');
    setClassId('');
    fetchTodayDiaries();
    setSubmitting(false);
  };

  const diaryMap = new Map<number, Diary>();
  diaries.forEach((d) => {
    if (!diaryMap.has(d.class_id)) diaryMap.set(d.class_id, d);
  });

  const toggleExpand = (id: number) => {
    setExpanded(expanded === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors">
      <Navbar />
      
      <div className="container mx-auto max-w-6xl p-4 md:p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
             <h1 className="text-3xl font-semibold tracking-tight">Diary Management</h1>
             <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
               Send daily updates to students and track submissions.
             </p>
           </div>
           
           <Button
               variant="outline"
               onClick={fetchData}
               disabled={loading}
               className="rounded-full border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300"
           >
               <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
               Refresh
           </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Input Form */}
          <div className="lg:col-span-4 space-y-6">
            <div className={glassCardClass}>
              <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/10">
                 <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-500" /> New Diary Entry
                 </h3>
              </div>
              
              <div className="p-5 space-y-4">
                {/* Date Picker */}
                <div>
                   <label className={labelClass}>
                      <Calendar className="w-3 h-3 inline mr-1 mb-0.5" /> Date
                   </label>
                   <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={inputClass}
                   />
                </div>

                {/* Class Selector */}
                <div>
                   <label className={labelClass}>Class</label>
                   <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className={inputClass}
                   >
                      <option value="">Select a class...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id} className="dark:bg-slate-900">
                          {c.name}
                        </option>
                      ))}
                   </select>
                </div>

                {/* Text Area */}
                <div>
                   <label className={labelClass}>
                      <BookOpen className="w-3 h-3 inline mr-1 mb-0.5" /> Message
                   </label>
                   <textarea
                      value={diary}
                      onChange={(e) => setDiary(e.target.value)}
                      placeholder="Enter homework or announcement..."
                      className={`${inputClass} min-h-[150px] resize-y`}
                   />
                </div>

                <Button 
                    onClick={addDiary} 
                    disabled={submitting}
                    className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/20 transition-all h-10"
                >
                    {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send to Students
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Status Grid */}
          <div className="lg:col-span-8">
             <div className={`${glassCardClass} h-full flex flex-col`}>
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                   <h3 className="font-semibold text-sm">Today's Status</h3>
                   <span className="text-xs text-gray-500 dark:text-slate-400">
                     {diaries.length} / {classes.length} Sent
                   </span>
                </div>

                <div className="p-5">
                   {loading ? (
                      <div className="flex flex-col items-center justify-center py-20">
                         <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                         <p className="text-gray-500 dark:text-slate-400 mt-2 text-sm">Loading status...</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {classes.map((c) => {
                           const entry = diaryMap.get(c.id);
                           const isExpanded = expanded === c.id;
                           
                           return (
                             <div 
                               key={c.id}
                               onClick={() => entry && toggleExpand(c.id)}
                               className={`
                                 relative p-4 rounded-lg border transition-all duration-200
                                 ${entry 
                                    ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800 cursor-pointer hover:border-green-300 dark:hover:border-green-700' 
                                    : 'bg-gray-50/50 dark:bg-white/5 border-gray-200 dark:border-white/10 opacity-80'
                                 }
                               `}
                             >
                                <div className="flex justify-between items-start">
                                   <div>
                                      <h4 className="font-medium text-sm text-gray-900 dark:text-slate-100">{c.name}</h4>
                                      <span className={`text-xs mt-1 block ${entry ? glowGreen : glowRed}`}>
                                         {entry ? "Sent" : "Pending"}
                                      </span>
                                   </div>
                                   {entry ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                   ) : (
                                      <XCircle className="h-5 w-5 text-gray-300 dark:text-slate-600" />
                                   )}
                                </div>

                                {/* Expanded Content */}
                                {entry && (
                                   <div className={`mt-3 pt-3 border-t border-green-200 dark:border-green-800/30 text-sm text-gray-600 dark:text-slate-300 ${!isExpanded && 'line-clamp-2'}`}>
                                      {entry.diary}
                                   </div>
                                )}
                                
                                {entry && entry.diary.length > 60 && (
                                   <div className="flex justify-center mt-2">
                                      {isExpanded ? <ChevronUp className="h-3 w-3 text-green-500" /> : <ChevronDown className="h-3 w-3 text-green-500" />}
                                   </div>
                                )}
                             </div>
                           );
                        })}
                      </div>
                   )}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}