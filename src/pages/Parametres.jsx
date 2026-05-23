import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, ChevronRight } from 'lucide-react'

export default function Parametres() {
  const [onglet, setOnglet] = useState('legumes')
  const [legumes, setLegumes] = useState([])
  const [familles, setFamilles] = useState([])
  const [blocs, setBlocs] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: l }, { data: f }, { data: b }] = await Promise.all([
      supabase.from('legumes').select('*, familles(nom, couleur)').order('nom'),
      supabase.from('familles').select('*').order('nom'),
      supabase.from('blocs').select('*').order('nom'),
    ])
    setLegumes(l || [])
    setFamilles(f || [])
    setBlocs(b || [])
    setLoading(false)
  }

  const tabs = [
    { id: 'legumes', label: 'Fiches légumes' },
    { id: 'familles', label: 'Familles' },
    { id: 'annees', label: 'Gestion années' },
    { id: 'blocs', label: 'Blocs & serres' },
    { id: 'stocks', label: 'Stocks & commandes' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111', marginBottom: 16 }}>Paramètres</h1>
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setOnglet(t.id); setSelected(null) }} style={{
            padding: '8px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
            borderRight: '1px solid #e5e7eb',
            background: onglet === t.id ? '#fff' : '#f9fafb',
            color: onglet === t.id ? '#111' : '#6b7280',
            fontWeight: onglet === t.id ? 500 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {onglet === 'legumes' && (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 240, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Légumes</span>
              <button onClick={() => setSelected('new')} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <Plus size={12} /> Ajouter
              </button>
            </div>
            {loading ? <p style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>Chargement...</p> : (
              legumes.map(l => (
                <div key={l.id} onClick={() => setSelected(l)} style={{
                  padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid #f3f4f6',
                  background: selected?.id === l.id ? '#f0fdf4' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.familles?.couleur || '#ccc' }} />
                    <span style={{ fontSize: 13, color: '#111' }}>{l.nom}</span>
                  </div>
                  <ChevronRight size={14} color="#9ca3af" />
                </div>
              ))
            )}
          </div>
          <div style={{ flex: 1 }}>
            {!selected && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, color: '#6b7280', fontSize: 13 }}>
                Sélectionnez un légume pour voir sa fiche
              </div>
            )}
            {selected && <FicheLegume legume={selected === 'new' ? null : selected} familles={familles} onSave={fetchData} />}
          </div>
        </div>
      )}

      {onglet === 'familles' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {familles.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: f.couleur }} />
              <span style={{ fontSize: 13, flex: 1, color: '#111' }}>{f.nom}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{legumes.filter(l => l.famille_id === f.id).length} légumes</span>
            </div>
          ))}
        </div>
      )}

      {onglet === 'annees' && <GestionAnnees blocs={blocs} />}

      {onglet === 'blocs' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, fontSize: 13, color: '#6b7280' }}>
          Configuration des blocs et serres — à venir
        </div>
      )}

      {onglet === 'stocks' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, fontSize: 13, color: '#6b7280' }}>
          Stocks et commandes — à venir
        </div>
      )}
    </div>
  )
}

function FicheLegume({ legume, familles, onSave }) {
  const [form, setForm] = useState({
    nom: legume?.nom || '',
    famille_id: legume?.famille_id || '',
    fournisseur: legume?.fournisseur || 'Pépinière interne',
    rangs: legume?.rangs || 2,
    espacement_rangs: legume?.espacement_rangs || 70,
    espacement_plants: legume?.espacement_plants || 50,
    notes: legume?.notes || '',
  })
  const [durees, setDurees] = useState([])
  const [varietes, setVarietes] = useState([])
  const [nouvelleVariete, setNouvelleVariete] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [onglet, setOnglet] = useState('infos')

  const saisons = ['hiver', 'printemps', 'ete', 'automne']
  const lieux = ['serre', 'exterieur']

  useEffect(() => {
    if (legume?.id) {
      fetchDurees()
      fetchVarietes()
    }
  }, [legume?.id])

  async function fetchDurees() {
    const { data } = await supabase.from('durees_culture').select('*').eq('legume_id', legume.id)
    setDurees(data || [])
  }

  async function fetchVarietes() {
    const { data } = await supabase.from('varietes').select('*').eq('legume_id', legume.id).order('nom')
    setVarietes(data || [])
  }

  function getDuree(lieu, saison) {
    return durees.find(d => d.lieu === lieu && d.saison === saison)?.duree_semaines || ''
  }

  async function updateDuree(lieu, saison, valeur) {
    const existing = durees.find(d => d.lieu === lieu && d.saison === saison)
    if (existing) {
      await supabase.from('durees_culture').update({ duree_semaines: parseInt(valeur) }).eq('id', existing.id)
    } else {
      await supabase.from('durees_culture').insert({ legume_id: legume.id, lieu, saison, duree_semaines: parseInt(valeur) })
    }
    fetchDurees()
  }

  async function ajouterVariete() {
    if (!nouvelleVariete.trim()) return
    await supabase.from('varietes').insert({ legume_id: legume.id, nom: nouvelleVariete.trim() })
    setNouvelleVariete('')
    fetchVarietes()
  }

  async function supprimerVariete(id) {
    await supabase.from('varietes').delete().eq('id', id)
    fetchVarietes()
  }

  async function handleSave() {
    setSaving(true)
    if (legume) {
      await supabase.from('legumes').update(form).eq('id', legume.id)
    } else {
      await supabase.from('legumes').insert(form)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSave()
  }

  const tabsList = ['infos', 'durées', 'variétés']

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, color: '#111' }}>
        {legume ? legume.nom : 'Nouveau légume'}
      </h2>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
        {tabsList.map(t => (
          <button key={t} onClick={() => setOnglet(t)} style={{
            padding: '6px 14px', fontSize: 12, border: 'none', cursor: 'pointer',
            borderRight: '1px solid #e5e7eb',
            background: onglet === t ? '#1D9E75' : '#f9fafb',
            color: onglet === t ? '#fff' : '#6b7280',
            fontWeight: onglet === t ? 500 : 400,
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {onglet === 'infos' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Nom', 'nom', 'text'], ['Fournisseur', 'fournisseur', 'select'], ['Nombre de rangs', 'rangs', 'number'], ['Famille', 'famille_id', 'famille'], ['Espacement rangs (cm)', 'espacement_rangs', 'number'], ['Espacement plants (cm)', 'espacement_plants', 'number']].map(([label, key, type]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
                {type === 'select' ? (
                  <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    {['Pépinière interne', 'Desbos', 'Semis direct'].map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : type === 'famille' ? (
                  <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    <option value="">-- Choisir --</option>
                    {familles.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                ) : (
                  <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, resize: 'vertical' }} />
          </div>
          <button onClick={handleSave} disabled={saving} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </>
      )}

      {onglet === 'durées' && (
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Durées en semaines — Drôme. Laisser vide si culture impossible.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 500 }}>Lieu</th>
                {saisons.map(s => (
                  <th key={s} style={{ padding: '8px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 500 }}>
                    {s === 'ete' ? 'Été' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lieux.map(lieu => (
                <tr key={lieu}>
                  <td style={{ padding: '8px 10px', border: '1px solid #e5e7eb', fontWeight: 500, background: '#f9fafb' }}>
                    {lieu === 'exterieur' ? 'Extérieur' : 'Serre'}
                  </td>
                  {saisons.map(saison => (
                    <td key={saison} style={{ padding: 4, border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <input type="number" min="1" max="52"
                        defaultValue={getDuree(lieu, saison)}
                        onBlur={e => e.target.value && updateDuree(lieu, saison, e.target.value)}
                        placeholder="—"
                        style={{ width: 50, textAlign: 'center', border: 'none', fontSize: 13, background: 'transparent', color: '#111' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Sauvegardé automatiquement à la sortie du champ.</p>
        </div>
      )}

      {onglet === 'variétés' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={nouvelleVariete} onChange={e => setNouvelleVariete(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ajouterVariete()}
              placeholder="Nom de la variété..."
              style={{ flex: 1, fontSize: 13, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }} />
            <button onClick={ajouterVariete} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
              Ajouter
            </button>
          </div>
          {varietes.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucune variété enregistrée</p>}
          {varietes.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #f3f4f6', borderRadius: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#111' }}>{v.nom}</span>
              <button onClick={() => supprimerVariete(v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GestionAnnees({ blocs }) {
  const [anneeSource, setAnneeSource] = useState(2026)
  const [anneeDestination, setAnneeDestination] = useState(2027)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [rotations, setRotations] = useState([])

  useEffect(() => { fetchRotations() }, [])

  async function fetchRotations() {
    const { data } = await supabase
      .from('rotations_planifiees')
      .select('*, blocs(nom, id, nombre_planches)')
      .order('annee')
    setRotations(data || [])
  }

  async function dupliquerAnneePleinChamp() {
  setLoading(true)
  setMessages([])
  const msgs = []

  const rotationCourte = ['A', 'B', 'C']
  const rotationLongue = ['D', 'E', 'F', 'G', 'H']
  let totalDupliquees = 0

  async function dupliquerGroupe(groupeBlocs) {
    for (let i = 0; i < groupeBlocs.length; i++) {
      const nomBlocDest = groupeBlocs[i]
      const nomBlocSource = groupeBlocs[(i - 1 + groupeBlocs.length) % groupeBlocs.length]

      const blocDest = blocs.find(b => b.nom === nomBlocDest)
      const blocSource = blocs.find(b => b.nom === nomBlocSource)
      if (!blocDest || !blocSource) continue

      if (blocDest.nombre_planches < blocSource.nombre_planches) {
        msgs.push({ type: 'warning', text: `Bloc ${nomBlocDest} a ${blocDest.nombre_planches} planches vs ${blocSource.nombre_planches} en source (Bloc ${nomBlocSource}) — certaines cultures peuvent ne pas rentrer` })
      }

      const { data: planches } = await supabase
        .from('planches')
        .select('*')
        .eq('bloc_id', blocSource.id)

      const { data: cultures } = await supabase
        .from('cultures')
        .select('*, series(*)')
        .in('planche_id', (planches || []).map(p => p.id))
        .eq('annee', anneeSource)
        .eq('type', 'prevu')

      const seriesUniques = [...new Map((cultures || []).map(c => [c.serie_id, c.series])).entries()]
        .map(([, s]) => s).filter(Boolean)

      for (const serie of seriesUniques) {
        await supabase.from('series').insert({
          legume_id: serie.legume_id,
          variete_id: serie.variete_id || null,
          nom: serie.nom,
          fournisseur: serie.fournisseur,
          type: serie.type,
          longueur_metres: serie.longueur_metres,
          semaine_plantation: serie.semaine_plantation,
          nombre_plants: serie.nombre_plants,
          annee: anneeDestination,
          notes: serie.notes,
        })
        totalDupliquees++
      }

      msgs.push({ type: 'success', text: `Bloc ${nomBlocDest} ← Bloc ${nomBlocSource} : ${seriesUniques.length} séries dupliquées` })
    }
  }

  await dupliquerGroupe(rotationCourte)
  await dupliquerGroupe(rotationLongue)

  msgs.push({ type: 'info', text: `Total : ${totalDupliquees} séries créées pour ${anneeDestination}` })
  setMessages(msgs)
  setLoading(false)
}

  async function dupliquerAnneeSerres() {
    setLoading(true)
    setMessages([])
    const msgs = []

    const blocsSerre = blocs.filter(b => b.type === 'serre')
    const { data: planches } = await supabase
      .from('planches')
      .select('*')
      .in('bloc_id', blocsSerre.map(b => b.id))

    const { data: cultures } = await supabase
      .from('cultures')
      .select('*, series(*)')
      .in('planche_id', (planches || []).map(p => p.id))
      .eq('annee', anneeSource)

    const seriesUniques = [...new Map((cultures || []).map(c => [c.serie_id, c.series])).entries()]
      .map(([, s]) => s).filter(Boolean)

    for (const serie of seriesUniques) {
      await supabase.from('series').insert({
        legume_id: serie.legume_id,
        variete_id: serie.variete_id || null,
        nom: serie.nom,
        fournisseur: serie.fournisseur,
        type: serie.type,
        longueur_metres: serie.longueur_metres,
        semaine_plantation: serie.semaine_plantation,
        nombre_plants: serie.nombre_plants,
        annee: anneeDestination,
        notes: serie.notes,
      })
    }

    msgs.push({ type: 'success', text: `${seriesUniques.length} séries serre dupliquées pour ${anneeDestination} — à replacer manuellement` })
    setMessages(msgs)
    setLoading(false)
  }

  const annees = [2025, 2026, 2027, 2028, 2029, 2030]

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 14 }}>Dupliquer une saison</div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Année source</div>
            <select value={anneeSource} onChange={e => setAnneeSource(parseInt(e.target.value))}
              style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              {annees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 20, color: '#9ca3af', marginTop: 16 }}>→</div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Année destination</div>
            <select value={anneeDestination} onChange={e => setAnneeDestination(parseInt(e.target.value))}
              style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              {annees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, padding: '8px 12px', background: '#f9fafb', borderRadius: 6 }}>
          La duplication plein champ utilise le planning de rotation pour déplacer les cultures vers les bons blocs.
          La duplication serres copie toutes les séries à replacer manuellement.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={dupliquerAnneePleinChamp} disabled={loading || anneeSource === anneeDestination}
            style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer', background: '#1D9E75', color: '#fff', fontWeight: 500, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'En cours...' : 'Dupliquer plein champ'}
          </button>
          <button onClick={dupliquerAnneeSerres} disabled={loading || anneeSource === anneeDestination}
            style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, cursor: loading ? 'default' : 'pointer', background: '#fff', color: '#111', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'En cours...' : 'Dupliquer serres'}
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: msg.type === 'success' ? '#f0fdf4' : msg.type === 'warning' ? '#fffbeb' : '#eff6ff',
              border: `1px solid ${msg.type === 'success' ? '#86efac' : msg.type === 'warning' ? '#fcd34d' : '#bfdbfe'}`,
              color: msg.type === 'success' ? '#166534' : msg.type === 'warning' ? '#92400e' : '#1e40af',
            }}>
              {msg.type === 'success' ? '✓' : msg.type === 'warning' ? '⚠' : 'ℹ'} {msg.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}