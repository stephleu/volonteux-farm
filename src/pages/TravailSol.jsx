import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ETAPES = ['broyer', 'fumier', 'covercrop', 'sous_soleuse', 'cultibutte', 'granules', 'vibroplanche']
const ETAPES_LABELS = {
  broyer: 'Broyer', fumier: 'Fumier', covercrop: 'Covercrop',
  sous_soleuse: 'S.soleuse', cultibutte: 'Cultibutte',
  granules: 'Granulés', vibroplanche: 'Vibroplanche'
}
const PASSAGES_MAX = { covercrop: 2, cultibutte: 2, vibroplanche: 3 }

export default function TravailSol() {
  const [blocs, setBlocs] = useState([])
  const [planches, setPlanches] = useState([])
  const [travaux, setTravaux] = useState([])
  const [loading, setLoading] = useState(true)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [vue, setVue] = useState('bloc')
  const [ouverts, setOuverts] = useState({})

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: b }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('blocs').select('*').order('nom'),
      supabase.from('planches').select('*').order('numero'),
      supabase.from('travail_sol').select('*'),
    ])
    setBlocs(b || [])
    setPlanches(p || [])
    setTravaux(t || [])
    setLoading(false)
  }

  function getTravail(plancheId, etape, passage = 1) {
    return travaux.find(t => t.planche_id === plancheId && t.etape === etape && t.passage === passage)
  }

  function getStatutPlanche(plancheId) {
    const total = ETAPES.length
    const faits = ETAPES.filter(e => getTravail(plancheId, e)?.fait).length
    if (faits === 0) return 'non_demarre'
    if (faits === total) return 'prete'
    return 'en_cours'
  }

  async function toggleTravail(plancheId, etape, passage = 1) {
    const existing = getTravail(plancheId, etape, passage)
    if (existing) {
      await supabase.from('travail_sol').update({ fait: !existing.fait, date_fait: !existing.fait ? new Date().toISOString().split('T')[0] : null }).eq('id', existing.id)
    } else {
      await supabase.from('travail_sol').insert({ planche_id: plancheId, etape, passage, fait: true, date_fait: new Date().toISOString().split('T')[0] })
    }
    fetchData()
  }

  async function toggleBlocEntier(blocId, etape, passage = 1) {
    const planchesBloc = planches.filter(p => p.bloc_id === blocId)
    const tousCoches = planchesBloc.every(p => getTravail(p.id, etape, passage)?.fait)
    for (const planche of planchesBloc) {
      const existing = getTravail(planche.id, etape, passage)
      if (existing) {
        await supabase.from('travail_sol').update({ fait: !tousCoches, date_fait: !tousCoches ? new Date().toISOString().split('T')[0] : null }).eq('id', existing.id)
      } else if (!tousCoches) {
        await supabase.from('travail_sol').insert({ planche_id: planche.id, etape, passage, fait: true, date_fait: new Date().toISOString().split('T')[0] })
      }
    }
    fetchData()
  }

  async function effacerBlocEntier(blocId) {
  const planchesBloc = planches.filter(p => p.bloc_id === blocId)
  const ids = planchesBloc.map(p => p.id)
  await supabase.from('travail_sol').delete().in('planche_id', ids)
  fetchData()
}

  const statutCouleur = (statut) => {
    if (statut === 'prete') return { bg: '#f0fdf4', border: '#86efac', label: 'Prête', color: '#166534' }
    if (statut === 'en_cours') return { bg: '#fffbeb', border: '#fcd34d', label: 'En cours', color: '#92400e' }
    return { bg: '#f9fafb', border: '#e5e7eb', label: 'Non démarrée', color: '#6b7280' }
  }

  const blocsChamp = blocs.filter(b => b.type !== 'serre')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Travail du sol</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Suivi des étapes tracteur</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {[['bloc', 'Vue par bloc'], ['planche', 'Vue par planche']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? '#1D9E75' : '#f9fafb', color: vue === v ? '#fff' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      {vue === 'bloc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {blocsChamp.map(bloc => {
            const planchesBloc = planches.filter(p => p.bloc_id === bloc.id)
            const ouvert = ouverts[bloc.id]
            const prets = planchesBloc.filter(p => getStatutPlanche(p.id) === 'prete').length
            const enCours = planchesBloc.filter(p => getStatutPlanche(p.id) === 'en_cours').length

            return (
              <div key={bloc.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div onClick={() => setOuverts(prev => ({ ...prev, [bloc.id]: !prev[bloc.id] }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>Bloc {bloc.nom}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{planchesBloc.length} planches</span>
                    {prets > 0 && <span style={{ fontSize: 11, background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 4, padding: '1px 6px' }}>{prets} prêtes</span>}
                    {enCours > 0 && <span style={{ fontSize: 11, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, padding: '1px 6px' }}>{enCours} en cours</span>}
                  </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  {ouvert && (
    <button
      onClick={e => { e.stopPropagation(); if (window.confirm(`Effacer tout le travail du sol pour le bloc ${bloc.nom} ?`)) effacerBlocEntier(bloc.id) }}
      style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}>
      Effacer tout
    </button>
  )}
  <span style={{ color: '#6b7280' }}>{ouvert ? '▾' : '▸'}</span>
</div>
                </div>

                {ouvert && planchesBloc.length > 0 && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                      Cocher une étape ici la marque pour <strong>toutes les planches du bloc</strong>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '6px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 400, borderBottom: '1px solid #e5e7eb', minWidth: 80 }}>Étape</th>
                            {ETAPES.map(e => (
                              <th key={e} style={{ padding: '6px 4px', textAlign: 'center', color: '#6b7280', fontWeight: 400, borderBottom: '1px solid #e5e7eb' }}>
                                {ETAPES_LABELS[e]}
                                {PASSAGES_MAX[e] && <div style={{ fontSize: 10, color: '#9ca3af' }}>×{PASSAGES_MAX[e]}</div>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '8px', fontSize: 11, color: '#111', fontWeight: 500 }}>Bloc entier</td>
                            {ETAPES.map(e => {
                              const maxPassages = PASSAGES_MAX[e] || 1
                              return (
                                <td key={e} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                                    {Array.from({ length: maxPassages }, (_, pi) => {
                                      const tousCoches = planchesBloc.every(p => getTravail(p.id, e, pi + 1)?.fait)
                                      return (
                                        <div key={pi} onClick={() => toggleBlocEntier(bloc.id, e, pi + 1)}
                                          style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${tousCoches ? '#1D9E75' : '#d1d5db'}`, background: tousCoches ? '#1D9E75' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {tousCoches && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                      Détail par planche — cliquez sur une case pour ajuster individuellement
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '4px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 400, borderBottom: '1px solid #f3f4f6', minWidth: 70 }}>Planche</th>
                            <th style={{ padding: '4px', textAlign: 'center', color: '#9ca3af', fontWeight: 400, borderBottom: '1px solid #f3f4f6' }}>Statut</th>
                            {ETAPES.map(e => (
                              <th key={e} style={{ padding: '4px', textAlign: 'center', color: '#9ca3af', fontWeight: 400, borderBottom: '1px solid #f3f4f6' }}>{ETAPES_LABELS[e]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {planchesBloc.map(planche => {
                            const statut = getStatutPlanche(planche.id)
                            const { bg, border, label, color } = statutCouleur(statut)
                            return (
                              <tr key={planche.id}>
                                <td style={{ padding: '5px 8px', fontWeight: 500, color: '#111', borderBottom: '1px solid #f3f4f6' }}>
                                  {bloc.nom}-{String(planche.numero).padStart(2, '0')}
                                </td>
                                <td style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                  <span style={{ fontSize: 10, background: bg, border: `1px solid ${border}`, color, borderRadius: 3, padding: '1px 5px' }}>{label}</span>
                                </td>
                                {ETAPES.map(e => {
                                  const maxPassages = PASSAGES_MAX[e] || 1
                                  return (
                                    <td key={e} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                        {Array.from({ length: maxPassages }, (_, pi) => {
                                          const t = getTravail(planche.id, e, pi + 1)
                                          return (
                                            <div key={pi} onClick={() => toggleTravail(planche.id, e, pi + 1)}
                                              style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${t?.fait ? '#1D9E75' : '#d1d5db'}`, background: t?.fait ? '#1D9E75' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              {t?.fait && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {vue === 'planche' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {blocsChamp.map(b => (
              <button key={b.id} onClick={() => setBlocSelectionne(b.id === blocSelectionne ? null : b.id)}
                style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: blocSelectionne === b.id ? '#1D9E75' : '#f9fafb', color: blocSelectionne === b.id ? '#fff' : '#111' }}>
                Bloc {b.nom}
              </button>
            ))}
          </div>
          {!blocSelectionne && <p style={{ fontSize: 13, color: '#9ca3af' }}>Sélectionnez un bloc pour voir les planches</p>}
          {blocSelectionne && planches.filter(p => p.bloc_id === blocSelectionne).map(planche => {
            const statut = getStatutPlanche(planche.id)
            const { bg, border, label, color } = statutCouleur(statut)
            const bloc = blocs.find(b => b.id === blocSelectionne)
            return (
              <div key={planche.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#111', minWidth: 70 }}>
                  {bloc?.nom}-{String(planche.numero).padStart(2, '0')}
                </div>
                <span style={{ fontSize: 10, background: bg, border: `1px solid ${border}`, color, borderRadius: 3, padding: '1px 5px', minWidth: 70, textAlign: 'center' }}>{label}</span>
                {ETAPES.map(e => {
                  const maxPassages = PASSAGES_MAX[e] || 1
                  return (
                    <div key={e} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>{ETAPES_LABELS[e]}</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: maxPassages }, (_, pi) => {
                          const t = getTravail(planche.id, e, pi + 1)
                          return (
                            <div key={pi} onClick={() => toggleTravail(planche.id, e, pi + 1)}
                              style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${t?.fait ? '#1D9E75' : '#d1d5db'}`, background: t?.fait ? '#1D9E75' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {t?.fait && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
