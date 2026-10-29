import { useState, useEffect } from 'react'
import { Tractor } from 'lucide-react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante, semaineDans, ecartDate } from '../lib/dates'
import { ETAPES, etapesFaites, nomLieu, libelleSemaine } from '../lib/travailSol'

const JOUR = 86400000
const SEMAINES_AFFICHEES = 2 // semaine en cours + 2 semaines d'avance

// Tableau de bord : planches dont la plantation arrive dans les 2 semaines et dont le travail du sol
// n'est pas terminé, par semaine de plantation puis par serre ou bloc
export default function PlanchesAPreparer() {
  const [cultures, setCultures] = useState([])
  const [travaux, setTravaux] = useState([])

  useEffect(() => {
    let actif = true
    const aujourdhui = new Date()
    const du = new Date(aujourdhui.getTime() - 7 * JOUR).toISOString().slice(0, 10)
    const au = new Date(aujourdhui.getTime() + (SEMAINES_AFFICHEES + 1) * 7 * JOUR).toISOString().slice(0, 10)
    const annees = [anneeCourante() - 1, anneeCourante(), anneeCourante() + 1]
    Promise.all([
      chargerTout(() => supabase.from('cultures')
        .select('id, annee, planche_id, date_plantation, planches(blocs(nom, type))')
        .eq('type', 'prevu').gte('date_plantation', du).lte('date_plantation', au).order('date_plantation').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('planche_id, etape, passage, fait, annee').in('annee', annees).order('id')),
    ]).then(([{ data: c }, { data: t }]) => {
      if (!actif) return
      setCultures(c || [])
      setTravaux(t || [])
    })
    return () => { actif = false }
  }, [])

  // Première plantation de chaque planche ; le retard (semaine dernière) compte dans la semaine en cours
  const vues = new Set()
  const parSemaine = new Map() // écart → Map(lieu → nombre de planches)
  for (const c of cultures) {
    if (vues.has(c.planche_id)) continue
    vues.add(c.planche_id)
    const ecart = Math.max(0, ecartDate(c.date_plantation))
    if (ecart > SEMAINES_AFFICHEES) continue
    const faites = etapesFaites(travaux.filter(t => t.annee === c.annee), c.planche_id)
    if (ETAPES.every(e => faites.includes(e))) continue
    const lieux = parSemaine.get(ecart) || new Map()
    const lieu = nomLieu(c.planches?.blocs)
    lieux.set(lieu, (lieux.get(lieu) || 0) + 1)
    parSemaine.set(ecart, lieux)
  }
  const semaines = [...parSemaine.entries()].sort((a, b) => a[0] - b[0])
  const total = semaines.reduce((acc, [, lieux]) => acc + [...lieux.values()].reduce((x, n) => x + n, 0), 0)

  if (total === 0) return null

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Tractor size={14} color="#9a6a00" />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Planches à préparer · {total}</span>
      </div>
      {semaines.map(([ecart, lieux]) => (
        <div key={ecart} style={{ background: ecart === 0 ? 'var(--rouge-pale)' : 'var(--jaune-pale)', border: `1px solid ${ecart === 0 ? 'var(--rouge-clair)' : 'var(--jaune)'}`, marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--encre)', padding: '6px 12px', borderBottom: '1px solid var(--trait-leger)' }}>
            {libelleSemaine(ecart, semaineDans(ecart))}
          </div>
          {[...lieux.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true })).map(([lieu, n]) => (
            <div key={lieu} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 12px', color: 'var(--encre)' }}>
              <span>{lieu}</span>
              <span style={{ color: 'var(--encre-douce)' }}>{n} planche{n > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
