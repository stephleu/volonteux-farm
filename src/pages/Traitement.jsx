import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { semaineCourante as calculSemaineCourante, anneeCourante } from '../lib/dates'
import { AlertTriangle, Check } from 'lucide-react'
import AjoutSerie from '../components/AjoutSerie.jsx'

const ANNEE = anneeCourante()

export default function Traitement() {
  const [series, setSeries] = useState([])
  const [traitements, setTraitements] = useState([])
  const [typesTraitement, setTypesTraitement] = useState([])
  const [suivis, setSuivis] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('alertes')
  const [semaineCourante] = useState(calculSemaineCourante)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: s }, { data: t }, { data: tt }, { data: sv }] = await Promise.all([
      supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').eq('annee', ANNEE).order('semaine_plantation'),
      supabase.from('serie_traitements').select('*, series!inner(annee, nom, semaine_plantation, longueur_metres, legumes(nom, familles(couleur))), types_traitement(nom)').eq('series.annee', ANNEE),
      supabase.from('types_traitement').select('*').order('nom'),
      supabase.from('suivi_traitements').select('*'),
    ])
    setSeries(s || [])
    setTraitements(t || [])
    setTypesTraitement(tt || [])
    setSuivis(sv || [])
    setLoading(false)
  }

  function getSemaineTraitement(serieSemainePlantation, semainesApres) {
    return (serieSemainePlantation || 0) + semainesApres
  }

  function getSuivi(traitementId) {
    return suivis.find(s => s.traitement_id === traitementId)
  }

  async function toggleFait(traitement) {
    const suivi = getSuivi(traitement.id)
    if (suivi) {
      await supabase.from('suivi_traitements').update({ fait: !suivi.fait, date_reelle: !suivi.fait ? new Date().toISOString().split('T')[0] : null }).eq('id', suivi.id)
    } else {
      await supabase.from('suivi_traitements').insert({
        traitement_id: traitement.id,
        fait: true,
        date_reelle: new Date().toISOString().split('T')[0],
      })
    }
    fetchData()
  }

  const traitementsAvecSemaine = traitements.map(t => ({
    ...t,
    semaineTraitement: getSemaineTraitement(t.series?.semaine_plantation, t.semaines_apres_plantation),
  })).sort((a, b) => a.semaineTraitement - b.semaineTraitement)

  const alertes = traitementsAvecSemaine.filter(t => {
    const suivi = getSuivi(t.id)
    if (suivi?.fait) return false
    return t.semaineTraitement <= semaineCourante + 3
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Traitements phyto</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{traitements.length} traitements planifiés · saison {ANNEE}</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          {[['alertes', 'Alertes'], ['planning', 'Planning'], ['suivi', 'Suivi']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? 'var(--accent)' : 'var(--fond)', color: vue === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <AjoutSerie mode="traitement" series={series} typesTraitement={typesTraitement} onAjout={fetchData} />
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'alertes' && (
        <div>
          {alertes.length === 0 ? (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 20, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucun traitement urgent cette semaine
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', borderRadius: 0, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--ocre)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} />
                <span>{alertes.length} traitement{alertes.length > 1 ? 's' : ''} à effectuer</span>
              </div>
              {alertes.map((traitement, i) => {
                const suivi = getSuivi(traitement.id)
                const couleur = traitement.series?.legumes?.familles?.couleur || '#9dca9a'
                return (
                  <div key={i} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                        {traitement.series?.legumes?.nom}
                        <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>{traitement.series?.nom}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                        Semaine {traitement.semaineTraitement} · <strong>{traitement.types_traitement?.nom}</strong>
                      </div>
                    </div>
                    <button onClick={() => toggleFait(traitement)}
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
          {traitementsAvecSemaine.map((traitement, i) => {
            const suivi = getSuivi(traitement.id)
            const couleur = traitement.series?.legumes?.familles?.couleur || '#9dca9a'
            const passe = traitement.semaineTraitement < semaineCourante
            return (
              <div key={i} style={{ background: 'var(--papier)', border: `1px solid ${suivi?.fait ? 'var(--vert)' : passe ? 'var(--rouge-clair)' : 'var(--trait-leger)'}`, borderRadius: 0, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: suivi?.fait ? 0.7 : 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                    {traitement.series?.legumes?.nom}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>{traitement.series?.nom}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                    Sem. {traitement.semaineTraitement} · {traitement.types_traitement?.nom}
                  </div>
                </div>
                <button onClick={() => toggleFait(traitement)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, border: `1px solid ${suivi?.fait ? 'var(--vert)' : 'var(--trait-leger)'}`, borderRadius: 0, cursor: 'pointer', background: suivi?.fait ? 'var(--vert-pale)' : 'var(--fond)', color: suivi?.fait ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                  <Check size={12} />
                  {suivi?.fait ? `Fait le ${suivi.date_reelle}` : 'À faire'}
                </button>
              </div>
            )
          })}
          {traitementsAvecSemaine.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucun traitement planifié — ajoutez des traitements dans vos séries
            </div>
          )}
        </div>
      )}

      {vue === 'suivi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Total traitements planifiés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{traitements.length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Traitements effectués</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent)' }}>{suivis.filter(s => s.fait).length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Produits utilisés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>
                {new Set(traitements.map(t => t.type_traitement_id)).size}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
              Détail par série
            </div>
            {series.map(serie => {
              const traitementserie = traitements.filter(t => t.serie_id === serie.id)
              if (traitementserie.length === 0) return null
              const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
              return (
                <div key={serie.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait-leger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>{serie.legumes?.nom}</span>
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>{serie.nom}</span>
                  </div>
                  {traitementserie.map((t, i) => {
                    const suivi = getSuivi(t.id)
                    const sem = getSemaineTraitement(serie.semaine_plantation, t.semaines_apres_plantation)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 4px 16px', fontSize: 12 }}>
                        <span style={{ color: 'var(--encre-pale)', minWidth: 60 }}>Sem. {sem}</span>
                        <span style={{ color: 'var(--encre-douce)' }}>{t.types_traitement?.nom}</span>
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