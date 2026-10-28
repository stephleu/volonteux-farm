import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { anneeCourante } from '../lib/dates'
import { LayoutDashboard, Map, Tractor, Sprout, Calendar, History, Settings, Shield, Layers, ClipboardCheck, ShoppingBag } from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/plan/assolement', icon: Map, label: 'Assolement', parent: true },
  { to: '/plan/series', icon: Layers, label: 'Séries', parent: true },
  { to: '/sol', icon: Tractor, label: 'Travail du sol' },
  { to: '/fertilisation', icon: Sprout, label: 'Fertilisation' },
  { to: '/traitement', icon: Shield, label: 'Traitements' },
  { to: '/planning', icon: Calendar, label: 'Planning plantation' },
  { to: '/historique', icon: History, label: 'Historique' },
  { to: '/historique/reel', icon: ClipboardCheck, label: 'Réel', parent: true },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
{ to: '/mercuriale', icon: ShoppingBag, label: 'Mercuriale' },
{ to: '/mercuriale/produits', icon: ShoppingBag, label: 'Produits', parent: true },
{ to: '/mercuriale/epiceries', icon: ShoppingBag, label: 'Épiceries', parent: true },
{ to: '/mercuriale/commandes', icon: ShoppingBag, label: 'Commandes', parent: true },
{ to: '/mercuriale/etiquettes', icon: ShoppingBag, label: 'Étiquettes', parent: true },
]

export default function Sidebar({ utilisateur }) {
  // Nom enregistré sur le compte (voir supabase/2026-10-noms-utilisateurs.sql), sinon l'email
  const meta = utilisateur?.user_metadata || {}
  const nom = meta.nom || meta.full_name || meta.display_name || meta.name || utilisateur?.email
  return (
    <aside style={{
      width: 230, minWidth: 230, height: '100vh',
      borderRight: '2.5px solid var(--trait)',
      background: 'var(--papier)', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '18px 16px 14px', borderBottom: '2.5px solid var(--trait)' }}>
        <div style={{ fontWeight: 700, fontSize: 22, fontStretch: '75%', lineHeight: 1, textTransform: 'uppercase', color: 'var(--encre)' }}>
          Les<br />Volonteux
        </div>
        <div style={{ height: 7, borderTop: '2px solid var(--trait)', borderBottom: '2px solid var(--trait)', margin: '10px 0 8px' }} />
        <div style={{ fontFamily: 'var(--script)', fontStyle: 'italic', fontSize: 18, lineHeight: 1.1, color: 'var(--encre)' }}>Gestion maraîchère</div>
      </div>
      <nav style={{ padding: '8px 0', flex: 1, overflowY: 'auto' }}>
        {nav.map(({ to, icon: Icon, label, parent }) => (
          <NavLink key={to} to={to} end style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: parent ? '6px 14px 6px 30px' : '9px 14px',
            fontSize: parent ? 11 : 12, textDecoration: 'none',
            textTransform: parent ? 'none' : 'uppercase',
            fontStretch: '75%', letterSpacing: parent ? 0 : '0.05em',
            borderLeft: isActive ? '4px solid var(--encre)' : '4px solid transparent',
            background: isActive ? 'var(--jaune)' : 'transparent',
            color: isActive ? 'var(--encre)' : 'var(--encre-douce)',
            fontWeight: isActive || !parent ? 700 : 400,
          })}>
            <Icon size={parent ? 13 : 15} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '10px 14px', borderTop: '2.5px solid var(--trait)', background: 'var(--vert)', fontSize: 11, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--encre)' }}>
        Saison {anneeCourante()}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          <span title={utilisateur?.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, textDecoration: 'underline', flexShrink: 0 }}>
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
  )
}