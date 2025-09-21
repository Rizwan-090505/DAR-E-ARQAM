import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function StudentRecordsPage() {
  const [studentId, setStudentId] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showMessages, setShowMessages] = useState(false); // ⬅️ New state for overall messages section
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAttendance, setShowAttendance] = useState(false);
  const [showMarks, setShowMarks] = useState(false);

  // 🔹 Parent-selected date range
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split('T')[0]
  );

  const fetchRecords = async () => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    setShowAttendance(false);
    setShowMarks(false);
    setShowMessages(false); // ⬅️ Reset overall messages state
    setExpandedMessageId(null);
    setMessages([]);

    try {
      // ✅ Attendance in chosen range
      const { data: att, error: attErr } = await supabase
        .from('attendance')
        .select('date,status')
        .eq('studentid', studentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (attErr) throw attErr;

      // ✅ Fetch the relevant tests first, filtering by date and type
      const { data: tests, error: testsErr } = await supabase
        .from('tests')
        .select('id, test_name, test_type, date')
        .neq('test_type', 'Terminal-1')
        .neq('test_type', 'Terminal-2')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (testsErr) throw testsErr;

      const testIds = tests?.map(test => test.id) || [];

      // ✅ Now fetch marks for the student for the relevant tests
      const { data: mk, error: mkErr } = await supabase
        .from('marks')
        .select(`
          obtained_marks,
          total_marks,
          tests (
            id,
            test_name,
            test_type,
            date
          )
        `)
        .eq('studentid', studentId)
        .in('test_id', testIds)
        .order('date', { foreignTable: 'tests', ascending: true });

      if (mkErr) throw mkErr;

      // 📥 Fetch ALL messages for the student, including the ID
      const { data: msgs, error: msgsErr } = await supabase
        .from('messages')
        .select('id, text, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (msgsErr) throw msgsErr;

      setAttendance(att || []);
      setMarks(mk || []);
      setMessages(msgs || []);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  };

  const toggleMessage = (id) => {
    setExpandedMessageId(expandedMessageId === id ? null : id);
  };

  const presentCount = attendance.filter(a =>
    a.status?.toLowerCase() === 'present'
  ).length;
  const absentCount = attendance.filter(a =>
    a.status?.toLowerCase() === 'absent'
  ).length;

  const avgPercent = marks.length
    ? (
        marks.reduce(
          (s, m) =>
            s +
            (Number(m.obtained_marks || 0) /
              Number(m.total_marks || 1)) *
              100,
          0
        ) / marks.length
      ).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6">
      <div className="bg-white border border-green-200 shadow-xl rounded-2xl p-8 w-full max-w-3xl">
        <h1 className="text-3xl font-extrabold text-center mb-8 text-green-700">
          🎓 Student Records
        </h1>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="px-4 py-3 border border-green-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-green-700"
          />
          <button
            onClick={fetchRecords}
            disabled={loading || !studentId}
            className="px-6 py-3 rounded-xl bg-green-500 text-white font-semibold shadow hover:bg-green-600 transition disabled:opacity-40"
          >
            {loading ? 'Fetching…' : 'Fetch Records'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-400 text-green-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-400 text-green-700"
            />
          </div>
        </div>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {/* 🔔 MESSAGES SECTION */}
        {messages.length > 0 && (
          <div className="bg-blue-100 text-blue-800 p-4 rounded-xl mb-6 shadow-inner">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowMessages(!showMessages)}>
              <h3 className="font-semibold flex items-center">
                <span role="img" aria-label="notification" className="mr-2 text-xl">
                  🔔
                </span>
                Messages
              </h3>
              <span className="text-sm font-medium text-blue-600 hover:underline">
                {showMessages ? 'Hide' : 'Show'} Messages
              </span>
            </div>
            {/* ⬅️ Conditional rendering of the messages list */}
            {showMessages && (
              <div className="space-y-4 mt-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents the parent div's click from firing
                      toggleMessage(msg.id);
                    }}
                    className="bg-blue-50 p-4 rounded-lg cursor-pointer hover:bg-blue-100 transition shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">
                        Message from {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-sm text-blue-500">
                        {expandedMessageId === msg.id ? 'Show Less' : 'Show More'}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700">
                      {expandedMessageId === msg.id
                        ? msg.text
                        : `${msg.text.slice(0, 100)}${msg.text.length > 100 ? '...' : ''}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* The rest of the page remains the same */}
        {attendance.length > 0 || marks.length > 0 ? (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-green-100 text-green-700 rounded-xl p-5 text-center shadow">
                <p className="text-lg font-medium">Present</p>
                <p className="text-3xl font-bold">{presentCount}</p>
              </div>
              <div className="bg-red-100 text-red-600 rounded-xl p-5 text-center shadow">
                <p className="text-lg font-medium">Absent</p>
                <p className="text-3xl font-bold">{absentCount}</p>
              </div>
              <div className="bg-green-200 text-green-800 rounded-xl p-5 text-center shadow">
                <p className="text-lg font-medium">Marks' Percentage</p>
                <p className="text-3xl font-bold">{avgPercent}%</p>
              </div>
            </div>

            {/* TOGGLE BUTTONS */}
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <button
                onClick={() => setShowAttendance((s) => !s)}
                className="px-5 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition"
              >
                {showAttendance ? 'Hide Attendance' : 'Show Attendance'}
              </button>
              <button
                onClick={() => setShowMarks((s) => !s)}
                className="px-5 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition"
              >
                {showMarks ? 'Hide Marks' : 'Show Marks'}
              </button>
            </div>

            {/* ATTENDANCE TABLE */}
            {showAttendance && (
              <div className="overflow-x-auto mb-10">
                <table className="w-full text-sm text-left border border-green-200 shadow rounded-xl">
                  <thead className="bg-green-50 text-green-700">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a, idx) => (
                      <tr key={idx} className="border-t hover:bg-green-50">
                        <td className="px-4 py-2">{a.date}</td>
                        <td
                          className={`px-4 py-2 font-medium ${
                            a.status?.toLowerCase() === 'present'
                              ? 'text-green-600'
                              : 'text-red-500'
                          }`}
                        >
                          {a.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* MARKS TABLE */}
            {showMarks && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border border-green-200 shadow rounded-xl">
                  <thead className="bg-green-50 text-green-700">
                    <tr>
                      <th className="px-4 py-2">Test</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Obtained</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m, idx) => {
                      const percent = m.total_marks
                        ? (
                            (Number(m.obtained_marks) /
                              Number(m.total_marks)) *
                            100
                          ).toFixed(1)
                        : 0;
                      return (
                        <tr key={idx} className="border-t hover:bg-green-50">
                          <td className="px-4 py-2">{m.tests?.test_name}</td>
                          <td className="px-4 py-2">{m.tests?.date}</td>
                          <td className="px-4 py-2 text-green-700">
                            {m.obtained_marks}
                          </td>
                          <td className="px-4 py-2 text-green-700">
                            {m.total_marks}
                          </td>
                          <td
                            className={`px-4 py-2 font-medium ${
                              percent >= 50 ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {percent}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-green-700">
            Enter a Student ID and date range to view records.
          </p>
        )}
      </div>
    </div>
  );
}