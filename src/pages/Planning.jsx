import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const FOURNISSEUR_STYLE = {
  'Desbos': { bg: '#E6F1FB', color: '#0C447C' },
  'Pépinière interne': { bg: '#EAF3DE', color: '#27500A' },
  'Semis direct': { bg: '#EEEDFE', color: '#3C3489' },
}

const TYPE_STYLE = {
  'plants': { bg: '#FAEEDA', color: '#633806' },
  'semis': { bg: '#EEEDFE', color: '#3C3489' },
}

export default function Planning() {
  const [legumes, setLegumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('legumes')
        .select('*, familles(nom, couleur)')
        .order('nom')
      setLegumes(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>

  const fournisseurs = ['tous', 'Desbos', 'Pépinière interne', 'Semis direct']
  const legumesFiltres = filtre === 'tous' ? legumes : legumes.filter(l => l.fournisseur === filtre)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Planning plantation</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Cultures disponibles · saison 2026</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {fournisseurs.map(f => (
          <button key={f} onClick={() => setFiltre(f)} style={{
            padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
            background: filtre === f ? '#1D9E75' : '#fff',
            color: filtre === f ? '#fff' : '#6b7280',
            border: '1px solid ' + (filtre === f ? '#1D9E75' : '#e5e7eb'),
          }}>{f === 'tous' ? 'Tous' : f}</button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Légume</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Famille</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Fournisseur</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Rangs</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Esp. rangs</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Esp. plants</th>
            </tr>
          </thead>
          <tbody>
            {legumesFiltres.map(legume => {
              const typeStyle = legume.fournisseur === 'Semis direct' ? TYPE_STYLE['semis'] : TYPE_STYLE['plants']
              const fStyle = FOURNISSEUR_STYLE[legume.fournisseur] || { bg: '#f3f4f6', color: '#6b7280' }
              return (
                <tr key={legume.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{legume.nom}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 3,
                      background: legume.familles?.couleur + '22',
                      color: legume.familles?.couleur,
                      fontWeight: 500
                    }}>{legume.familles?.nom}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: typeStyle.bg, color: typeStyle.color, fontWeight: 500 }}>
                      {legume.fournisseur === 'Semis direct' ? 'semis' : 'plants'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: fStyle.bg, color: fStyle.color, fontWeight: 500 }}>
                      {legume.fournisseur}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{legume.rangs}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{legume.espacement_rangs} cm</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{legume.espacement_plants} cm</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}