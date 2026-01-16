"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Moon,
  Sun,
  LayoutGrid,      
  ScrollText,      
  Trophy,          // Still used for Result Sheet or other results if needed, but class result removed
  FileSpreadsheet, 
  BookOpenCheck,   
  NotebookPen,     
  Sparkles,        
  UserCheck,       
  BellRing,        
  Wallet,          
  ShieldAlert,     
  LogOut,
  User,
  X,
  Menu,
  ChevronRight,
  Power
} from "lucide-react";

// ----- Types & Hooks -----
type Theme = "light" | "dark";

const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("theme") as Theme) || "light";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  return { theme, setTheme, mounted };
};

// Fake Router & Supabase (Mocking functionality for the demo)
const useRouter = () => {
    // In real Next.js, import { useRouter } from 'next/navigation'
    return { push: (p: string) => window.location.href = p }; 
};

const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: "123" } } }), 
    signOut: async () => {
        // Simulate network delay to prove the UI handles it instantly
        return new Promise(resolve => setTimeout(resolve, 500));
    },
  },
};

// ----- Config -----
// REMOVED: /result/class
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "group-hover:border-blue-200 dark:group-hover:border-blue-800" },
  { href: "/marks", label: "Tests", icon: ScrollText, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "group-hover:border-emerald-200 dark:group-hover:border-emerald-800" },
  // { href: "/result/class" } <-- REMOVED
  { href: "/result/sheet", label: "Result Sheet", icon: FileSpreadsheet, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "group-hover:border-cyan-200 dark:group-hover:border-cyan-800" },
  { href: "/syllabus", label: "Syllabus", icon: BookOpenCheck, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20", border: "group-hover:border-violet-200 dark:group-hover:border-violet-800" },
  { href: "/diary", label: "Diary", icon: NotebookPen, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/20", border: "group-hover:border-pink-200 dark:group-hover:border-pink-800" },
  { href: "/activities", label: "Activities", icon: Sparkles, color: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-50 dark:bg-fuchsia-900/20", border: "group-hover:border-fuchsia-200 dark:group-hover:border-fuchsia-800" },
  { href: "/attendance-record/report", label: "Attendance", icon: UserCheck, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20", border: "group-hover:border-teal-200 dark:group-hover:border-teal-800" },
  { href: "/notice", label: "Notice", icon: BellRing, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", border: "group-hover:border-orange-200 dark:group-hover:border-orange-800" },
  { href: "/advance", label: "Advance", icon: Wallet, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", border: "group-hover:border-green-200 dark:group-hover:border-green-800" },
  { href: "/mycomplaint", label: "Complaints", icon: ShieldAlert, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", border: "group-hover:border-rose-200 dark:group-hover:border-rose-800" },
];

// ----- Component -----

const Navbar = () => {
  const { theme, setTheme, mounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user));
  }, []);

  const handleSignOut = async () => {
    // 1. Instant UI Feedback (Optimistic Update)
    setIsOpen(false);
    setIsLoggedIn(false);
    
    // 2. Clear Session locally instantly (if using local storage tokens)
    if (typeof window !== "undefined") {
        localStorage.removeItem("sb-access-token");
        localStorage.removeItem("sb-refresh-token");
    }

    // 3. Redirect Instantly
    router.push("/login");

    // 4. Perform the actual cleanup in background
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Background signout error:", error);
    }
  };

  return (
    <>
      {/* FIXED HEADER 
        Added 'backdrop-saturate-150' for nicer glass colors
      */}
      <nav className="fixed top-0 left-0 right-0 z-[100] h-20 transition-all border-b border-white/20 dark:border-gray-800/20 backdrop-blur-xl backdrop-saturate-150 bg-white/70 dark:bg-gray-950/70 shadow-sm">
        <div className="container mx-auto px-4 h-full flex justify-between items-center">
          
          {/* Logo Area */}
          <Link href="/" className="flex items-center gap-3 group relative select-none">
             {/* Glow effect behind logo */}
             <div className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />
             
             <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 transform group-hover:scale-105 transition-transform duration-300">
               <span className="font-black text-xl">D</span>
             </div>
             
             <div className="flex flex-col relative">
               <span className="font-extrabold text-lg leading-none tracking-tight text-gray-900 dark:text-white">
                 DAR-E-ARQAM
               </span>
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
                 School System
               </span>
             </div>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-all hover:rotate-12"
                aria-label="Toggle Theme"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`
                relative p-2.5 rounded-full transition-all duration-300
                ${isOpen 
                    ? "bg-indigo-600 text-white rotate-90 shadow-md" 
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/30"}
              `}
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* SPACER */}
      <div className="h-20 w-full" aria-hidden="true" />

      {/* DRAWER / MENU */}
      <div
        className={`fixed z-[90] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen 
            ? "opacity-100 visible translate-y-0 scale-100" 
            : "opacity-0 invisible -translate-y-4 scale-[0.98] pointer-events-none"}
          
          /* Mobile: Full Screen, Top padded */
          inset-0 top-20 bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl
          
          /* Desktop: Floating Panel */
          md:inset-auto md:top-24 md:right-6 md:w-[680px] md:h-auto md:max-h-[85vh] 
          md:rounded-[2rem] md:shadow-2xl md:shadow-indigo-500/10 
          md:border md:border-gray-200/50 md:dark:border-gray-700/50
          md:bg-white/80 md:dark:bg-gray-900/90 flex flex-col overflow-hidden
        `}
      >
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
          
          {/* User Profile / Auth Status */}
          <div className="flex items-center justify-between mb-8 p-1">
             <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer">
                   <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 border-2 border-white dark:border-gray-800 shadow-sm">
                      <User size={28} strokeWidth={1.5} />
                   </div>
                   {/* Status Indicator */}
                   <div className={`absolute bottom-0 right-0 w-4 h-4 border-[3px] border-white dark:border-gray-900 rounded-full transition-colors duration-500 ${isLoggedIn ? "bg-emerald-500" : "bg-gray-300"}`} />
                </div>
                
                <div className="flex flex-col">
                   <span className="font-bold text-gray-900 dark:text-white text-base">
                      {isLoggedIn ? "Welcome Back" : "Guest User"}
                   </span>
                   <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isLoggedIn ? "Student Portal" : "Please login to continue"}
                   </span>
                </div>
             </div>

             {/* Auth Action Button */}
             {isLoggedIn ? (
               <button 
                 onClick={handleSignOut}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-all duration-300 group"
               >
                 <span className="text-xs font-bold uppercase tracking-wide">Logout</span>
                 <Power size={16} className="group-hover:text-white" />
               </button>
             ) : (
                <button 
                  onClick={() => router.push('/login')}
                  className="px-6 py-2.5 rounded-full bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all transform hover:-translate-y-0.5"
                >
                  Sign In
                </button>
             )}
          </div>

          {/* Navigation Grid */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Academic & Utilities</h3>
                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{NAV_LINKS.length} Apps</span>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
               {NAV_LINKS.map((link) => {
                 const Icon = link.icon;
                 return (
                   <Link
                     key={link.href}
                     href={link.href}
                     onClick={() => setIsOpen(false)}
                     className={`
                       group relative flex flex-col items-center p-5 rounded-2xl 
                       bg-gray-50/50 dark:bg-gray-800/40 
                       border border-transparent ${link.border}
                       hover:bg-white dark:hover:bg-gray-800
                       hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-black/20
                       transition-all duration-300 ease-out hover:-translate-y-1
                     `}
                   >
                     <div className={`
                       w-12 h-12 rounded-2xl mb-3 flex items-center justify-center 
                       ${link.bg} ${link.color}
                       transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm
                     `}>
                       <Icon size={24} strokeWidth={2} />
                     </div>
                     
                     <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                       {link.label}
                     </span>
                     
                     {/* Decorative Arrow on Hover */}
                     <div className="absolute top-3 right-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                       <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
                     </div>
                   </Link>
                 );
               })}
             </div>
          </div>

        </div>
      </div>
      
      {/* Click Outside Overlay (PC) */}
      {isOpen && (
        <div 
          className="hidden md:block fixed inset-0 z-[80] cursor-default bg-black/5 dark:bg-black/40 backdrop-blur-[1px] transition-all"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;