"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import Groq from 'groq-sdk';
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
  RefreshCw,
  Wand2, 
  Sparkles,
  Lock
} from "lucide-react";

// --- AI CONFIGURATION ---
const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;

if (!apiKey) {
  throw new Error("Missing NEXT_PUBLIC_GROQ_API_KEY in .env.local");
}

const groq = new Groq({ 
  apiKey: apiKey, 
  dangerouslyAllowBrowser: true 
});

// 1. UPDATED FORMATTER PROMPT (STRICTER SCRIPT-LOCKING)
const generateFormatPrompt = (className: string, date: string) => `
You are a 'Script-Frozen' School Diary Formatter. 
Your goal is to format text, fix spelling, and fix grammar ONLY.

⚠️ CRITICAL DIRECTIVE: "SCRIPT LOCK" ⚠️
You are FORBIDDEN from changing the script of the input text.
1. IF Input is English -> Output MUST be English.
2. IF Input is Urdu -> Output MUST be Urdu.
3. IF Input is Roman Urdu -> Output MUST be Roman Urdu.

🚫 NEGATIVE CONSTRAINTS (WHAT YOU MUST NOT DO):
- NEVER transliterate English words to Urdu script (e.g., "Computer" ❌-> "کمپیوٹر").
- NEVER transliterate Urdu words to English script (e.g., "ریاضی" ❌-> "Math").
- NEVER translate concepts (e.g., "Holiday" ❌-> "Chutti").

✅ APPROVED TRANSFORMATION EXAMPLES:
- Input: "maths: do pg 5" -> Output: "📚 Maths: \n📝 Do page 5." (Kept English)
- Input: "اردو: سبق نمبر 1 یاد کریں" -> Output: "📚 اردو: \n📝 سبق نمبر 1 یاد کریں۔" (Kept Urdu)
- Input: "Eng: learn ch 1. Urdu: nazam yad karni hai" -> Output: "📚 English: \n📝 Learn Chapter 1.\n\n📚 Urdu: \n📝 Nazam yad karni hai." (Mixed preserved)

FORMATTING RULES:
1. Start exactly with: "📅 ${date} | 🏫 ${className}"
2. Use 📚 for Subjects.
3. Use 📝 for Tasks/Details.
4. Add a blank line between subjects.

Output ONLY the final formatted text. Do not add conversational filler.
`;

// 2. POLICY PROMPT (Guardrail)
const POLICY_SYSTEM_PROMPT = `
You are a School Compliance AI. Review the diary entry.
RULES:
1. Content must be educational.No personal contact details other than 03234447292 or school address.
2. No abusive language.Nothing bad about school or staff's personal issues.
3. RETURN JSON ONLY: { "allowed": boolean, "reason": "string" }.
`;

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
  const [isFormatting, setIsFormatting] = useState(false);
  
  const [expanded, setExpanded] = useState<number | null>(null);
  const { toast } = useToast();

  // --- DESIGN TOKENS ---
  const glassCardClass = "rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-xl";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block";
  const inputClass = "w-full bg-gray-50 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 rounded-md p-2.5 text-sm transition-all";
  
  const glowGreen = "text-green-600 dark:text-green-400 font-bold drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]";
  const glowRed = "text-red-500 dark:text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]";

  useEffect(() => {
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
    if (error) toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch classes' });
    else setClasses(data || []);
  };

  const fetchTodayDiaries = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('diary')
      .select('*')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (error) toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch diaries' });
    else setDiaries(data || []);
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClassId = e.target.value;
    setClassId(newClassId);

    if (newClassId) {
        const selectedClass = classes.find(c => String(c.id) === newClassId);
        if (selectedClass) {
            setDiary(`📅 ${date} | 🏫 ${selectedClass.name}\n\n`);
        }
    } else {
        setDiary('');
    }
  };

  const handleSmartFormat = async () => {
    if (!classId) return;

    setIsFormatting(true);
    const selectedClass = classes.find(c => String(c.id) === classId)?.name || "Class";

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: generateFormatPrompt(selectedClass, date) },
                { role: "user", content: diary }
            ],
            model: "llama-3.1-8b-instant",
            // Lowered temperature for stricter adherence to instructions
            temperature: 0.1, 
            max_tokens: 600,
        });

        const formattedText = completion.choices[0]?.message?.content;
        if (formattedText) setDiary(formattedText);
        toast({ title: "✨ Formatted", description: "Spelling fixed & Formatting applied (Script Preserved).", className: "bg-purple-600 text-white border-none" });
    } catch (error) {
        console.error("AI Error", error);
        toast({ title: "AI Error", description: "Service busy, please try again.", variant: "destructive" });
    } finally {
        setIsFormatting(false);
    }
  };

  const checkPolicy = async (textToCheck: string) => {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: POLICY_SYSTEM_PROMPT },
                { role: "user", content: textToCheck }
            ],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
        return result;
    } catch (error) {
        return { allowed: false, reason: "AI Service Unavailable" };
    }
  };

  const addDiary = async () => {
    if (!classId || !diary || !date) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please fill all fields' });
      return;
    }

    const selectedClass = classes.find(c => String(c.id) === classId);
    
    // Local Validation
    if (selectedClass && !diary.includes(selectedClass.name)) {
       toast({ variant: 'destructive', title: 'Format Error', description: `Text must contain "${selectedClass.name}". Use AI Format to fix.` });
       return;
    }

    setSubmitting(true);

    // Policy Check
    const policy = await checkPolicy(diary);
    if (!policy.allowed) {
        setSubmitting(false);
        toast({ variant: 'destructive', title: 'Policy Violation', description: policy.reason });
        return;
    }

    const isoDate = new Date(date).toISOString();

    // Insert Diary
    const { data: inserted, error } = await supabase
      .from('diary')
      .insert([{ class_id: Number(classId), diary, date: isoDate }])
      .select();

    if (error || !inserted?.length) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database save failed' });
      setSubmitting(false);
      return;
    }

    // Queue Messages
    const { data: students } = await supabase
      .from('students')
      .select('studentid, mobilenumber')
      .eq('class_id', classId);

    if (students?.length) {
      const messages = students.map((s) => ({
        student_id: s.studentid,
        class_id: classId,
        number: s.mobilenumber || '',
        text: diary,
        created_at: isoDate,
      }));
      await supabase.from('messages').insert(messages);
    }

    toast({ variant: 'default', className: "bg-green-600 text-white border-none", title: 'Success', description: 'Diary sent successfully!' });

    setDiary('');
    setClassId('');
    fetchTodayDiaries();
    setSubmitting(false);
  };

  const diaryMap = new Map<number, Diary>();
  diaries.forEach((d) => {
    if (!diaryMap.has(d.class_id)) diaryMap.set(d.class_id, d);
  });

  const toggleExpand = (id: number) => setExpanded(expanded === id ? null : id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors">
      <Navbar />
      
      <div className="container mx-auto max-w-6xl p-4 md:p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
             <h1 className="text-3xl font-semibold tracking-tight">Diary Management</h1>
             <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
               AI-Assisted Daily Updates & Tracking
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
                    <Send className="h-4 w-4 text-blue-500" /> Compose Entry
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
                      onChange={(e) => {
                          setDate(e.target.value);
                          if(classId) {
                              const cls = classes.find(c => String(c.id) === classId)?.name;
                              if(cls) setDiary(`📅 ${e.target.value} | 🏫 ${cls}\n\n` + diary.split('\n\n').slice(1).join('\n\n'));
                          }
                      }}
                      className={inputClass}
                   />
                </div>

                {/* Class Selector */}
                <div>
                   <label className={labelClass}>Class</label>
                   <select
                      value={classId}
                      onChange={handleClassChange}
                      className={inputClass}
                   >
                      <option value="">Select a class to start...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id} className="dark:bg-slate-900">
                          {c.name}
                        </option>
                      ))}
                   </select>
                </div>

                {/* Text Area & AI Button */}
                <div>
                   <label className={labelClass}>
                      <BookOpen className="w-3 h-3 inline mr-1 mb-0.5" /> Message
                   </label>
                   
                   <button
                     onClick={handleSmartFormat}
                     disabled={isFormatting || !classId}
                     className={`
                        w-full mb-2 flex items-center justify-center gap-2 p-2 rounded-md font-medium text-xs transition-all border
                        ${!classId 
                           ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                           : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-transparent shadow-md'
                        }
                     `}
                   >
                     {isFormatting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                     {isFormatting ? 'AI is Formatting...' : 'AI Format '}
                   </button>
                   
                   <div className="relative">
                       <textarea
                          value={diary}
                          onChange={(e) => setDiary(e.target.value)}
                          disabled={!classId}
                          placeholder={!classId ? "⚠️ Select a class above to enable typing..." : "Type details here (Eng or Urdu)..."}
                          className={`${inputClass} min-h-[160px] resize-y font-mono text-sm leading-relaxed ${!classId ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900' : ''}`}
                       />
                       {!classId && (
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                               <Lock className="w-6 h-6 text-gray-400 opacity-20" />
                           </div>
                       )}
                   </div>
                   
                   <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between">
                     <span>* Scripts preserved (Eng stays Eng, Urdu stays Urdu).</span>
                   </p>
                </div>

                <Button 
                    onClick={addDiary} 
                    disabled={submitting || !classId}
                    className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/20 transition-all h-10"
                >
                    {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {submitting ? 'Verifying Policy...' : 'Send to Students'}
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
                                      <h4 className="font-medium text-sm text-gray-900 dark:text-slate-100 flex items-center gap-2">
                                        {c.name}
                                        {entry && <span className="text-[10px] bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded-full">Sent</span>}
                                      </h4>
                                   </div>
                                   {entry ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                   ) : (
                                      <XCircle className="h-5 w-5 text-gray-300 dark:text-slate-600" />
                                   )}
                                </div>

                                {entry && (
                                   <div className={`mt-3 pt-3 border-t border-green-200 dark:border-green-800/30 text-sm text-gray-600 dark:text-slate-300 font-mono whitespace-pre-wrap ${!isExpanded && 'line-clamp-2'}`}>
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
