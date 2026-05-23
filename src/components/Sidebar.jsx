import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, Tractor, Sprout, Calendar, History, Settings, Shield, Layers, ClipboardCheck } from 'lucide-react'

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
]

export default function Sidebar() {
  return (
    <aside style={{
      width: 210, minWidth: 210, height: '100vh',
      borderRight: '1px solid #e5e7eb',
      background: '#f9fafb', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: '#111' }}>Les Volonteux</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Gestion maraîchère · 2026</div>
      </div>
      <nav style={{ padding: '8px 0', flex: 1 }}>
        {nav.map(({ to, icon: Icon, label, parent }) => (
          <NavLink key={to} to={to} end style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: parent ? '7px 14px 7px 28px' : '9px 14px',
            fontSize: parent ? 12 : 13, textDecoration: 'none',
            borderLeft: isActive ? '2px solid #1D9E75' : '2px solid transparent',
            background: isActive ? '#fff' : 'transparent',
            color: isActive ? '#111' : '#6b7280',
            fontWeight: isActive ? 500 : 400,
          })}>
            <Icon size={parent ? 13 : 15} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', fontSize: 11, color: '#9ca3af' }}>
        Saison 2026
      </div>
    </aside>
  )
}