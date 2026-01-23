import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "../components/ui/toaster"
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
// 1. Import your Loader component
import Loader from '../components/Loader' 

const useAuth = () => {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    fetchUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { user, loading }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const openRoutes = ['/login','/parents_portal', '/auth/callback','/datesheets','/res','/res1'];
    if (!loading && !user) {
      if (!openRoutes.some(route => router.pathname.startsWith(route))) {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  if (loading) {
    // 2. Replace the text with your Loader component
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
