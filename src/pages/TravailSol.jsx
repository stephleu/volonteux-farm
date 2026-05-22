import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ETAPES = [
  { id: 'broyer', label: 'Broyer', passages: 1 },
  { id: 'fumier', label: 'Fumier', passages: 1 },
  { id: 'covercrop', label: 'Covercrop', passages: 2 },
  { id: 'sous_soleuse', label: 'S.soleuse', passages: 1 },
  { id: 'cultibutte', label: 'Cultibutte', passages: 2 },
  { id: 'granules', label: 'Granulés', passages: 1 },
  { id: 'vibroplanche', label: 'Vibroplanche', passages: 3 },
]

export default function TravailSol() {
  const [blocs, setBlocs] = useState([])
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [planches, setPlanches] = useState([])
  const [travaux, setTravaux] = useState([])
  const [vue, setVue] = useState('bloc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBlocs() {
      const { data } = await supabase.from('blocs').select('*').order('nom')
      setBlocs(data || [])
      if (data && data.length > 0) setBlocSelectionne(data[0])
      setLoading(false)
    }
    fetchBlocs()
  }, [])

  useEffect(() => {
    if (!blocSelectionne) return
    async function fetchPlanches() {
      const { data } = await supabase
        .from('planches')
        .select('*')
        .eq('bloc_id', blocSelectionne.id)
        .order('numero')
      setPlanches(data || [])
      if (data && data.length > 0) {
        const ids = data.map(p => p.id)
        const { data: t } = await supabase
          .from('travail_sol')
          .select('*')
          .in('planche_id', ids)
        setTravaux(t || [])
      }
    }
    fetchPlanches()
  }, [blocSelectionne])

  function estFait(plancheId, etapeId, passage) {
    return travaux.some(t =>
      t.planche_id === plancheId &&
      t.etape === etapeId &&
      t.passage === passage &&
      t.fait
    )
  }

  async function toggleEtape(plancheId, etapeId, passage) {
    const existant = travaux.find(t =>
      t.planche_id === plancheId &&
      t.etape === etapeId &&
      t.passage === passage
    )
    if (existant) {
      const { data } = await supabase
        .from('travail_sol')
        .update({ fait: !existant.fait, date_fait: !existant.fait ? new Date().toISOString().split('T')[0] : null })
        .eq('id', existant.id)
        .select()
      setTravaux(prev => prev.map(t => t.id === existant.id ? data[0] : t))
    } else {
      const { data } = await supabase
        .from('travail_sol')
        .insert({ planche_id: plancheId, etape: etapeId, passage, fait: true, date_fait: new Date().toISOString().split('T')[0] })
        .select()
      setTravaux(prev => [...prev, data[0]])
    }
  }

  function statutPlanche(plancheId) {
    const total = ETAPES.reduce((acc, e) => acc + e.passages, 0)
    const faits = ETAPES.reduce((acc, e) => {
      for (let i = 1; i <= e.passages; i++) {
        if (estFait(plancheId, e.id, i)) acc++
      }
      return acc
    }, 0)
    if (faits === 0) return { label: 'Non démarrée', bg: '#FCEBEB', color: '#791F1F' }
    if (faits === total) return { label: 'Prête', bg: '#EAF3DE', color: '#27500A' }
    return { label: 'En cours', bg: '#FAEEDA', color: '#633806' }
  }

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Travail du sol</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Suivi des étapes tracteur</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={blocSelectionne?.id || ''}
          onChange={e => {
            const b = blocs.find(b => b.id === e.target.value)
            setBlocSelectionne(b)
            setVue('bloc')
          }}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
        >
          {blocs.map(b => (
            <option key={b.id} value={b.id}>{b.type === 'serre' ? b.nom : `Bloc ${b.nom}`}</option>
          ))}
        </select>

        <button onClick={() => setVue('bloc')} style={{
          padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          background: vue === 'bloc' ? '#1D9E75' : '#fff',
          color: vue === 'bloc' ? '#fff' : '#6b7280',
          border: '1px solid ' + (vue === 'bloc' ? '#1D9E75' : '#e5e7eb'),
        }}>Vue bloc</button>

        <button onClick={() => setVue('planche')} style={{
          padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          background: vue === 'planche' ? '#1D9E75' : '#fff',
          color: vue === 'planche' ? '#fff' : '#6b7280',
          border: '1px solid ' + (vue === 'planche' ? '#1D9E75' : '#e5e7eb'),
        }}>Vue planche par planche</button>
      </div>

      {planches.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, color: '#6b7280', fontSize: 13 }}>
          Aucune planche configurée pour ce bloc. Allez dans Paramètres pour les créer.
        </div>
      ) : vue === 'bloc' ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
            {blocSelectionne?.type === 'serre' ? blocSelectionne?.nom : `Bloc ${blocSelectionne?.nom}`} — {planches.length} planches
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
            {ETAPES.map(e => (
              <div key={e.id} style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{e.label}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
            Cocher ici marque l'étape sur toutes les planches du bloc.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {ETAPES.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {Array.from({ length: e.passages }).map((_, i) => {
                  const toutFait = planches.every(p => estFait(p.id, e.id, i + 1))
                  return (
                    <div
                      key={i}
                      onClick={() => planches.forEach(p => toggleEtape(p.id, e.id, i + 1))}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                        border: '1px solid ' + (toutFait ? '#1D9E75' : '#d1d5db'),
                        background: toutFait ? '#1D9E75' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 12,
                      }}
                    >{toutFait ? '✓' : ''}</div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Planche</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>Statut</th>
                {ETAPES.map(e => (
                  <th key={e.id} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 400, color: '#6b7280', borderBottom: '1px solid #e5e7eb', fontSize: 10 }}>{e.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planches.map(planche => {
                const statut = statutPlanche(planche.id)
                return (
                  <tr key={planche.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 500 }}>
                      {blocSelectionne?.type === 'serre' ? blocSelectionne?.nom : `${blocSelectionne?.nom}`}-{String(planche.numero).padStart(2, '0')}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: statut.bg, color: statut.color, fontWeight: 500 }}>
                        {statut.label}
                      </span>
                    </td>
                    {ETAPES.map(e => (
                      <td key={e.id} style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                          {Array.from({ length: e.passages }).map((_, i) => {
                            const fait = estFait(planche.id, e.id, i + 1)
                            return (
                              <div
                                key={i}
                                onClick={() => toggleEtape(planche.id, e.id, i + 1)}
                                style={{
                                  width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
                                  border: '1px solid ' + (fait ? '#1D9E75' : '#d1d5db'),
                                  background: fait ? '#1D9E75' : '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#fff', fontSize: 9,
                                }}
                              >{fait ? '✓' : ''}</div>
                            )
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}