import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X } from 'lucide-react'

export default function Series() {
  const [series, setSeries] = useState([])
  const [legumes, setLegumes] = useState([])
  const [varietes, setVarietes] = useState([])
  const [typesTraitement, setTypesTraitement] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtreNom, setFiltreNom] = useState('')
  const [legumeSelectionne, setLegumeSelectionne] = useState(null)
  const [serieEnModif, setSerieEnModif] = useState(null)
  const [form, setForm] = useState({
    legume_id: '', variete_id: '', nom: '',
    fournisseur: 'Pépinière interne', type: 'plant',
    longueur_metres: 50, semaine_plantation: '', annee: 2026, notes: '',
  })
  const [fertilisations, setFertilisations] = useState([{ dose_kg_ha: '', semaines_apres_plantation: '' }])
  const [traitements, setTraitements] = useState([{ type_traitement_id: '', semaines_apres_plantation: '' }])

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (form.legume_id) {
      fetchVarietes(form.legume_id)
      const leg = legumes.find(l => l.id === form.legume_id)
      setLegumeSelectionne(leg || null)
    } else {
      setVarietes([])
      setLegumeSelectionne(null)
    }
  }, [form.legume_id])

  async function fetchData() {
    const [{ data: s }, { data: l }, { data: t }] = await Promise.all([
      supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').order('created_at', { ascending: false }),
      supabase.from('legumes').select('*').order('nom'),
      supabase.from('types_traitement').select('*').order('nom'),
    ])
    setSeries(s || [])
    setLegumes(l || [])
    setTypesTraitement(t || [])
    setLoading(false)
  }

  async function fetchVarietes(legumeId) {
    const { data } = await supabase.from('varietes').select('*').eq('legume_id', legumeId).order('nom')
    setVarietes(data || [])
  }

  function calculNbPlants(longueur, legume) {
    if (!legume) return ''
    return Math.round((longueur * 100 / legume.espacement_plants) * legume.rangs)
  }

  async function handleSave() {
    const nomAuto = form.nom || `${legumes.find(l => l.id === form.legume_id)?.nom || ''} · sem. ${form.semaine_plantation}`
    const nbPlants = calculNbPlants(form.longueur_metres, legumeSelectionne)
    const payload = {
      legume_id: form.legume_id,
      variete_id: form.variete_id || null,
      nom: nomAuto,
      fournisseur: form.fournisseur,
      type: form.type,
      longueur_metres: form.longueur_metres,
      semaine_plantation: form.semaine_plantation || null,
      annee: form.annee,
      notes: form.notes || null,
      nombre_plants: nbPlants || null,
    }
    const { data: serie } = await supabase.from('series').insert(payload).select().single()
    if (serie) {
      const fertis = fertilisations.filter(f => f.dose_kg_ha && f.semaines_apres_plantation)
      if (fertis.length > 0) await supabase.from('serie_fertilisations').insert(fertis.map(f => ({ ...f, serie_id: serie.id })))
      const traits = traitements.filter(t => t.type_traitement_id && t.semaines_apres_plantation)
      if (traits.length > 0) await supabase.from('serie_traitements').insert(traits.map(t => ({ ...t, serie_id: serie.id })))
    }
    setShowForm(false)
    setForm({ legume_id: '', variete_id: '', nom: '', fournisseur: 'Pépinière interne', type: 'plant', longueur_metres: 50, semaine_plantation: '', annee: 2026, notes: '' })
    setFertilisations([{ dose_kg_ha: '', semaines_apres_plantation: '' }])
    setTraitements([{ type_traitement_id: '', semaines_apres_plantation: '' }])
    fetchData()
  }

  async function handleUpdate() {
    const nbPlants = calculNbPlants(serieEnModif.longueur_metres, legumes.find(l => l.id === serieEnModif.legume_id))
    await supabase.from('series').update({
      legume_id: serieEnModif.legume_id,
      variete_id: serieEnModif.variete_id || null,
      fournisseur: serieEnModif.fournisseur,
      type: serieEnModif.type,
      longueur_metres: serieEnModif.longueur_metres,
      semaine_plantation: serieEnModif.semaine_plantation,
      nombre_plants: nbPlants || serieEnModif.nombre_plants,
      notes: serieEnModif.notes,
    }).eq('id', serieEnModif.id)
    setSerieEnModif(null)
    fetchData()
  }

  async function supprimerSerie(id) {
    await supabase.from('series').delete().eq('id', id)
    fetchData()
  }

  function updateFerti(i, key, val) {
    const updated = [...fertilisations]
    updated[i][key] = val
    setFertilisations(updated)
  }

  function updateTraitement(i, key, val) {
    const updated = [...traitements]
    updated[i][key] = val
    setTraitements(updated)
  }

  const seriesFiltrees = series.filter(s =>
    s.legumes?.nom?.toLowerCase().includes(filtreNom.toLowerCase()) ||
    s.varietes?.nom?.toLowerCase().includes(filtreNom.toLowerCase()) ||
    s.nom?.toLowerCase().includes(filtreNom.toLowerCase())
  )

  const semaines = Array.from({ length: 52 }, (_, i) => i + 1)
  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: 6 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Séries</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{series.length} séries · saison 2026</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> Nouvelle série
        </button>
      </div>

      <input value={filtreNom} onChange={e => setFiltreNom(e.target.value)}
        placeholder="Rechercher par légume, variété..."
        style={{ width: '100%', fontSize: 13, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16, background: '#fff' }} />

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>Nouvelle série</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Légume</div>
              <select value={form.legume_id} onChange={e => setForm({ ...form, legume_id: e.target.value, variete_id: '' })} style={inputStyle}>
                <option value="">-- Choisir --</option>
                {legumes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Variété</div>
              <select value={form.variete_id} onChange={e => setForm({ ...form, variete_id: e.target.value })} style={inputStyle}>
                <option value="">-- Aucune --</option>
                {varietes.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Type</div>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                <option value="plant">Plant</option>
                <option value="semis">Semis direct</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Fournisseur</div>
              <select value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} style={inputStyle}>
                <option>Pépinière interne</option>
                <option>Desbos</option>
                <option>Semis direct</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Semaine plantation</div>
              <select value={form.semaine_plantation} onChange={e => setForm({ ...form, semaine_plantation: parseInt(e.target.value) })} style={inputStyle}>
                <option value="">-- Semaine --</option>
                {semaines.map(s => <option key={s} value={s}>Sem. {s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Longueur (m)</div>
              <input type="number" min="5" step="5" value={form.longueur_metres}
                onChange={e => setForm({ ...form, longueur_metres: parseInt(e.target.value) })} style={inputStyle} />
            </div>
          </div>

          {legumeSelectionne && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#166534' }}>
              Nombre de plants calculé : <strong>{calculNbPlants(form.longueur_metres, legumeSelectionne)} plants</strong>
              <span style={{ color: '#6b7280', marginLeft: 8 }}>({legumeSelectionne.rangs} rangs · espacement {legumeSelectionne.espacement_plants}cm)</span>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 8 }}>Fertilisation</div>
            {fertilisations.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <input type="number" placeholder="Dose kg/ha" value={f.dose_kg_ha}
                    onChange={e => updateFerti(i, 'dose_kg_ha', e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <select value={f.semaines_apres_plantation} onChange={e => updateFerti(i, 'semaines_apres_plantation', parseInt(e.target.value))} style={inputStyle}>
                    <option value="">Sem. après plantation</option>
                    {Array.from({ length: 30 }, (_, j) => j + 1).map(s => <option key={s} value={s}>Sem. +{s}</option>)}
                  </select>
                </div>
                {fertilisations.length > 1 && (
                  <button onClick={() => setFertilisations(fertilisations.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                )}
                {i === fertilisations.length - 1 && (
                  <button onClick={() => setFertilisations([...fertilisations, { dose_kg_ha: '', semaines_apres_plantation: '' }])}
                    style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#166534' }}>
                    <Plus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 8 }}>Traitements</div>
            {traitements.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ flex: 2 }}>
                  <select value={t.type_traitement_id} onChange={e => updateTraitement(i, 'type_traitement_id', e.target.value)} style={inputStyle}>
                    <option value="">-- Type de traitement --</option>
                    {typesTraitement.map(tt => <option key={tt.id} value={tt.id}>{tt.nom}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <select value={t.semaines_apres_plantation} onChange={e => updateTraitement(i, 'semaines_apres_plantation', parseInt(e.target.value))} style={inputStyle}>
                    <option value="">Sem. après plantation</option>
                    {Array.from({ length: 30 }, (_, j) => j + 1).map(s => <option key={s} value={s}>Sem. +{s}</option>)}
                  </select>
                </div>
                {traitements.length > 1 && (
                  <button onClick={() => setTraitements(traitements.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                )}
                {i === traitements.length - 1 && (
                  <button onClick={() => setTraitements([...traitements, { type_traitement_id: '', semaines_apres_plantation: '' }])}
                    style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#92400e' }}>
                    <Plus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <button onClick={handleSave} disabled={!form.legume_id}
            style={{ background: form.legume_id ? '#1D9E75' : '#e5e7eb', color: form.legume_id ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: form.legume_id ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
            Créer la série
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {seriesFiltrees.map(serie => {
          const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
          const enModif = serieEnModif?.id === serie.id

          if (enModif) return (
            <div key={serie.id} style={{ background: '#fff', border: '1px solid #1D9E75', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Légume</div>
                  <select value={serieEnModif.legume_id} onChange={e => setSerieEnModif({ ...serieEnModif, legume_id: e.target.value })} style={inputStyle}>
                    {legumes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Type</div>
                  <select value={serieEnModif.type} onChange={e => setSerieEnModif({ ...serieEnModif, type: e.target.value })} style={inputStyle}>
                    <option value="plant">Plant</option>
                    <option value="semis">Semis direct</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Fournisseur</div>
                  <select value={serieEnModif.fournisseur} onChange={e => setSerieEnModif({ ...serieEnModif, fournisseur: e.target.value })} style={inputStyle}>
                    <option>Pépinière interne</option>
                    <option>Desbos</option>
                    <option>Semis direct</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Semaine plantation</div>
                  <select value={serieEnModif.semaine_plantation} onChange={e => setSerieEnModif({ ...serieEnModif, semaine_plantation: parseInt(e.target.value) })} style={inputStyle}>
                    {semaines.map(s => <option key={s} value={s}>Sem. {s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Longueur (m)</div>
                  <input type="number" min="5" step="5" value={serieEnModif.longueur_metres}
                    onChange={e => setSerieEnModif({ ...serieEnModif, longueur_metres: parseInt(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Notes</div>
                  <input type="text" value={serieEnModif.notes || ''} onChange={e => setSerieEnModif({ ...serieEnModif, notes: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSerieEnModif(null)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#f9fafb' }}>Annuler</button>
                <button onClick={handleUpdate} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1D9E75', color: '#fff', fontWeight: 500 }}>Sauvegarder</button>
              </div>
            </div>
          )

          return (
            <div key={serie.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                  {serie.legumes?.nom}
                  {serie.varietes?.nom && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {serie.varietes.nom}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {serie.semaine_plantation && `Sem. ${serie.semaine_plantation} · `}
                  {serie.longueur_metres}m
                  {serie.nombre_plants && ` · ${serie.nombre_plants} plants`}
                  {` · ${serie.fournisseur}`}
                </div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: serie.type === 'plant' ? '#fef3c7' : '#ede9fe', color: serie.type === 'plant' ? '#92400e' : '#5b21b6' }}>
                {serie.type === 'plant' ? 'Plant' : 'Semis'}
              </span>
              <button onClick={() => setSerieEnModif(serie)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', color: '#6b7280', padding: '3px 8px', fontSize: 11 }}>
                Modifier
              </button>
              <button onClick={() => supprimerSerie(serie.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                <X size={14} />
              </button>
            </div>
          )
        })}

        {!loading && seriesFiltrees.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
            Aucune série — cliquez sur "Nouvelle série" pour commencer
          </div>
        )}
      </div>
    </div>
  )
}