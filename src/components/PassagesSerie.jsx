import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import AjoutSerie from './AjoutSerie.jsx'
import { SELECT_PLANS, planPour, passagesDeSerie, nomPlan } from '../lib/fertilisation'

// Dans la modification d'une série : sa fertilisation (lecture seule, elle vient du tableau par légume)
// et ses traitements (liste, suppression, ajout)
export default function PassagesSerie({ serie, typesTraitement }) {
  const [plans, setPlans] = useState([])
  const [traitements, setTraitements] = useState([])
  // Incrémenté pour recharger la liste après un ajout ou une suppression
  const [version, setVersion] = useState(0)
  const charger = () => setVersion(v => v + 1)

  useEffect(() => {
    let actif = true
    Promise.all([
      supabase.from('ferti_lignes').select(SELECT_PLANS).eq('legume_id', serie.legume_id),
      supabase.from('serie_traitements').select('*, types_traitement(nom)').eq('serie_id', serie.id).order('semaines_apres_plantation'),
    ]).then(([{ data: p }, { data: t }]) => {
      if (!actif) return
      setPlans(p || [])
      setTraitements(t || [])
    })
    return () => { actif = false }
  }, [serie.id, serie.legume_id, version])

  async function supprimerTraitement(id) {
    if (!window.confirm('Supprimer ce traitement ?')) return
    await supabase.from('suivi_traitements').delete().eq('traitement_id', id)
    const { error } = await supabase.from('serie_traitements').delete().eq('id', id)
    if (error) alert(`Suppression impossible : ${error.message}`)
    charger()
  }

  const semaine = sem => `sem. +${sem} (sem. ${(serie.semaine_plantation || 0) + sem})`
  const ligne = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 8px', border: '1px solid var(--trait-leger)', marginBottom: 4 }
  const plan = planPour(plans, serie.legume_id, Number(serie.semaine_plantation))
  const passages = passagesDeSerie(plans, { ...serie, semaine_plantation: Number(serie.semaine_plantation) })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12, paddingTop: 12, borderTop: '1px solid var(--trait-leger)' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Fertilisation{plan ? ` · ${nomPlan(plan)}` : ''}</div>
        <div style={ligne}>Fumure de fond : {plan ? `${Number(plan.fumure_fond_t_ha)} t/ha` : '1 t/ha (pas encore de ligne dans le tableau)'}</div>
        {passages.map(p => (
          <div key={p.cle} style={ligne}>{p.dose_kg_ha} kg/ha · {semaine(p.semaines_apres_plantation)}</div>
        ))}
        <p style={{ fontSize: 11, color: 'var(--encre-pale)', margin: '4px 0 0' }}>À modifier dans Fertilisation › Tableau par légume</p>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Traitements</div>
        {traitements.length === 0 && <p style={{ fontSize: 11, color: 'var(--encre-pale)', margin: '0 0 6px' }}>Aucun traitement prévu</p>}
        {traitements.map(t => (
          <div key={t.id} style={ligne}>
            <span style={{ flex: 1 }}>{t.types_traitement?.nom} · {semaine(t.semaines_apres_plantation)}</span>
            <button onClick={() => supprimerTraitement(t.id)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)', padding: 0 }}><X size={13} /></button>
          </div>
        ))}
        <AjoutSerie mode="traitement" serieFixe={serie} typesTraitement={typesTraitement} onAjout={charger} />
      </div>
    </div>
  )
}
