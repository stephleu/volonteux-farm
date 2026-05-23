import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LONGUEUR_PLANCHE = 50
const INCREMENT = 5

export default function Reel() {
  const [blocs, setBlocs] = useState([])
  const [planches, setPlanches] = useState([])
  const [cultures, setCultures] = useState([])
  const [series, setSeries] = useState([])
  const [legumes, setLegumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [plancheSelectionnee, setPlancheSelectionnee] = useState(null)
  const [dragCulture, setDragCulture] = useState(null)
  const [showSidebar, setShowSidebar] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: b }, { data: p }, { data: c }, { data: s }, { data: l }] = await Promise.all([
      supabase.from('blocs').select('*').order('nom'),
      supabase.from('planches').select('*').order('numero'),
      supabase.from('cultures').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('type', 'reel').order('position_debut'),
      supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').order('semaine_plantation'),
      supabase.from('legumes').select('*, familles(couleur)').order('nom'),
    ])
    setBlocs(b || [])
    setPlanches(p || [])
    setCultures(c || [])
    setSeries(s || [])
    setLegumes(l || [])
    setLoading(false)
  }

  async function placerCulture(plancheId, position) {
    if (!dragCulture) return
    await supabase.from('cultures').insert({
      planche_id: plancheId,
      legume_id: dragCulture.legume_id,
      variete_id: dragCulture.variete_id || null,
      serie_id: dragCulture.id,
      type: 'reel',
      statut: 'en_culture',
      longueur_metres: dragCulture.longueur_metres,
      position_debut: position,
      annee: 2026,
      saison: getSaison(dragCulture.semaine_plantation),
    })
    setDragCulture(null)
    fetchData()
  }

  async function deplacerCulture(cultureId, nouvellePosition) {
    await supabase.from('cultures').update({ position_debut: nouvellePosition }).eq('id', cultureId)
    setDragCulture(null)
    fetchData()
  }

  async function retirerCultureReel(id) {
    await supabase.from('cultures').delete().eq('id', id)
    fetchData()
  }

  function getSaison(semaine) {
    if (!semaine) return 'printemps'
    if (semaine <= 9) return 'hiver'
    if (semaine <= 22) return 'printemps'
    if (semaine <= 39) return 'ete'
    return 'automne'
  }

  const blocsChamp = blocs.filter(b => b.type !== 'serre')
  const planchesBloc = planches.filter(p => p.bloc_id === blocSelectionne)

  function handleDrop(e, plancheId) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const longueur = dragCulture?.longueur_metres || 10
    const positionBrute = Math.round(pct * LONGUEUR_PLANCHE / INCREMENT) * INCREMENT
    const position = Math.max(0, Math.min(LONGUEUR_PLANCHE - longueur, positionBrute))

    if (dragCulture?._deplacer) {
      deplacerCulture(dragCulture.id, position)
    } else {
      placerCulture(plancheId, position)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 48px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, position: 'sticky', top: 0, background: '#f3f4f6', padding: '10px 0', zIndex: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: '#111' }}>Plantation réelle 2026</h1>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Positionnez les cultures au mètre près sur chaque planche</p>
          </div>
          <button onClick={() => setShowSidebar(!showSidebar)} style={{ fontSize: 12, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: showSidebar ? '#1D9E75' : '#fff', color: showSidebar ? '#fff' : '#111' }}>
            {showSidebar ? 'Masquer séries' : 'Placer une série'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {blocsChamp.map(b => (
            <button key={b.id} onClick={() => { setBlocSelectionne(b.id); setPlancheSelectionnee(null) }}
              style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: blocSelectionne === b.id ? '#1D9E75' : '#f9fafb', color: blocSelectionne === b.id ? '#fff' : '#111' }}>
              Bloc {b.nom}
            </button>
          ))}
        </div>

        {!blocSelectionne && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
            Sélectionnez un bloc pour commencer
          </div>
        )}

        {blocSelectionne && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', marginBottom: 4 }}>
              <div />
              <div style={{ display: 'flex' }}>
                {Array.from({ length: 11 }, (_, i) => i * 5).map(m => (
                  <div key={m} style={{ flex: 1, fontSize: 9, color: '#9ca3af', textAlign: 'left', paddingLeft: 2 }}>{m}m</div>
                ))}
              </div>
            </div>

            {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

            {planchesBloc.map(planche => {
              const culturesPlanche = cultures.filter(c => c.planche_id === planche.id).sort((a, b) => a.position_debut - b.position_debut)
              const bloc = blocs.find(b => b.id === blocSelectionne)
              const estSelectionnee = plancheSelectionnee === planche.id

              return (
                <div key={planche.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ fontSize: 11, color: estSelectionnee ? '#1D9E75' : '#6b7280', fontWeight: estSelectionnee ? 500 : 400, cursor: 'pointer' }}
                    onClick={() => setPlancheSelectionnee(estSelectionnee ? null : planche.id)}>
                    {bloc?.nom}-{String(planche.numero).padStart(2, '0')}
                  </div>
                  <div
                    style={{ position: 'relative', height: 28, background: '#f3f4f6', borderRadius: 4, border: `1px solid ${estSelectionnee ? '#1D9E75' : dragCulture ? '#1D9E75' : '#e5e7eb'}`, borderStyle: dragCulture ? 'dashed' : 'solid', overflow: 'hidden' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, planche.id)}
                  >
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', left: `${(i + 1) * 10}%`, top: 0, bottom: 0, borderLeft: '1px solid #e5e7eb', opacity: 0.5 }} />
                    ))}
                    {culturesPlanche.map((culture, i) => {
                      const leftPct = (culture.position_debut / LONGUEUR_PLANCHE) * 100
                      const widthPct = (culture.longueur_metres / LONGUEUR_PLANCHE) * 100
                      const couleur = culture.legumes?.familles?.couleur || '#1D9E75'
                      return (
                        <div key={i}
                          draggable
                          onDragStart={e => {
                            e.stopPropagation()
                            setDragCulture({ ...culture, _deplacer: true })
                          }}
                          onDragEnd={() => setDragCulture(null)}
                          style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, top: 2, bottom: 2, background: couleur + 'cc', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 2, overflow: 'hidden', cursor: 'grab' }}
                        >
                          <span style={{ fontSize: 9, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {culture.legumes?.nom} {culture.longueur_metres}m
                          </span>
                          <button onClick={e => { e.stopPropagation(); retirerCultureReel(culture.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, fontSize: 10, lineHeight: 1, flexShrink: 0 }}>×</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {plancheSelectionnee && (
              <PlancheDetail
                planche={planches.find(p => p.id === plancheSelectionnee)}
                bloc={blocs.find(b => b.id === blocSelectionne)}
                cultures={cultures.filter(c => c.planche_id === plancheSelectionnee)}
                legumes={legumes}
                onSave={fetchData}
                onRetirer={retirerCultureReel}
              />
            )}
          </div>
        )}
      </div>

      {showSidebar && (
        <div style={{ width: 210, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 6 }}>Séries à placer</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>Glissez sur une planche</div>
          {series.map(serie => {
            const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
            return (
              <div key={serie.id} draggable
                onDragStart={() => setDragCulture(serie)}
                onDragEnd={() => setDragCulture(null)}
                style={{ padding: '7px 9px', marginBottom: 5, background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 6, cursor: 'grab', opacity: dragCulture?.id === serie.id ? 0.5 : 1 }}>
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
    </div>
  )
}

function PlancheDetail({ planche, bloc, cultures, legumes, onSave, onRetirer }) {
  const [form, setForm] = useState({ legume_id: '', longueur_metres: 10, position_debut: 0 })
  const [saving, setSaving] = useState(false)

  const positions = Array.from({ length: LONGUEUR_PLANCHE / INCREMENT }, (_, i) => i * INCREMENT)
  const longueurs = Array.from({ length: LONGUEUR_PLANCHE / INCREMENT }, (_, i) => (i + 1) * INCREMENT)

  async function handleSave() {
    setSaving(true)
    await supabase.from('cultures').insert({
      planche_id: planche.id,
      legume_id: form.legume_id,
      type: 'reel',
      statut: 'en_culture',
      longueur_metres: form.longueur_metres,
      position_debut: form.position_debut,
      annee: 2026,
    })
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #1D9E75', borderRadius: 8, padding: 14, marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 10 }}>
        {bloc?.nom}-{String(planche.numero).padStart(2, '0')} · Ajout manuel
      </div>

      {cultures.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Cultures en place</div>
          {cultures.map((c, i) => {
            const couleur = c.legumes?.familles?.couleur || '#1D9E75'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 5, marginBottom: 4, fontSize: 11 }}>
                <span style={{ flex: 1, color: '#111', fontWeight: 500 }}>{c.legumes?.nom}</span>
                <span style={{ color: '#6b7280' }}>{c.position_debut}m → {c.position_debut + c.longueur_metres}m</span>
                <button onClick={() => onRetirer(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Légume</div>
          <select value={form.legume_id} onChange={e => setForm({ ...form, legume_id: e.target.value })}
            style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
            <option value="">-- Choisir --</option>
            {legumes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Depuis</div>
          <select value={form.position_debut} onChange={e => setForm({ ...form, position_debut: parseInt(e.target.value) })}
            style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
            {positions.map(p => <option key={p} value={p}>{p}m</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Longueur</div>
          <select value={form.longueur_metres} onChange={e => setForm({ ...form, longueur_metres: parseInt(e.target.value) })}
            style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
            {longueurs.map(l => <option key={l} value={l}>{l}m</option>)}
          </select>
        </div>
      </div>

      <button onClick={handleSave} disabled={!form.legume_id || saving}
        style={{ background: form.legume_id ? '#1D9E75' : '#e5e7eb', color: form.legume_id ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: form.legume_id ? 'pointer' : 'default', fontSize: 12, fontWeight: 500 }}>
        {saving ? 'Enregistrement...' : 'Ajouter'}
      </button>
    </div>
  )
}