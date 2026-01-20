// pages/bulk-message.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { 
  Search, 
  Users, 
  FileText, 
  Send, 
  CheckSquare, 
  Square, 
  X, 
  ShieldCheck, 
  Lock,
  Loader2,
  RefreshCcw,
  Sparkles
} from 'lucide-react';

// 📝 A styled custom modal component
const CustomModal = ({ title, description, isOpen, onClose, onAction, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-white/5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
            {children}
        </div>
        <div className="flex justify-end gap-3 p-6 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
          <Button onClick={onClose} variant="ghost" className="text-gray-600 dark:text-gray-400">Cancel</Button>
          <Button onClick={onAction} className="bg-blue-600 hover:bg-blue-700 text-white">Generate Message</Button>
        </div>
      </div>
    </div>
  );
};

export default function BulkMessagePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authKey, setAuthKey] = useState('');

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
    
  // State for the filter
  const [filterClear, setFilterClear] = useState('all'); // Options: 'all', 'true', 'false'

  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [templateInputs, setTemplateInputs] = useState({});

  const templates = [
    {
      name: 'PTM Reminder',
      text: (inputs) => `_Respected Parent_,\n\n*A Parent-Teacher Meeting (PTM) has been scheduled on ${inputs.ptm_date} at ${inputs.ptm_time}*. Please ensure your presence to discuss the academic progress of your child, *{{name}}* (ID: {{id}}).\n\nThank you.`,
      placeholders: [{ name: 'ptm_date', label: 'PTM Date', type: 'date' }, { name: 'ptm_time', label: 'PTM Time', type: 'time' }]
    },
    {
      name: 'Fee Reminder',
      text: () => `_Respected Parent_,\n\nThis is a gentle reminder that the school fee for your child, *{{name}}* (Class: {{class}}), is now pending. Your timely payment ensures smooth functioning of school operations.\n\n_Kindly ignore this message if the fee has already been paid._\n\nThank you for your cooperation!`
    },
    {
      name: 'Uniform Notice',
      text: (inputs) => `_Respected Parent_,\n\nThis is a notice regarding the school uniform. We have observed that *{{name}}* (ID: {{id}}) is not adhering to the uniform code due to _${inputs.uniform_issue}_.\n\nPlease ensure your child wears the correct and clean uniform daily. Thank you.`,
      placeholders: [{ name: 'uniform_issue', label: 'Issue', type: 'text' }]
    },
    {
      name: 'Holiday Announcement',
      text: (inputs) => `_Respected Parent_,\n\nPlease note that the school will remain closed on *${inputs.holiday_date}* on account of _${inputs.holiday_reason}_.\n\nRegular classes will resume from the next working day. Thank you.`,
      placeholders: [{ name: 'holiday_date', label: 'Holiday Date', type: 'date' }, { name: 'holiday_reason', label: 'Reason', type: 'text' }]
    },
  ];

  const handleAuth = () => {
    if (authKey === '1234') {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect key. Please try again.');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    supabase
      .from('classes')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Classes fetch error', error);
        else setClasses(data || []);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !selectedClass) {
      setStudents([]);
      setSelectedIds(new Set());
      setSelectAll(false);
      return;
    }

    setLoading(true);
    supabase
      .from('students')
      .select('studentid, name, fathername, class_id, mobilenumber, Clear, classes(name)')
      .eq('class_id', selectedClass)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error('Students fetch error', error);
          setStudents([]);
        } else {
          const withClass = (data || []).map(s => ({
            ...s,
            class: s.classes?.name || ''
          }));
          setStudents(withClass);
          setSelectedIds(new Set());
          setSelectAll(false);
        }
      });
  }, [selectedClass, isAuthenticated]);

  const filtered = useMemo(() => {
    let result = students;

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

  const handleTemplateClick = (template) => {
    setCurrentTemplate(template);
    if (template.placeholders) {
      const initialInputs = template.placeholders.reduce((acc, p) => ({ ...acc, [p.name]: '' }), {});
      setTemplateInputs(initialInputs);
      setShowTemplateModal(true);
    } else {
      setMessage(template.text());
    }
  };

  const generateTemplateMessage = () => {
    if (currentTemplate) {
      setMessage(currentTemplate.text(templateInputs));
      setShowTemplateModal(false);
    }
  };

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

    const today = new Date().toLocaleDateString();

    setSaving(true);
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
        alert(`Saved personalized message for ${payload.length} student(s).`);
        setMessage('');
        setSelectedIds(new Set());
        setSelectAll(false);
      }
    } catch (err) {
      console.error('Unexpected save error', err);
      alert('Unexpected error while saving. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-8 rounded-2xl shadow-xl">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Access</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your authentication key to continue</p>
          </div>
          <div className="space-y-4">
            <div>
              {/* FIXED: Solid backgrounds to ensure text is visible */}
              <input
                type="password"
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                className="block w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="Auth Key"
              />
            </div>
            <Button
              onClick={handleAuth}
              className="w-full rounded-xl py-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/20 transition-all"
            >
              Authenticate
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="md:col-span-3">
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
            <div className="md:col-span-5">
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Col: Student List */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden h-[600px]">
              
              {/* List Header */}
              <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-sm">
                    {loading ? 'Loading...' : `${filtered.length} Students`}
                  </span>
                </div>
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
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                {loading && (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">Fetching student data...</span>
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
                        // COMPACT FIX: Reduced padding to p-2.5 and gap to gap-3
                        className={`group flex items-center gap-3 p-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${checked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'}`}>
                          <CheckSquare className="w-3 h-3" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium truncate ${checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                              {s.name}
                            </span>
                            {s.Clear ? 
                              <span className="text-[10px] inline-flex items-center gap-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                                <ShieldCheck className="w-3 h-3" /> Clear
                              </span> 
                              : 
                              <span className="text-[10px] inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                                Pending
                              </span>
                            }
                          </div>
                          {/* COMPACT FIX: Reduced top margin */}
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="truncate">ID: {s.studentid}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
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
          <div className="lg:col-span-5 flex flex-col h-full">
             <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-sm p-5 h-[600px] flex flex-col">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4" /> Quick Templates
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.name}
                        onClick={() => handleTemplateClick(template)}
                        className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:border-blue-800 text-gray-700 dark:text-gray-300 transition-all text-left"
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Message Body
                  </label>
                  {/* FIXED: Solid backgrounds and high contrast colors */}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here... Use {{name}}, {{fathername}} etc."
                    className="flex-1 w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono"
                  />
                  <div className="mt-2 text-[10px] text-gray-400 flex flex-wrap gap-2">
                    <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{name}}'}</span>
                    <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{fathername}}'}</span>
                    <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{id}}'}</span>
                    <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{class}}'}</span>
                    <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{'{{date}}'}</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                  <Button
                    onClick={() => { setSelectedIds(new Set()); setSelectAll(false); setMessage(''); }}
                    disabled={saving}
                    variant="ghost"
                    className="flex-1"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || selectedIds.size === 0 || !message.trim()}
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    {saving ? 'Sending...' : `Send to ${selectedIds.size} Students`}
                  </Button>
                </div>
             </div>
          </div>

        </div>
      </main>

      <CustomModal
        title={currentTemplate?.name}
        description="Fill in the specific details for this template."
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onAction={generateTemplateMessage}
      >
        <div className="grid gap-5">
          {currentTemplate?.placeholders?.map((p) => (
            <div key={p.name} className="space-y-1.5">
              <label htmlFor={p.name} className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {p.label}
              </label>
              <input
                id={p.name}
                type={p.type}
                value={templateInputs[p.name]}
                onChange={(e) => setTemplateInputs({ ...templateInputs, [p.name]: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          ))}
        </div>
      </CustomModal>
    </div>
  );
}
