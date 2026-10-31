import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Sidebar from './Sidebar.jsx'
import Connexion from './Connexion.jsx'

// Téléphone : la barre latérale devient un menu qui s'ouvre par-dessus la page
const REQUETE_MOBILE = '(max-width: 767px)'
function useEstMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(REQUETE_MOBILE).matches)
  useEffect(() => {
    const m = window.matchMedia(REQUETE_MOBILE)
    const changer = () => setMobile(m.matches)
    m.addEventListener('change', changer)
    return () => m.removeEventListener('change', changer)
  }, [])
  return mobile
}

export default function Layout() {
  // undefined = on ne sait pas encore, null = pas connecté
  const [session, setSession] = useState(undefined)
  const mobile = useEstMobile()
  const [menuOuvert, setMenuOuvert] = useState(false)
  // Le menu se referme à chaque changement de page
  const { pathname } = useLocation()
  const [pageMenu, setPageMenu] = useState(pathname)
  if (pageMenu !== pathname) { setPageMenu(pathname); setMenuOuvert(false) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => setSession(nouvelle))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Connexion />

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--papier)', borderBottom: '2.5px solid var(--trait)', flexShrink: 0 }}>
          <button onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu" style={{ background: 'none', border: '1.5px solid var(--trait)', padding: 6, display: 'flex' }}>
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, fontStretch: '75%', textTransform: 'uppercase' }}>Les Volonteux</span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', background: 'var(--fond)' }}>
          <Outlet />
        </main>
        {menuOuvert && (
          <div onClick={() => setMenuOuvert(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, display: 'flex' }}>
              <Sidebar utilisateur={session.user} />
              <button onClick={() => setMenuOuvert(false)} aria-label="Fermer le menu"
                style={{ position: 'absolute', top: 10, right: 10, background: 'var(--papier)', border: '1.5px solid var(--trait)', padding: 4, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar utilisateur={session.user} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--fond)' }}>
        <Outlet />
      </main>
    </div>
  )
}
