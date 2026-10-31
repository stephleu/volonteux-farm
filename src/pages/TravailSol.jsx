import { useState } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante } from '../lib/dates'
import { ETAPES, ETAPES_LABELS } from '../lib/travailSol'
import { EnTetePage, Onglets } from '../components/ui.jsx'
import { useChargement } from '../lib/useChargement'

const aujourdhui = () => new Date().toISOString().split('T')[0]

const PASSAGES_MAX = { covercrop: 2, cultibutte: 2, vibroplanche: 3 }

export default function TravailSol() {
  const [blocs, setBlocs] = useState([])
  const [planches, setPlanches] = useState([])
  const [travaux, setTravaux] = useState([])
  const [loading, setLoading] = useState(true)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [vue, setVue] = useState('bloc')
  const [ouverts, setOuverts] = useState({})
  // Le travail du sol se refait chaque saison : chaque année a ses propres coches
  const [annee, setAnnee] = useState(anneeCourante)

  async function fetchData() {
    const [{ data: b }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('blocs').select('*').order('nom'),
      chargerTout(() => supabase.from('planches').select('*').order('numero').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('*').eq('annee', annee).order('id')),
    ])
    setBlocs(b || [])
    setPlanches(p || [])
    setTravaux(t || [])
    setLoading(false)
  }
  useChargement(fetchData, [annee])

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
      await supabase.from('travail_sol').update({ fait: !existing.fait, date_fait: !existing.fait ? aujourdhui() : null }).eq('id', existing.id)
    } else {
      await supabase.from('travail_sol').insert({ planche_id: plancheId, etape, passage, annee, fait: true, date_fait: aujourdhui() })
    }
    fetchData()
  }

  async function toggleBlocEntier(blocId, etape, passage = 1) {
    const planchesBloc = planches.filter(p => p.bloc_id === blocId)
    const tousCoches = planchesBloc.every(p => getTravail(p.id, etape, passage)?.fait)
    // Deux requêtes pour tout le bloc au lieu d'une par planche
    const existants = planchesBloc.map(p => getTravail(p.id, etape, passage)).filter(Boolean)
    const manquants = tousCoches ? [] : planchesBloc.filter(p => !getTravail(p.id, etape, passage))
    if (existants.length) {
      await supabase.from('travail_sol').update({ fait: !tousCoches, date_fait: !tousCoches ? aujourdhui() : null }).in('id', existants.map(t => t.id))
    }
    if (manquants.length) {
      await supabase.from('travail_sol').insert(manquants.map(p => ({ planche_id: p.id, etape, passage, annee, fait: true, date_fait: aujourdhui() })))
    }
    fetchData()
  }

  async function effacerBlocEntier(blocId) {
    const ids = planches.filter(p => p.bloc_id === blocId).map(p => p.id)
    await supabase.from('travail_sol').delete().in('planche_id', ids).eq('annee', annee)
    fetchData()
  }

  const statutCouleur = (statut) => {
    if (statut === 'prete') return { bg: 'var(--vert-pale)', border: 'var(--vert)', label: 'Prête', color: 'var(--vert-fonce)' }
    if (statut === 'en_cours') return { bg: 'var(--jaune-pale)', border: 'var(--jaune)', label: 'En cours', color: 'var(--ocre)' }
    return { bg: 'var(--fond)', border: 'var(--trait-leger)', label: 'Non démarrée', color: 'var(--encre-douce)' }
  }

  const blocsChamp = blocs.filter(b => b.type !== 'serre')

  return (
    <div>
      <EnTetePage titre="Travail du sol" sousTitre={<>
        Suivi des étapes tracteur · saison{' '}
        <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={{ fontSize: 13, padding: '2px 6px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          {[2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </>}>
        <Onglets valeur={vue} onChange={setVue} options={[['bloc', 'Vue par bloc'], ['planche', 'Vue par planche']]} />
      </EnTetePage>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'bloc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {blocsChamp.map(bloc => {
            const planchesBloc = planches.filter(p => p.bloc_id === bloc.id)
            const ouvert = ouverts[bloc.id]
            const prets = planchesBloc.filter(p => getStatutPlanche(p.id) === 'prete').length
            const enCours = planchesBloc.filter(p => getStatutPlanche(p.id) === 'en_cours').length

            return (
              <div key={bloc.id} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
                <div onClick={() => setOuverts(prev => ({ ...prev, [bloc.id]: !prev[bloc.id] }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--encre)' }}>Bloc {bloc.nom}</span>
                    <span style={{ fontSize: 11, color: 'var(--encre-douce)' }}>{planchesBloc.length} planches</span>
                    {prets > 0 && <span style={{ fontSize: 11, background: 'var(--vert-pale)', color: 'var(--vert-fonce)', border: '1px solid var(--vert)', borderRadius: 0, padding: '1px 6px' }}>{prets} prêtes</span>}
                    {enCours > 0 && <span style={{ fontSize: 11, background: 'var(--jaune-pale)', color: 'var(--ocre)', border: '1px solid var(--jaune)', borderRadius: 0, padding: '1px 6px' }}>{enCours} en cours</span>}
                  </div>
                  {/* Cocher une étape ici la marque pour toutes les planches du bloc */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', cursor: 'default' }}>
                    {ETAPES.map(e => {
                      const maxPassages = PASSAGES_MAX[e] || 1
                      return (
                        <div key={e} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 9, color: 'var(--encre-pale)' }}>{ETAPES_LABELS[e]}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {Array.from({ length: maxPassages }, (_, pi) => {
                              const tousCoches = planchesBloc.length > 0 && planchesBloc.every(p => getTravail(p.id, e, pi + 1)?.fait)
                              return (
                                <div key={pi} onClick={() => toggleBlocEntier(bloc.id, e, pi + 1)}
                                  title={`${ETAPES_LABELS[e]}${maxPassages > 1 ? ` (passage ${pi + 1})` : ''} : tout le bloc`}
                                  style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${tousCoches ? 'var(--accent)' : 'var(--trait)'}`, background: tousCoches ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {tousCoches && <span style={{ color: 'var(--papier)', fontSize: 10 }}>✓</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  {ouvert && (
    <button
      onClick={e => { e.stopPropagation(); if (window.confirm(`Effacer tout le travail du sol ${annee} pour le bloc ${bloc.nom} ?`)) effacerBlocEntier(bloc.id) }}
      style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--rouge-clair)', borderRadius: 0, cursor: 'pointer', background: 'var(--rouge-pale)', color: 'var(--rouge)' }}>
      Effacer tout
    </button>
  )}
  <span style={{ color: 'var(--encre-douce)' }}>{ouvert ? '▾' : '▸'}</span>
</div>
                </div>

                {ouvert && planchesBloc.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--trait)', padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 6 }}>
                      Détail par planche — cliquez sur une case pour ajuster individuellement
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--encre-pale)', fontWeight: 400, borderBottom: '1px solid var(--trait-leger)', minWidth: 70 }}>Planche</th>
                            <th style={{ padding: '4px', textAlign: 'center', color: 'var(--encre-pale)', fontWeight: 400, borderBottom: '1px solid var(--trait-leger)' }}>Statut</th>
                            {ETAPES.map(e => (
                              <th key={e} style={{ padding: '4px', textAlign: 'center', color: 'var(--encre-pale)', fontWeight: 400, borderBottom: '1px solid var(--trait-leger)' }}>{ETAPES_LABELS[e]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {planchesBloc.map(planche => {
                            const statut = getStatutPlanche(planche.id)
                            const { bg, border, label, color } = statutCouleur(statut)
                            return (
                              <tr key={planche.id}>
                                <td style={{ padding: '5px 8px', fontWeight: 500, color: 'var(--encre)', borderBottom: '1px solid var(--trait-leger)' }}>
                                  {bloc.nom}-{String(planche.numero).padStart(2, '0')}
                                </td>
                                <td style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--trait-leger)' }}>
                                  <span style={{ fontSize: 10, background: bg, border: `1px solid ${border}`, color, borderRadius: 0, padding: '1px 5px' }}>{label}</span>
                                </td>
                                {ETAPES.map(e => {
                                  const maxPassages = PASSAGES_MAX[e] || 1
                                  return (
                                    <td key={e} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--trait-leger)' }}>
                                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                        {Array.from({ length: maxPassages }, (_, pi) => {
                                          const t = getTravail(planche.id, e, pi + 1)
                                          return (
                                            <div key={pi} onClick={() => toggleTravail(planche.id, e, pi + 1)}
                                              style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${t?.fait ? 'var(--accent)' : 'var(--trait-leger)'}`, background: t?.fait ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              {t?.fait && <span style={{ color: 'var(--papier)', fontSize: 9 }}>✓</span>}
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
        <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {blocsChamp.map(b => (
              <button key={b.id} onClick={() => setBlocSelectionne(b.id === blocSelectionne ? null : b.id)}
                style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: blocSelectionne === b.id ? 'var(--accent)' : 'var(--fond)', color: blocSelectionne === b.id ? 'var(--papier)' : 'var(--encre)' }}>
                Bloc {b.nom}
              </button>
            ))}
          </div>
          {!blocSelectionne && <p style={{ fontSize: 13, color: 'var(--encre-pale)' }}>Sélectionnez un bloc pour voir les planches</p>}
          {blocSelectionne && planches.filter(p => p.bloc_id === blocSelectionne).map(planche => {
            const statut = getStatutPlanche(planche.id)
            const { bg, border, label, color } = statutCouleur(statut)
            const bloc = blocs.find(b => b.id === blocSelectionne)
            return (
              <div key={planche.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--trait-leger)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)', minWidth: 70 }}>
                  {bloc?.nom}-{String(planche.numero).padStart(2, '0')}
                </div>
                <span style={{ fontSize: 10, background: bg, border: `1px solid ${border}`, color, borderRadius: 0, padding: '1px 5px', minWidth: 70, textAlign: 'center' }}>{label}</span>
                {ETAPES.map(e => {
                  const maxPassages = PASSAGES_MAX[e] || 1
                  return (
                    <div key={e} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ fontSize: 9, color: 'var(--encre-pale)' }}>{ETAPES_LABELS[e]}</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: maxPassages }, (_, pi) => {
                          const t = getTravail(planche.id, e, pi + 1)
                          return (
                            <div key={pi} onClick={() => toggleTravail(planche.id, e, pi + 1)}
                              style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${t?.fait ? 'var(--accent)' : 'var(--trait-leger)'}`, background: t?.fait ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {t?.fait && <span style={{ color: 'var(--papier)', fontSize: 9 }}>✓</span>}
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
