import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';

export default function AdminAdvancesPage() {
  const [advances, setAdvances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [staffEmails, setStaffEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentInputs, setPaymentInputs] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    document.documentElement.classList.remove('dark'); // force light mode
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

  const filteredAdvances = advances.filter((adv) => {
    if (statusFilter === 'completed') return adv.balance === 0;
    if (statusFilter === 'pending') return adv.status === 'pending';
    if (statusFilter === 'rejected') return adv.status === 'rejected';
    return true;
  });

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 min-h-screen bg-gray-50">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 tracking-tight">
          Staff Advances Admin
        </h1>

        {/* Staff Email Dropdown */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Select Staff Email:
            </label>
            <select
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              {staffEmails.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Filter by Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div>Loading records…</div>
        ) : (
          <div className="grid gap-6">
            {filteredAdvances.map((adv) => (
              <div
                key={adv.id}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 transition hover:shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-semibold text-lg">
                      {adv.staff_email}
                    </p>
                    <p className="text-gray-600 text-sm">
                      Requested: {new Date(adv.requested_at).toLocaleDateString()}
                    </p>
                    <p className="text-gray-800">
                      Amount: Rs. {adv.amount.toLocaleString('en-PK')}
                    </p>
                    <p className="text-gray-800">Reason: {adv.reason}</p>
                    <p className="text-gray-700 font-medium">
                      Status: <span className="capitalize">{adv.status}</span>
                    </p>
                    <p className="text-green-700">
                      Paid Back: Rs. {adv.total_paid_back.toLocaleString('en-PK')}
                    </p>
                    <p className="text-red-700">
                      Balance: Rs. {adv.balance.toLocaleString('en-PK')}
                    </p>
                    {adv.approved_by_email && (
                      <p className="text-sm text-gray-500">
                        Approved by: {adv.approved_by_email}
                      </p>
                    )}
                  </div>
                  {adv.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(adv.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(adv.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {adv.status === 'approved' && adv.balance > 0 && (
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="number"
                      value={paymentInputs[adv.id] || ''}
                      onChange={(e) =>
                        setPaymentInputs((prev) => ({
                          ...prev,
                          [adv.id]: e.target.value
                        }))
                      }
                      placeholder="Payment amount"
                      className="px-3 py-2 border rounded w-40"
                    />
                    <button
                      onClick={() => handleAddPayment(adv.id)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
                    >
                      Add Payment
                    </button>
                  </div>
                )}

                {/* Payment history for this advance */}
                <div className="mt-4 border-t pt-3">
                  <p className="font-semibold text-gray-800 mb-2">
                    Payment History
                  </p>
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 border">Amount</th>
                        <th className="p-2 border">Paid At</th>
                        <th className="p-2 border">Added By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments
                        .filter((p) => p.advance_id === adv.id)
                        .map((p) => (
                          <tr key={p.id}>
                            <td className="p-2 border">
                              Rs. {p.amount.toLocaleString('en-PK')}
                            </td>
                            <td className="p-2 border">
                              {new Date(p.paid_at).toLocaleDateString()}
                            </td>
                            <td className="p-2 border">{p.added_by_email}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
