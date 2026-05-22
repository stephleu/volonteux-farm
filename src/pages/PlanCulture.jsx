import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const COULEURS_TYPE = {
  ete: { bg: '#E1F5EE', border: '#1D9E75', label: 'Rotation 3 ans' },
  hiver: { bg: '#E6F1FB', border: '#378ADD', label: 'Rotation 6 ans' },
  bonus: { bg: '#FAEEDA', border: '#EF9F27', label: 'Bonus' },
  serre: { bg: '#F4EDF9', border: '#9B7FD4', label: 'Serre' },
}

export default function PlanCulture() {
  const [blocs, setBlocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('terrain')

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('blocs').select('*').order('nom')
      setBlocs(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>

  const blocsTerrain = blocs.filter(b => b.type !== 'serre')
  const blocsSerre = blocs.filter(b => b.type === 'serre')
  const blocsAffiches = vue === 'terrain' ? blocsTerrain : blocsSerre

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Plan de culture 2026</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Vue par bloc — cliquer pour le détail des planches</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setVue('terrain')} style={{
          padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          background: vue === 'terrain' ? '#1D9E75' : '#fff',
          color: vue === 'terrain' ? '#fff' : '#6b7280',
          border: '1px solid ' + (vue === 'terrain' ? '#1D9E75' : '#e5e7eb'),
          fontWeight: vue === 'terrain' ? 500 : 400,
        }}>Blocs A→I</button>
        <button onClick={() => setVue('serre')} style={{
          padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          background: vue === 'serre' ? '#1D9E75' : '#fff',
          color: vue === 'serre' ? '#fff' : '#6b7280',
          border: '1px solid ' + (vue === 'serre' ? '#1D9E75' : '#e5e7eb'),
          fontWeight: vue === 'serre' ? 500 : 400,
        }}>Serres S1→S9</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {blocsAffiches.map(bloc => {
          const style = COULEURS_TYPE[bloc.type] || COULEURS_TYPE.bonus
          return (
            <div key={bloc.id} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
              borderTop: `3px solid ${style.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>
                  {bloc.type === 'serre' ? bloc.nom : `Bloc ${bloc.nom}`}
                </div>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: style.bg, color: style.border, fontWeight: 500
                }}>{style.label}</span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                {bloc.nombre_planches} planches · {bloc.nombre_planches * 50}m linéaires
              </div>
              {bloc.rotation_ans && (
                <div style={{ marginTop: 8, height: 3, background: '#e5e7eb', borderRadius: 2 }}>
                  <div style={{
                    height: 3, borderRadius: 2, background: style.border,
                    width: `${(1 / bloc.rotation_ans) * 100}%`
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}