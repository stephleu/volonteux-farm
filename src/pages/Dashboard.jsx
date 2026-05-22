import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Bell, CheckCircle } from 'lucide-react'

export default function Dashboard() {
  const [blocs, setBlocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBlocs() {
      const { data, error } = await supabase
        .from('blocs')
        .select('*')
        .order('nom')
      if (!error) setBlocs(data)
      setLoading(false)
    }
    fetchBlocs()
  }, [])

  const blocsChamp = blocs.filter(b => b.type !== 'serre')
  const blocsSerre = blocs.filter(b => b.type === 'serre')

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Semaine 21 — 22 mai 2026</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Blocs plein champ</div>
          <div style={{ fontSize: 24, fontWeight: 500 }}>{blocsChamp.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Serres</div>
          <div style={{ fontSize: 24, fontWeight: 500 }}>{blocsSerre.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Légumes enregistrés</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1D9E75' }}>29</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 12 }}>Alertes — prépa sol à démarrer</h2>
        {[
          { bloc: 'Bloc H — planches 12 à 18', detail: 'Plantation choux sem. 26 · Début prépa avant le 27 mai (été, −3 sem.)' },
          { bloc: 'Bloc D — planches 34 à 40', detail: 'Plantation poireaux sem. 28 · Début prépa avant le 10 juin' },
        ].map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} color="#d97706" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{a.bloc}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 12 }}>Plantations imminentes</h2>
        <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
          <Bell size={16} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Semaine 22 — Melon (plants · Pépi) + Coriandre (semis)</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>400 plants melon · semis coriandre direct planche</div>
          </div>
        </div>
      </div>

      {loading && <p style={{ color: '#6b7280', fontSize: 13, marginTop: 16 }}>Chargement...</p>}
    </div>
  )
}
