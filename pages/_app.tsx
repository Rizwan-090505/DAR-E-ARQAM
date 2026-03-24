import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "../components/ui/toaster"
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Loader from '../components/Loader'

// Public routes (no auth required)
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
  const [isActive, setIsActive] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    // 🔥 Minimal DB check (fast)
    const checkUserStatus = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single()

      if (error || !data) return false
      return data.is_active
    }

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user) {
        const active = await checkUserStatus(session.user.id)

        if (!active) {
          await supabase.auth.signOut()
          setUser(null)
          setIsActive(false)
        } else {
          setUser(session.user)
          setIsActive(true)
        }
      }

      setLoading(false)
    }

    initializeAuth()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return

        const currentUser = session?.user ?? null

        if (currentUser) {
          const active = await checkUserStatus(currentUser.id)

          if (!active) {
            await supabase.auth.signOut()
            setUser(null)
            setIsActive(false)
            return
          }

          setUser(currentUser)
          setIsActive(true)
        } else {
          setUser(null)
          setIsActive(null)
        }

        setLoading(false)
      }
    )

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { user, loading, isActive }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user, loading, isActive } = useAuth()
  const router = useRouter()

  // Safely handle client-side localStorage to prevent Next.js Hydration errors
  const [userRole, setUserRole] = useState<string | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)

  useEffect(() => {
    setUserRole(localStorage.getItem('UserRole'))
    setRoleLoaded(true)
  }, [])

  const isPublicRoute = OPEN_ROUTES.some(route =>
    router.pathname.startsWith(route)
  )

  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  // Combine Supabase loading with our local role loading
  const isAppLoading = loading || !roleLoaded

  useEffect(() => {
    if (isAppLoading) return

    const currentPath = router.pathname

    // 🚨 Inactive user → force logout + redirect
    if (isActive === false) {
      if (currentPath !== '/login') router.replace('/login')
      return
    }

    // Not logged in → redirect
    if (!user && !isPublicRoute) {
      if (currentPath !== '/login') router.replace('/login')
      return
    }

    if (user) {
      // Block non-admins from admin routes
      if (currentPath.startsWith('/admin') && !isAdmin) {
        if (currentPath !== '/') router.replace('/')
        return
      }

      // Redirect admins to /admin
      if (currentPath === '/' && isAdmin) {
        if (currentPath !== '/admin') router.replace('/admin')
        return
      }
    }

  }, [user, isAppLoading, isPublicRoute, isAdmin, router.pathname, isActive])

  // Prevent flashing unauthorized UI
  const isRedirecting =
    (!isAppLoading && !user && !isPublicRoute && router.pathname !== '/login') ||
    (user && router.pathname.startsWith('/admin') && !isAdmin) ||
    (user && router.pathname === '/' && isAdmin) ||
    (isActive === false && router.pathname !== '/login')

  if ((isAppLoading && !isPublicRoute) || isRedirecting) {
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
