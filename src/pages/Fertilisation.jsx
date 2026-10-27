import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { semaineCourante as calculSemaineCourante, anneeCourante } from '../lib/dates'
import { AlertTriangle, Check } from 'lucide-react'

const ANNEE = anneeCourante()

const SURFACE_PLANCHE = 70
const SACS_KG = 25

export default function Fertilisation() {
  const [series, setSeries] = useState([])
  const [fertilisations, setFertilisations] = useState([])
  const [suivis, setSuivis] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('alertes')
  const [semaineCourante] = useState(calculSemaineCourante)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: s }, { data: f }, { data: sv }] = await Promise.all([
      supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('annee', ANNEE).order('semaine_plantation'),
      supabase.from('serie_fertilisations').select('*, series!inner(annee, nom, semaine_plantation, longueur_metres, legumes(nom))').eq('series.annee', ANNEE),
      supabase.from('suivi_ferti').select('*'),
    ])
    setSeries(s || [])
    setFertilisations(f || [])
    setSuivis(sv || [])
    setLoading(false)
  }

  function getSemaineFerti(serieSemainePlantation, semainesApres) {
    return (serieSemainePlantation || 0) + semainesApres
  }

  function calculQuantite(longueurMetres, doseKgHa) {
    const surface = longueurMetres * 1.4
    const quantiteKg = (doseKgHa * surface) / 10000
    const nbSacs = Math.ceil(quantiteKg / SACS_KG)
    return { quantiteKg: quantiteKg.toFixed(1), nbSacs }
  }

  function getSuivi(fertilisationId) {
    return suivis.find(s => s.plan_ferti_id === fertilisationId)
  }

  async function toggleFait(ferti) {
    const suivi = getSuivi(ferti.id)
    if (suivi) {
      await supabase.from('suivi_ferti').update({ fait: !suivi.fait, date_reelle: !suivi.fait ? new Date().toISOString().split('T')[0] : null }).eq('id', suivi.id)
    } else {
      await supabase.from('suivi_ferti').insert({
        plan_ferti_id: ferti.id,
        fait: true,
        date_reelle: new Date().toISOString().split('T')[0],
      })
    }
    fetchData()
  }

  const fertisAvecSemaine = fertilisations.map(f => ({
    ...f,
    semaineFerti: getSemaineFerti(f.series?.semaine_plantation, f.semaines_apres_plantation),
  })).sort((a, b) => a.semaineFerti - b.semaineFerti)

  const alertes = fertisAvecSemaine.filter(f => {
    const suivi = getSuivi(f.id)
    if (suivi?.fait) return false
    return f.semaineFerti >= semaineCourante - 1 && f.semaineFerti <= semaineCourante + 3
  })

  const totalSacsAlerte = alertes.reduce((acc, f) => {
    const { nbSacs } = calculQuantite(f.series?.longueur_metres || 50, f.dose_kg_ha)
    return acc + nbSacs
  }, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Fertilisation</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{fertilisations.length} passages planifiés · saison {ANNEE}</p>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          {[['alertes', 'Alertes'], ['planning', 'Planning'], ['suivi', 'Suivi']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? 'var(--accent)' : 'var(--fond)', color: vue === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'alertes' && (
        <div>
          {alertes.length === 0 ? (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 20, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucune fertilisation urgente cette semaine
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', borderRadius: 0, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--ocre)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} />
                <span>{alertes.length} fertilisation{alertes.length > 1 ? 's' : ''} à faire · <strong>{totalSacsAlerte} sacs de 25kg</strong> à préparer</span>
              </div>
              {alertes.map((ferti, i) => {
                const suivi = getSuivi(ferti.id)
                const { quantiteKg, nbSacs } = calculQuantite(ferti.series?.longueur_metres || 50, ferti.dose_kg_ha)
                const couleur = ferti.series?.legumes?.familles?.couleur || '#9dca9a'
                return (
                  <div key={i} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                        {ferti.series?.legumes?.nom} · passage {ferti.series?.nom}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                        Semaine {ferti.semaineFerti} · {ferti.dose_kg_ha} kg/ha · {quantiteKg} kg · <strong>{nbSacs} sac{nbSacs > 1 ? 's' : ''}</strong>
                      </div>
                    </div>
                    <button onClick={() => toggleFait(ferti)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, border: `1px solid ${suivi?.fait ? 'var(--vert)' : 'var(--trait-leger)'}`, borderRadius: 0, cursor: 'pointer', background: suivi?.fait ? 'var(--vert-pale)' : 'var(--fond)', color: suivi?.fait ? 'var(--vert-fonce)' : 'var(--encre-douce)', fontWeight: suivi?.fait ? 500 : 400 }}>
                      <Check size={13} />
                      {suivi?.fait ? 'Fait' : 'Marquer fait'}
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {vue === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fertisAvecSemaine.map((ferti, i) => {
            const suivi = getSuivi(ferti.id)
            const { quantiteKg, nbSacs } = calculQuantite(ferti.series?.longueur_metres || 50, ferti.dose_kg_ha)
            const couleur = ferti.series?.legumes?.familles?.couleur || '#9dca9a'
            const passe = ferti.semaineFerti < semaineCourante
            return (
              <div key={i} style={{ background: 'var(--papier)', border: `1px solid ${suivi?.fait ? 'var(--vert)' : passe ? 'var(--rouge-clair)' : 'var(--trait-leger)'}`, borderRadius: 0, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: suivi?.fait ? 0.7 : 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                    {ferti.series?.legumes?.nom}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>{ferti.series?.nom}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                    Sem. {ferti.semaineFerti} · {ferti.dose_kg_ha} kg/ha · {quantiteKg} kg · {nbSacs} sac{nbSacs > 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={() => toggleFait(ferti)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, border: `1px solid ${suivi?.fait ? 'var(--vert)' : 'var(--trait-leger)'}`, borderRadius: 0, cursor: 'pointer', background: suivi?.fait ? 'var(--vert-pale)' : 'var(--fond)', color: suivi?.fait ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                  <Check size={12} />
                  {suivi?.fait ? `Fait le ${suivi.date_reelle}` : 'À faire'}
                </button>
              </div>
            )
          })}
          {fertisAvecSemaine.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucune fertilisation planifiée — ajoutez des passages dans vos séries
            </div>
          )}
        </div>
      )}

      {vue === 'suivi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Total passages planifiés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{fertilisations.length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Passages effectués</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent)' }}>{suivis.filter(s => s.fait).length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Total sacs saison</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>
                {fertisAvecSemaine.reduce((acc, f) => acc + calculQuantite(f.series?.longueur_metres || 50, f.dose_kg_ha).nbSacs, 0)}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
              Détail par série
            </div>
            {series.map(serie => {
              const fertiserie = fertilisations.filter(f => f.serie_id === serie.id)
              if (fertiserie.length === 0) return null
              const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
              return (
                <div key={serie.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait-leger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>{serie.legumes?.nom}</span>
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>{serie.nom}</span>
                  </div>
                  {fertiserie.map((f, i) => {
                    const suivi = getSuivi(f.id)
                    const sem = getSemaineFerti(serie.semaine_plantation, f.semaines_apres_plantation)
                    const { quantiteKg, nbSacs } = calculQuantite(serie.longueur_metres, f.dose_kg_ha)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 4px 16px', fontSize: 12 }}>
                        <span style={{ color: 'var(--encre-pale)', minWidth: 60 }}>Sem. {sem}</span>
                        <span style={{ color: 'var(--encre-douce)' }}>{f.dose_kg_ha} kg/ha · {quantiteKg} kg · {nbSacs} sac{nbSacs > 1 ? 's' : ''}</span>
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