import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "../components/ui/toaster"
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Loader from '../components/Loader'

// 1. Define Public Routes (Speed Optimization)
const OPEN_ROUTES = [
  '/login',
  '/admission',
  '/parents_portal',
  '/auth/callback',
  '/datesheets',
  '/res',
  '/res1'
]

const useAuth = () => {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user)
        }
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) {
          const currentUser = session?.user ?? null
          setUser(currentUser)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { user, loading }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // Check if current page is public
  const isPublicRoute = OPEN_ROUTES.some(route => router.pathname.startsWith(route))

  // 2. Fast Synchronous Role Check via LocalStorage
  // We check typeof window to prevent Server-Side Rendering (SSR) hydration errors
  const isClient = typeof window !== 'undefined';
  const userRole = isClient ? localStorage.getItem('UserRole') : null;
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  useEffect(() => {
    // Wait for auth to finish loading before deciding to redirect
    if (loading) return

    // SECURITY: If not logged in & not on a public route -> Go to Login
    if (!user && !isPublicRoute) {
      router.replace('/login')
      return
    }

    // ROLE-BASED REDIRECTS
    if (user) {
      // Rule A: Revoke access to /admin pages for non-admins
      if (router.pathname.startsWith('/admin') && !isAdmin) {
        router.replace('/') // Kick them back to the standard root/dashboard
        return
      }

      // Rule B: Redirect admins/superadmins from the root '/' to '/admin'
      if (router.pathname === '/' && isAdmin) {
        router.replace('/admin')
        return
      }
    }

  }, [user, loading, router, isPublicRoute, isAdmin])

  // --- RENDERING LOGIC ---

  // Determine if a client-side redirect is about to happen. 
  // This prevents the app from briefly rendering unauthorized components (speed optimization).
  const isRedirecting = 
    (!loading && !user && !isPublicRoute) || 
    (user && router.pathname.startsWith('/admin') && !isAdmin) || 
    (user && router.pathname === '/' && isAdmin);

  // A. If waiting for Auth on a protected route, OR if we are actively redirecting, show Loader.
  if ((loading && !isPublicRoute) || isRedirecting) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    )
  }

  // B. Render the Application
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Component {...pageProps} />
      <Toaster />
    </ThemeProvider>
  )
}

export default MyApp
