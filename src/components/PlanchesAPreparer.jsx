import { useState, useEffect } from 'react'
import { Tractor } from 'lucide-react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante, semaineIso } from '../lib/dates'
import { ETAPES, ETAPES_LABELS, etapesFaites, kgFumure } from '../lib/travailSol'
import { SELECT_PLANS, fumureFond } from '../lib/fertilisation'

// Délai de préparation avant plantation (mêmes règles que le tableau de bord : 5 semaines l'hiver, 3 sinon)
const semainesPrepa = semaine => (semaine <= 9 || semaine >= 44 ? 5 : 3)
const JOUR = 86400000

// Tableau de bord : planches dont la plantation approche et dont le travail du sol n'est pas terminé
export default function PlanchesAPreparer() {
  const [cultures, setCultures] = useState([])
  const [travaux, setTravaux] = useState([])
  const [plans, setPlans] = useState([])
  const [maintenant] = useState(() => Date.now())

  useEffect(() => {
    let actif = true
    const aujourdhui = new Date()
    const du = new Date(aujourdhui.getTime() - 7 * JOUR).toISOString().slice(0, 10)
    const au = new Date(aujourdhui.getTime() + 6 * 7 * JOUR).toISOString().slice(0, 10)
    const annees = [anneeCourante() - 1, anneeCourante(), anneeCourante() + 1]
    Promise.all([
      chargerTout(() => supabase.from('cultures')
        .select('id, annee, planche_id, legume_id, variete_id, date_plantation, longueur_metres, legumes(nom), series(semaine_plantation), planches(numero, blocs(nom))')
        .eq('type', 'prevu').gte('date_plantation', du).lte('date_plantation', au).order('date_plantation').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('planche_id, etape, passage, fait, annee').in('annee', annees).order('id')),
      supabase.from('ferti_lignes').select(SELECT_PLANS),
    ]).then(([{ data: c }, { data: t }, { data: p }]) => {
      if (!actif) return
      setPlans(p || [])
      setCultures(c || [])
      setTravaux(t || [])
    })
    return () => { actif = false }
  }, [])

  // Première plantation à venir de chaque planche, si on est dans sa fenêtre de préparation
  const parPlanche = new Map()
  for (const c of cultures) {
    if (parPlanche.has(c.planche_id)) continue
    const semaine = semaineIso(c.date_plantation)
    const semainesAvant = Math.round((new Date(c.date_plantation + 'T12:00:00') - maintenant) / (7 * JOUR))
    if (semainesAvant > semainesPrepa(semaine)) continue
    const faites = etapesFaites(travaux.filter(t => t.annee === c.annee), c.planche_id)
    const manquantes = ETAPES.filter(e => !faites.includes(e))
    if (manquantes.length === 0) continue
    const cultureDeLaPlanche = cultures.filter(x => x.planche_id === c.planche_id && x.date_plantation === c.date_plantation)
    parPlanche.set(c.planche_id, { c, semaine, semainesAvant, manquantes, cultureDeLaPlanche })
  }
  const aPreparer = [...parPlanche.values()].sort((a, b) => a.c.date_plantation.localeCompare(b.c.date_plantation))

  if (aPreparer.length === 0) return null

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Tractor size={14} color="#9a6a00" />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Planches à préparer · {aPreparer.length}</span>
      </div>
      {aPreparer.map(({ c, semaine, semainesAvant, manquantes, cultureDeLaPlanche }) => {
        const granules = manquantes.includes('granules')
          ? cultureDeLaPlanche.reduce((acc, x) => acc + kgFumure(fumureFond(plans, x.legume_id, x.series?.semaine_plantation, x.variete_id), Number(x.longueur_metres)), 0)
          : 0
        const urgent = semainesAvant <= 1
        return (
          <div key={c.planche_id} style={{ padding: '8px 12px', background: urgent ? 'var(--rouge-pale)' : 'var(--jaune-pale)', border: `1px solid ${urgent ? 'var(--rouge-clair)' : 'var(--jaune)'}`, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--encre)' }}>
              {c.planches?.blocs?.nom}-{String(c.planches?.numero).padStart(2, '0')}
              <span style={{ fontWeight: 400, color: 'var(--encre-douce)' }}> · {[...new Set(cultureDeLaPlanche.map(x => x.legumes?.nom))].join(', ')} · plantation sem. {semaine}{semainesAvant <= 0 ? ' (cette semaine ou en retard)' : ` (dans ${semainesAvant} sem.)`}</span>
            </div>
            <div style={{ fontSize: 11, color: urgent ? 'var(--rouge)' : 'var(--encre-douce)', marginTop: 2 }}>
              Reste : {manquantes.map(e => ETAPES_LABELS[e]).join(', ')}
              {granules > 0 && ` · granulés ${Math.round(granules)} kg`}
              {manquantes.includes('granules') && cultureDeLaPlanche.every(x => fumureFond(plans, x.legume_id, x.series?.semaine_plantation, x.variete_id) === 0) && ' · pas de granulés pour cette culture'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
