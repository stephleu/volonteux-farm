import { useState, useEffect } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { semaineCourante as calculSemaineCourante, anneeCourante, semaineReelle } from '../lib/dates'
import { SELECT_PLANS, passagesDeSerie, fumureFond, planPour, nomPlan } from '../lib/fertilisation'
import { kgFumure, SAC_GRANULES_KG } from '../lib/travailSol'
import { Check } from 'lucide-react'
import TableauFerti from '../components/TableauFerti.jsx'

const ANNEE = anneeCourante()
const ANNEES = [2025, 2026, 2027, 2028]
const aujourdhui = () => new Date().toISOString().split('T')[0]

// Tous les apports de granulés de l'année, série par série, calculés depuis le tableau par légume :
// la fumure de fond (à la préparation de la planche) et les passages en cours de culture.
export default function Fertilisation() {
  const [series, setSeries] = useState([])
  const [plans, setPlans] = useState([])
  const [suivis, setSuivis] = useState([])
  const [cultures, setCultures] = useState([])
  const [granules, setGranules] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('planning')
  const [semaineCourante] = useState(calculSemaineCourante)
  const [annee, setAnnee] = useState(ANNEE)
  const [version, setVersion] = useState(0)

  useEffect(() => { fetchData() }, [annee, version])

  async function fetchData() {
    const [{ data: s }, { data: p }, { data: sv }, { data: c }, { data: g }] = await Promise.all([
      chargerTout(() => supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('annee', annee).order('semaine_plantation').order('id')),
      supabase.from('ferti_lignes').select(SELECT_PLANS),
      chargerTout(() => supabase.from('ferti_suivi').select('*, series!inner(annee)').eq('series.annee', annee).order('id')),
      // Planches de chaque série : la fumure de fond est « faite » quand l'étape Granulés y est cochée
      chargerTout(() => supabase.from('cultures').select('serie_id, planche_id').eq('annee', annee).eq('type', 'prevu').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('id, planche_id, fait').eq('annee', annee).eq('etape', 'granules').eq('passage', 1).order('id')),
    ])
    setSeries(s || [])
    setPlans(p || [])
    setSuivis(sv || [])
    setCultures(c || [])
    setGranules(g || [])
    setLoading(false)
  }

  const kgPassage = (longueurMetres, doseKgHa) => (doseKgHa * longueurMetres * 1.4) / 10000
  const sacs = kg => Math.ceil(kg / SAC_GRANULES_KG)

  const planchesDe = serie => [...new Set(cultures.filter(c => c.serie_id === serie.id).map(c => c.planche_id))]
  const granulesFaits = plancheId => granules.some(g => g.planche_id === plancheId && g.fait)

  // ---- Liste des apports ----
  const apports = []
  for (const serie of series) {
    const longueur = Number(serie.longueur_metres) || 50
    const plan = planPour(plans, serie.legume_id, serie.semaine_plantation, serie.variete_id)
    const fond = fumureFond(plans, serie.legume_id, serie.semaine_plantation, serie.variete_id)
    if (fond > 0 && serie.semaine_plantation) {
      const planches = planchesDe(serie)
      apports.push({
        cle: `${serie.id}:fond`, type: 'fond', serie, plan, planches,
        semaine: serie.semaine_plantation,
        dose: `${fond} t/ha de fond`,
        kg: kgFumure(fond, longueur),
        fait: planches.length > 0 && planches.every(granulesFaits),
      })
    }
    for (const p of passagesDeSerie(plans, serie)) {
      const suivi = suivis.find(s => s.serie_id === serie.id && s.passage_id === p.passage.id)
      apports.push({
        cle: p.cle, type: 'passage', serie, plan, passage: p.passage, suivi,
        semaine: p.semaineFerti,
        dose: `${p.dose_kg_ha} kg/ha à +${p.semaines_apres_plantation} sem.`,
        kg: kgPassage(longueur, p.dose_kg_ha),
        fait: !!suivi?.fait,
      })
    }
  }
  apports.sort((a, b) => a.semaine - b.semaine || (a.type === 'fond' ? -1 : 1))

  // ---- « Fait » ----
  async function basculer(apport) {
    let erreur = null
    if (apport.type === 'passage') {
      const { suivi } = apport
      const { error } = suivi
        ? await supabase.from('ferti_suivi').update({ fait: !suivi.fait, date_reelle: !suivi.fait ? aujourdhui() : null }).eq('id', suivi.id)
        : await supabase.from('ferti_suivi').insert({ serie_id: apport.serie.id, passage_id: apport.passage.id, fait: true, date_reelle: aujourdhui() })
      erreur = error
    } else {
      // Fumure de fond = étape Granulés du travail du sol, cochée sur toutes les planches de la série
      if (apport.planches.length === 0) return alert("Cette série n'est pas encore placée dans l'assolement : pas de planche où cocher les granulés.")
      const fait = !apport.fait
      for (const plancheId of apport.planches) {
        const existant = granules.find(g => g.planche_id === plancheId)
        const { error } = existant
          ? await supabase.from('travail_sol').update({ fait, date_fait: fait ? aujourdhui() : null }).eq('id', existant.id)
          : fait ? await supabase.from('travail_sol').insert({ planche_id: plancheId, etape: 'granules', passage: 1, annee, fait: true, date_fait: aujourdhui() }) : {}
        erreur ||= error
      }
    }
    if (erreur) alert(`Enregistrement impossible : ${erreur.message}`)
    fetchData()
  }

  const totalKg = apports.reduce((acc, a) => acc + a.kg, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Fertilisation</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{apports.length} apports planifiés · saison{' '}
            <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={{ fontSize: 13, padding: '2px 6px', border: '1px solid var(--trait)', borderRadius: 0 }}>
              {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </p>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          {[['planning', 'Planning'], ['tableau', 'Tableau par légume'], ['suivi', 'Suivi']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? 'var(--accent)' : 'var(--fond)', color: vue === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 12, color: 'var(--encre-douce)', margin: '0 0 6px' }}>
            Fumure de fond : granulés à la préparation de la planche (cocher « Fait » coche l'étape Granulés de ses planches dans Travail du sol).
            Passages : granulés en cours de culture. Doses dans l'onglet « Tableau par légume ».
          </p>
          {apports.map(a => {
            const couleur = a.serie.legumes?.familles?.couleur || '#9dca9a'
            const passe = annee < ANNEE || (annee === ANNEE && a.semaine < semaineCourante)
            return (
              <div key={a.cle} style={{ background: 'var(--papier)', border: `1px solid ${a.fait ? 'var(--vert)' : passe ? 'var(--rouge-clair)' : 'var(--trait-leger)'}`, borderLeft: `4px solid ${a.type === 'fond' ? 'var(--encre)' : 'var(--trait-leger)'}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: a.fait ? 0.7 : 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                    {a.serie.legumes?.nom}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>{a.serie.nom}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                    Sem. {semaineReelle(annee, a.semaine)} · <strong>{a.type === 'fond' ? 'Fumure de fond' : 'En culture'}</strong> · {a.dose} · {a.kg.toFixed(1)} kg · {sacs(a.kg)} sac{sacs(a.kg) > 1 ? 's' : ''}
                    {a.plan?.variante && ` · ${nomPlan(a.plan)}`}
                  </div>
                </div>
                <button onClick={() => basculer(a)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, border: `1px solid ${a.fait ? 'var(--vert)' : 'var(--trait-leger)'}`, borderRadius: 0, cursor: 'pointer', background: a.fait ? 'var(--vert-pale)' : 'var(--fond)', color: a.fait ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                  <Check size={12} />
                  {a.fait ? (a.suivi?.date_reelle ? `Fait le ${a.suivi.date_reelle}` : 'Fait') : 'À faire'}
                </button>
              </div>
            )
          })}
          {apports.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucun apport : réglez les doses dans l'onglet « Tableau par légume »
            </div>
          )}
        </div>
      )}

      {vue === 'tableau' && <TableauFerti onChange={() => setVersion(v => v + 1)} />}

      {vue === 'suivi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Apports planifiés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{apports.length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Apports effectués</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent)' }}>{apports.filter(a => a.fait).length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Granulés sur la saison</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{(totalKg / 1000).toFixed(2).replace('.', ',')} t · {sacs(totalKg)} sacs</div>
            </div>
          </div>

          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
              Détail par série
            </div>
            {series.map(serie => {
              const apportsSerie = apports.filter(a => a.serie.id === serie.id)
              if (apportsSerie.length === 0) return null
              const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
              return (
                <div key={serie.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait-leger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>{serie.legumes?.nom}</span>
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>{serie.nom}</span>
                  </div>
                  {apportsSerie.map(a => (
                    <div key={a.cle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 4px 16px', fontSize: 12 }}>
                      <span style={{ color: 'var(--encre-pale)', minWidth: 60 }}>Sem. {semaineReelle(annee, a.semaine)}</span>
                      <span style={{ color: 'var(--encre-douce)' }}>{a.type === 'fond' ? 'Fond' : 'En culture'} · {a.dose} · {a.kg.toFixed(1)} kg</span>
                      <span style={{ marginLeft: 'auto', color: a.fait ? 'var(--vert-fonce)' : 'var(--encre-pale)', fontSize: 11 }}>
                        {a.fait ? '✓ Fait' : '○ À faire'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
