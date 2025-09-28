import React, { useEffect, useState } from 'react';
import { Moon, Sun, Menu } from 'lucide-react';

// --- TYPE DEFINITIONS ---

type Theme = 'light' | 'dark';
type ButtonVariant = 'default' | 'ghost' | 'outline';
type ButtonSize = 'icon' | 'sm' | 'default';
type SheetSide = 'right' | 'left';

// Custom type to allow adding a static property like 'typeId' to the functional component
type IdentifiedFC<P = {}> = React.FC<P> & { typeId?: string };

interface UseThemeResult {
  theme: Theme;
  setTheme: (newTheme: Theme) => void;
}

interface Router {
  push: (path: string) => void;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}

// Props injected by Sheet are now optional for the user writing JSX
interface SheetTriggerProps {
  children: React.ReactElement<{ onClick?: () => void }>;
  setIsOpen?: (open: boolean) => void; // Made optional to fix TS error
}

// Props injected by Sheet are now optional for the user writing JSX
interface SheetContentProps {
  children: React.ReactNode;
  isOpen?: boolean; // Made optional to fix TS error
  setIsOpen?: (open: boolean) => void; // Made optional to fix TS error
  side?: SheetSide;
}

interface SheetProps {
  children: React.ReactNode;
}

interface NavbarProps {
  className?: string;
}

// --- MOCK COMPONENTS AND HOOKS (For single-file use) ---

// Mocking useTheme for dark mode
const useTheme = (): UseThemeResult => {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const storedTheme = (localStorage.getItem('theme') as Theme) || 'light';
    setThemeState(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }, []);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return { theme, setTheme };
};

// Mocking useRouter
const useRouter = (): Router => ({
  push: (path: string) => console.log('Navigating to:', path),
});

// Mocking supabase client
const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'user-123', email: 'test@example.com' } } }),
    signOut: async () => console.log('User signed out'),
  },
};

// Simple Button Mock
const Button: React.FC<ButtonProps> = ({ children, onClick, variant = 'default', size = 'default', className = '', ...props }) => {
  const baseClasses = 'px-3 py-2 rounded-lg font-medium transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50';
  
  const variantClasses: Record<ButtonVariant, string> = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    outline: 'border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
  };
  
  const sizeClasses: Record<ButtonSize, string> = {
    icon: 'p-2',
    sm: 'py-1.5 px-3 text-sm',
    default: 'py-2 px-4',
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Sheet/Drawer Mocks

const SheetTrigger: IdentifiedFC<SheetTriggerProps> = ({ children, setIsOpen }) => {
  // We must ensure setIsOpen exists before calling it, though in the Sheet parent it's always injected.
  const handleTriggerClick = () => {
    if (setIsOpen) {
      setIsOpen(true);
    }
  };
  
  // Ensure we clone the child element and add the onClick handler
  return React.cloneElement(children, { 
    onClick: handleTriggerClick 
  });
};
SheetTrigger.typeId = 'SheetTrigger';


const SheetContent: IdentifiedFC<SheetContentProps> = ({ children, isOpen, setIsOpen, side = 'right' }) => {
  const sideClasses = side === 'right' ? 'right-0' : 'left-0';
  const transformClass = isOpen ? 'translate-x-0' : (side === 'right' ? 'translate-x-full' : '-translate-x-full');
  
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen && setIsOpen(false)}
        ></div>
      )}
      {/* Content Panel */}
      <div
        className={`fixed top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-2xl z-50 p-6 transition-transform duration-300 ease-in-out ${sideClasses} ${transformClass}`}
      >
        <div className="flex justify-end mb-4">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen && setIsOpen(false)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </Button>
        </div>
        {children}
      </div>
    </>
  );
};
SheetContent.typeId = 'SheetContent';


const Sheet: React.FC<SheetProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const childrenArray = React.Children.toArray(children);

  const trigger = childrenArray.find(
    (child): child is React.ReactElement<SheetTriggerProps> => 
      React.isValidElement(child) && (child.type as IdentifiedFC).typeId === 'SheetTrigger'
  );

  const content = childrenArray.find(
    (child): child is React.ReactElement<SheetContentProps> => 
      React.isValidElement(child) && (child.type as IdentifiedFC).typeId === 'SheetContent'
  );

  // Clone elements and inject required props (setIsOpen, isOpen)
  const triggerClone = trigger ? React.cloneElement(trigger, { setIsOpen: setIsOpen }) : null;
  const contentClone = content ? React.cloneElement(content, { isOpen, setIsOpen: setIsOpen }) : null;

  return (
    <>
      {triggerClone}
      {contentClone}
    </>
  );
};


const NavLink: React.FC<NavLinkProps> = ({ href, children, onClick }) => (
  <a
    href={href}
    onClick={onClick}
    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition duration-300 font-medium whitespace-nowrap py-1 block"
  >
    {children}
  </a>
);

// --- MAIN COMPONENT ---

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

  const menuLinks = [
    { href: "/marks", label: "Tests" },
    { href: "/result/class", label: "Results" },
    { href: "/attendance-record/report", label: "Attendance Report" },
    { href: "/notice", label: "Add Notice" },
    { href: "/diary", label: "Diary" },
    { href: "/advance", label: "Advance" },
    { href: "/activities", label: "Add Activities" },
    { href: "/syllabus", label: "Syllabus" },
    { href: "/result/sheet", label: "Result Sheet" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-3 shadow-md ${className}`}>
      <div className="container mx-auto px-4 flex justify-between items-center">
        <a href="/" className="text-gray-900 dark:text-white text-xl font-extrabold whitespace-nowrap">
          DAR-E-ARQAM SCHOOL
        </a>

        {/* Collapsible Menu (Sheet Trigger and Theme Switcher) - Visible on all screen sizes (PC and Mobile) */}
        <div className="flex items-center space-x-2">
          {/* Theme Switcher */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </Button>
          )}

          {/* Collapsible Menu Trigger */}
          <Sheet>
            {/* Note: asChild is not needed here since we are mocking the Sheet component */}
            <SheetTrigger>
              <Button variant="ghost" size="icon" className='text-gray-800 dark:text-white' onClick={() => {/* Handled by SheetTrigger wrapper */}}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col space-y-4 mt-6 text-base">
                {menuLinks.map(link => (
                  <NavLink key={link.href} href={link.href}>
                    {link.label}
                  </NavLink>
                ))}
                
                <div className="pt-4">
                  {user ? (
                    <Button onClick={handleSignOut} variant="outline" size="default" className="w-full">
                      Sign Out ({user.email || 'User'})
                    </Button>
                  ) : (
                    <Button onClick={() => router.push('/login')} variant="default" size="default" className="w-full">
                      Login
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
