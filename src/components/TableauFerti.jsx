import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SELECT_PLANS, nomPlan } from '../lib/fertilisation'

// Tableau des fertilisations par légume : fumure de fond + passages en cours de culture.
// Les modifications restent en attente jusqu'au bouton « Enregistrer », puis s'appliquent à toutes
// les séries du légume.
let compteurNouveaux = 0
const copie = plans => plans.map(p => ({ ...p, ferti_lignes_passages: (p.ferti_lignes_passages || []).map(x => ({ ...x })) }))

export default function TableauFerti({ onChange }) {
  const [plans, setPlans] = useState([])        // tel qu'enregistré
  const [brouillon, setBrouillon] = useState([]) // avec les modifications en attente
  const [legumes, setLegumes] = useState([])
  const [varietes, setVarietes] = useState([])
  const [recherche, setRecherche] = useState('')
  const [version, setVersion] = useState(0)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    let actif = true
    Promise.all([
      supabase.from('ferti_lignes').select(SELECT_PLANS),
      supabase.from('legumes').select('id, nom').order('nom'),
      supabase.from('varietes').select('id, nom'),
    ]).then(([{ data: p }, { data: l }, { data: v }]) => {
      if (!actif) return
      setVarietes(v || [])
      setPlans(p || [])
      setBrouillon(copie(p || []))
      setLegumes(l || [])
    })
    return () => { actif = false }
  }, [version])

  // ---- Modifications en attente ----
  const modifierPlan = (planId, champs) => setBrouillon(b => b.map(p => (p.id === planId ? { ...p, ...champs } : p)))
  const modifierPassages = (planId, f) => setBrouillon(b => b.map(p => (p.id === planId ? { ...p, ferti_lignes_passages: f(p.ferti_lignes_passages) } : p)))
  const modifierPassage = (planId, passageId, champs) => modifierPassages(planId, liste => liste.map(x => (x.id === passageId ? { ...x, ...champs } : x)))
  const ajouterPassage = planId => modifierPassages(planId, liste => [...liste, { id: `nouveau-${++compteurNouveaux}`, plan_id: planId, dose_kg_ha: '', semaines_apres_plantation: '' }])
  const retirerPassage = (planId, passageId) => modifierPassages(planId, liste => liste.filter(x => x.id !== passageId))

  // Différences entre le brouillon et ce qui est enregistré
  const nombre = v => (v === '' || v == null ? 0 : Number(v))
  const changements = []
  for (const p of brouillon) {
    const avant = plans.find(x => x.id === p.id)
    if (!avant) continue
    if (nombre(p.fumure_fond_t_ha) !== Number(avant.fumure_fond_t_ha)) {
      changements.push(supabase.from('ferti_lignes').update({ fumure_fond_t_ha: nombre(p.fumure_fond_t_ha) }).eq('id', p.id))
    }
    for (const x of p.ferti_lignes_passages) {
      const champs = { dose_kg_ha: nombre(x.dose_kg_ha), semaines_apres_plantation: parseInt(x.semaines_apres_plantation) || 0 }
      const ancien = avant.ferti_lignes_passages.find(y => y.id === x.id)
      if (!ancien) changements.push(supabase.from('ferti_lignes_passages').insert({ plan_id: p.id, ...champs }))
      else if (champs.dose_kg_ha !== Number(ancien.dose_kg_ha) || champs.semaines_apres_plantation !== ancien.semaines_apres_plantation) {
        changements.push(supabase.from('ferti_lignes_passages').update(champs).eq('id', x.id))
      }
    }
    for (const ancien of avant.ferti_lignes_passages) {
      if (!p.ferti_lignes_passages.some(x => x.id === ancien.id)) changements.push(supabase.from('ferti_lignes_passages').delete().eq('id', ancien.id))
    }
  }

  async function enregistrer() {
    setEnvoi(true)
    const erreurs = (await Promise.all(changements)).map(r => r.error).filter(Boolean)
    setEnvoi(false)
    if (erreurs.length) alert(`Une partie n'a pas pu être enregistrée : ${erreurs[0].message}`)
    setVersion(v => v + 1)
    onChange?.()
  }

  async function creerLigne(legume) {
    const { error } = await supabase.from('ferti_lignes').insert({ legume_id: legume.id })
    if (error) alert(`Création impossible : ${error.message}`)
    setVersion(v => v + 1)
  }

  const q = recherche.trim().toLowerCase()
  const lignes = brouillon
    .filter(p => !q || nomPlan(p).toLowerCase().includes(q))
    .sort((a, b) => nomPlan(a).localeCompare(nomPlan(b), 'fr'))
  const sansLigne = legumes.filter(l => !plans.some(p => p.legume_id === l.id) && (!q || l.nom.toLowerCase().includes(q)))

  const champ = { fontSize: 12, padding: '4px 6px', border: '1px solid var(--trait)', borderRadius: 0, width: 70 }
  const aEnregistrer = changements.length > 0

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--encre-douce)', margin: '0 0 10px' }}>
        Fumure de fond : granulés à la préparation de la planche (0 = aucune). Passages : granulés en cours de culture,
        en kg/ha, X semaines après la plantation. Pour la carotte, la ligne dépend de la semaine de plantation ; pour le chou, de la variété (chinois et rave à part).
        Les passages à 0 kg/ha sont ignorés.
      </p>

      {/* Barre d'enregistrement, collée en haut pendant le défilement */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', background: 'var(--fond)', marginBottom: 4 }}>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un légume…"
          style={{ flex: 1, fontSize: 13, padding: '7px 10px', border: '1px solid var(--trait)', borderRadius: 0, background: 'var(--papier)' }} />
        {aEnregistrer && (
          <button onClick={() => setBrouillon(copie(plans))} disabled={envoi}
            style={{ fontSize: 12, padding: '7px 12px', border: '1px solid var(--trait)', background: 'var(--papier)', cursor: 'pointer' }}>
            Annuler les modifications
          </button>
        )}
        <button onClick={enregistrer} disabled={!aEnregistrer || envoi}
          style={{ fontSize: 13, fontWeight: 600, padding: '7px 16px', border: 'none', background: aEnregistrer ? 'var(--accent)' : 'var(--trait-leger)', color: aEnregistrer ? 'var(--papier)' : 'var(--encre-pale)', cursor: aEnregistrer ? 'pointer' : 'default' }}>
          {envoi ? 'Enregistrement…' : aEnregistrer ? `Enregistrer (${changements.length})` : 'Enregistré'}
        </button>
      </div>

      <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 110px 1fr', gap: 12, padding: '8px 14px', background: 'var(--fond)', borderBottom: '1px solid var(--trait)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Légume</span><span>Fond (t/ha)</span><span>Passages en cours de culture</span>
        </div>
        {lignes.map(plan => (
          <div key={plan.id} style={{ display: 'grid', gridTemplateColumns: '200px 110px 1fr', gap: 12, alignItems: 'start', padding: '8px 14px', borderBottom: '1px solid var(--trait-leger)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{nomPlan(plan)}</div>
              {(plan.semaines || []).length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>plantation sem. {plan.semaines.join(', ')}</div>
              )}
              {(plan.variete_ids || []).length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>
                  variétés : {plan.variete_ids.map(id => varietes.find(v => v.id === id)?.nom).filter(Boolean).join(', ')}
                </div>
              )}
              {plan.variante && !(plan.semaines || []).length && !(plan.variete_ids || []).length && (
                <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>toutes les autres séries</div>
              )}
            </div>
            <input type="number" min="0" step="0.1" value={plan.fumure_fond_t_ha ?? ''}
              onChange={e => modifierPlan(plan.id, { fumure_fond_t_ha: e.target.value })} style={champ} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {plan.ferti_lignes_passages.map(passage => (
                <div key={passage.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="number" min="0" step="any" value={passage.dose_kg_ha ?? ''} placeholder="kg/ha"
                    onChange={e => modifierPassage(plan.id, passage.id, { dose_kg_ha: e.target.value })} style={champ} />
                  <span>kg/ha à +</span>
                  <input type="number" min="0" max="52" value={passage.semaines_apres_plantation ?? ''} placeholder="0"
                    onChange={e => modifierPassage(plan.id, passage.id, { semaines_apres_plantation: e.target.value })} style={{ ...champ, width: 50 }} />
                  <span>sem.</span>
                  <button onClick={() => retirerPassage(plan.id, passage.id)} aria-label="Retirer le passage" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)', padding: 0 }}><X size={13} /></button>
                </div>
              ))}
              <button onClick={() => ajouterPassage(plan.id)}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', border: '1px solid var(--trait)', background: 'var(--fond)', cursor: 'pointer' }}>
                <Plus size={11} /> Passage
              </button>
            </div>
          </div>
        ))}
        {sansLigne.map(l => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--trait-leger)', fontSize: 13, color: 'var(--encre-douce)' }}>
            <span>{l.nom} : pas encore de ligne (1 t/ha de fond par défaut)</span>
            <button onClick={() => creerLigne(l)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--trait)', background: 'var(--fond)', cursor: 'pointer' }}>Créer la ligne</button>
          </div>
        ))}
      </div>
    </div>
  )
}
