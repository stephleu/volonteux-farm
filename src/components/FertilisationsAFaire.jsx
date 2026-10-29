import { useState, useEffect } from 'react'
import { Sprout } from 'lucide-react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante, ecartSemaines, semaineDans } from '../lib/dates'
import { kgFumure, SAC_GRANULES_KG, LARGEUR_PLANCHE_M, nomLieu, libelleSemaine } from '../lib/travailSol'
import { SELECT_PLANS, fumureFond, passagesDeSerie } from '../lib/fertilisation'

const SEMAINES_AFFICHEES = 2 // semaine en cours + 2 semaines d'avance
const RETARD_MAX = 4         // apports non faits des 4 dernières semaines, comptés dans la semaine en cours
const sacs = kg => Math.ceil(kg / SAC_GRANULES_KG)
const kgPassage = (doseKgHa, longueurMetres) => (doseKgHa * longueurMetres * LARGEUR_PLANCHE_M) / 10000

// Tableau de bord : granulés à épandre (fumure de fond + passages en culture), par semaine puis par
// serre ou bloc, avec le nombre de planches, les kilos et les sacs
export default function FertilisationsAFaire() {
  const [donnees, setDonnees] = useState(null)

  useEffect(() => {
    let actif = true
    const annees = [anneeCourante() - 1, anneeCourante(), anneeCourante() + 1]
    Promise.all([
      chargerTout(() => supabase.from('series').select('id, annee, legume_id, variete_id, semaine_plantation, longueur_metres, legumes(nom)').in('annee', annees).order('id')),
      supabase.from('ferti_lignes').select(SELECT_PLANS),
      chargerTout(() => supabase.from('ferti_suivi').select('serie_id, passage_id').eq('fait', true).order('id')),
      chargerTout(() => supabase.from('cultures').select('serie_id, planche_id, longueur_metres, planches(blocs(nom, type))').in('annee', annees).eq('type', 'prevu').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('planche_id, annee').in('annee', annees).eq('etape', 'granules').eq('passage', 1).eq('fait', true).order('id')),
    ]).then(([{ data: s }, { data: p }, { data: sv }, { data: c }, { data: g }]) => {
      if (!actif) return
      setDonnees({ series: s || [], plans: p || [], suivis: sv || [], cultures: c || [], granules: g || [] })
    })
    return () => { actif = false }
  }, [])

  if (!donnees) return null
  const { series, plans, suivis, cultures, granules } = donnees
  const passagesFaits = new Set(suivis.map(x => `${x.serie_id}:${x.passage_id}`))
  const granulesFaits = new Set(granules.map(x => `${x.planche_id}:${x.annee}`))
  const culturesDe = new Map()
  for (const c of cultures) culturesDe.set(c.serie_id, [...(culturesDe.get(c.serie_id) || []), c])

  // écart → Map(lieu → { planches, kg })
  const parSemaine = new Map()
  const ajouter = (ecart, lieu, plancheId, kg) => {
    if (ecart < -RETARD_MAX || ecart > SEMAINES_AFFICHEES || kg <= 0) return
    const e = Math.max(0, ecart)
    const lieux = parSemaine.get(e) || new Map()
    const l = lieux.get(lieu) || { planches: new Set(), kg: 0 }
    l.planches.add(plancheId)
    l.kg += kg
    lieux.set(lieu, l)
    parSemaine.set(e, lieux)
  }

  for (const serie of series) {
    if (!serie.semaine_plantation) continue
    // Planches de la série ; à défaut (série pas encore placée), la série seule, sans bloc
    const planches = culturesDe.get(serie.id) || [{ planche_id: `serie-${serie.id}`, longueur_metres: serie.longueur_metres || 50, planches: null }]
    // Série pas encore placée : on affiche le légume (« Tomate - non placé »)
    const lieuDe = c => (c.planches ? nomLieu(c.planches.blocs) : `${serie.legumes?.nom || 'Série'} - non placé`)
    const fond = fumureFond(plans, serie.legume_id, serie.semaine_plantation, serie.variete_id)
    const ecartFond = ecartSemaines(serie.annee, serie.semaine_plantation)
    for (const c of planches) {
      if (granulesFaits.has(`${c.planche_id}:${serie.annee}`)) continue
      ajouter(ecartFond, lieuDe(c), c.planche_id, kgFumure(fond, Number(c.longueur_metres) || 0))
    }
    for (const p of passagesDeSerie(plans, serie)) {
      if (passagesFaits.has(p.cle)) continue
      const ecart = ecartSemaines(serie.annee, p.semaineFerti)
      for (const c of planches) ajouter(ecart, lieuDe(c), c.planche_id, kgPassage(p.dose_kg_ha, Number(c.longueur_metres) || 0))
    }
  }
  const semaines = [...parSemaine.entries()].sort((a, b) => a[0] - b[0])

  if (semaines.length === 0) {
    return (
      <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', padding: 16, fontSize: 13, color: 'var(--vert-fonce)', marginBottom: 14 }}>
        ✓ Aucune fertilisation dans les deux semaines
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sprout size={14} color="#3f7a3b" />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Fertilisations à faire</span>
      </div>
      {semaines.map(([ecart, lieux]) => {
        const liste = [...lieux.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }))
        const kgSemaine = liste.reduce((acc, [, l]) => acc + l.kg, 0)
        return (
          <div key={ecart} style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--encre)', padding: '6px 12px', borderBottom: '1px solid var(--trait-leger)' }}>
              <span>{libelleSemaine(ecart, semaineDans(ecart))}</span>
              <span>{Math.round(kgSemaine)} kg · {sacs(kgSemaine)} sac{sacs(kgSemaine) > 1 ? 's' : ''}</span>
            </div>
            {liste.map(([lieu, l]) => (
              <div key={lieu} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 60px', gap: 8, fontSize: 12, padding: '4px 12px', color: 'var(--encre)' }}>
                <span>{lieu}</span>
                <span style={{ color: 'var(--encre-douce)', textAlign: 'right' }}>{l.planches.size} planche{l.planches.size > 1 ? 's' : ''}</span>
                <span style={{ textAlign: 'right' }}>{Math.round(l.kg)} kg</span>
                <span style={{ color: 'var(--encre-douce)', textAlign: 'right' }}>{sacs(l.kg)} sac{sacs(l.kg) > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
