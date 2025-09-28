"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun, Menu } from "lucide-react";

// ----- Types -----
type Theme = "light" | "dark";
type ButtonVariant = "default" | "ghost" | "outline";
type ButtonSize = "icon" | "sm" | "default";

// ----- Hooks -----
const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) || "light";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);
  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };
  return { theme, setTheme };
};

// Fake router + supabase mocks
const useRouter = () => ({ push: (p: string) => console.log("Navigating to:", p) });
const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { email: "test@example.com" } } }),
    signOut: async () => console.log("User signed out"),
  },
};

// ----- UI Components -----
const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}> = ({ children, onClick, variant = "default", size = "default", className = "" }) => {
  const base = "px-3 py-2 rounded-lg font-medium transition duration-150 focus:outline-none";
  const variantMap: Record<ButtonVariant, string> = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700",
    ghost: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
    outline: "border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800",
  };
  const sizeMap: Record<ButtonSize, string> = {
    icon: "p-2",
    sm: "py-1.5 px-3 text-sm",
    default: "py-2 px-4",
  };
  return (
    <button onClick={onClick} className={`${base} ${variantMap[variant]} ${sizeMap[size]} ${className}`}>
      {children}
    </button>
  );
};

// ----- Sheet / Drawer -----
const Sheet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const childrenArray = React.Children.toArray(children);

  const trigger = childrenArray.find(
    (c) => React.isValidElement(c) && (c.props as any)["data-trigger"]
  );
  const content = childrenArray.find(
    (c) => React.isValidElement(c) && (c.props as any)["data-content"]
  );

  return (
    <>
      {trigger && React.cloneElement(trigger as any, { onClick: () => setOpen(true) })}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <div className="fixed top-0 right-0 w-64 bg-white dark:bg-gray-900 z-50 p-6 shadow-xl">
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                ✕
              </Button>
            </div>
            {content && React.cloneElement(content as any, { close: () => setOpen(false) })}
          </div>
        </>
      )}
    </>
  );
};

// ----- Navbar -----
const Navbar: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const links = [
    { href: "/marks", label: "Tests" },
    { href: "/result/class", label: "Results" },
    { href: "/attendance-record/report", label: "Attendance Report" },
    { href: "/notice", label: "Add Notice" },
    { href: "/diary", label: "Diary" },
    { href: "/mycomplaint", label: "Complaints" },
    { href: "/advance", label: "Advance" },
    { href: "/activities", label: "Add Activities" },
    { href: "/syllabus", label: "Syllabus" },
    { href: "/result/sheet", label: "Result Sheet" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-3 shadow-md ${className}`}>
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link href="/" className="text-gray-900 dark:text-white text-xl font-extrabold">
          DAR-E-ARQAM SCHOOL
        </Link>

        <div className="flex items-center space-x-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </Button>
          )}

          <Sheet>
            <Button data-trigger variant="ghost" size="icon" className="text-gray-800 dark:text-white">
              <Menu className="h-6 w-6" />
            </Button>

            <div data-content>
              <div className="flex flex-col space-y-4 mt-6 text-base">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition font-medium"
                  >
                    {l.label}
                  </Link>
                ))}

                <div className="pt-4">
                  {user ? (
                    <Button onClick={handleSignOut} variant="outline" className="w-full">
                      Sign Out ({user.email})
                    </Button>
                  ) : (
                    <Button onClick={() => router.push("/login")} variant="default" className="w-full">
                      Login
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
