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
  CheckCircle, 
  Clock, 
  Plus, 
  X, 
  Search, 
  User, 
  Phone, 
  GraduationCap, 
  Loader2,
  Filter,
  MoreHorizontal
} from "lucide-react";

// --- HELPER: TIMEZONE (GMT+5) ---
const getPakistanDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pkOffset = 5 * 60 * 60 * 1000; // GMT+5
  return new Date(utc + pkOffset);
};

// --- STYLING CONSTANTS (Revamped for Dark Mode Contrast) ---
const BADGE_STYLES = {
  'Inquiry':        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  'Test Scheduled': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  'Test Clear':     'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  'Admission':      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20',
};

const FILTERS = ["All", "Inquiry", "Test Scheduled", "Test Clear", "Admission"];

// --- REUSABLE COMPONENTS ---

const Modal = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Darkened Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {title}
            </h3>
            {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 overflow-y-auto bg-white dark:bg-slate-900 custom-scrollbar">
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
    if (!dateString) return <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>;
    const date = new Date(dateString);
    let colorClass = "text-slate-600 dark:text-slate-300";
    if (isToday(date)) colorClass = "text-amber-600 dark:text-amber-400 font-bold";
    if (isTomorrow(date)) colorClass = "text-blue-600 dark:text-blue-400 font-medium";
    if (isPast(date) && !isToday(date)) colorClass = "text-slate-400 dark:text-slate-500 line-through";
    
    return (
      <div className={`flex items-center gap-2 ${colorClass} bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-md w-fit border border-slate-200 dark:border-slate-700/50`}>
        <Calendar size={12} />
        <span className="text-xs font-mono whitespace-nowrap">{format(date, "MMM d, h:mm a")}</span>
      </div>
    );
  };

  // --- COMMON INPUT STYLES ---
  const inputStyles = "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:focus-visible:border-indigo-500";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      <Navbar />

      <div className="container mx-auto max-w-7xl p-4 md:p-6 lg:p-8 space-y-8">
        
        {/* --- HEADER SECTION --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Admissions</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage student inquiries, testing schedules, and enrollment.</p>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                onClick={() => setIsAddOpen(true)} 
                className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 px-6 dark:shadow-none"
              >
                <Plus className="h-4 w-4 mr-2" /> New Inquiry
              </Button>
          </div>
        </div>

        {/* --- STATS CARDS --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { label: 'Total Inquiries', val: inquiries.length, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' },
                { label: 'Pending Tests', val: inquiries.filter(i => i.status === 'Test Scheduled').length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' },
                { label: 'Admissions', val: inquiries.filter(i => i.status === 'Admission').length, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' },
                { label: 'This Month', val: inquiries.filter(i => new Date(i.created_at || new Date()).getMonth() === new Date().getMonth()).length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' },
            ].map((stat, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} border mb-3 flex items-center justify-center`}>
                        <Filter className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-2xl font-bold mt-1 text-slate-900 dark:text-white`}>{stat.val}</p>
                </div>
            ))}
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                
                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1 p-1.5 bg-slate-100 dark:bg-slate-950/60 rounded-xl w-full lg:w-auto border border-slate-200 dark:border-slate-800">
                  {FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`
                        px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-grow lg:flex-grow-0
                        ${activeFilter === f 
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}
                      `}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full lg:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
                  <input 
                    placeholder="Search students..." 
                    className={`w-full pl-10 h-10 rounded-xl text-sm transition-all outline-none ${inputStyles}`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-white dark:bg-slate-900">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[28%]">Student Profile</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%]">Guardian</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Status</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%]">Schedule</th>
                    <th className="p-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[7%]">Logs</th>
                    <th className="p-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                      <tr><td colSpan="6" className="p-12 text-center text-slate-500 dark:text-slate-400"><Loader2 className="animate-spin h-6 w-6 mx-auto mb-2"/> Loading records...</td></tr>
                  ) : filteredInquiries.length === 0 ? (
                      <tr><td colSpan="6" className="p-12 text-center text-slate-500 dark:text-slate-400">No records found matching your criteria.</td></tr>
                  ) : (
                    filteredInquiries.map((inq) => (
                    <tr key={inq.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm border border-indigo-200 dark:border-indigo-500/30">
                            {inq.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">{inq.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                  <GraduationCap size={10} className="mr-1"/> {inq.class}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 truncate">
                            <User size={12} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> <span className="truncate">{inq.fathername}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                            <Phone size={12} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> {inq.mobilenumber}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${BADGE_STYLES[inq.status] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full bg-current ${inq.status === 'Inquiry' ? 'animate-pulse' : ''}`}></span>
                          {inq.status}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        {renderTestDate(inq.test_date)}
                      </td>
                      <td className="p-4 text-center align-middle">
                          <span className={`
                          inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded text-xs font-bold border
                          ${inq.follow_up_count > 0 
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20' 
                              : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'}
                          `}>
                          {inq.follow_up_count}
                          </span>
                      </td>
                      <td className="p-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300" 
                            onClick={() => openMessageModal(inq, 'FOLLOW_UP')}
                          >
                            <MessageSquare size={14} />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300" 
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
            {/* Section 1: Child Info */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2"><User size={12}/> Student Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Full Name</label>
                    <Input 
                      className={inputStyles}
                      placeholder="e.g. Ali Khan"
                      value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Class</label>
                    <Input 
                      className={inputStyles}
                      placeholder="e.g. Grade 1"
                      value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} 
                    />
                </div>
              </div>
            </div>

            {/* Section 2: Parent Info */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-4">
               <h4 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2"><Phone size={12}/> Guardian Contact</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Father's Name</label>
                    <Input 
                      className={inputStyles}
                      value={form.fathername} onChange={(e) => setForm({ ...form, fathername: e.target.value })} 
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">WhatsApp</label>
                    <Input 
                      className={`${inputStyles} font-mono`}
                      placeholder="923001234567"
                      value={form.mobilenumber} onChange={(e) => setForm({ ...form, mobilenumber: e.target.value })} 
                    />
                </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Quoted Fee</label>
                    <Input 
                        placeholder="0.00" 
                        className={inputStyles}
                        value={form.quoted_fee} onChange={(e) => setForm({ ...form, quoted_fee: e.target.value })} 
                    />
               </div>
               <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Year</label>
                    <Input 
                        type="number" 
                        className={inputStyles}
                        value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} 
                    />
               </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800">Cancel</Button>
                <Button onClick={handleAddSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white">Save Record</Button>
            </div>
        </div>
      </Modal>

      {/* --- MODAL: UPDATE STATUS --- */}
      <Modal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} title="Update Workflow" subtitle={`Current status: ${selectedInquiry?.status}`}>
         <div className="space-y-6">
            <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Select New Stage</label>
                <div className="grid grid-cols-1 gap-2">
                    {Object.keys(BADGE_STYLES).map((statusKey) => (
                        <button
                            key={statusKey}
                            onClick={() => setStatusDraft(statusKey)}
                            className={`p-3 rounded-lg border text-sm font-medium transition-all text-left flex items-center justify-between
                                ${statusDraft === statusKey 
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600' 
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="flex items-center gap-3">
                                <span className={`h-2 w-2 rounded-full ${statusDraft === statusKey ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                {statusKey}
                            </span>
                            {statusDraft === statusKey && <CheckCircle size={16} className="text-indigo-600 dark:text-indigo-400" />}
                        </button>
                    ))}
                </div>
            </div>

            {statusDraft === 'Test Scheduled' && (
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-900/30">
                    <label className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-400 mb-2">
                        <Clock size={14} /> Select Date & Time
                    </label>
                    <Input 
                        type="datetime-local" 
                        value={testDateDraft} 
                        onChange={(e) => setTestDateDraft(e.target.value)} 
                        className="bg-white dark:bg-slate-950 border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white dark:color-scheme-dark"
                    />
                </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                <input 
                    type="checkbox" 
                    id="notify" 
                    checked={shouldNotify} 
                    onChange={(e) => setShouldNotify(e.target.checked)}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <label htmlFor="notify" className="text-sm select-none cursor-pointer">
                    <span className="font-medium block text-slate-900 dark:text-slate-200">Notify Parents via WhatsApp</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">Automatically sends a formatted message based on the status change.</span>
                </label>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => setIsStatusOpen(false)} className="dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800">Cancel</Button>
                <Button onClick={handleStatusUpdate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Confirm Update
                </Button>
            </div>
         </div>
      </Modal>

      {/* --- MODAL: SEND MESSAGE --- */}
      <Modal isOpen={isMessageOpen} onClose={() => setIsMessageOpen(false)} title="Compose Message" subtitle="Send WhatsApp via server.">
         <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 text-sm rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                <User size={16} /> 
                <span className="font-medium">To: {selectedInquiry?.mobilenumber} ({selectedInquiry?.fathername})</span>
            </div>
            
            <textarea 
                className="w-full h-32 p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 outline-none resize-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder="Type your message here..."
            />
            
            <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <Button variant="ghost" onClick={() => setIsMessageOpen(false)} className="dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800">Discard</Button>
                <Button onClick={handleSendMessage} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <MessageSquare size={16} className="mr-2" /> Send Message
                </Button>
            </div>
         </div>
      </Modal>

    </div>
  );
}

