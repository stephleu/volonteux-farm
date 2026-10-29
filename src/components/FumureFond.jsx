import { useState, useEffect } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante, ecartSemaines, semaineReelle } from '../lib/dates'
import { kgFumure, SAC_GRANULES_KG } from '../lib/travailSol'
import { SELECT_PLANS, fumureFond } from '../lib/fertilisation'

// Fumure de fond aux granulés : pour chaque culture placée dans l'assolement, la quantité à épandre
// sur sa planche lors de la préparation (étape « Granulés » du travail du sol), regroupée par semaine
// de plantation. La dose vient de la fiche légume (0 = pas de granulés à la préparation).
export default function FumureFond({ annee }) {
  const [cultures, setCultures] = useState([])
  const [travaux, setTravaux] = useState([])
  const [plans, setPlans] = useState([])
  const [voirPassees, setVoirPassees] = useState(false)

  useEffect(() => {
    let actif = true
    Promise.all([
      chargerTout(() => supabase.from('cultures')
        .select('id, annee, date_plantation, longueur_metres, planche_id, legume_id, series(semaine_plantation), legumes(nom), varietes(nom), planches(numero, blocs(nom))')
        .eq('annee', annee).eq('type', 'prevu').order('date_plantation').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('planche_id, fait').eq('annee', annee).eq('etape', 'granules').order('id')),
      supabase.from('plans_ferti').select(SELECT_PLANS),
    ]).then(([{ data: c }, { data: t }, { data: p }]) => {
      if (!actif) return
      setPlans(p || [])
      setCultures(c || [])
      setTravaux(t || [])
    })
    return () => { actif = false }
  }, [annee])

  const granulesFaits = new Set(travaux.filter(t => t.fait).map(t => t.planche_id))
  const semaineDe = c => c.series?.semaine_plantation
  const dose = c => fumureFond(plans, c.legume_id, semaineDe(c))
  const masquerPassees = annee === anneeCourante() && !voirPassees

  // Une ligne par planche et par série : une série posée sur plusieurs bouts de planche compte une fois par planche
  const lignes = cultures
    .filter(c => semaineDe(c) && dose(c) > 0)
    .filter(c => !masquerPassees || ecartSemaines(annee, semaineDe(c)) >= -1)
  const parSemaine = new Map()
  for (const c of lignes) {
    const sem = semaineReelle(annee, semaineDe(c))
    parSemaine.set(sem, [...(parSemaine.get(sem) || []), c])
  }
  const semaines = [...parSemaine.keys()].sort((a, b) => a - b)
  const totalKg = lignes.reduce((acc, c) => acc + kgFumure(dose(c), Number(c.longueur_metres)), 0)

  const nomPlanche = c => `${c.planches?.blocs?.nom}-${String(c.planches?.numero).padStart(2, '0')}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
        <span>
          <strong>{(totalKg / 1000).toFixed(2).replace('.', ',')} t</strong> de granulés · {Math.ceil(totalKg / SAC_GRANULES_KG)} sacs de {SAC_GRANULES_KG} kg
          {masquerPassees ? ' à venir' : ` sur ${annee}`}
        </span>
        {annee === anneeCourante() && (
          <button onClick={() => setVoirPassees(!voirPassees)}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--trait)', background: voirPassees ? 'var(--accent)' : 'var(--papier)', color: voirPassees ? 'var(--papier)' : 'var(--encre)', cursor: 'pointer' }}>
            {voirPassees ? 'Masquer les semaines passées' : "Voir toute l'année"}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--encre-douce)', margin: '0 0 12px' }}>
        Granulés épandus à la préparation de la planche, avant plantation. Dose par légume dans l'onglet « Tableau par légume »
        (carotte, choux, poireaux et courges : 0, leurs granulés sont prévus en cours de culture ou ils n'en ont pas).
        « Fait » = étape Granulés cochée sur la planche dans Travail du sol.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {semaines.map(sem => {
          const liste = parSemaine.get(sem)
          const kg = liste.reduce((acc, c) => acc + kgFumure(dose(c), Number(c.longueur_metres)), 0)
          return (
            <div key={sem} style={{ background: 'var(--papier)', border: '1px solid var(--trait)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--fond)', borderBottom: '1px solid var(--trait)', fontSize: 13 }}>
                <strong>Plantation sem. {sem}</strong>
                <span>{Math.round(kg)} kg · {Math.ceil(kg / SAC_GRANULES_KG)} sac{Math.ceil(kg / SAC_GRANULES_KG) > 1 ? 's' : ''}</span>
              </div>
              {liste.map(c => {
                const fait = granulesFaits.has(c.planche_id)
                return (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px 90px 70px', gap: 10, alignItems: 'center', padding: '5px 14px', fontSize: 12, borderBottom: '1px solid var(--trait-leger)' }}>
                    <strong>{nomPlanche(c)}</strong>
                    <span>{c.legumes?.nom}{c.varietes?.nom ? ` · ${c.varietes.nom}` : ''} · {Number(c.longueur_metres)} m</span>
                    <span style={{ color: 'var(--encre-douce)' }}>{dose(c)} t/ha</span>
                    <span style={{ textAlign: 'right' }}>{kgFumure(dose(c), Number(c.longueur_metres)).toFixed(1).replace('.', ',')} kg</span>
                    <span style={{ textAlign: 'right', color: fait ? 'var(--vert-fonce)' : 'var(--encre-pale)' }}>{fait ? '✓ Fait' : 'À faire'}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {semaines.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
            Aucune fumure de fond à prévoir{masquerPassees ? ' dans les semaines à venir' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
