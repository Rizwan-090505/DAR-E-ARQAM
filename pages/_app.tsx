import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from "../components/ui/toaster"
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'

// Create the `useAuth` hook directly in _app.tsx for managing auth state
const useAuth = () => {
  const [user, setUser] = useState<any | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Get the initial user state using getUser
    const fetchUser = async () => {
      const { data: userData } = await supabase.auth.getUser()
      setUser(userData)
    }
    fetchUser()

    // Listen to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        setUser(null)
        // Redirect to login page if the user is logged out
        if (router.pathname !== '/login' && router.pathname !== '/auth/callback') {
          router.push('/login')
        }
      }
    })

    // Explicitly type the listener subscription
    return () => {
      listener?.subscription?.unsubscribe() // Make sure we're accessing unsubscribe correctly
    }
  }, [router])

  return { user }
}

function MyApp({ Component, pageProps }: AppProps) {
  const { user } = useAuth() // Get the current user state
  const router = useRouter()

  useEffect(() => {
    // If not authenticated, redirect to login page
    if (user === null && router.pathname !== '/auth' && router.pathname !== '/auth/callback') {
      router.push('/login')
    }
  }, [user, router])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Component {...pageProps} />
      <Toaster />
    </ThemeProvider>
  )
}

export default MyApp
