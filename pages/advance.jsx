import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';

export default function RequestAdvancePage() {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [advances, setAdvances] = useState([]);
  const clickGuardRef = useRef(false);

  // Fetch logged-in user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Fetch user advances + payments to compute balance
  const fetchAdvances = async () => {
    if (!user) return;

    const { data: advData, error: advErr } = await supabase
      .from('staff_advances')
      .select('*')
      .eq('staff_id', user.id)
      .order('requested_at', { ascending: false });

    if (advErr) {
      console.error(advErr);
      return;
    }

    if (!advData.length) {
      setAdvances([]);
      return;
    }

    const advanceIds = advData.map(a => a.id);
    const { data: payData, error: payErr } = await supabase
      .from('staff_advance_payments')
      .select('*')
      .in('advance_id', advanceIds);

    if (payErr) {
      console.error(payErr);
      return;
    }

    const advancesWithBalance = advData.map(a => {
      const totalPaid = payData
        .filter(p => p.advance_id === a.id)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return {
        ...a,
        total_paid_back: totalPaid,
        balance: Number(a.amount || 0) - totalPaid
      };
    });

    // Only keep advances where balance > 0
    setAdvances(advancesWithBalance.filter(a => a.balance > 0));
  };

  useEffect(() => {
    fetchAdvances();
  }, [user]);

  // Handle advance request
  const handleRequestAdvance = async (e) => {
    e.preventDefault();
    if (submitting || clickGuardRef.current) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !reason.trim()) {
      alert('Please enter a valid amount and a brief reason.');
      return;
    }

    clickGuardRef.current = true;
    setTimeout(() => (clickGuardRef.current = false), 1500);

    try {
      setSubmitting(true);

      const { error } = await supabase.from('staff_advances').insert([
        {
          staff_id: user.id,
          amount: amt,
          reason: reason.trim(),
          status: 'pending',
        }
      ]);

      if (error) {
        alert('Error requesting advance: ' + error.message);
      } else {
        alert('Advance request submitted');
        setAmount('');
        setReason('');
        fetchAdvances();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto p-6 min-h-screen bg-gray-50 text-gray-900">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-8 tracking-tight">
          Request Advance
        </h1>

        {/* Request Form */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 mb-10">
          <form onSubmit={handleRequestAdvance} className="space-y-5">
            <div>
              <label className="block mb-2 font-medium text-gray-800">
                Amount (Rs.)
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="0.01"
                placeholder="Enter amount"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block mb-2 font-medium text-gray-800">
                Reason
              </label>
              <textarea
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for advance"
                disabled={submitting}
              ></textarea>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Submit
            </button>
          </form>
        </div>

        {/* Advance History */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 tracking-tight">
            My Active Advance Requests
          </h2>

          {(!advances || advances.length === 0) ? (
            <p className="text-gray-700">
              No active advance requests.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {advances.map((adv) => (
                <div
                  key={adv.id}
                  className="relative p-5 bg-white rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200"
                >
                  {/* Status Badge */}
                  <span
                    className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold shadow-sm border
                      ${
                        adv.status === 'approved'
                          ? 'bg-green-500 text-white border-green-200'
                          : adv.status === 'rejected'
                          ? 'bg-red-500 text-white border-red-200'
                          : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      }`}
                  >
                    {String(adv.status || '').toUpperCase()}
                  </span>

                  <p className="font-semibold">
                    Amount: Rs. {Number(adv.amount || 0).toLocaleString('en-PK')}
                  </p>
                  <p className="text-green-700">
                    Paid Back: Rs. {Number(adv.total_paid_back || 0).toLocaleString('en-PK')}
                  </p>
                  <p className="text-red-700">
                    Balance: Rs. {Number(adv.balance || 0).toLocaleString('en-PK')}
                  </p>
                  <p className="text-gray-700">
                    Reason: {adv.reason || '—'}
                  </p>
                  <p className="text-gray-600 text-sm">
                    Requested: {adv.requested_at ? new Date(adv.requested_at).toLocaleDateString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
