"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import Navbar from "../../../components/Navbar";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { format, isToday, isTomorrow } from "date-fns";

import {
  MessageSquare, Calendar, CheckCircle2, Clock, Plus, X,
  Search, User, Phone, GraduationCap, Loader2, MoreHorizontal, Briefcase,
  Printer, Trash2, FileText, Send
} from "lucide-react";

import { BADGE_STYLES, FILTERS, INPUT_STYLES, getPakistanDate } from "../../../utils/constants";
import { generateMessageTemplate } from "../../../utils/messageTemplates";
import {
  fetchAllInquiries, updateInquiryStatus,
  incrementFollowUpCount, logMessage
} from "../../../utils/inquiryService";
import { parseFee, printFeeQuote, printTestSlip } from "../../../utils/printUtils";

// ─── Reusable Modal (Overflow Safe with Fixed Footer) ─────────────────────────
const Modal = ({ isOpen, onClose, title, subtitle, children, footer, wide }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-4xl" : "max-w-md"} flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 max-h-[90vh] animate-in zoom-in-95 duration-200`}>

        {/* Header - Fixed */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 text-gray-900 dark:text-white">
          {children}
        </div>

        {/* Footer - Fixed */}
        {footer && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 shrink-0 flex justify-end gap-2 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InquiryManager() {
  const router = useRouter();

  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [testDateDraft, setTestDateDraft] = useState("");
  const [shouldNotify, setShouldNotify] = useState(true);

  const loadInquiries = async () => {
    setLoading(true);
    try { setInquiries(await fetchAllInquiries()); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadInquiries(); }, []);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter(item => {
      const matchesFilter = activeFilter === "All" || item.status === activeFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = item.name.toLowerCase().includes(q) ||
        item.fathername.toLowerCase().includes(q) ||
        item.mobilenumber.includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [inquiries, activeFilter, searchQuery]);

  const openMessageModal = (inquiry, type, extraData = {}) => {
    setSelectedInquiry(inquiry);
    setMessageDraft(generateMessageTemplate(type, inquiry, extraData));
    setIsMessageOpen(true);
  };

  const handleSendMessage = async () => {
    if (!selectedInquiry || !messageDraft) return;
    try {
      await logMessage(selectedInquiry.mobilenumber, messageDraft);
      await incrementFollowUpCount(selectedInquiry.id, selectedInquiry.follow_up_count);
      setIsMessageOpen(false);
      loadInquiries();
    } catch { alert("Failed to log message"); }
  };

  const openStatusModal = (inquiry) => {
    setSelectedInquiry(inquiry);
    setStatusDraft(inquiry.status);
    const defaultTime = getPakistanDate();
    defaultTime.setHours(defaultTime.getHours() + 1);
    setTestDateDraft(
      inquiry.test_date
        ? new Date(inquiry.test_date).toISOString().slice(0, 16)
        : defaultTime.toISOString().slice(0, 16)
    );
    setShouldNotify(true);
    setIsStatusOpen(true);
  };

  const handleStatusUpdate = async () => {
    let updatePayload = { status: statusDraft };
    let messageType = "";
    if (statusDraft === "Test Scheduled") {
      if (!testDateDraft) return alert("Please select a test date/time");
      updatePayload.test_date = testDateDraft;
      messageType = "TEST_SCHEDULED";
    } else {
      if (statusDraft === "Test Clear") messageType = "TEST_CLEAR";
      if (statusDraft === "Admission") messageType = "ADMISSION";
    }
    try {
      await updateInquiryStatus(selectedInquiry.id, updatePayload);
      setIsStatusOpen(false);
      loadInquiries();
      if (shouldNotify && messageType) {
        openMessageModal({ ...selectedInquiry, ...updatePayload }, messageType, { date: testDateDraft });
      }
    } catch (e) { console.error(e); }
  };

  const groupByPhone = (inq) => {
    const grouped = {};
    for (const i of inq) {
      const key = i.mobilenumber;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(i);
    }
    return grouped;
  };

  const handlePrintFee = (inq) => {
    const groups = groupByPhone(inquiries);
    const siblings = groups[inq.mobilenumber] || [inq];
    printFeeQuote(siblings);
  };

  const handlePrintTest = (inq) => {
    const groups = groupByPhone(inquiries);
    const siblings = (groups[inq.mobilenumber] || [inq]).filter(s => s.test_date);
    if (siblings.length === 0) {
      alert("No test scheduled for this student / family.");
      return;
    }
    printTestSlip(siblings);
  };

  const renderTestDate = (dateString) => {
    if (!dateString) return <span className="text-gray-400 dark:text-gray-600 text-xs">Not Scheduled</span>;
    const date = new Date(dateString);
    let colorClass = "text-gray-600 dark:text-gray-400";
    if (isToday(date)) colorClass = "text-amber-700 dark:text-amber-400 font-bold";
    if (isTomorrow(date)) colorClass = "text-blue-700 dark:text-blue-400 font-medium";
    return (
      <div className={`flex items-center gap-1.5 ${colorClass}`}>
        <Calendar size={12} className="opacity-70" />
        <span className="text-xs whitespace-nowrap">{format(date, "MMM d, h:mm a")}</span>
      </div>
    );
  };

  const renderFee = (quoted_fee) => {
    const fee = parseFee(quoted_fee);
    if (!fee.total) return <span className="text-gray-400 text-xs">—</span>;
    return (
      <div className="text-xs space-y-0.5">
        <div className="font-bold text-gray-900 dark:text-white">PKR {fee.total.toLocaleString()}</div>
        <div className="text-gray-400 dark:text-slate-500 font-mono text-[10px]">
          Adm:{fee.admission.toLocaleString()} · Mo:{fee.monthly.toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      <Navbar />

      <div className="container mx-auto max-w-7xl p-4 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white uppercase">Admission Office</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-1">Dar-e-Arqam School · Student Enrollment Portal</p>
          </div>
          <Button
            onClick={() => router.push("/admin/inquiries/add")}
            className="w-full sm:w-auto rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" /> New Application
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Inquiries", val: inquiries.length, icon: Briefcase },
            { label: "Tests Scheduled", val: inquiries.filter(i => i.status === "Test Scheduled").length, icon: Clock },
            { label: "Confirmed Admissions", val: inquiries.filter(i => i.status === "Admission").length, icon: CheckCircle2 },
            { label: "Current Month", val: inquiries.filter(i => new Date(i.created_at || new Date()).getMonth() === new Date().getMonth()).length, icon: Calendar },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white dark:bg-white/5 backdrop-blur-xl p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300"><stat.icon size={14} /></div>
                <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white pl-1">{stat.val}</p>
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-xl shadow-sm overflow-hidden">

          {/* Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
            <div className="flex flex-col w-full md:w-auto gap-1.5">
              <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider">Application Status</label>
              <div className="flex flex-wrap gap-1 p-1 bg-gray-200 dark:bg-black/40 rounded-lg w-full md:w-fit border border-gray-300 dark:border-white/5">
                {FILTERS.map(f => (
                  <button key={f} onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeFilter === f ? "bg-blue-600 text-white shadow-md" : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-300/50 dark:hover:bg-white/10"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full md:w-64 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider">Search Records</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 h-4 w-4" />
                <input
                  placeholder="Name, Phone, or Father..."
                  className="w-full h-9 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg px-3 py-2 pl-9 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3">Candidate Profile</th>
                  <th className="px-4 py-3">Guardian Details</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3">Test Schedule</th>
                  <th className="px-4 py-3">Quoted Fee</th>
                  <th className="px-4 py-3 text-center">Logs</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin h-6 w-6" />Loading records...</div>
                  </td></tr>
                ) : filteredInquiries.length === 0 ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-500">No records found.</td></tr>
                ) : (
                  filteredInquiries.map(inq => (
                    <tr key={inq.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-900/50">
                            {inq.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-slate-200 text-sm">{inq.name}</div>
                            <span className="inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded text-[10px] bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10 font-medium">
                              <GraduationCap size={10} className="mr-1" />{inq.class}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-slate-300"><User size={12} className="text-gray-400" />{inq.fathername}</div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500 dark:text-slate-400"><Phone size={12} className="text-gray-400" />{inq.mobilenumber}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${BADGE_STYLES[inq.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full bg-current ${inq.status === "Inquiry" ? "animate-pulse" : ""}`}></span>
                          {inq.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{renderTestDate(inq.test_date)}</td>
                      <td className="px-4 py-3">{renderFee(inq.quoted_fee)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded text-[10px] font-bold border ${inq.follow_up_count > 0 ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" : "bg-gray-50 text-gray-400 border-gray-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/10"}`}>
                          {inq.follow_up_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" title="Fee Quote" className="h-7 w-7 p-0 rounded-full hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-300" onClick={() => handlePrintFee(inq)}>
                            <FileText size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" title="Test Slip" className="h-7 w-7 p-0 rounded-full hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-300" onClick={() => handlePrintTest(inq)}>
                            <Printer size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" title="Send Message" className="h-7 w-7 p-0 rounded-full hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300" onClick={() => openMessageModal(inq, "FOLLOW_UP")}>
                            <MessageSquare size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" title="Update Status" className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 dark:hover:text-white" onClick={() => openStatusModal(inq)}>
                            <MoreHorizontal size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── MODAL: Update Status ─── */}
      <Modal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        title="Update Application Stage"
        subtitle={`Current: ${selectedInquiry?.status}`}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsStatusOpen(false)} className="text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white h-8 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleStatusUpdate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold shadow-sm h-8 text-xs">Update Status</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Select New Stage</label>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.keys(BADGE_STYLES).map(statusKey => (
                <button key={statusKey} onClick={() => setStatusDraft(statusKey)}
                  className={`p-2.5 rounded-lg border text-sm font-semibold transition-all text-left flex items-center justify-between ${statusDraft === statusKey ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500" : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${statusDraft === statusKey ? "bg-blue-600" : "bg-gray-300 dark:bg-slate-600"}`}></span>
                    {statusKey}
                  </span>
                  {statusDraft === statusKey && <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />}
                </button>
              ))}
            </div>
          </div>

          {statusDraft === "Test Scheduled" && (
            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200 dark:border-amber-900/30">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 mb-2"><Clock size={14} />Date &amp; Time</label>
              <Input type="datetime-local" value={testDateDraft} onChange={e => setTestDateDraft(e.target.value)} className="w-full h-8 bg-gray-50 border border-amber-300 text-gray-900 rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
            </div>
          )}

          <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
            <input type="checkbox" id="notify" checked={shouldNotify} onChange={e => setShouldNotify(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 text-blue-600 rounded border-gray-300" />
            <label htmlFor="notify" className="text-xs select-none cursor-pointer">
              <span className="font-bold block text-gray-900 dark:text-slate-200 leading-tight">Send WhatsApp Notification</span>
              <span className="text-gray-500 dark:text-slate-400">Automatically open message composer after update</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: Message ─── */}
      <Modal
        isOpen={isMessageOpen}
        onClose={() => setIsMessageOpen(false)}
        title="WhatsApp Message"
        subtitle={selectedInquiry?.name}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsMessageOpen(false)} className="text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white h-8 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSendMessage} className="bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold shadow-sm h-8 text-xs">
              <Send size={12} className="mr-1.5" /> Log &amp; Send
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <textarea
            className="w-full min-h-[200px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            value={messageDraft}
            onChange={e => setMessageDraft(e.target.value)}
          />
          <p className="text-[10px] text-gray-400 dark:text-slate-500">Edit the message above before sending. This will be logged in the system.</p>
        </div>
      </Modal>
    </div>
  );
}
