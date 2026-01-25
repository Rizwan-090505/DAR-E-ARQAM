// pages/bulk-message.jsx
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import Groq from 'groq-sdk';
import Loader from '../components/Loader'; 
import { Button } from '../components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { 
  Search, 
  Users, 
  FileText, 
  Send, 
  CheckSquare, 
  Square, 
  ShieldCheck, 
  Loader2, 
  RefreshCcw, 
  Sparkles, 
  Bot 
} from 'lucide-react';

// --- CONFIGURATION ---
const groq = new Groq({ 
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY, 
  dangerouslyAllowBrowser: true 
});

// 1. CONTEXT: Smart Drafter
const AI_DRAFTER_PROMPT = `
You are the **AI Communications Director** for "DAR-E-ARQAM SCHOOL".
Your goal is to write professional, polite, and clear SMS broadcasts to parents based on the user's rough input.

### CORE INSTRUCTIONS
1. **ENGLISH ONLY**: The final output must be in professional English. If the input is in Urdu or Roman Urdu, translate and refine it to English.
2. **ACTION**: 
   - If the user provides a topic (e.g., "fee reminder"), write a full message from scratch.
   - If the user provides a rough draft, polish and fix grammar.
3. **TONE**: Formal, respectful, and authoritative yet gentle. Use "Respected Parent" as the salutation.

### MANDATORY VARIABLES
You MUST seamlessly integrate these placeholders where they make sense naturally:
- {{name}} (Student Name)
- {{fathername}} (Father's Name) - *Optional, use if flow allows*
- {{id}} (Student ID) - *Good for official notices*
- {{class}} (Class Name)

### FORMATTING RULES
- Do not use "Subject:" lines.
- Keep it under 400 characters if possible (SMS friendly).
- Use spacing for readability.
- Ends with "Regards, 
Administration".

### EXAMPLE INPUT/OUTPUT
Input: "tell parents fees is due"
Output: 
Respected Parent,
This is a gentle reminder to submit the pending school fee for your child, {{name}} (Class: {{class}}). Your timely payment ensures smooth school operations. 
Thank you.

Input: "kal chuti hai barish ki waja se"
Output: 
Respected Parent,
Please be informed that the school will remain closed tomorrow due to heavy rain. Regular classes for {{name}} will resume the following day.
Regards,
Administration.

Output **ONLY** the message text. No conversational filler.
`;

const SCHOOL_POLICY_CONTEXT = `
You are a strict AI Compliance Officer for a School Administration System. 
Your task is to review the message text provided by the user to ensure it adheres to school policy.

STRICT OUTPUT FORMAT:
You must return ONLY a JSON object in this exact format:
{
  "allowed": boolean,
  "reason": "Short explanation if rejected, or 'OK' if allowed"
}

POLICY RULES:
1. Language must be professional, polite, and grammatically correct.
2. No threatening, abusive, or slang language. No bad remarks about the school.
3. Messages must be relevant to school activities (Fees, Exams, Attendance, Holidays, or moral lessons).
4. Teachers are not allowed to share personal contacts (Only school address and 03234447292 allowed).

Do not provide conversational text, only the JSON.
`;

export default function BulkMessagePage() {
  const router = useRouter();
  
  const { student: urlStudentId, class: urlClassId } = router.query;

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
    
  const [filterClear, setFilterClear] = useState('all'); 
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); 
  const [isDrafting, setIsDrafting] = useState(false); 
  const [query, setQuery] = useState('');

  // Handle URL Params (Set Class) - Only if student ID is NOT present
  // If student ID is present, we ignore the class selector logic to prevent conflicts
  useEffect(() => {
    if (router.isReady && urlClassId && !urlStudentId) {
      setSelectedClass(String(urlClassId));
    }
  }, [router.isReady, urlClassId, urlStudentId]);

  // Initial fetch for classes list (for the dropdown)
  useEffect(() => {
    supabase
      .from('classes')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Classes fetch error', error);
        else setClasses(data || []);
      });
  }, []);

  // --- MODIFIED: Main Data Fetching Logic ---
  useEffect(() => {
    if (!router.isReady) return;

    const fetchStudents = async () => {
      setLoading(true);
      setStudents([]);
      setSelectedIds(new Set());
      setSelectAll(false);

      try {
        // CASE A: Direct Student Selection (Bypass Class Query)
        if (urlStudentId) {
          const { data, error } = await supabase
            .from('students')
            .select('studentid, name, fathername, class_id, mobilenumber, Clear, classes(name)')
            .eq('studentid', urlStudentId)
            // We use .maybeSingle() or just handle the array. 
            // Since the UI expects an array, we'll keep it as a list of 1.
            .limit(1);

          if (error) throw error;

          if (data && data.length > 0) {
            const formatted = data.map(s => ({
              ...s,
              class: s.classes?.name || ''
            }));
            
            setStudents(formatted);
            // Auto-select the student
            setSelectedIds(new Set([formatted[0].studentid]));
            // Update UI class dropdown to match student (visual only)
            setSelectedClass(String(formatted[0].class_id));
          }
        } 
        
        // CASE B: Class Selection (Standard Bulk Mode)
        else if (selectedClass) {
          const { data, error } = await supabase
            .from('students')
            .select('studentid, name, fathername, class_id, mobilenumber, Clear, classes(name)')
            .eq('class_id', selectedClass)
            .order('name', { ascending: true });

          if (error) throw error;

          const withClass = (data || []).map(s => ({
            ...s,
            class: s.classes?.name || ''
          }));
          setStudents(withClass);
        }

      } catch (error) {
        console.error('Error fetching students:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();

  }, [selectedClass, urlStudentId, router.isReady]);


  // Filtering Logic (Search bar / Status)
  const filtered = useMemo(() => {
    let result = students;

    // Even if we fetched a single student via URL, we allow the search bar 
    // to filter that single result (though likely unnecessary, keeps logic consistent)
    
    if (filterClear === 'true') {
      result = result.filter(s => s.Clear === true);
    } else if (filterClear === 'false') {
      result = result.filter(s => s.Clear !== true);
    }

    const q = query.trim().toLowerCase();
    if (!q) return result;

    return result.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.fathername || '').toLowerCase().includes(q) ||
      String(s.studentid).toLowerCase().includes(q) ||
      (s.mobilenumber || '').toLowerCase().includes(q) ||
      (s.class || '').toLowerCase().includes(q)
    );
  }, [students, query, filterClear]);

  const toggleSelect = (studentid) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(studentid)) next.delete(studentid);
      else next.add(studentid);
      setSelectAll(next.size === filtered.length && filtered.length > 0);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      const all = new Set(filtered.map(s => s.studentid));
      setSelectedIds(all);
      setSelectAll(true);
    }
  };

  const invertSelection = () => {
    setSelectedIds(prev => {
      const next = new Set();
      filtered.forEach(s => {
        if (!prev.has(s.studentid)) next.add(s.studentid);
      });
      setSelectAll(next.size === filtered.length && filtered.length > 0);
      return next;
    });
  };

  // --- AI FUNCTION 1: SMART DRAFTER ---
  const handleSmartDraft = async () => {
    if (!message.trim()) {
      alert("Please type a topic or rough draft first (e.g. 'Exam tomorrow' or 'Fee reminder').");
      return;
    }
    
    setIsDrafting(true);
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: AI_DRAFTER_PROMPT },
          { role: "user", content: `User Input: "${message}"` }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_completion_tokens: 600,
      });

      const draftedText = chatCompletion.choices[0]?.message?.content;
      if (draftedText) {
        setMessage(draftedText); 
      }
    } catch (error) {
      console.error("Drafting failed:", error);
      alert("AI Service unavailable. Please check internet connection.");
    } finally {
      setIsDrafting(false);
    }
  };

  // --- AI FUNCTION 2: POLICY CHECKER ---
  const checkContentPolicy = async (textToCheck) => {
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: SCHOOL_POLICY_CONTEXT },
          { role: "user", content: `Message Content: "${textToCheck}"` }
        ],
        model: "openai/gpt-oss-120b", 
        temperature: 0,
        max_completion_tokens: 2048,
        response_format: { type: 'json_object' },
        stream: false 
      });

      const content = chatCompletion.choices[0]?.message?.content;
      return JSON.parse(content || '{}');

    } catch (error) {
      console.error("Policy check failed:", error);
      return { allowed: false, reason: "Error connecting to Policy Server" };
    }
  };

  // --- MAIN SAVE/SEND HANDLER ---
  const handleSave = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one student.');
      return;
    }
    if (!message.trim()) {
      alert('Please enter a message before saving.');
      return;
    }

    const selectedArray = Array.from(selectedIds);
    const missingNumberStudents = selectedArray
      .map(id => students.find(s => s.studentid === id))
      .filter(s => !s || !s.mobilenumber);

    if (missingNumberStudents.length > 0) {
      const names = missingNumberStudents.map(s => (s ? `${s.name} (${s.studentid})` : '(unknown id)')).join(', ');
      alert(`Cannot save. The following selected students are missing mobile numbers:\n\n${names}\n\nPlease update their mobile number(s) before saving.`);
      return;
    }

    setSaving(true); 

    // --- POLICY CHECK ---
    const policyResult = await checkContentPolicy(message);
    
    if (!policyResult.allowed) {
      setSaving(false);
      alert(`⚠️ Policy Violation Detected:\n\n"${policyResult.reason}"\n\nThe message was NOT sent. Please revise.`);
      return;
    }

    // --- SUPABASE INSERT ---
    const today = new Date().toLocaleDateString();

    try {
      const payload = selectedArray.map(studentid => {
        const student = students.find(s => s.studentid === studentid);

        let customizedMessage = message
          .replace(/{{name}}/g, student?.name || '')
          .replace(/{{fathername}}/g, student?.fathername || '')
          .replace(/{{id}}/g, student?.studentid || '')
          .replace(/{{class}}/g, student?.class || '')
          .replace(/{{date}}/g, today)
          .replace(/_/g, '')
          .replace(/\*/g, '');

        return {
          student_id: studentid,
          number: student?.mobilenumber || '',
          sent: false,
          class_id: student?.class_id,
          text: customizedMessage.trim(),
          created_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('messages')
        .insert(payload);

      if (error) {
        console.error('Save error', error);
        alert('Failed to save messages. Check console for details.');
      } else {
        alert(`✅ Verified & Saved personalized message for ${payload.length} student(s).`);
        setMessage('');
        
        // Don't clear selection if in 'student' URL mode
        if (!urlStudentId) {
          setSelectedIds(new Set());
          setSelectAll(false);
        }
      }
    } catch (err) {
      console.error('Unexpected save error', err);
      alert('Unexpected error while saving. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors">
      <Navbar />
      
      <main className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bulk Messaging</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select students and send personalized broadcasts.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* If class param is present, HIDE the selector (Clean UI) */}
            {(!urlClassId && !urlStudentId) && (
              <div className="md:col-span-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">Select Class</label>
                <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val)}>
                  <SelectTrigger className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* If student param is present, HIDE filters (Clean UI - we are focusing on one student) */}
            {!urlStudentId && (
              <>
                <div className={`${urlClassId ? 'md:col-span-4' : 'md:col-span-3'}`}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">Status</label>
                  <Select value={filterClear} onValueChange={setFilterClear}>
                    <SelectTrigger className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      <SelectItem value="true">Cleared Only</SelectItem>
                      <SelectItem value="false">Not Cleared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={`${urlClassId ? 'md:col-span-8' : 'md:col-span-5'}`}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, ID or mobile..."
                      className="w-full pl-9 pr-4 py-2 rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {/* If we have params and UI is cleaned, show a context badge */}
            {(urlClassId || urlStudentId) && (
               <div className="md:col-span-12 flex items-center gap-2 text-sm text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                 <span className="font-semibold">Mode:</span> 
                 {urlStudentId 
                    ? <span>Direct Student Messaging (ID: {urlStudentId})</span>
                    : <span>Single Class Context</span>
                 }
               </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Col: Student List */}
          <div className="md:col-span-7 flex flex-col">
            <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden h-[500px] md:h-[600px]">
              
              {/* List Header */}
              <div className="p-4 border-b border-gray-100 dark:border-white/5 flex flex-wrap gap-2 items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-sm">
                    {loading ? 'Loading...' : `${filtered.length} Students`}
                  </span>
                </div>
                {/* Hide selection tools if targeting single student via URL */}
                {!urlStudentId && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleSelectAll} 
                      disabled={!students.length} 
                      className="h-8 text-xs border-gray-200 dark:border-white/10"
                    >
                      {selectAll ? <CheckSquare className="w-3 h-3 mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                      {selectAll ? 'Unselect All' : 'Select All'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={invertSelection} 
                      disabled={!students.length}
                      className="h-8 text-xs border-gray-200 dark:border-white/10"
                    >
                      <RefreshCcw className="w-3 h-3 mr-1" /> Invert
                    </Button>
                  </div>
                )}
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                {loading && (
                   <div className="flex flex-col items-center justify-center h-40">
                      <Loader />
                   </div>
                )}
                
                {!loading && filtered.length === 0 && (
                  <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No students found matching criteria.
                  </div>
                )}

                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {filtered.map(s => {
                    const checked = selectedIds.has(s.studentid);
                    return (
                      <li 
                        key={s.studentid} 
                        onClick={() => toggleSelect(s.studentid)}
                        className={`group flex items-center gap-3 p-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${checked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'}`}>
                          <CheckSquare className="w-3 h-3" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-medium truncate ${checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                              {s.name}
                            </span>
                            {s.Clear ? 
                              <span className="text-[10px] whitespace-nowrap inline-flex items-center gap-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                                <ShieldCheck className="w-3 h-3" /> Clear
                              </span> 
                              : 
                              <span className="text-[10px] whitespace-nowrap inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                                Pending
                              </span>
                            }
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="truncate">ID: {s.studentid}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0"></span>
                            <span className="truncate">{s.fathername}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Col: Message Composer */}
          <div className="md:col-span-5 flex flex-col">
             <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-sm p-5 h-auto min-h-[500px] md:h-[600px] flex flex-col relative overflow-hidden">
               
               {/* --- PROMINENT AI BRANDING AREA --- */}
               <div className="mb-4">
                 <div className="flex items-center justify-between mb-2">
                   <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-500" /> AI Assistant
                   </h2>
                 </div>
                 <button 
                   onClick={handleSmartDraft}
                   disabled={isDrafting || !message}
                   className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 hover:from-purple-700 hover:to-blue-700 text-white p-3 rounded-lg shadow-md transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed group"
                 >
                   {isDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                   {isDrafting ? 'Drafting Professional Message...' : 'Generate Professional Message with AI'}
                 </button>
                 <p className="text-[10px] text-gray-400 text-center mt-2">
                   Type a topic (e.g. "fee reminder") or rough draft below, then click Generate.
                 </p>
               </div>
               {/* ---------------------------------- */}

               <div className="flex-1 flex flex-col min-h-0">
                 <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-2">
                   <FileText className="w-4 h-4" /> Message Editor
                 </label>
                 
                 <textarea
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   placeholder="1. Type your idea here... (e.g., 'Tell parents school is closed tomorrow')&#10;2. Click the AI button above to draft it."
                   className="flex-1 w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono min-h-[200px]"
                 />
                 <div className="mt-2 text-[10px] text-gray-400 flex flex-wrap gap-2">
                   <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{name}}'}</span>
                   <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{fathername}}'}</span>
                   <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{id}}'}</span>
                   <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{class}}'}</span>
                   <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{date}}'}</span>
                 </div>
               </div>

               <div className="mt-5 flex flex-wrap gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                 <Button
                   onClick={() => { setSelectedIds(new Set()); setSelectAll(false); setMessage(''); }}
                   disabled={saving}
                   variant="ghost"
                   className="flex-1 min-w-[100px]"
                 >
                   Reset
                 </Button>
                 <Button
                   onClick={handleSave}
                   disabled={saving || selectedIds.size === 0 || !message.trim()}
                   className="flex-[2] min-w-[180px] bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                 >
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                   {saving ? 'Verifying & Sending...' : `Send to ${selectedIds.size} Students`}
                 </Button>
               </div>
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}
