import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { semaineIso, anneeCourante } from '../lib/dates'
import { Plus, X } from 'lucide-react'
import PassagesSerie from '../components/PassagesSerie.jsx'
import { EnTetePage, BoutonAjouter } from '../components/ui.jsx'
import { useChargement } from '../lib/useChargement'

const FOURNISSEURS = ['Pépinière interne', 'Desbos', 'Pépi', 'agrosemence', 'agrodia', 'valsoleil', 'Payson ferme', 'GIA ail dromois', 'Semis direct']
const ANNEES = [2025, 2026, 2027, 2028]

const dateCourte = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''

function OptionsFournisseurs({ valeur }) {
  const liste = valeur && !FOURNISSEURS.includes(valeur) ? [...FOURNISSEURS, valeur] : FOURNISSEURS
  return liste.map(f => <option key={f}>{f}</option>)
}

export default function Series() {
  const [series, setSeries] = useState([])
  const [legumes, setLegumes] = useState([])
  const [varietes, setVarietes] = useState([])
  const [typesTraitement, setTypesTraitement] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtreNom, setFiltreNom] = useState('')
  const [serieEnModif, setSerieEnModif] = useState(null)
  const [annee, setAnnee] = useState(anneeCourante)
  // La nouvelle série prend l'année affichée (une date au champ la corrige ensuite)
  const formVide = {
    legume_id: '', variete_id: '', nom: '',
    fournisseur: 'Pépinière interne', type: 'plant',
    longueur_metres: 50, semaine_plantation: '', annee, notes: '',
    rangs: '', espacement_plants: '', date_plantation: '', premiere_recolte: '', derniere_recolte: '',
  }
  const [form, setForm] = useState(formVide)
  const [traitements, setTraitements] = useState([{ type_traitement_id: '', semaines_apres_plantation: '' }])

  async function fetchData() {
    const [{ data: s }, { data: l }, { data: t }] = await Promise.all([
      supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('annee', annee).order('semaine_plantation'),
      supabase.from('legumes').select('*').order('nom'),
      supabase.from('types_traitement').select('*').order('nom'),
    ])
    setSeries(s || [])
    setLegumes(l || [])
    setTypesTraitement(t || [])
    setLoading(false)
  }
  useChargement(fetchData, [annee])

  async function fetchVarietes(legumeId) {
    const { data } = await supabase.from('varietes').select('*').eq('legume_id', legumeId).order('nom')
    setVarietes(data || [])
  }
  // Variétés du légume choisi dans le formulaire
  useChargement(() => (form.legume_id ? fetchVarietes(form.legume_id) : setVarietes([])), [form.legume_id])
  const legumeSelectionne = legumes.find(l => l.id === form.legume_id) || null

  function calculNbPlants(longueur, rangs, espacement) {
    if (!rangs || !espacement) return ''
    return Math.round((longueur * 100 / espacement) * rangs)
  }

  const nombreOuNull = v => (v === '' || v == null ? null : Number(v))

  async function handleSave() {
    const nomAuto = form.nom || `${legumes.find(l => l.id === form.legume_id)?.nom || ''} · sem. ${form.semaine_plantation}`
    const nbPlants = calculNbPlants(form.longueur_metres, form.rangs, form.espacement_plants)
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
      rangs: nombreOuNull(form.rangs),
      espacement_plants: nombreOuNull(form.espacement_plants),
      date_plantation: form.date_plantation || null,
      premiere_recolte: form.premiere_recolte || null,
      derniere_recolte: form.derniere_recolte || null,
    }
    const { data: serie } = await supabase.from('series').insert(payload).select().single()
    if (serie) {
      const traits = traitements.filter(t => t.type_traitement_id && t.semaines_apres_plantation)
      if (traits.length > 0) await supabase.from('serie_traitements').insert(traits.map(t => ({ ...t, serie_id: serie.id })))
    }
    setShowForm(false)
    setForm(formVide)
    setTraitements([{ type_traitement_id: '', semaines_apres_plantation: '' }])
    fetchData()
  }

  async function handleUpdate() {
    const nbPlants = calculNbPlants(serieEnModif.longueur_metres, serieEnModif.rangs, serieEnModif.espacement_plants)
    await supabase.from('series').update({
      legume_id: serieEnModif.legume_id,
      variete_id: serieEnModif.variete_id || null,
      fournisseur: serieEnModif.fournisseur,
      type: serieEnModif.type,
      longueur_metres: serieEnModif.longueur_metres,
      semaine_plantation: serieEnModif.semaine_plantation,
      nombre_plants: nbPlants || serieEnModif.nombre_plants,
      notes: serieEnModif.notes,
      rangs: nombreOuNull(serieEnModif.rangs),
      espacement_plants: nombreOuNull(serieEnModif.espacement_plants),
      date_plantation: serieEnModif.date_plantation || null,
      premiere_recolte: serieEnModif.premiere_recolte || null,
      derniere_recolte: serieEnModif.derniere_recolte || null,
    }).eq('id', serieEnModif.id)
    setSerieEnModif(null)
    fetchData()
  }

  async function supprimerSerie(id) {
    const serie = series.find(s => s.id === id)
    if (!window.confirm(`Supprimer définitivement la série « ${serie?.nom || ''} » ?`)) return
    const { error } = await supabase.from('series').delete().eq('id', id)
    if (error) alert(`Suppression impossible (elle est sans doute placée dans l'assolement ou a des passages prévus) : ${error.message}`)
    fetchData()
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
  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }

  return (
    <div>
      <EnTetePage titre="Séries" sousTitre={<>
        {series.length} séries · saison{' '}
        <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={{ fontSize: 13, padding: '2px 6px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </>}>
        <BoutonAjouter onClick={() => { setForm(formVide); setShowForm(true) }}>Nouvelle série</BoutonAjouter>
      </EnTetePage>

      <input value={filtreNom} onChange={e => setFiltreNom(e.target.value)}
        placeholder="Rechercher par légume, variété..."
        style={{ width: '100%', fontSize: 13, padding: '8px 12px', border: '1px solid var(--trait)', borderRadius: 0, marginBottom: 16, background: 'var(--papier)' }} />

      {showForm && (
        <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre)' }}>Nouvelle série</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Légume</div>
              <select value={form.legume_id} onChange={e => {
                // Rangs et espacement de la fiche légume par défaut, modifiables pour la série
                const leg = legumes.find(l => l.id === e.target.value)
                setForm({ ...form, legume_id: e.target.value, variete_id: '', rangs: leg?.rangs || '', espacement_plants: leg?.espacement_plants || '' })
              }} style={inputStyle}>
                <option value="">-- Choisir --</option>
                {legumes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Variété</div>
              <select value={form.variete_id} onChange={e => setForm({ ...form, variete_id: e.target.value })} style={inputStyle}>
                <option value="">-- Aucune --</option>
                {varietes.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Type</div>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                <option value="plant">Plant</option>
                <option value="semis">Semis direct</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Fournisseur</div>
              <select value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} style={inputStyle}>
                <OptionsFournisseurs valeur={form.fournisseur} />
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Semaine plantation</div>
              <select value={form.semaine_plantation} onChange={e => setForm({ ...form, semaine_plantation: parseInt(e.target.value) })} style={inputStyle}>
                <option value="">-- Semaine --</option>
                {semaines.map(s => <option key={s} value={s}>Sem. {s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Longueur (m)</div>
              <input type="number" min="0.5" step="0.5" value={form.longueur_metres}
                onChange={e => setForm({ ...form, longueur_metres: parseFloat(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Rangs</div>
              <input type="number" min="1" value={form.rangs} onChange={e => setForm({ ...form, rangs: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Espacement plants (cm)</div>
              <input type="number" min="1" step="0.5" value={form.espacement_plants} onChange={e => setForm({ ...form, espacement_plants: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Date au champ</div>
              <input type="date" value={form.date_plantation}
                onChange={e => setForm({ ...form, date_plantation: e.target.value, ...(e.target.value && { semaine_plantation: semaineIso(e.target.value), annee: Number(e.target.value.slice(0, 4)) }) })} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>1re récolte</div>
                <input type="date" value={form.premiere_recolte} onChange={e => setForm({ ...form, premiere_recolte: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Dernière récolte</div>
                <input type="date" value={form.derniere_recolte} onChange={e => setForm({ ...form, derniere_recolte: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          {legumeSelectionne && (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: 'var(--vert-fonce)' }}>
              Nombre de plants calculé : <strong>{calculNbPlants(form.longueur_metres, form.rangs, form.espacement_plants) || '—'} plants</strong>
              <span style={{ color: 'var(--encre-douce)', marginLeft: 8 }}>({form.rangs || '?'} rangs · espacement {form.espacement_plants || '?'}cm)</span>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--encre-douce)', margin: '0 0 14px' }}>
            Fertilisation : la série suit automatiquement le tableau de son légume (page Fertilisation › Tableau par légume).
          </p>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)', marginBottom: 8 }}>Traitements</div>
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)' }}><X size={14} /></button>
                )}
                {i === traitements.length - 1 && (
                  <button onClick={() => setTraitements([...traitements, { type_traitement_id: '', semaines_apres_plantation: '' }])}
                    style={{ background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', borderRadius: 0, padding: '4px 8px', cursor: 'pointer', color: 'var(--ocre)' }}>
                    <Plus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <button onClick={handleSave} disabled={!form.legume_id}
            style={{ background: form.legume_id ? 'var(--accent)' : 'var(--trait-leger)', color: form.legume_id ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '8px 16px', cursor: form.legume_id ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
            Créer la série
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {seriesFiltrees.map(serie => {
          const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
          const enModif = serieEnModif?.id === serie.id

          if (enModif) return (
            <div key={serie.id} style={{ background: 'var(--papier)', border: '1px solid var(--accent)', borderRadius: 0, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Légume</div>
                  <select value={serieEnModif.legume_id} onChange={e => setSerieEnModif({ ...serieEnModif, legume_id: e.target.value })} style={inputStyle}>
                    {legumes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Type</div>
                  <select value={serieEnModif.type} onChange={e => setSerieEnModif({ ...serieEnModif, type: e.target.value })} style={inputStyle}>
                    <option value="plant">Plant</option>
                    <option value="semis">Semis direct</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Fournisseur</div>
                  <select value={serieEnModif.fournisseur || ''} onChange={e => setSerieEnModif({ ...serieEnModif, fournisseur: e.target.value })} style={inputStyle}>
                    <OptionsFournisseurs valeur={serieEnModif.fournisseur} />
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Semaine plantation</div>
                  <select value={serieEnModif.semaine_plantation} onChange={e => setSerieEnModif({ ...serieEnModif, semaine_plantation: parseInt(e.target.value) })} style={inputStyle}>
                    {semaines.map(s => <option key={s} value={s}>Sem. {s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Longueur (m)</div>
                  <input type="number" min="0.5" step="0.5" value={serieEnModif.longueur_metres}
                    onChange={e => setSerieEnModif({ ...serieEnModif, longueur_metres: parseFloat(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Rangs</div>
                  <input type="number" min="1" value={serieEnModif.rangs ?? ''} onChange={e => setSerieEnModif({ ...serieEnModif, rangs: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Espacement plants (cm)</div>
                  <input type="number" min="1" step="0.5" value={serieEnModif.espacement_plants ?? ''} onChange={e => setSerieEnModif({ ...serieEnModif, espacement_plants: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Date au champ</div>
                  <input type="date" value={serieEnModif.date_plantation || ''}
                    onChange={e => setSerieEnModif({ ...serieEnModif, date_plantation: e.target.value, ...(e.target.value && { semaine_plantation: semaineIso(e.target.value) }) })} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>1re récolte</div>
                    <input type="date" value={serieEnModif.premiere_recolte || ''} onChange={e => setSerieEnModif({ ...serieEnModif, premiere_recolte: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Dernière récolte</div>
                    <input type="date" value={serieEnModif.derniere_recolte || ''} onChange={e => setSerieEnModif({ ...serieEnModif, derniere_recolte: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Notes</div>
                  <input type="text" value={serieEnModif.notes || ''} onChange={e => setSerieEnModif({ ...serieEnModif, notes: e.target.value })} style={inputStyle} />
                </div>
              </div>
              {/* Les passages s'enregistrent tout de suite, indépendamment du bouton Sauvegarder */}
              <PassagesSerie serie={serieEnModif} typesTraitement={typesTraitement} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSerieEnModif(null)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)' }}>Annuler</button>
                <button onClick={handleUpdate} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 0, cursor: 'pointer', background: 'var(--accent)', color: 'var(--papier)', fontWeight: 500 }}>Sauvegarder</button>
              </div>
            </div>
          )

          return (
            <div key={serie.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '10px 14px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                  {serie.legumes?.nom}
                  {serie.varietes?.nom && <span style={{ fontWeight: 400, color: 'var(--encre-douce)' }}> · {serie.varietes.nom}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--encre-pale)', marginTop: 2 }}>
                  {serie.semaine_plantation && `Sem. ${serie.semaine_plantation} · `}
                  {serie.longueur_metres}m
                  {serie.rangs && ` · ${serie.rangs} rangs`}
                  {serie.nombre_plants && ` · ${serie.nombre_plants} plants`}
                  {serie.fournisseur && ` · ${serie.fournisseur}`}
                  {serie.sous_abri && ' · sous abri'}
                  {serie.premiere_recolte && ` · récolte ${dateCourte(serie.premiere_recolte)} → ${dateCourte(serie.derniere_recolte)}`}
                </div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 0, background: serie.type === 'plant' ? 'var(--jaune-pale)' : 'var(--bleu-pale)', color: serie.type === 'plant' ? 'var(--ocre)' : 'var(--bleu)' }}>
                {serie.type === 'plant' ? 'Plant' : 'Semis'}
              </span>
              <button onClick={() => setSerieEnModif(serie)} style={{ background: 'none', border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', color: 'var(--encre-douce)', padding: '3px 8px', fontSize: 11 }}>
                Modifier
              </button>
              <button onClick={() => supprimerSerie(serie.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)', padding: 4 }}>
                <X size={14} />
              </button>
            </div>
          )
        })}

        {!loading && seriesFiltrees.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
            Aucune série — cliquez sur "Nouvelle série" pour commencer
          </div>
        )}
      </div>
    </div>
  )
}