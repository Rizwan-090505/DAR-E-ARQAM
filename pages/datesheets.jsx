// pages/das.js
import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Head from 'next/head';

export default function DasPage() {
  const [das, setDas] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStudent = async () => {
    setLoading(true);
    setError('');
    setStudent(null);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('studentid', das)
      .single();

    if (error || !data) {
      setError('Student not found. Please check DAS number.');
    } else {
      setStudent(data);
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>December Tests Datesheet</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-indigo-100 via-white to-pink-50 flex flex-col items-center p-8">
        <h1 className="text-5xl font-extrabold mb-12 text-indigo-900 text-center drop-shadow-lg">
          DECEMBER TESTS DATESHEET
        </h1>

        <div className="flex flex-col items-center w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
          {/* Input */}
          <input
            type="text"
            placeholder="Enter DAS Number"
            value={das}
            onChange={(e) => setDas(e.target.value)}
            className="w-full p-5 mb-6 rounded-3xl border-2 border-indigo-300 focus:border-pink-400 focus:ring-4 focus:ring-pink-200 shadow-lg text-lg font-medium placeholder-gray-400 transition-all duration-300 hover:shadow-xl"
          />

          {/* Fetch Button */}
          <button
            onClick={fetchStudent}
            className="w-[450px] py-5 mb-5 font-bold rounded-3xl bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400 text-white shadow-xl hover:scale-105 transform hover:from-yellow-400 hover:via-pink-500 hover:to-indigo-500 transition-all duration-300 text-lg"
          >
            {loading ? 'Fetching...' : 'Get Datesheet'}
          </button>

          {error && (
            <p className="text-red-700 font-semibold mt-4 text-lg drop-shadow">
              {error}
            </p>
          )}

          {/* Datesheet / Info Block */}
          <div className="mt-8 w-full text-center rounded-3xl overflow-hidden shadow-2xl border-2 border-indigo-300 p-6 bg-gradient-to-r from-indigo-50 via-pink-50 to-yellow-50 flex flex-col items-center">
            {loading ? (
              <p className="text-xl font-semibold text-indigo-700 animate-pulse drop-shadow my-40">
                Loading your datesheet...
              </p>
            ) : student ? (
              student.Clear ? (
                <>
                  <p className="text-3xl font-extrabold mb-6 text-green-700 drop-shadow-md">
                    Welcome, {student.name}!
                  </p>

                  <div className="w-full flex-1 min-h-[80vh] rounded-2xl overflow-hidden shadow-inner border-2 border-pink-300 mb-6">
                    <iframe
                      src="https://drive.google.com/file/d/1ONi81kkWUxJXVmYBPvDcktJ3J3KFFbpW/preview"
                      className="w-full h-full"
                      style={{ minHeight: '80vh' }}
                      allow="autoplay"
                    ></iframe>
                  </div>

                  <div className="bg-gradient-to-r from-indigo-100 via-pink-100 to-yellow-100 p-6 rounded-2xl border-l-8 border-indigo-600 shadow-lg text-left space-y-3">
                    <h2 className="text-3xl font-bold text-indigo-900 mb-2 drop-shadow">
                      Exam Instructions
                    </h2>
                    <ul className="list-disc list-inside text-gray-900 space-y-2 text-lg font-medium">
                      <li>No leaves will be entertained during exams.</li>
                      <li>Bring your own complete stationery from Class One onwards.</li>
                      <li>Arrive on time; late arrivals will not be allowed.</li>
                      <li>No retakes or make-up exams under any circumstances.</li>
                      <li>Follow all instructions given by exam supervisors strictly.</li>
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-2xl text-red-800 font-bold mb-8 drop-shadow-lg">
                  Please get clearance from Accounts Office.
                </p>
              )
            ) : (
              <p className="text-xl text-indigo-700 drop-shadow my-40">
                Enter your DAS number and click "Get Datesheet" to see your December tests schedule.
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        html,
        body {
          background-color: #fdfdfd !important;
          color: #1f2937 !important;
        }
        *, *::before, *::after {
          background-color: inherit !important;
          color: inherit !important;
        }
      `}</style>
    </>
  );
}

