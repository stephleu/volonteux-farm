import { useState, useEffect } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante, ecartSemaines, anneeEtSemaine } from '../lib/dates'
import { SELECT_PLANS, apportsDeSerie, nomPlan } from '../lib/fertilisation'
import { nbSacs, texteSacs } from '../lib/travailSol'
import { Check } from 'lucide-react'
import TableauFerti from '../components/TableauFerti.jsx'

const ANNEE = anneeCourante()
const aujourdhui = () => new Date().toISOString().split('T')[0]

// Tous les apports de granulés à venir, série par série et toutes années confondues, calculés depuis
// le tableau par légume : la fumure de fond (à la préparation de la planche) et les passages en culture.
// On charge aussi l'année précédente : une plantation de décembre a ses passages en janvier.
export default function Fertilisation() {
  const [series, setSeries] = useState([])
  const [plans, setPlans] = useState([])
  const [suivis, setSuivis] = useState([])
  const [cultures, setCultures] = useState([])
  const [granules, setGranules] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('planning')
  const [version, setVersion] = useState(0)

  useEffect(() => { fetchData() }, [version])

  async function fetchData() {
    const [{ data: s }, { data: p }, { data: sv }, { data: c }, { data: g }] = await Promise.all([
      chargerTout(() => supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').gte('annee', ANNEE - 1).order('semaine_plantation').order('id')),
      supabase.from('ferti_lignes').select(SELECT_PLANS),
      chargerTout(() => supabase.from('ferti_suivi').select('*, series!inner(annee)').gte('series.annee', ANNEE - 1).order('id')),
      // Planches de chaque série : la fumure de fond est « faite » quand l'étape Granulés y est cochée
      chargerTout(() => supabase.from('cultures').select('serie_id, planche_id').gte('annee', ANNEE - 1).eq('type', 'prevu').order('id')),
      chargerTout(() => supabase.from('travail_sol').select('id, planche_id, annee, fait').gte('annee', ANNEE - 1).eq('etape', 'granules').eq('passage', 1).order('id')),
    ])
    setSeries(s || [])
    setPlans(p || [])
    setSuivis(sv || [])
    setCultures(c || [])
    setGranules(g || [])
    setLoading(false)
  }


  const planchesDe = serie => [...new Set(cultures.filter(c => c.serie_id === serie.id).map(c => c.planche_id))]
  // Granulés cochés dans le travail du sol de l'année de la série
  const granulesDe = (plancheId, annee) => granules.find(g => g.planche_id === plancheId && g.annee === annee)

  // ---- Liste des apports ----
  const apports = []
  for (const serie of series) {
    const longueur = Number(serie.longueur_metres) || 50
    for (const a of apportsDeSerie(plans, serie)) {
      if (a.type === 'fond') {
        const planches = planchesDe(serie)
        apports.push({ ...a, planches, kg: a.kg(longueur), fait: planches.length > 0 && planches.every(id => granulesDe(id, serie.annee)?.fait) })
      } else {
        const suivi = suivis.find(s => s.serie_id === serie.id && s.passage_id === a.passage.id)
        apports.push({ ...a, suivi, kg: a.kg(longueur), fait: !!suivi?.fait })
      }
    }
  }
  for (const a of apports) {
    a.ecart = ecartSemaines(a.serie.annee, a.semaine)       // semaines entre aujourd'hui et l'apport
    a.reel = anneeEtSemaine(a.serie.annee, a.semaine)       // année et semaine affichées
  }
  apports.sort((a, b) => a.ecart - b.ecart || (a.type === 'fond' ? -1 : 1))

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
        const existant = granulesDe(plancheId, apport.serie.annee)
        const { error } = existant
          ? await supabase.from('travail_sol').update({ fait, date_fait: fait ? aujourdhui() : null }).eq('id', existant.id)
          : fait ? await supabase.from('travail_sol').insert({ planche_id: plancheId, etape: 'granules', passage: 1, annee: apport.serie.annee, fait: true, date_fait: aujourdhui() }) : {}
        erreur ||= error
      }
    }
    if (erreur) alert(`Enregistrement impossible : ${erreur.message}`)
    fetchData()
  }

  // Suivi : la saison en cours (séries de l'année)
  const apportsSaison = apports.filter(a => a.serie.annee === ANNEE)
  const totalKg = apportsSaison.reduce((acc, a) => acc + a.kg, 0)

  // Planning : à partir de la semaine dernière (plus les apports en retard des 4 dernières semaines),
  // regroupé par année puis par semaine
  const aVenir = apports.filter(a => a.ecart >= -1 || (!a.fait && a.ecart >= -4))
  const parAnnee = new Map()
  for (const a of aVenir) {
    const semaines = parAnnee.get(a.reel.annee) || new Map()
    semaines.set(a.reel.semaine, [...(semaines.get(a.reel.semaine) || []), a])
    parAnnee.set(a.reel.annee, semaines)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Fertilisation</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{aVenir.filter(a => !a.fait).length} apports à venir</p>
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
          {[...parAnnee].map(([anneeApports, semaines]) => [
            // Séparateur à chaque nouvelle année
            <div key={`annee-${anneeApports}`} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase' }}>{anneeApports}</div>
              <div style={{ height: 6, borderTop: '2px solid var(--trait)', borderBottom: '2px solid var(--trait)', margin: '4px 0 8px' }} />
            </div>,
            ...[...semaines].map(([sem, liste]) => {
            const kg = liste.reduce((acc, a) => acc + a.kg, 0)
            const restants = liste.filter(a => !a.fait).length
            return (
              <div key={`${anneeApports}-${sem}`} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 14px', background: 'var(--fond)', borderBottom: '1px solid var(--trait)', fontSize: 13 }}>
                  <strong>Semaine {sem}{liste[0].ecart < 0 ? ' · en retard' : liste[0].ecart === 0 ? ' · cette semaine' : ''}</strong>
                  <span>{Math.round(kg)} kg · {texteSacs(kg)}{restants ? ` · ${restants} à faire` : ' · tout est fait'}</span>
                </div>
                {liste.map(a => {
                  const couleur = a.serie.legumes?.familles?.couleur || '#9dca9a'
                  return (
                    <div key={a.cle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 14px', borderBottom: '1px solid var(--trait-leger)', borderLeft: `4px solid ${a.type === 'fond' ? 'var(--encre)' : 'transparent'}`, opacity: a.fait ? 0.6 : 1 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <strong>{a.serie.legumes?.nom}</strong>
                        <span style={{ color: 'var(--encre-pale)' }}> {a.serie.nom}</span>
                        <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 1 }}>
                          <strong>{a.type === 'fond' ? 'Fumure de fond' : 'En culture'}</strong> · {a.dose} · {a.kg.toFixed(1)} kg
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
              </div>
            )
            }),
          ])}
          {aVenir.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              {apports.length ? 'Aucun apport dans les semaines à venir' : "Aucun apport : réglez les doses dans l'onglet « Tableau par légume »"}
            </div>
          )}
        </div>
      )}

      {vue === 'tableau' && <TableauFerti onChange={() => setVersion(v => v + 1)} />}

      {vue === 'suivi' && (
        <div>
          <p style={{ fontSize: 13, margin: '0 0 10px' }}>Saison {ANNEE}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Apports planifiés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{apportsSaison.length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Apports effectués</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent)' }}>{apportsSaison.filter(a => a.fait).length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Granulés sur la saison</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{(totalKg / 1000).toFixed(2).replace('.', ',')} t · {nbSacs(totalKg)} sacs</div>
            </div>
          </div>

          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
              Détail par série
            </div>
            {series.filter(serie => serie.annee === ANNEE).map(serie => {
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
                      <span style={{ color: 'var(--encre-pale)', minWidth: 60 }}>Sem. {a.reel.semaine}{a.reel.annee !== ANNEE ? ` (${a.reel.annee})` : ''}</span>
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
