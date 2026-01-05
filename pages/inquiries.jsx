"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../utils/supabaseClient";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { format, isPast, isToday, isTomorrow, addDays } from "date-fns";
import { 
  MessageSquare, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Plus, 
  X,
  Send,
  Filter,
  Search,
  Sparkles
} from "lucide-react";

// --- HELPER: TIMEZONE (GMT+5) ---
const getPakistanDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pkOffset = 5 * 60 * 60 * 1000; // GMT+5
  return new Date(utc + pkOffset);
};

// --- STYLING CONSTANTS ---
// Explicit pairs: Default (Light) vs Dark
const BADGE_STYLES = {
  'Inquiry': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700 border',
  'Test Scheduled': 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700 border',
  'Test Clear': 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700 border',
  'Admission': 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900 dark:text-violet-200 dark:border-violet-700 border',
};

const SCHOOL_OPTIONS = ["WISSEN Grammar", "Unique Ravian", "American Lyceum", "Other"];
const FILTERS = ["All", "Inquiry", "Test Scheduled", "Test Clear", "Admission"];

// --- FIXED MODAL COMPONENT ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    // 1. OVERLAY: dark/60 for both modes to ensure focus
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      
      {/* 2. CONTAINER: bg-white vs dark:bg-slate-900 */}
      <div className="isolate bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-slate-700 relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            {title}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-transparent p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/10"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
          {children}
        </div>

      </div>
    </div>
  );
};

const InquiryManager = () => {
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
    else setInquiries(data);
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

  // --- PROFESSIONAL MESSAGE TEMPLATES ---
  const generateMessageTemplate = (type, inquiry, extraData = {}) => {
    const parent = inquiry.fathername;
    const student = inquiry.name;
    const schoolName = "DAR-E-ARQAM School";
    
    switch (type) {
      case 'WELCOME':
        return `Dear Mr./Mrs. ${parent},

Thank you for visiting *${schoolName}* for admission inquiry of your child *${student}*! 

We are proud to share that we are *Pakistan's largest educational network with over 800 branches* nationwide. 

- Please feel free to message if you have any queries or want to get admission test scheduled.

Regards,
Admissions Office`;

      case 'TEST_SCHEDULED':
        const tDate = extraData.date ? format(new Date(extraData.date), "EEEE, MMM do 'at' h:mm a") : "an upcoming date";
        return `Dear Parent,

The admission test for *${student}* has been scheduled! 📝

_Date & Time:_
${tDate}

- Please arrive *10 minutes early*. No stationery is required.
- Let us know if you have any questions regarding the test pattern. 

Regards,
Admissions Office`;

      case 'TEST_CLEAR':
        return `Dear Parent,

🎉 *Congratulations!*

We are pleased to inform you that *${student}* has successfully _cleared_ the admission test. 🌟

Please visit the Administrative Office at your earliest convenience to proceed with the admission formalities. 🤝

Regards,
Management
DAR-E-ARQAM SCHOOL`;

      case 'ADMISSION':
        return `Dear Parent,

A warm *Welcome to the DAR-E-ARQAM Family!* 🎒

Admission for _${student}_ is confirmed. We look forward to a bright future together! 

_Important Notes:_
- Please ensure your child's *punctuality* for the best academic results. 
- You are welcome to visit on *Saturdays* to discuss progress, as our teachers are free to meet with you. 
- Please save this number for future correspondence. You will receive attendance,academics and miscellaneous updated via Whatsapp.
Regards,
Administration`;

      case 'FOLLOW_UP':
        return `Respected Parents,

You visited **${schoolName}** for the admission inquiry of your child, _${student}_. 

If you have any queries, please feel free to ask. You can also reply to this message to *schedule the admission test* at your convenience. 📝

Regards,
Admissions Office`;

      default: return "";
    }
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

  // --- HELPER: DATE RENDER ---
  const renderTestDate = (dateString) => {
    if (!dateString) return <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>;
    const date = new Date(dateString);
    let colorClass = "text-gray-600 dark:text-gray-400";
    if (isToday(date)) colorClass = "text-amber-600 dark:text-amber-400 font-bold";
    if (isTomorrow(date)) colorClass = "text-blue-600 dark:text-blue-400 font-medium";
    if (isPast(date) && !isToday(date)) colorClass = "text-gray-400 dark:text-gray-600 line-through";
    return (
      <div className={`flex items-center gap-1.5 ${colorClass}`}>
        <Calendar size={14} />
        <span className="text-sm">{format(date, "MMM d, h:mm a")}</span>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 dark:bg-slate-950 min-h-screen font-sans text-gray-800 dark:text-gray-100 transition-colors duration-200">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles className="text-amber-500" /> Admissions Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">Manage inquiries, schedule tests, and track admissions.</p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="light:bg-green-800 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white shadow-lg transition-all font-semibold">
            <Plus className="mr-2 h-4 w-4 " /> New Inquiry
          </Button>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
          <div className="flex gap-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                  ${activeFilter === f 
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
            <Input 
              placeholder="Search by name or #..." 
              className="pl-10 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-gray-100 transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Student</th>
                <th className="p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Parent Contact</th>
                <th className="p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Test Schedule</th>
                <th className="p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">Follow Ups</th>
                <th className="p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredInquiries.map((inq) => (
                <tr key={inq.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-base text-gray-900 dark:text-gray-100">{inq.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block">
                        {inq.class}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{inq.fathername}</div>
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">{inq.mobilenumber}</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${BADGE_STYLES[inq.status]}`}>
                      {inq.status}
                    </span>
                  </td>
                  <td className="p-4">{renderTestDate(inq.test_date)}</td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {inq.follow_up_count}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full" onClick={() => openMessageModal(inq, 'FOLLOW_UP')}>
                        <MessageSquare size={18} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-full" onClick={() => openStatusModal(inq)}>
                        <CheckCircle size={18} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInquiries.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-gray-400 dark:text-gray-600 flex flex-col items-center">
                    <Filter className="h-12 w-12 mb-4 opacity-20" />
                    <span>No inquiries found.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL: ADD INQUIRY --- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="New Admission Inquiry">
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Student Name</label>
                    <Input 
                      className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
                      value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Class</label>
                    <Input 
                      className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
                      value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} 
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Father's Name</label>
                    <Input 
                      className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
                      value={form.fathername} onChange={(e) => setForm({ ...form, fathername: e.target.value })} 
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Mobile (Whatsapp)</label>
                    <Input 
                      className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
                      value={form.mobilenumber} onChange={(e) => setForm({ ...form, mobilenumber: e.target.value })} 
                    />
                </div>
            </div>

             <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Previous School</label>
                <Input 
                  list="schools" 
                  className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
                  value={form.previous_school} onChange={(e) => setForm({ ...form, previous_school: e.target.value })} 
                />
                <datalist id="schools">{SCHOOL_OPTIONS.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
                <Input type="text" placeholder="Quoted Fee" className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white" value={form.quoted_fee} onChange={(e) => setForm({ ...form, quoted_fee: e.target.value })} />
                <Input type="number" placeholder="Session Year" className="bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>

            <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800">
                <Button variant="outline" className="dark:bg-transparent dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSubmit} className="light:bg-green-800 dark:bg-blue-600 text-white font-bold px-6">Save Inquiry</Button>
            </div>
        </div>
      </Modal>

      {/* --- MODAL: UPDATE STATUS --- */}
      <Modal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} title="Update Workflow Status">
         <div className="space-y-6">
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Current Stage</label>
                <div className="grid grid-cols-2 gap-3">
                    {Object.keys(BADGE_STYLES).map((statusKey) => (
                        <button
                            key={statusKey}
                            onClick={() => setStatusDraft(statusKey)}
                            className={`p-3 rounded-lg border text-sm font-bold transition-all text-left flex items-center justify-between
                                ${statusDraft === statusKey 
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-600 text-blue-800 dark:text-white ring-1 ring-blue-600 shadow-md' 
                                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-950'}`}
                        >
                            {statusKey}
                            {statusDraft === statusKey && <CheckCircle size={18} />}
                        </button>
                    ))}
                </div>
            </div>
            {statusDraft === 'Test Scheduled' && (
                <div className="bg-amber-50 dark:bg-slate-800 p-5 rounded-lg border border-amber-200 dark:border-amber-700 animate-in fade-in slide-in-from-top-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-400 mb-3">
                        <Clock size={16} /> Schedule Test Date & Time (GMT+5)
                    </label>
                    <Input 
                        type="datetime-local" 
                        value={testDateDraft} 
                        onChange={(e) => setTestDateDraft(e.target.value)} 
                        className="bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-gray-900 dark:text-white font-mono"
                    />
                </div>
            )}
            <div className="flex items-start gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <input 
                    type="checkbox" 
                    id="notify" 
                    checked={shouldNotify} 
                    onChange={(e) => setShouldNotify(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                />
                <label htmlFor="notify" className="text-sm text-gray-600 dark:text-gray-300 select-none cursor-pointer">
                    <span className="font-bold block text-gray-900 dark:text-white">Send WhatsApp Notification</span>
                </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" className="dark:bg-transparent dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => setIsStatusOpen(false)}>Cancel</Button>
                <Button onClick={handleStatusUpdate} className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 text-white font-bold">
                    Confirm Update
                </Button>
            </div>
         </div>
      </Modal>

      {/* --- MODAL: SEND MESSAGE --- */}
      <Modal isOpen={isMessageOpen} onClose={() => setIsMessageOpen(false)} title="Compose Message">
         <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="bg-white dark:bg-slate-700 p-2.5 rounded-full text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-slate-600"><MessageSquare size={18}/></div>
                <div>
                    <p className="font-bold text-base">{selectedInquiry?.fathername}</p>
                    <p className="text-xs font-mono opacity-80 mt-0.5">{selectedInquiry?.mobilenumber}</p>
                </div>
            </div>
            <textarea 
                className="w-full h-64 p-4 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 outline-none resize-none shadow-inner leading-relaxed"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder="Type your message here..."
            />
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-500 dark:text-gray-500 italic flex items-center gap-1">
                    <CheckCircle size={12} /> Auto-increments follow-up counter
                </span>
                <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white pl-6 pr-6 font-bold shadow-lg shadow-blue-500/20">
                    <Send className="w-4 h-4 mr-2" /> Send WhatsApp
                </Button>
            </div>
         </div>
      </Modal>

    </div>
  );
};

export default InquiryManager;
