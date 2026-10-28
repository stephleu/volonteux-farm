import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from './Sidebar.jsx'
import Connexion from './Connexion.jsx'

export default function Layout() {
  // undefined = on ne sait pas encore, null = pas connecté
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => setSession(nouvelle))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Connexion />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar utilisateur={session.user} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--fond)' }}>
        <Outlet />
      </main>
    </div>
  )
}
