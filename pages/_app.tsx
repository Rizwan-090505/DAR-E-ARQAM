import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "../components/ui/toaster"
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Loader from '../components/Loader'

// Define routes outside to prevent re-creation
const OPEN_ROUTES = [
  '/login',
  '/parents_portal',
  '/auth/callback',
  '/datesheets',
  '/res',
  '/res1'
]

const useAuth = () => {
  const [user, setUser] = useState<any | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchRole = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      
      if (mounted) {
        setRole(error ? null : data?.role ?? null)
      }
    }

    const initializeAuth = async () => {
      // getSession is faster than getUser as it checks local storage first
      const { data: { session } } = await supabase.auth.getSession()
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user)
          await fetchRole(session.user.id)
        } else {
          setUser(null)
          setRole(null)
        }
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null
        if (mounted) {
          setUser(currentUser)
          if (currentUser) {
            await fetchRole(currentUser.id)
          } else {
            setRole(null)
          }
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { user, role, loading }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  
  // Check public route status immediately
  const isPublicRoute = OPEN_ROUTES.some(route => router.pathname.startsWith(route))

  useEffect(() => {
    if (loading) return

    // 1. Unauthenticated Redirect
    if (!user && !isPublicRoute) {
      router.replace('/login') // 'replace' is faster/cleaner than 'push' for redirects
      return
    }

    // 2. Admin Logic
    if (user) {
      // Redirect Admin from Home to Dashboard
      if (role === 'admin' && router.pathname === '/') {
        router.replace('/admin')
        return
      }

      // Security: Block non-admins from /admin
      if (router.pathname.startsWith('/admin') && role !== 'admin') {
        router.replace('/')
        return
      }
    }

  }, [user, role, loading, router, isPublicRoute])

  // 3. SPEED OPTIMIZATION:
  // Render immediately if public (don't wait for auth check).
  // Only show Loader if we are on a protected route AND still loading.
  if (loading && !isPublicRoute) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Component {...pageProps} />
      <Toaster />
    </ThemeProvider>
  )
}

export default MyApp
