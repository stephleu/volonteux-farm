import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const SEMAINES_PAR_MOIS = [4, 4, 5, 4, 4, 5, 4, 4, 4, 5, 4, 5]

export default function Assolement() {
  const [blocs, setBlocs] = useState([])
  const [planches, setPlanches] = useState([])
  const [series, setSeries] = useState([])
  const [cultures, setCultures] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('champ')
  const [ouverts, setOuverts] = useState({})
  const [offsetMois, setOffsetMois] = useState(0)
  const [dragSerie, setDragSerie] = useState(null)
  const [showSeries, setShowSeries] = useState(false)
  const [cultureSelectionnee, setCultureSelectionnee] = useState(null)
  const [modifCulture, setModifCulture] = useState(null)
  const [triSeries, setTriSeries] = useState('recent')
  const [propositionDebord, setPropositionDebord] = useState(null)
  const [annee, setAnnee] = useState(2026)
  const refs = useRef({})

 useEffect(() => { fetchData() }, [annee])

  async function fetchData() {
    const [{ data: b }, { data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('blocs').select('*').order('nom'),
      supabase.from('planches').select('*').order('numero'),
      supabase.from('series').select('*, legumes(nom, familles(couleur), espacement_plants, rangs), varietes(nom)').eq('annee', annee).order('created_at', { ascending: false }),
supabase.from('cultures').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('annee', annee).order('created_at'),
    ])
    setBlocs(b || [])
    setPlanches(p || [])
    setSeries(s || [])
    setCultures(c || [])
    setLoading(false)
  }

  const seriesPlacees = new Set(cultures.map(c => c.serie_id).filter(Boolean))
  const seriesDisponibles = series
    .filter(s => !seriesPlacees.has(s.id))
    .sort((a, b) => {
      if (triSeries === 'alpha') return (a.legumes?.nom || '').localeCompare(b.legumes?.nom || '')
      if (triSeries === 'semaine') return (a.semaine_plantation || 0) - (b.semaine_plantation || 0)
      return 0
    })

  function getSaison(semaine) {
    if (semaine <= 9) return 'hiver'
    if (semaine <= 22) return 'printemps'
    if (semaine <= 39) return 'ete'
    return 'automne'
  }

  function semaineToDate(semaine, annee) {
    const d = new Date(annee, 0, 1 + (semaine - 1) * 7)
    return d.toISOString().split('T')[0]
  }

  function getSemaineDepuisDate(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const start = new Date(2026, 0, 1)
    return Math.ceil((d - start) / (7 * 24 * 3600 * 1000))
  }

  async function placerSerie(plancheId, serie) {
    if (!serie) return
    const saison = getSaison(serie.semaine_plantation || 14)
    const bloc = blocs.find(b => planches.find(p => p.id === plancheId && p.bloc_id === b.id))
    const lieu = bloc?.type === 'serre' ? 'serre' : 'exterieur'
    const { data: duree } = await supabase
      .from('durees_culture')
      .select('duree_semaines')
      .eq('legume_id', serie.legume_id)
      .eq('lieu', lieu)
      .eq('saison', saison)
      .single()
    const dureeSemaines = duree?.duree_semaines || 12
    const semPlantation = serie.semaine_plantation || 14
    const culturesPlanche = cultures.filter(c => c.planche_id === plancheId)
    const metresOccupes = culturesPlanche.reduce((acc, c) => acc + (c.longueur_metres || 0), 0)
    const metresDisponibles = 50 - metresOccupes
    const metresASerie = serie.longueur_metres || 50

    if (metresASerie > metresDisponibles) {
      const planchesBloc = planches.filter(p => p.bloc_id === bloc?.id).sort((a, b) => a.numero - b.numero)
      const indexActuel = planchesBloc.findIndex(p => p.id === plancheId)
      const plancheSuivante = planchesBloc[indexActuel + 1]
      setPropositionDebord({
        serie, plancheId,
        plancheSuivante: plancheSuivante || null,
        metresPlanche: metresDisponibles,
        metresDebord: metresASerie - metresDisponibles,
        dureeSemaines, semPlantation, lieu,
      })
      setDragSerie(null)
      return
    }

    await supabase.from('cultures').insert({
      planche_id: plancheId,
      legume_id: serie.legume_id,
      variete_id: serie.variete_id || null,
      serie_id: serie.id,
      type: 'prevu', statut: 'en_culture',
      date_plantation: semaineToDate(semPlantation, 2026),
      date_fin_prevue: semaineToDate(semPlantation + dureeSemaines, 2026),
      longueur_metres: metresASerie,
      position_debut: metresOccupes,
      saison, annee: 2026,
    })
    setDragSerie(null)
    fetchData()
  }

  async function confirmerDebord(accepter) {
    const { serie, plancheId, plancheSuivante, metresPlanche, metresDebord, dureeSemaines, semPlantation } = propositionDebord
    await supabase.from('cultures').insert({
      planche_id: plancheId,
      legume_id: serie.legume_id,
      variete_id: serie.variete_id || null,
      serie_id: serie.id,
      type: 'prevu', statut: 'en_culture',
      date_plantation: semaineToDate(semPlantation, 2026),
      date_fin_prevue: semaineToDate(semPlantation + dureeSemaines, 2026),
      longueur_metres: metresPlanche,
      position_debut: 50 - metresPlanche,
      saison: getSaison(semPlantation), annee: 2026,
    })
    if (accepter && plancheSuivante) {
      await supabase.from('cultures').insert({
        planche_id: plancheSuivante.id,
        legume_id: serie.legume_id,
        variete_id: serie.variete_id || null,
        serie_id: serie.id,
        type: 'prevu', statut: 'en_culture',
        date_plantation: semaineToDate(semPlantation, 2026),
        date_fin_prevue: semaineToDate(semPlantation + dureeSemaines, 2026),
        longueur_metres: metresDebord,
        position_debut: 0,
        saison: getSaison(semPlantation), annee: 2026,
      })
    }
    setPropositionDebord(null)
    fetchData()
  }

  async function retirerCulture(id) {
    await supabase.from('cultures').delete().eq('id', id)
    setCultureSelectionnee(null)
    setModifCulture(null)
    fetchData()
  }

  async function modifierCulture(id, updates) {
    await supabase.from('cultures').update(updates).eq('id', id)
    setModifCulture(null)
    setCultureSelectionnee(null)
    fetchData()
  }

  const blocsAffiches = blocs.filter(b => vue === 'champ' ? b.type !== 'serre' : b.type === 'serre')
  const moisAffiches = MOIS.slice(offsetMois, offsetMois + 6)
  const semaineDebut = SEMAINES_PAR_MOIS.slice(0, offsetMois).reduce((a, b) => a + b, 0) + 1
  const semaineFin = SEMAINES_PAR_MOIS.slice(0, offsetMois + 6).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 48px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'sticky', top: 0, background: '#f3f4f6', padding: '10px 0', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
  <h1 style={{ fontSize: 18, fontWeight: 500, color: '#111' }}>Assolement</h1>
  <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))}
    style={{ fontSize: 13, padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
    {[2024, 2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
  </select>
</div>
            <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {['champ', 'serres'].map(v => (
                <button key={v} onClick={() => setVue(v)} style={{ padding: '5px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: vue === v ? '#1D9E75' : '#f9fafb', color: vue === v ? '#fff' : '#6b7280' }}>
                  {v === 'champ' ? 'Plein champ' : 'Serres'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowSeries(!showSeries)} style={{ fontSize: 12, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: showSeries ? '#1D9E75' : '#fff', color: showSeries ? '#fff' : '#111' }}>
              {showSeries ? 'Masquer séries' : `Placer une série (${seriesDisponibles.length})`}
            </button>
            <button onClick={() => setOffsetMois(Math.max(0, offsetMois - 1))} disabled={offsetMois === 0}
              style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', background: '#fff' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, color: '#111', minWidth: 140, textAlign: 'center' }}>
              {moisAffiches[0]} — {moisAffiches[moisAffiches.length - 1]} 2026
            </span>
            <button onClick={() => setOffsetMois(Math.min(6, offsetMois + 1))} disabled={offsetMois === 6}
              style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', background: '#fff' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ minWidth: 600 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', marginBottom: 4 }}>
            <div />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {moisAffiches.map(m => (
                <div key={m} style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', borderLeft: '1px solid #e5e7eb' }}>{m}</div>
              ))}
            </div>
          </div>

          {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

          {blocsAffiches.map(bloc => {
            const planchesBloc = planches.filter(p => p.bloc_id === bloc.id)
            const ouvert = ouverts[bloc.id]
            return (
              <div key={bloc.id} ref={el => refs.current[bloc.id] = el} style={{ marginBottom: 6 }}>
                <div onClick={() => setOuverts(prev => ({ ...prev, [bloc.id]: !prev[bloc.id] }))}
                  style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', cursor: 'pointer', background: '#e5e7eb', borderRadius: 6, padding: '5px 8px', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Bloc {bloc.nom} {ouvert ? '▾' : '▸'}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
                    {moisAffiches.map(m => <div key={m} style={{ borderLeft: '1px solid #d1d5db', height: 18 }} />)}
                  </div>
                </div>

                {ouvert && planchesBloc.map(planche => {
                  const culturesPlanche = cultures.filter(c => c.planche_id === planche.id)
                  const hauteur = Math.max(24, culturesPlanche.length * 26)
                  return (
                    <div key={planche.id}
                      style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'flex-start', marginBottom: 2 }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); placerSerie(planche.id, dragSerie) }}
                    >
                      <div style={{ fontSize: 11, color: '#6b7280', paddingTop: 4 }}>
                        {bloc.nom}-{String(planche.numero).padStart(2, '0')}
                      </div>
                      <div style={{ position: 'relative', background: '#f3f4f6', borderRadius: 4, border: dragSerie ? '1px dashed #1D9E75' : '1px solid #e5e7eb', height: hauteur }}>
                        {moisAffiches.map((m, i) => (
                          <div key={m} style={{ position: 'absolute', left: `${(i / 6) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid #e5e7eb' }} />
                        ))}
                        {culturesPlanche.map((culture, i) => {
                          const semDeb = getSemaineDepuisDate(culture.date_plantation)
                          const semFin = getSemaineDepuisDate(culture.date_fin_prevue)
                          if (!semDeb || !semFin) return null
                          const leftPct = ((semDeb - semaineDebut) / (semaineFin - semaineDebut + 1)) * 100
                          const widthPct = ((semFin - semDeb) / (semaineFin - semaineDebut + 1)) * 100
                          if (leftPct > 100 || leftPct + widthPct < 0) return null
                          const couleur = culture.legumes?.familles?.couleur || '#1D9E75'
                          const estSelectionnee = cultureSelectionnee?.id === culture.id
                          const top = i * 26 + 2
                          return (
                            <div key={culture.id}
                              onClick={e => { e.stopPropagation(); setCultureSelectionnee(estSelectionnee ? null : culture); setModifCulture(null) }}
                              style={{
                                position: 'absolute',
                                left: `${Math.max(0, leftPct)}%`,
                                width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                                top, height: 22,
                                background: couleur + 'cc',
                                borderRadius: 3,
                                display: 'flex', alignItems: 'center', paddingLeft: 4,
                                cursor: 'pointer',
                                border: estSelectionnee ? '2px solid #111' : 'none',
                                zIndex: estSelectionnee ? 5 : 1,
                                overflow: 'hidden',
                              }}>
                              <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap' }}>
                                {culture.legumes?.nom}{culture.varietes?.nom ? ` · ${culture.varietes.nom}` : ''} · {culture.longueur_metres}m
                              </span>
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
      </div>

      {cultureSelectionnee && !modifCulture && (
        <div style={{ width: 220, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, flexShrink: 0, alignSelf: 'flex-start', marginTop: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{cultureSelectionnee.legumes?.nom}</span>
            <button onClick={() => setCultureSelectionnee(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
            {cultureSelectionnee.varietes?.nom && <div>Variété : {cultureSelectionnee.varietes.nom}</div>}
            <div>Plantation : {cultureSelectionnee.date_plantation}</div>
            <div>Fin prévue : {cultureSelectionnee.date_fin_prevue}</div>
            <div>Longueur : {cultureSelectionnee.longueur_metres}m</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setModifCulture(cultureSelectionnee)}
              style={{ width: '100%', padding: '7px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#f9fafb', color: '#111' }}>
              Modifier
            </button>
            <button onClick={() => retirerCulture(cultureSelectionnee.id)}
              style={{ width: '100%', padding: '7px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}>
              Retirer
            </button>
          </div>
        </div>
      )}

      {modifCulture && (
        <div style={{ width: 240, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, flexShrink: 0, alignSelf: 'flex-start', marginTop: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Modifier</span>
            <button onClick={() => setModifCulture(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
          </div>
          <ModifForm culture={modifCulture} onSave={modifierCulture} onCancel={() => setModifCulture(null)} />
        </div>
      )}

      {showSeries && (
        <div style={{ width: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 6 }}>Séries à placer</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[['recent', 'Récent'], ['alpha', 'A→Z'], ['semaine', 'Chrono']].map(([val, label]) => (
              <button key={val} onClick={() => setTriSeries(val)} style={{
                flex: 1, padding: '3px 0', fontSize: 10, border: '1px solid #e5e7eb',
                borderRadius: 4, cursor: 'pointer',
                background: triSeries === val ? '#1D9E75' : '#f9fafb',
                color: triSeries === val ? '#fff' : '#6b7280',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Glissez sur une planche</div>
          {seriesDisponibles.length === 0 && (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Toutes les séries sont placées !</p>
          )}
          {seriesDisponibles.map(serie => {
            const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
            return (
              <div key={serie.id} draggable
                onDragStart={() => setDragSerie(serie)}
                onDragEnd={() => setDragSerie(null)}
                style={{ padding: '7px 9px', marginBottom: 5, background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 6, cursor: 'grab', opacity: dragSerie?.id === serie.id ? 0.5 : 1 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#111' }}>
                  {serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                  Sem. {serie.semaine_plantation} · {serie.longueur_metres}m
                </div>
              </div>
            )
          })}
        </div>
      )}

      {propositionDebord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111', marginBottom: 12 }}>Débordement détecté</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
              La série <strong>{propositionDebord.serie.legumes?.nom}</strong> fait <strong>{propositionDebord.serie.longueur_metres}m</strong> mais il ne reste que <strong>{propositionDebord.metresPlanche}m</strong> disponibles.
              <br /><br />
              {propositionDebord.plancheSuivante
                ? <>Les <strong>{propositionDebord.metresDebord}m</strong> restants seront placés sur la planche suivante.</>
                : <span style={{ color: '#dc2626' }}>⚠ Fin de bloc — impossible de reporter.</span>
              }
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPropositionDebord(null)}
                style={{ flex: 1, padding: '8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#f9fafb' }}>
                Annuler
              </button>
              {propositionDebord.plancheSuivante && (
                <button onClick={() => confirmerDebord(true)}
                  style={{ flex: 1, padding: '8px', fontSize: 13, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1D9E75', color: '#fff', fontWeight: 500 }}>
                  Confirmer + reporter
                </button>
              )}
              <button onClick={() => confirmerDebord(false)}
                style={{ flex: 1, padding: '8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}>
                {propositionDebord.metresPlanche}m seulement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModifForm({ culture, onSave, onCancel }) {
  const [datePlantation, setDatePlantation] = useState(culture.date_plantation || '')
  const [dateFinPrevue, setDateFinPrevue] = useState(culture.date_fin_prevue || '')
  const [longueur, setLongueur] = useState(culture.longueur_metres || 50)
  const [type, setType] = useState(culture.type || 'prevu')
  const [statut, setStatut] = useState(culture.statut || 'en_culture')

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Date plantation</div>
        <input type="date" value={datePlantation} onChange={e => setDatePlantation(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: 5 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Date fin prévue</div>
        <input type="date" value={dateFinPrevue} onChange={e => setDateFinPrevue(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: 5 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Longueur (m)</div>
        <input type="number" value={longueur} onChange={e => setLongueur(parseInt(e.target.value))}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: 5 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Type</div>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
          <option value="prevu">Prévu</option>
          <option value="reel">Réel</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Statut</div>
        <select value={statut} onChange={e => setStatut(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
          <option value="en_culture">En culture</option>
          <option value="engrais_vert">Engrais vert</option>
          <option value="repos">Repos</option>
          <option value="termine">Terminé</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '7px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#f9fafb' }}>
          Annuler
        </button>
        <button onClick={() => onSave(culture.id, { date_plantation: datePlantation, date_fin_prevue: dateFinPrevue, longueur_metres: longueur, type, statut })}
          style={{ flex: 1, padding: '7px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1D9E75', color: '#fff', fontWeight: 500 }}>
          Sauvegarder
        </button>
      </div>
    </div>
  )
}