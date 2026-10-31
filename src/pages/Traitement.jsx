import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { anneeCourante, ecartSemaines, anneeEtSemaine } from '../lib/dates'
import { Check } from 'lucide-react'
import AjoutTraitement from '../components/AjoutTraitement.jsx'
import { EnTetePage, Onglets, SeparateurAnnee } from '../components/ui.jsx'
import { useChargement } from '../lib/useChargement'

const ANNEE = anneeCourante()

// Tous les traitements à venir, toutes années confondues (et l'année précédente : une plantation
// de décembre a ses traitements en janvier), avec un séparateur par année
export default function Traitement() {
  const [series, setSeries] = useState([])
  const [traitements, setTraitements] = useState([])
  const [typesTraitement, setTypesTraitement] = useState([])
  const [suivis, setSuivis] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('planning')

  async function fetchData() {
    const [{ data: s }, { data: t }, { data: tt }, { data: sv }] = await Promise.all([
      supabase.from('series').select('*, legumes(nom, familles(couleur)), varietes(nom)').gte('annee', ANNEE - 1).order('semaine_plantation'),
      supabase.from('serie_traitements').select('*, series!inner(annee, nom, semaine_plantation, longueur_metres, legumes(nom, familles(couleur))), types_traitement(nom)').gte('series.annee', ANNEE - 1),
      supabase.from('types_traitement').select('*').order('nom'),
      supabase.from('suivi_traitements').select('*'),
    ])
    setSeries(s || [])
    setTraitements(t || [])
    setTypesTraitement(tt || [])
    setSuivis(sv || [])
    setLoading(false)
  }
  useChargement(fetchData)

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

  // Modification d'un traitement depuis le planning : { id, type_traitement_id, semaines_apres_plantation }
  const [enModif, setEnModif] = useState(null)

  async function enregistrerModif() {
    const { error } = await supabase.from('serie_traitements').update({
      type_traitement_id: enModif.type_traitement_id,
      semaines_apres_plantation: parseInt(enModif.semaines_apres_plantation),
    }).eq('id', enModif.id)
    if (error) return alert(`Modification impossible : ${error.message}`)
    setEnModif(null)
    fetchData()
  }

  async function supprimerPassage(traitement) {
    if (!window.confirm(`Supprimer ce traitement (${traitement.series?.legumes?.nom}, sem. ${traitement.semaineTraitement}) ?`)) return
    await supabase.from('suivi_traitements').delete().eq('traitement_id', traitement.id)
    const { error } = await supabase.from('serie_traitements').delete().eq('id', traitement.id)
    if (error) return alert(`Suppression impossible : ${error.message}`)
    setEnModif(null)
    fetchData()
  }

  const traitementsAvecSemaine = traitements.map(t => {
    const semaine = getSemaineTraitement(t.series?.semaine_plantation, t.semaines_apres_plantation)
    return { ...t, ecart: ecartSemaines(t.series?.annee, semaine), reel: anneeEtSemaine(t.series?.annee, semaine), semaineTraitement: anneeEtSemaine(t.series?.annee, semaine).semaine }
  }).sort((a, b) => a.ecart - b.ecart)

  // Planning : à partir de la semaine dernière, plus les traitements en retard des 4 dernières semaines
  const aVenir = traitementsAvecSemaine.filter(t => t.ecart >= -1 || (!getSuivi(t.id)?.fait && t.ecart >= -4))
  const annees = [...new Set(aVenir.map(t => t.reel.annee))]
  // Suivi : la saison en cours
  const traitementsSaison = traitements.filter(t => t.series?.annee === ANNEE)

  return (
    <div>
      <EnTetePage titre="Traitements phyto" sousTitre={`${aVenir.filter(t => !getSuivi(t.id)?.fait).length} traitements à venir`}>
        <Onglets valeur={vue} onChange={setVue} options={[['planning', 'Planning'], ['suivi', 'Suivi']]} />
      </EnTetePage>

      <div style={{ marginBottom: 16 }}>
        <AjoutTraitement series={series} typesTraitement={typesTraitement} onAjout={fetchData} />
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {annees.map(anneeTraitements => [
            <SeparateurAnnee key={`annee-${anneeTraitements}`} annee={anneeTraitements} />,
            ...aVenir.filter(t => t.reel.annee === anneeTraitements).map((traitement, i) => {
            const suivi = getSuivi(traitement.id)
            const couleur = traitement.series?.legumes?.familles?.couleur || '#9dca9a'
            const passe = traitement.ecart < 0
            return (
              <div key={traitement.id || i} style={{ background: 'var(--papier)', border: `1px solid ${suivi?.fait ? 'var(--vert)' : passe ? 'var(--rouge-clair)' : 'var(--trait-leger)'}`, borderRadius: 0, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: suivi?.fait ? 0.7 : 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                    {traitement.series?.legumes?.nom}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>{traitement.series?.nom}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 2 }}>
                    Sem. {traitement.semaineTraitement}{passe && !suivi?.fait ? ' · en retard' : ''} · {traitement.types_traitement?.nom}
                  </div>
                </div>
                {enModif?.id === traitement.id ? (
                  <>
                    <select value={enModif.type_traitement_id} onChange={e => setEnModif({ ...enModif, type_traitement_id: e.target.value })}
                      style={{ fontSize: 11, padding: '4px 6px', border: '1px solid var(--trait)' }}>
                      {typesTraitement.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                    <select value={enModif.semaines_apres_plantation} onChange={e => setEnModif({ ...enModif, semaines_apres_plantation: e.target.value })}
                      style={{ fontSize: 11, padding: '4px 6px', border: '1px solid var(--trait)' }}>
                      {Array.from({ length: 31 }, (_, s) => s).map(s => <option key={s} value={s}>Sem. +{s} (sem. {(traitement.series?.semaine_plantation || 0) + s})</option>)}
                    </select>
                    <button onClick={enregistrerModif} style={{ padding: '5px 10px', fontSize: 11, border: 'none', background: 'var(--accent)', color: 'var(--papier)', cursor: 'pointer' }}>OK</button>
                    <button onClick={() => setEnModif(null)} style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--trait)', background: 'var(--fond)', cursor: 'pointer' }}>Annuler</button>
                    <button onClick={() => supprimerPassage(traitement)} style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--rouge-clair)', background: 'var(--rouge-pale)', color: 'var(--rouge)', cursor: 'pointer' }}>Supprimer</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEnModif({ id: traitement.id, type_traitement_id: traitement.type_traitement_id, semaines_apres_plantation: traitement.semaines_apres_plantation })}
                      style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--trait-leger)', background: 'var(--fond)', color: 'var(--encre-douce)', cursor: 'pointer' }}>
                      Modifier
                    </button>
                    <button onClick={() => toggleFait(traitement)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, border: `1px solid ${suivi?.fait ? 'var(--vert)' : 'var(--trait-leger)'}`, borderRadius: 0, cursor: 'pointer', background: suivi?.fait ? 'var(--vert-pale)' : 'var(--fond)', color: suivi?.fait ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                      <Check size={12} />
                      {suivi?.fait ? `Fait le ${suivi.date_reelle}` : 'À faire'}
                    </button>
                  </>
                )}
              </div>
            )
            }),
          ])}
          {aVenir.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucun traitement à venir — ajoutez des traitements dans vos séries
            </div>
          )}
        </div>
      )}

      {vue === 'suivi' && (
        <div>
          <p style={{ fontSize: 13, margin: '0 0 10px' }}>Saison {ANNEE}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Total traitements planifiés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>{traitementsSaison.length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Traitements effectués</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent)' }}>{traitementsSaison.filter(t => getSuivi(t.id)?.fait).length}</div>
            </div>
            <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 4 }}>Produits utilisés</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--encre)' }}>
                {new Set(traitementsSaison.map(t => t.type_traitement_id)).size}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
              Détail par série
            </div>
            {series.filter(serie => serie.annee === ANNEE).map(serie => {
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