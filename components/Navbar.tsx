import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { Moon, Sun, Menu } from 'lucide-react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';

interface NavbarProps {
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ className }) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className={`bg-background border-b border-border py-2 ${className}`}>
      <div className="container mx-auto px-3 flex justify-between items-center">
        <Link href="/" className="text-foreground text-lg font-bold whitespace-nowrap">
          DAR-E-ARQAM SCHOOL
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex space-x-3 items-center text-sm">
          <NavLink href="/marks">Tests</NavLink>
          <NavLink href="/result/report-card">Results</NavLink>
          <NavLink href="/notice">Add Notice</NavLink>
          <NavLink href="/diary">Diary</NavLink>
          <NavLink href="/dashboard">Dashboard</NavLink>

          {user ? (
            <Button onClick={handleSignOut} variant="outline" size="sm">
              Sign Out
            </Button>
          ) : (
            <Button onClick={() => router.push('/login')} variant="outline" size="sm">
              Login
            </Button>
          )}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="mr-1"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col space-y-3 mt-4 text-sm">
                <NavLink href="/marks">Tests</NavLink>
                <NavLink href="/notice">Add Notice</NavLink>
                <NavLink href="/diary">Diary</NavLink>
                <NavLink href="/dashboard">Dashboard</NavLink>
                
                {user ? (
                  <Button onClick={handleSignOut} variant="outline" size="sm">
                    Sign Out
                  </Button>
                ) : (
                  <Button onClick={() => router.push('/login')} variant="outline" size="sm">
                    Login
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

const NavLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link
    href={href}
    className="text-foreground hover:text-primary transition duration-300 font-medium"
  >
    {children}
  </Link>
);

export default Navbar;
