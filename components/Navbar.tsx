"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Moon,
  Sun,
  LayoutGrid,      // New Dashboard
  ScrollText,      // New Tests
  Trophy,          // New Results
  FileSpreadsheet, // New Sheet
  BookOpenCheck,   // New Syllabus
  NotebookPen,     // New Diary
  Sparkles,        // New Activities
  UserCheck,       // New Attendance
  BellRing,        // New Notice
  Wallet,          // New Advance
  ShieldAlert,     // New Complaint
  LogOut,
  User,
  X,
  Menu,
  ChevronRight
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

// Fake Router & Supabase
const useRouter = () => ({ push: (p: string) => console.log("Navigating to:", p) });
const supabase = {
  auth: {
    // Return user to simulate logged in, return null to simulate logged out
    getUser: async () => ({ data: { user: { id: "123" } } }), 
    signOut: async () => console.log("User signed out"),
  },
};

// ----- Config (Updated Icons) -----
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100/50 dark:bg-blue-900/30" },
  { href: "/marks", label: "Tests", icon: ScrollText, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100/50 dark:bg-emerald-900/30" },
  { href: "/result/class", label: "Results", icon: Trophy, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100/50 dark:bg-amber-900/30" },
  { href: "/result/sheet", label: "Result Sheet", icon: FileSpreadsheet, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100/50 dark:bg-cyan-900/30" },
  { href: "/syllabus", label: "Syllabus", icon: BookOpenCheck, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100/50 dark:bg-violet-900/30" },
  { href: "/diary", label: "Diary", icon: NotebookPen, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100/50 dark:bg-pink-900/30" },
  { href: "/activities", label: "Activities", icon: Sparkles, color: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-100/50 dark:bg-fuchsia-900/30" },
  { href: "/attendance-record/report", label: "Attendance", icon: UserCheck, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100/50 dark:bg-teal-900/30" },
  { href: "/notice", label: "Notice", icon: BellRing, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100/50 dark:bg-orange-900/30" },
  { href: "/advance", label: "Advance", icon: Wallet, color: "text-green-600 dark:text-green-400", bg: "bg-green-100/50 dark:bg-green-900/30" },
  { href: "/mycomplaint", label: "Complaints", icon: ShieldAlert, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100/50 dark:bg-rose-900/30" },
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
    await supabase.auth.signOut();
    router.push("/login");
    setIsOpen(false);
    setIsLoggedIn(false);
  };

  return (
    <>
      {/* FIXED HEADER 
         Glassmorphic Gradient: White to Transparent (Light) / Black to Transparent (Dark)
      */}
      <nav className="fixed top-0 left-0 right-0 z-[100] h-20 transition-all border-b border-white/20 dark:border-gray-800/20 backdrop-blur-xl bg-gradient-to-b from-white/90 to-white/60 dark:from-gray-950/90 dark:to-gray-950/60 shadow-sm">
        <div className="container mx-auto px-4 h-full flex justify-between items-center">
          
          {/* Logo Area */}
          <Link href="/" className="flex items-center gap-3 group relative">
             <div className="absolute -inset-2 bg-indigo-500/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition duration-500" />
             <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20">
               D
             </div>
             <div className="flex flex-col relative">
               <span className="font-extrabold text-lg leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                 DAR-E-ARQAM
               </span>
               <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                 School System
               </span>
             </div>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100/50 dark:text-gray-400 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-900 dark:text-white transition-all active:scale-95"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* SPACER: This pushes your page content down 
        so it starts exactly below the fixed header 
      */}
      <div className="h-20 w-full" aria-hidden="true" />

      {/* DRAWER / MENU 
        PC: Floating Dropdown | Mobile: Full Screen 
      */}
      <div
        className={`fixed z-[90] transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)
          ${isOpen ? "opacity-100 visible translate-y-0 scale-100" : "opacity-0 invisible -translate-y-2 scale-95 pointer-events-none"}
          
          /* Mobile */
          inset-0 top-20 bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl
          
          /* Desktop */
          md:inset-auto md:top-24 md:right-6 md:w-[650px] md:h-auto md:max-h-[80vh] 
          md:rounded-3xl md:shadow-2xl md:border md:border-white/20 md:dark:border-gray-700/30
          md:bg-white/80 md:dark:bg-gray-900/80 flex flex-col overflow-hidden
        `}
      >
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
          
          {/* Auth / Status Bar (No Text Details) */}
          <div className="flex items-center justify-between mb-6 bg-gray-50/50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
             <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                      <User size={24} />
                   </div>
                   {/* Online Dot */}
                   <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-gray-800 rounded-full ${isLoggedIn ? "bg-green-500" : "bg-gray-400"}`} />
                </div>
                
                <div className="flex flex-col">
                   <span className="font-bold text-gray-900 dark:text-white text-sm">
                      {isLoggedIn ? "Active Session" : "Guest Mode"}
                   </span>
                   <span className="text-xs text-gray-500 dark:text-gray-400">
                      {isLoggedIn ? "Access Granted" : "Read Only"}
                   </span>
                </div>
             </div>

             {isLoggedIn ? (
               <button 
                 onClick={handleSignOut}
                 className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-all duration-300"
               >
                 <span className="text-xs font-bold">Sign Out</span>
                 <LogOut size={14} />
               </button>
             ) : (
                <button 
                  onClick={() => router.push('/login')}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Login
                </button>
             )}
          </div>

          {/* Icon Grid */}
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Menu</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="group relative flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 hover:border-indigo-500/30 dark:hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                >
                  <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${link.bg} ${link.color}`}>
                    <Icon size={22} className="stroke-[2.5px]" />
                  </div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {link.label}
                  </span>
                  
                  {/* Subtle hover indicator */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-1 group-hover:translate-x-0">
                    <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
                  </div>
                </Link>
              );
            })}
          </div>

        </div>
      </div>
      
      {/* Click Outside Listener (PC) */}
      {isOpen && (
        <div 
          className="hidden md:block fixed inset-0 z-[80] cursor-default"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;
