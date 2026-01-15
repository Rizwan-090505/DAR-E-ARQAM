
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../utils/supabaseClient";
import Navbar from "../components/Navbar";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Plus, 
  X, 
  Search, 
  User, 
  Phone, 
  GraduationCap, 
  Loader2,
  Filter,
  MoreHorizontal,
  Briefcase
} from "lucide-react";

// --- HELPER: TIMEZONE (GMT+5) ---
const getPakistanDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pkOffset = 5 * 60 * 60 * 1000; // GMT+5
  return new Date(utc + pkOffset);
};

// --- STYLING CONSTANTS ---
const BADGE_STYLES = {
  'Inquiry':        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50',
  'Test Scheduled': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/50',
  'Test Clear':     'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/50',
  'Admission':      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-900/50',
};

const FILTERS = ["All", "Inquiry", "Test Scheduled", "Test Clear", "Admission"];

// --- UPDATED INPUT STYLE (FORCED LIGHT THEME) ---
// FIX: Removed all 'dark:' classes for bg and text. 
// This forces the input to always be Light Gray BG with Dark Gray Text, ensuring visibility.
const inputStyles = "w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm font-medium placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm";

// --- REUSABLE MODAL COMPONENT ---
const Modal = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-start bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {title}
            </h3>
            {subtitle && <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function InquiryManager() {
  // --- STATE ---
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
    
  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  // Active Data
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
    
  // Status Logic
  const [statusDraft, setStatusDraft] = useState("");
  const [testDateDraft, setTestDateDraft] = useState("");
  const [shouldNotify, setShouldNotify] = useState(true);

  // Form State
  const [form, setForm] = useState({
    name: "", class: "PG", fathername: "", address: "", previous_school: "",
    mobilenumber: "", date: format(getPakistanDate(), "yyyy-MM-dd"), session: "Fall",
    year: getPakistanDate().getFullYear(), quoted_fee: "", number_of_children: 1,
  });

  // --- FETCH DATA ---
  const fetchInquiries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inquiries")
      .select("*")
      .order("id", { ascending: false });
    
    if (error) console.error("Error fetching:", error);
    else setInquiries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInquiries(); }, []);

  // --- FILTER & SEARCH ---
  const filteredInquiries = useMemo(() => {
    return inquiries.filter(item => {
      const matchesFilter = activeFilter === "All" || item.status === activeFilter;
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.fathername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mobilenumber.includes(searchQuery);
      return matchesFilter && matchesSearch;
    });
  }, [inquiries, activeFilter, searchQuery]);

  // --- ACTIONS ---
  const handleAddSubmit = async () => {
    const trimmedForm = {
      ...form,
      name: form.name.trim(),
      fathername: form.fathername.trim(),
      mobilenumber: form.mobilenumber.trim(),
      status: 'Inquiry',
      follow_up_count: 0
    };

    const { data, error } = await supabase.from("inquiries").insert([trimmedForm]).select();
    if (error) return console.error("Error saving:", error);

    const newInquiry = data?.[0];
    openMessageModal(newInquiry, 'WELCOME');
    
    setForm({ ...form, name: "", fathername: "", mobilenumber: "", quoted_fee: "" });
    setIsAddOpen(false);
    fetchInquiries();
  };

  // --- MESSAGE LOGIC ---
  const generateMessageTemplate = (type, inquiry, extraData = {}) => {
    const parent = inquiry.fathername;
    const student = inquiry.name;
    const schoolName = "DAR-E-ARQAM School";
    
    if(type === 'WELCOME') return `Dear ${parent}, Welcome to ${schoolName} regarding ${student}.`;
    if(type === 'TEST_SCHEDULED') return `Dear Parent, Test scheduled for ${student} on ${extraData.date}.`;
    if(type === 'TEST_CLEAR') return `Congratulations! ${student} cleared the test.`;
    if(type === 'ADMISSION') return `Admission confirmed for ${student}.`;
    if(type === 'FOLLOW_UP') return `Dear Parent, following up on admission for ${student}.`;
    return "";
  };

  const openMessageModal = (inquiry, type, extraData = {}) => {
    setSelectedInquiry(inquiry);
    const text = generateMessageTemplate(type, inquiry, extraData);
    setMessageDraft(text);
    setIsMessageOpen(true);
  };

  const handleSendMessage = async () => {
    if (!selectedInquiry || !messageDraft) return;
    const { error } = await supabase.from("messages").insert([{
      number: selectedInquiry.mobilenumber,
      text: messageDraft
    }]);
    if (error) return alert("Failed to log message");
    const newCount = (selectedInquiry.follow_up_count || 0) + 1;
    await supabase.from("inquiries").update({ follow_up_count: newCount }).eq('id', selectedInquiry.id);
    setIsMessageOpen(false);
    fetchInquiries();
  };

  const openStatusModal = (inquiry) => {
    setSelectedInquiry(inquiry);
    setStatusDraft(inquiry.status);
    const defaultTime = getPakistanDate();
    defaultTime.setHours(defaultTime.getHours() + 1);
    setTestDateDraft(inquiry.test_date ? new Date(inquiry.test_date).toISOString().slice(0, 16) : defaultTime.toISOString().slice(0, 16));
    setShouldNotify(true);
    setIsStatusOpen(true);
  };

  const handleStatusUpdate = async () => {
    let updatePayload = { status: statusDraft };
    let messageType = '';
    if (statusDraft === 'Test Scheduled') {
        if(!testDateDraft) return alert("Please select a test date/time");
        updatePayload.test_date = testDateDraft;
        messageType = 'TEST_SCHEDULED';
    } else {
        if (statusDraft === 'Test Clear') messageType = 'TEST_CLEAR';
        if (statusDraft === 'Admission') messageType = 'ADMISSION';
    }
    const { error } = await supabase.from("inquiries").update(updatePayload).eq('id', selectedInquiry.id);
    if (error) return console.error(error);
    setIsStatusOpen(false);
    fetchInquiries();
    if (shouldNotify && messageType) {
        const updatedInquiry = { ...selectedInquiry, ...updatePayload };
        openMessageModal(updatedInquiry, messageType, { date: testDateDraft });
    }
  };

  // --- RENDER HELPERS ---
  const renderTestDate = (dateString) => {
    if (!dateString) return <span className="text-gray-400 dark:text-gray-600 text-xs">N/A</span>;
    const date = new Date(dateString);
    let colorClass = "text-gray-600 dark:text-gray-400";
    if (isToday(date)) colorClass = "text-amber-700 dark:text-amber-400 font-bold";
    if (isTomorrow(date)) colorClass = "text-blue-700 dark:text-blue-400 font-medium";
    
    return (
      <div className={`flex items-center gap-2 ${colorClass}`}>
        <Calendar size={12} className="opacity-70" />
        <span className="text-xs whitespace-nowrap">{format(date, "MMM d, h:mm a")}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      <Navbar />

      <div className="container mx-auto max-w-6xl p-4 md:p-8 space-y-8">
        
        {/* --- HEADER SECTION --- */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admissions Dashboard</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-1">Manage student inquiries and testing.</p>
          </div>
          <Button 
            onClick={() => setIsAddOpen(true)} 
            className="w-full sm:w-auto rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-blue-500/20 transition-all font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" /> New Inquiry
          </Button>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { label: 'Total Inquiries', val: inquiries.length, icon: Briefcase },
                { label: 'Pending Tests', val: inquiries.filter(i => i.status === 'Test Scheduled').length, icon: Clock },
                { label: 'Admissions', val: inquiries.filter(i => i.status === 'Admission').length, icon: CheckCircle2 },
                { label: 'This Month', val: inquiries.filter(i => new Date(i.created_at || new Date()).getMonth() === new Date().getMonth()).length, icon: Calendar },
            ].map((stat, idx) => (
                <div key={idx} className="bg-white dark:bg-white/5 backdrop-blur-xl p-5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300">
                             <stat.icon size={16} />
                        </div>
                        <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white pl-1">{stat.val}</p>
                </div>
            ))}
        </div>

        {/* --- MAIN CONTENT CARD --- */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-xl shadow-sm dark:shadow-xl overflow-hidden">
            
            {/* Filters Toolbar */}
            <div className="p-5 border-b border-gray-200 dark:border-white/10 flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
                
                {/* Segmented Control Filters */}
                <div className="flex flex-col w-full md:w-auto gap-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider">Status Filter</label>
                    <div className="flex flex-wrap gap-1 p-1 bg-gray-200 dark:bg-black/40 rounded-lg w-full md:w-fit border border-gray-300 dark:border-white/5">
                    {FILTERS.map(f => (
                        <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`
                            px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                            ${activeFilter === f 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-300/50 dark:hover:bg-white/10'}
                        `}
                        >
                        {f}
                        </button>
                    ))}
                    </div>
                </div>

                {/* Search Box - Using inputStyles here too for consistency, or keep it dark/themed? 
                    Let's keep the main search themed, but ensure text is visible.
                */}
                <div className="w-full md:w-64 space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 h-4 w-4" />
                        {/* Search is NOT in a modal, so we can keep it themed or force it. Let's force it to be consistent with the user request if they want "dark grey text". 
                            But usually main search bars should adapt. The user specified "in modal".
                            I will leave this search bar ADAPTIVE (dark bg in dark mode) but ensure text is white.
                        */}
                        <input 
                            placeholder="Name, Phone, or Father..." 
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 pl-9 text-sm font-medium placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-slate-400 uppercase text-xs font-bold border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4">Student Profile</th>
                    <th className="px-6 py-4">Guardian Info</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Schedule</th>
                    <th className="px-6 py-4 text-center">Logs</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {loading ? (
                      <tr><td colSpan="6" className="py-12 text-center text-gray-500 dark:text-slate-400"><div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin h-6 w-6"/>Loading records...</div></td></tr>
                  ) : filteredInquiries.length === 0 ? (
                      <tr><td colSpan="6" className="py-12 text-center text-gray-500 dark:text-slate-400">No students found matching your filters.</td></tr>
                  ) : (
                    filteredInquiries.map((inq) => (
                    <tr key={inq.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-900/50">
                            {inq.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-slate-200 text-sm">{inq.name}</div>
                            <span className="inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-[10px] bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10 font-medium">
                                <GraduationCap size={10} className="mr-1"/> {inq.class}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                            <User size={12} className="text-gray-400" /> <span>{inq.fathername}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-gray-500 dark:text-slate-400">
                            <Phone size={12} className="text-gray-400" /> {inq.mobilenumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${BADGE_STYLES[inq.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full bg-current ${inq.status === 'Inquiry' ? 'animate-pulse' : ''}`}></span>
                          {inq.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {renderTestDate(inq.test_date)}
                      </td>
                      <td className="px-6 py-4 text-center">
                          <span className={`
                          inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded text-xs font-bold border
                          ${inq.follow_up_count > 0 
                              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' 
                              : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/10'}
                          `}>
                          {inq.follow_up_count}
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 rounded-full hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition-colors" 
                            onClick={() => openMessageModal(inq, 'FOLLOW_UP')}
                          >
                            <MessageSquare size={14} />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 dark:hover:text-white transition-colors" 
                            onClick={() => openStatusModal(inq)}
                          >
                            <MoreHorizontal size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
        </div>

      </div>

      {/* --- MODAL: ADD INQUIRY --- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="New Inquiry" subtitle="Enter student details below.">
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Student Name</label>
                    {/* INPUTS FORCED LIGHT: bg-gray-50, text-gray-900 */}
                    <Input 
                      className={inputStyles}
                      placeholder="e.g. Ali Khan"
                      value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Class</label>
                    <Input 
                      className={inputStyles}
                      placeholder="e.g. Grade 1"
                      value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Father Name</label>
                    <Input 
                      className={inputStyles}
                      value={form.fathername} onChange={(e) => setForm({ ...form, fathername: e.target.value })} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">WhatsApp</label>
                    <Input 
                      className={`${inputStyles} font-mono`}
                      placeholder="923001234567"
                      value={form.mobilenumber} onChange={(e) => setForm({ ...form, mobilenumber: e.target.value })} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-slate-800">
               <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Quoted Fee</label>
                    <Input 
                        placeholder="0.00" 
                        className={inputStyles}
                        value={form.quoted_fee} onChange={(e) => setForm({ ...form, quoted_fee: e.target.value })} 
                    />
               </div>
               <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Session Year</label>
                    <Input 
                        type="number" 
                        className={inputStyles}
                        value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} 
                    />
               </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 font-medium">Cancel</Button>
                <Button onClick={handleAddSubmit} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm">Save Record</Button>
            </div>
        </div>
      </Modal>

      {/* --- MODAL: UPDATE STATUS --- */}
      <Modal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} title="Update Workflow" subtitle={`Current status: ${selectedInquiry?.status}`}>
         <div className="space-y-6">
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Select New Stage</label>
                <div className="grid grid-cols-1 gap-2">
                    {Object.keys(BADGE_STYLES).map((statusKey) => (
                        <button
                            key={statusKey}
                            onClick={() => setStatusDraft(statusKey)}
                            className={`p-3 rounded-lg border text-sm font-semibold transition-all text-left flex items-center justify-between
                                ${statusDraft === statusKey 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500 shadow-sm' 
                                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="flex items-center gap-3">
                                <span className={`h-2.5 w-2.5 rounded-full ${statusDraft === statusKey ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}></span>
                                {statusKey}
                            </span>
                            {statusDraft === statusKey && <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />}
                        </button>
                    ))}
                </div>
            </div>

            {statusDraft === 'Test Scheduled' && (
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-900/30 animate-in fade-in slide-in-from-top-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-400 mb-2">
                        <Clock size={16} /> Select Date & Time
                    </label>
                    <Input 
                        type="datetime-local" 
                        value={testDateDraft} 
                        onChange={(e) => setTestDateDraft(e.target.value)} 
                        /* FIXED: Forced light bg and dark text for datetime picker */
                        className="w-full bg-gray-50 border border-amber-300 text-gray-900 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
                <input 
                    type="checkbox" 
                    id="notify" 
                    checked={shouldNotify} 
                    onChange={(e) => setShouldNotify(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-slate-600 bg-white"
                />
                <label htmlFor="notify" className="text-sm select-none cursor-pointer">
                    <span className="font-bold block text-gray-900 dark:text-slate-200">Notify Parents via WhatsApp</span>
                    <span className="text-gray-500 dark:text-slate-400 text-xs font-medium">Automatically sends a formatted message based on the status change.</span>
                </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => setIsStatusOpen(false)} className="text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 font-medium">Cancel</Button>
                <Button onClick={handleStatusUpdate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm">
                    Confirm Update
                </Button>
            </div>
         </div>
      </Modal>

      {/* --- MODAL: SEND MESSAGE --- */}
      <Modal isOpen={isMessageOpen} onClose={() => setIsMessageOpen(false)} title="Compose Message" subtitle="Send WhatsApp via server.">
         <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 text-sm rounded-lg border border-blue-200 dark:border-blue-900/30">
                <User size={16} /> 
                <span className="font-semibold">To: {selectedInquiry?.mobilenumber} ({selectedInquiry?.fathername})</span>
            </div>
            
            <textarea 
                /* FIXED: Forced bg-gray-50 and text-gray-900 (Dark Grey Text on Light BG) */
                className="w-full h-32 p-3 text-sm font-medium rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none resize-none shadow-inner"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder="Type your message here..."
            />
            
            <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800 pt-4">
                <Button variant="ghost" onClick={() => setIsMessageOpen(false)} className="text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 font-medium">Discard</Button>
                <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm">
                    <MessageSquare size={16} className="mr-2" /> Send Message
                </Button>
            </div>
         </div>
      </Modal>

    </div>
  );
}


