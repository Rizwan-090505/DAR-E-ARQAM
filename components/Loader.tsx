import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-sm dark:bg-slate-900/95 transition-colors duration-300">
      
      {/* --- CSS Injection for custom Keyframes (Self-contained) --- */}
      <style>{`
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
          50% { opacity: 0.8; transform: scale(0.95); box-shadow: 0 0 10px rgba(16, 185, 129, 0.1); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 3s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 4s linear infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      {/* --- Graphical Element --- */}
      <div className="relative w-40 h-40 mb-8">
        
        {/* Outer Ring - Slow Gold */}
        <div className="absolute inset-0 border-4 border-transparent border-t-amber-500/80 border-b-amber-500/20 rounded-full animate-spin-slow"></div>
        
        {/* Middle Ring - Fast Green (Reverse) */}
        <div className="absolute inset-2 border-4 border-transparent border-l-emerald-600 border-r-emerald-600/30 rounded-full animate-spin-reverse"></div>
        
        {/* Inner Ring - Dynamic Accent */}
        <div className="absolute inset-6 border-2 border-dashed border-slate-400/50 dark:border-slate-500 rounded-full animate-[spin_10s_linear_infinite]"></div>

        {/* Center Core - Logo/Icon Placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-full flex items-center justify-center shadow-lg animate-pulse-glow z-10">
            {/* Book/Open Icon SVG */}
            <svg 
              className="w-8 h-8 text-white drop-shadow-md" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
      </div>

      {/* --- Text Content --- */}
      <div className="text-center relative z-20">
        <h1 className="text-3xl font-bold tracking-wider text-slate-800 dark:text-white uppercase font-serif">
          <span className="inline-block animate-pulse">D</span>
          <span className="inline-block animate-pulse delay-75">a</span>
          <span className="inline-block animate-pulse delay-100">r</span>
          <span className="inline-block">-</span>
          <span className="inline-block animate-pulse delay-150">e</span>
          <span className="inline-block">-</span>
          <span className="inline-block animate-pulse delay-200">A</span>
          <span className="inline-block animate-pulse delay-300">r</span>
          <span className="inline-block animate-pulse delay-500">q</span>
          <span className="inline-block animate-pulse delay-700">a</span>
          <span className="inline-block animate-pulse delay-1000">m</span>
        </h1>
        
        {/* Animated Gradient Subtitle */}
        <div className="mt-2 overflow-hidden">
          <p className="text-sm font-semibold tracking-[0.5em] text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 animate-[pulse_3s_ease-in-out_infinite] uppercase">
            School System
          </p>
        </div>
      </div>

      {/* --- Decorative Background Blur Circles (Optional for depth) --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
    </div>
  );
};

export default Loader;