import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SELECT_PLANS, nomPlan } from '../lib/fertilisation'

// Tableau des fertilisations par légume : fumure de fond + passages en cours de culture.
// Chaque modification est enregistrée tout de suite et s'applique à toutes les séries du légume.
export default function TableauFerti({ onChange }) {
  const [plans, setPlans] = useState([])
  const [legumes, setLegumes] = useState([])
  const [recherche, setRecherche] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let actif = true
    Promise.all([
      supabase.from('ferti_lignes').select(SELECT_PLANS),
      supabase.from('legumes').select('id, nom').order('nom'),
    ]).then(([{ data: p }, { data: l }]) => {
      if (!actif) return
      setPlans(p || [])
      setLegumes(l || [])
    })
    return () => { actif = false }
  }, [version])

  async function ecrire(requete) {
    const { error } = await requete
    if (error) alert(`Enregistrement impossible : ${error.message}`)
    setVersion(v => v + 1)
    onChange?.()
  }

  const majPlan = (plan, champs) => ecrire(supabase.from('ferti_lignes').update(champs).eq('id', plan.id))
  const majPassage = (passage, champs) => ecrire(supabase.from('ferti_lignes_passages').update(champs).eq('id', passage.id))
  const ajouterPassage = plan => ecrire(supabase.from('ferti_lignes_passages').insert({ plan_id: plan.id, dose_kg_ha: 0, semaines_apres_plantation: 0 }))
  const supprimerPassage = passage => window.confirm('Supprimer ce passage ?') && ecrire(supabase.from('ferti_lignes_passages').delete().eq('id', passage.id))
  const creerLigne = legume => ecrire(supabase.from('ferti_lignes').insert({ legume_id: legume.id }))

  const q = recherche.trim().toLowerCase()
  const lignes = plans
    .filter(p => !q || nomPlan(p).toLowerCase().includes(q))
    .sort((a, b) => nomPlan(a).localeCompare(nomPlan(b), 'fr'))
  const sansLigne = legumes.filter(l => !plans.some(p => p.legume_id === l.id) && (!q || l.nom.toLowerCase().includes(q)))

  const champ = { fontSize: 12, padding: '4px 6px', border: '1px solid var(--trait)', borderRadius: 0, width: 70 }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--encre-douce)', margin: '0 0 10px' }}>
        Fumure de fond : granulés à la préparation de la planche (0 = aucune). Passages : granulés en cours de culture,
        en kg/ha, X semaines après la plantation. Pour la carotte, la ligne dépend de la semaine de plantation.
        Les passages à 0 kg/ha sont ignorés.
      </p>
      <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un légume…"
        style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid var(--trait)', borderRadius: 0, marginBottom: 12, background: 'var(--papier)' }} />

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
              {plan.variante && !(plan.semaines || []).length && (
                <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>toutes les autres semaines</div>
              )}
            </div>
            <input type="number" min="0" step="0.1" defaultValue={plan.fumure_fond_t_ha} key={`fond-${plan.id}-${plan.fumure_fond_t_ha}`}
              onBlur={e => Number(e.target.value) !== Number(plan.fumure_fond_t_ha) && majPlan(plan, { fumure_fond_t_ha: Number(e.target.value) || 0 })}
              style={champ} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...(plan.ferti_lignes_passages || [])].sort((a, b) => a.semaines_apres_plantation - b.semaines_apres_plantation).map(passage => (
                <div key={passage.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="number" min="0" step="any" defaultValue={passage.dose_kg_ha} key={`dose-${passage.id}-${passage.dose_kg_ha}`}
                    onBlur={e => Number(e.target.value) !== Number(passage.dose_kg_ha) && majPassage(passage, { dose_kg_ha: Number(e.target.value) || 0 })}
                    style={champ} />
                  <span>kg/ha à</span>
                  <span>+</span>
                  <input type="number" min="0" max="52" defaultValue={passage.semaines_apres_plantation} key={`sem-${passage.id}-${passage.semaines_apres_plantation}`}
                    onBlur={e => Number(e.target.value) !== passage.semaines_apres_plantation && majPassage(passage, { semaines_apres_plantation: parseInt(e.target.value) || 0 })}
                    style={{ ...champ, width: 50 }} />
                  <span>sem.</span>
                  <button onClick={() => supprimerPassage(passage)} aria-label="Supprimer le passage" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)', padding: 0 }}><X size={13} /></button>
                </div>
              ))}
              <button onClick={() => ajouterPassage(plan)}
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
