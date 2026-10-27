import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import AjoutSerie from './AjoutSerie.jsx'

// Fertilisations et traitements d'une série existante : liste, suppression, ajout
export default function PassagesSerie({ serie, typesTraitement }) {
  const [fertis, setFertis] = useState([])
  const [traitements, setTraitements] = useState([])
  // Incrémenté pour recharger la liste après un ajout ou une suppression
  const [version, setVersion] = useState(0)
  const charger = () => setVersion(v => v + 1)

  useEffect(() => {
    let actif = true
    Promise.all([
      supabase.from('serie_fertilisations').select('*').eq('serie_id', serie.id).order('semaines_apres_plantation'),
      supabase.from('serie_traitements').select('*, types_traitement(nom)').eq('serie_id', serie.id).order('semaines_apres_plantation'),
    ]).then(([{ data: f }, { data: t }]) => {
      if (!actif) return
      setFertis(f || [])
      setTraitements(t || [])
    })
    return () => { actif = false }
  }, [serie.id, version])

  async function supprimer(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert(`Suppression impossible : ${error.message}`)
    charger()
  }

  const semaine = sem => `sem. +${sem} (sem. ${(serie.semaine_plantation || 0) + sem})`
  const ligne = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 8px', border: '1px solid var(--trait-leger)', marginBottom: 4 }
  const supprimerBouton = (table, id) => (
    <button onClick={() => supprimer(table, id)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)', padding: 0 }}><X size={13} /></button>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12, paddingTop: 12, borderTop: '1px solid var(--trait-leger)' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Fertilisation</div>
        {fertis.length === 0 && <p style={{ fontSize: 11, color: 'var(--encre-pale)', margin: '0 0 6px' }}>Aucun passage prévu</p>}
        {fertis.map(f => (
          <div key={f.id} style={ligne}>
            <span style={{ flex: 1 }}>{f.dose_kg_ha} kg/ha · {semaine(f.semaines_apres_plantation)}</span>
            {supprimerBouton('serie_fertilisations', f.id)}
          </div>
        ))}
        <AjoutSerie mode="ferti" serieFixe={serie} onAjout={charger} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Traitements</div>
        {traitements.length === 0 && <p style={{ fontSize: 11, color: 'var(--encre-pale)', margin: '0 0 6px' }}>Aucun traitement prévu</p>}
        {traitements.map(t => (
          <div key={t.id} style={ligne}>
            <span style={{ flex: 1 }}>{t.types_traitement?.nom} · {semaine(t.semaines_apres_plantation)}</span>
            {supprimerBouton('serie_traitements', t.id)}
          </div>
        ))}
        <AjoutSerie mode="traitement" serieFixe={serie} typesTraitement={typesTraitement} onAjout={charger} />
      </div>
    </div>
  )
}
