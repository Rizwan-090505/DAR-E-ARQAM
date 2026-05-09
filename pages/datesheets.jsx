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
    if (!das.trim()) {
      setError('Please enter a valid DAS number.');
      return;
    }

    setLoading(true);
    setError('');
    setStudent(null);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('studentid', das)
      .single();

    if (error || !data) {
      setError('Student not found. Please check your DAS number.');
    } else {
      setStudent(data);
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Exam Datesheet</title>
      </Head>

      {/* Forced Light Mode & Compacter Padding */}
      <div 
        className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4 sm:px-6 font-sans text-slate-900"
        style={{ colorScheme: 'light' }}
      >
        
        {/* Header Section */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-950 tracking-tight mb-2">
            Exam Datesheet
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            Enter your DAS number to view your exam schedule and instructions.
          </p>
        </div>

        {/* Main Card (Sleeker, max-w-3xl instead of 4xl) */}
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          
          {/* Search Section */}
          <div className="p-5 sm:p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <input
              type="text"
              placeholder="Enter DAS Number (e.g., 12345)"
              value={das}
              onChange={(e) => setDas(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStudent()}
              className="w-full sm:w-2/3 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-800 focus:ring-2 focus:ring-blue-800/20 text-base font-medium text-slate-900 placeholder-slate-400 outline-none transition-all duration-200"
            />
            <button
              onClick={fetchStudent}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 font-semibold rounded-lg text-green shadow-sm hover:bg-blue-950 hover:shadow disabled:opacity-70 transition-all duration-200 text-base whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 text-white">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Fetching...
                </span>
              ) : (
                'Get Datesheet'
              )}
            </button>
          </div>

          {/* Results Section */}
          <div className="bg-[#F8FAFC] p-6 sm:p-8 min-h-[300px] flex flex-col items-center justify-center transition-all duration-300">
            
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm font-medium w-full max-w-xl text-center border border-red-200 flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {error}
              </div>
            )}

            {!loading && !error && !student && (
              <div className="text-slate-400 flex flex-col items-center gap-3">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p className="text-sm font-medium text-slate-500">Your datesheet will appear here.</p>
              </div>
            )}

            {student && (
              <div className="w-full flex flex-col items-center animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-900 mb-5 self-start">
                  Welcome, <span className="text-blue-700">{student.name}</span>
                </h2>

                {student.Clear ? (
                  /* --- CLEARED STUDENT VIEW --- */
                  <div className="w-full space-y-5">
                    {/* Embedded PDF */}
                    <div className="w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-slate-100">
                      <iframe
                        src="https://drive.google.com/file/d/1KIFdgr7Q9L8AbAFHH0dIx6LQfMHJp3iD/preview"
                        className="w-full h-[65vh] min-h-[800px]"
                        allow="autoplay"
                        title="Student Datesheet"
                      ></iframe>
                    </div>

                    {/* Instructions Panel - Compacter */}
                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 text-left">
                      <div className="flex items-center gap-2.5 mb-3">
                        <svg className="w-5 h-5 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h3 className="text-base font-bold text-blue-950">
                          Important Exam Instructions
                        </h3>
                      </div>
                      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span> No leaves entertained during exams.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span> Bring complete stationery.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span> Arrive on time; late arrivals strictly not allowed.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span> No retakes or make-up exams.
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  /* --- PENDING DUES VIEW --- */
                  <div className="w-full max-w-xl bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden text-left">
                    <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      <div>
                        <h3 className="text-lg font-bold text-red-900">Action Required: Pending Dues</h3>
                      </div>
                    </div>
                    
                    <div className="p-6 space-y-5">
                      <p className="text-slate-700 text-sm leading-relaxed">
                        You currently have pending dues. Please obtain clearance from the <strong className="text-slate-900 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">Accounts Office</strong> to view your complete examination schedule.
                      </p>
                      
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <div>
                          <h4 className="text-blue-950 font-bold text-sm mb-1">First Exam Reminder</h4>
                          <p className="text-blue-900 text-sm">
                            Your first exam is on <strong className="font-semibold">Monday, 11 May 2026</strong>. 
                            <br className="sm:hidden" />
                            Subject: <strong className="font-semibold">Mathematics</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
