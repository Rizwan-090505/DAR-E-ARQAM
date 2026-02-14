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
  // Removed role state to speed up loading
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Removed fetchRole function entirely for speed

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user)
          // No longer fetching role - access is now open to all logged in users
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

  // We only return user and loading now
  return { user, loading }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // Check if current page is public
  const isPublicRoute = OPEN_ROUTES.some(route => router.pathname.startsWith(route))

  useEffect(() => {
    // Wait for auth to finish loading before deciding to redirect
    if (loading) return

    // 1. SECURITY: If not logged in & not on a public route -> Go to Login
    // We keep this to ensure the app doesn't crash due to missing 'user' object
    if (!user && !isPublicRoute) {
      router.replace('/login')
      return
    }

    // REMOVED: The Admin/Role specific redirects. 
    // Now, anyone who is logged in can stay on /admin routes.

  }, [user, loading, router, isPublicRoute])

  // --- RENDERING LOGIC ---

  // A. If we are waiting for Auth AND we are on a protected route, show Loader.
  if (loading && !isPublicRoute) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    )
  }

  // REMOVED: The Security Check block that prevented rendering /admin content

  // C. Render the Application
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Component {...pageProps} />
      <Toaster />
    </ThemeProvider>
  )
}

export default MyApp
