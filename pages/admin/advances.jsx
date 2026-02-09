import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { 
  Users, 
  Filter, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard,
  Plus,
  Calendar,
  ChevronDown
} from 'lucide-react';

// Reusable Glass Card Component
const GlassCard = ({ children, className = "" }) => (
  <div className={`rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-xl shadow-sm dark:shadow-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

export default function AdminAdvancesPage() {
  const [advances, setAdvances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [staffEmails, setStaffEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentInputs, setPaymentInputs] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Data Fetching Logic ---
  useEffect(() => {
    fetchStaffEmails();
  }, []);

  useEffect(() => {
    if (selectedEmail) {
      fetchData(selectedEmail);
    }
  }, [selectedEmail]);

  const fetchStaffEmails = async () => {
    const { data, error } = await supabase
      .from('staff_advances_with_emails')
      .select('staff_email')
      .order('staff_email', { ascending: true });

    if (!error && data) {
      const uniqueEmails = [...new Set(data.map((item) => item.staff_email))];
      setStaffEmails(uniqueEmails);
      if (uniqueEmails.length > 0) {
        setSelectedEmail(uniqueEmails[0]);
      }
    }
  };

  const fetchData = async (email) => {
    setLoading(true);

    const { data: advData, error: advErr } = await supabase
      .from('staff_advances_with_emails')
      .select('*')
      .eq('staff_email', email)
      .order('requested_at', { ascending: false });

    const { data: payData, error: payErr } = await supabase
      .from('staff_advance_payments_with_emails')
      .select('*')
      .in('advance_id', advData?.map((a) => a.id) || [])
      .order('paid_at', { ascending: false });

    if (!advErr) setAdvances(advData || []);
    if (!payErr) setPayments(payData || []);

    setLoading(false);
  };

  // --- Actions ---
  const handleApprove = async (id) => {
    await supabase
      .from('staff_advances')
      .update({
        status: 'approved',
        approved_at: new Date(),
        approved_by: (await supabase.auth.getUser()).data.user.id
      })
      .eq('id', id);
    fetchData(selectedEmail);
  };

  const handleReject = async (id) => {
    await supabase
      .from('staff_advances')
      .update({ status: 'rejected' })
      .eq('id', id);
    fetchData(selectedEmail);
  };

  const handleAddPayment = async (advanceId) => {
    const amount = parseFloat(paymentInputs[advanceId]);
    if (!amount || amount <= 0) {
      alert('Enter valid payment amount');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('staff_advance_payments').insert([
      {
        advance_id: advanceId,
        amount,
        added_by: userData.user.id
      }
    ]);
    setPaymentInputs((prev) => ({ ...prev, [advanceId]: '' }));
    fetchData(selectedEmail);
  };

  // --- Filtering & Helpers ---
  const filteredAdvances = advances.filter((adv) => {
    if (statusFilter === 'completed') return adv.balance <= 0;
    if (statusFilter === 'pending') return adv.status === 'pending';
    if (statusFilter === 'rejected') return adv.status === 'rejected';
    return true;
  });

  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-PK');
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
      </span>
    );
    if (s === 'rejected') return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" /> Rejected
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-medium">
        <Clock className="w-3.5 h-3.5" /> Pending
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 dark:from-[#0b1220] dark:to-[#05070c] text-gray-900 dark:text-slate-100 transition-colors pb-10">
      <Navbar />

      <div className="container mx-auto max-w-6xl p-4 md:p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Admin Advance Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Review requests, approve advances, and record repayments.
          </p>
        </div>

        {/* Controls Bar */}
        <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between sticky top-24 z-10">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            {/* Staff Selector */}
            <div className="space-y-1.5 w-full md:w-64">
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3" /> Select Staff
              </label>
              <div className="relative">
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-lg bg-gray-50 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                >
                  {staffEmails.map((email) => (
                    // Explicit dark background for options to fix visibility
                    <option key={email} value={email} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-slate-100">
                      {email}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5 w-full md:w-48">
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter Status
              </label>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-lg bg-gray-50 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                >
                  {/* Explicit dark background for options */}
                  <option value="all" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-slate-100">All Requests</option>
                  <option value="pending" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-slate-100">Pending</option>
                  <option value="completed" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-slate-100">Completed (Paid)</option>
                  <option value="rejected" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-slate-100">Rejected</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Content Area */}
        {loading ? (
          <div className="text-center py-20 opacity-50">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <Users className="h-8 w-8 text-blue-500 animate-bounce" />
              Loading records...
            </div>
          </div>
        ) : filteredAdvances.length === 0 ? (
           <GlassCard className="p-12 flex flex-col items-center justify-center text-center opacity-75">
             <div className="bg-gray-100 dark:bg-white/10 p-4 rounded-full mb-3">
               <Filter className="h-8 w-8 text-gray-400 dark:text-slate-500" />
             </div>
             <h3 className="font-semibold text-gray-900 dark:text-slate-200">No Records Found</h3>
             <p className="text-gray-500 dark:text-slate-400 max-w-xs mt-1 text-sm">
               Try selecting a different staff member or adjusting the status filter.
             </p>
           </GlassCard>
        ) : (
          <div className="grid gap-6">
            {filteredAdvances.map((adv) => {
              const advancePayments = payments.filter((p) => p.advance_id === adv.id);
              
              return (
                <GlassCard key={adv.id} className="p-0 overflow-visible">
                  {/* Card Header Section */}
                  <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(adv.status)}
                          <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                             <Calendar className="w-3 h-3" /> Requested {formatDate(adv.requested_at)}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                           <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Total:</span>
                           <span className="text-2xl font-bold text-gray-900 dark:text-white">Rs. {formatCurrency(adv.amount)}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 italic">"{adv.reason}"</p>
                        {adv.approved_by_email && (
                          <div className="mt-2 text-xs text-gray-400">Approved by: {adv.approved_by_email}</div>
                        )}
                      </div>

                      {/* Action Buttons for Pending Requests */}
                      {adv.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(adv.id)}
                            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium shadow-lg shadow-green-500/20 transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(adv.id)}
                            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-red-200 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-all active:scale-95"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body: Financials & Payments */}
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left: Financial Status */}
                    <div className="lg:col-span-1 space-y-6">
                       {/* Balance Box */}
                       <div className="p-4 rounded-xl  bg-black/10 border border-gray-100 dark:border-white/5">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold uppercase text-gray-500">Paid Back</span>
                            <span className="text-green-600 dark:text-green-400 font-medium text-sm">Rs. {formatCurrency(adv.total_paid_back)}</span>
                         </div>
                         <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-white/10">
                            <span className="text-xs font-semibold uppercase text-gray-500">Remaining</span>
                            <span className="text-red-600 dark:text-red-400 font-bold text-lg">Rs. {formatCurrency(adv.balance)}</span>
                         </div>
                       </div>

                       {/* Add Payment Form */}
                       {adv.status === 'approved' && adv.balance > 0 && (
                         <div className="space-y-2">
                           <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                             Record Repayment
                           </label>
                           <div className="flex gap-2">
                             <div className="relative flex-1">
                               <span className="absolute left-3 top-2.5 text-gray-500 text-sm font-semibold">Rs.</span>
                               <input
                                 type="number"
                                 value={paymentInputs[adv.id] || ''}
                                 onChange={(e) => setPaymentInputs((prev) => ({ ...prev, [adv.id]: e.target.value }))}
                                 placeholder="0.00"
                                 className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                               />
                             </div>
                             <button
                               onClick={() => handleAddPayment(adv.id)}
                               className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                             >
                               <Plus className="w-5 h-5" />
                             </button>
                           </div>
                         </div>
                       )}
                    </div>

                    {/* Right: Payment History Table */}
                    <div className="lg:col-span-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" /> Payment History
                      </h4>
                      
                      <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 font-medium">
                            <tr>
                              <th className="px-4 py-2">Date</th>
                              <th className="px-4 py-2">Added By</th>
                              <th className="px-4 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-transparent">
                            {advancePayments.length === 0 ? (
                              <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-gray-400 text-xs italic">
                                  No payments recorded yet.
                                </td>
                              </tr>
                            ) : (
                              advancePayments.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                  <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">
                                    {formatDate(p.paid_at)}
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 text-xs">
                                    {p.added_by_email}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                                    Rs. {formatCurrency(p.amount)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
