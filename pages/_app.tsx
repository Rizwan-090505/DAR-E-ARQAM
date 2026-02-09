import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "../components/ui/toaster"
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Loader from '../components/Loader'

const useAuth = () => {
  const [user, setUser] = useState<any | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserAndRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (!error) setRole(data.role)
        else setRole(null)
      } else {
        setRole(null)
      }

      setLoading(false)
    }

    fetchUserAndRole()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user || null
        setUser(user)

        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          setRole(data?.role ?? null)
        } else {
          setRole(null)
        }
      }
    )

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { user, role, loading }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const openRoutes = [
      '/login',
      '/parents_portal',
      '/auth/callback',
      '/datesheets',
      '/res',
      '/res1'
    ]

    if (loading) return

    // Not logged in
    if (!user) {
      if (!openRoutes.some(route => router.pathname.startsWith(route))) {
        router.push('/login')
      }
      return
    }

    // Block non-admins from /admin
    if (router.pathname.startsWith('/admin') && role !== 'admin') {
      router.push('/')
      return
    }

    // Optional: auto-redirect admin to /admin
    if (role === 'admin' && router.pathname === '/') {
      router.push('/admin')
    }

  }, [user, role, loading, router])

  if (loading) {
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

