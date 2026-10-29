import { useState, useEffect } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { semaineCourante as calculSemaineCourante, anneeCourante, semaineReelle } from '../lib/dates'
import { SELECT_PLANS, passagesDeSerie, nomPlan } from '../lib/fertilisation'
import { Check } from 'lucide-react'
import FumureFond from '../components/FumureFond.jsx'
import TableauFerti from '../components/TableauFerti.jsx'

const ANNEE = anneeCourante()
const ANNEES = [2025, 2026, 2027, 2028]

const SACS_KG = 25

// Les passages ne sont plus saisis série par série : ils viennent du tableau par légume
// (onglet « Tableau par légume »), appliqué à chaque série de l'année.
export default function Fertilisation() {
  const [series, setSeries] = useState([])
  const [plans, setPlans] = useState([])
  const [suivis, setSuivis] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('planning')
  const [semaineCourante] = useState(calculSemaineCourante)
  const [annee, setAnnee] = useState(ANNEE)
  const [version, setVersion] = useState(0)

  useEffect(() => { fetchData() }, [annee, version])

  async function fetchData() {
    const [{ data: s }, { data: p }, { data: sv }] = await Promise.all([
      chargerTout(() => supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('annee', annee).order('semaine_plantation').order('id')),
      supabase.from('plans_ferti').select(SELECT_PLANS),
      chargerTout(() => supabase.from('suivi_passages_ferti').select('*, series!inner(annee)').eq('series.annee', annee).order('id')),
    ])
    setSeries(s || [])
    setPlans(p || [])
    setSuivis(sv || [])
    setLoading(false)
  }

  function calculQuantite(longueurMetres, doseKgHa) {
    const surface = longueurMetres * 1.4
    const quantiteKg = (doseKgHa * surface) / 10000
    const nbSacs = Math.ceil(quantiteKg / SACS_KG)
    return { quantiteKg: quantiteKg.toFixed(1), nbSacs }
  }

  const getSuivi = passage => suivis.find(s => s.serie_id === passage.serie.id && s.passage_id === passage.passage.id)

  async function toggleFait(passage) {
    const suivi = getSuivi(passage)
    const { error } = suivi
      ? await supabase.from('suivi_passages_ferti').update({ fait: !suivi.fait, date_reelle: !suivi.fait ? new Date().toISOString().split('T')[0] : null }).eq('id', suivi.id)
      : await supabase.from('suivi_passages_ferti').insert({ serie_id: passage.serie.id, passage_id: passage.passage.id, fait: true, date_reelle: new Date().toISOString().split('T')[0] })
    if (error) alert(`Enregistrement impossible : ${error.message}`)
    fetchData()
  }

  const passages = series.flatMap(s => passagesDeSerie(plans, s)).sort((a, b) => a.semaineFerti - b.semaineFerti)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Fertilisation</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{passages.length} passages planifiés · saison{' '}
            <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={{ fontSize: 13, padding: '2px 6px', border: '1px solid var(--trait)', borderRadius: 0 }}>
              {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </p>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          {[['planning', 'Planning'], ['tableau', 'Tableau par légume'], ['fond', 'Fumure de fond'], ['suivi', 'Suivi']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? 'var(--accent)' : 'var(--fond)', color: vue === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {passages.map(p => {
            const suivi = getSuivi(p)
            const { quantiteKg, nbSacs } = calculQuantite(Number(p.serie.longueur_metres) || 50, p.dose_kg_ha)
            const couleur = p.serie.legumes?.familles?.couleur || '#9dca9a'
            const passe = annee < ANNEE || (annee === ANNEE && p.semaineFerti < semaineCourante)
            return (
              <div key={p.cle} style={{ background: 'var(--papier)', border: `1px solid ${suivi?.fait ? 'var(--vert)' : passe ? 'var(--rouge-clair)' : 'var(--trait-leger)'}`, borderRadius: 0, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: suivi?.fait ? 0.7 : 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                    {p.serie.legumes?.nom}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>{p.serie.nom}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                    Sem. {semaineReelle(annee, p.semaineFerti)} · {p.dose_kg_ha} kg/ha · {quantiteKg} kg · {nbSacs} sac{nbSacs > 1 ? 's' : ''}
                    {p.plan.variante && ` · ${nomPlan(p.plan)}`}
                  </div>
                </div>
                <button onClick={() => toggleFait(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, border: `1px solid ${suivi?.fait ? 'var(--vert)' : 'var(--trait-leger)'}`, borderRadius: 0, cursor: 'pointer', background: suivi?.fait ? 'var(--vert-pale)' : 'var(--fond)', color: suivi?.fait ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                  <Check size={12} />
                  {suivi?.fait ? `Fait le ${suivi.date_reelle}` : 'À faire'}
                </button>
              </div>
            )
          })}
          {passages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucun passage : réglez les doses dans l'onglet « Tableau par légume »
            </div>
          )}
        </div>
      )}

      {vue === 'tableau' && <TableauFerti onChange={() => setVersion(v => v + 1)} />}

      {vue === 'fond' && <FumureFond annee={annee} />}

      {vue === 'suivi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Total passages planifiés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{passages.length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Passages effectués</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent)' }}>{passages.filter(p => getSuivi(p)?.fait).length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Total sacs saison</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>
                {passages.reduce((acc, p) => acc + calculQuantite(Number(p.serie.longueur_metres) || 50, p.dose_kg_ha).nbSacs, 0)}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
              Détail par série
            </div>
            {series.map(serie => {
              const passagesSerie = passages.filter(p => p.serie.id === serie.id)
              if (passagesSerie.length === 0) return null
              const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
              return (
                <div key={serie.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait-leger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>{serie.legumes?.nom}</span>
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>{serie.nom}</span>
                  </div>
                  {passagesSerie.map(p => {
                    const suivi = getSuivi(p)
                    const { quantiteKg, nbSacs } = calculQuantite(Number(serie.longueur_metres) || 50, p.dose_kg_ha)
                    return (
                      <div key={p.cle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 4px 16px', fontSize: 12 }}>
                        <span style={{ color: 'var(--encre-pale)', minWidth: 60 }}>Sem. {semaineReelle(annee, p.semaineFerti)}</span>
                        <span style={{ color: 'var(--encre-douce)' }}>{p.dose_kg_ha} kg/ha · {quantiteKg} kg · {nbSacs} sac{nbSacs > 1 ? 's' : ''}</span>
                        <span style={{ marginLeft: 'auto', color: suivi?.fait ? 'var(--vert-fonce)' : 'var(--encre-pale)', fontSize: 11 }}>
                          {suivi?.fait ? `✓ Fait le ${suivi.date_reelle}` : '○ À faire'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
