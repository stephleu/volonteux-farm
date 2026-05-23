import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Bell, Tractor, Sprout, Shield } from 'lucide-react'

const SEMAINE_COURANTE = 21

function getSemainesPrepa(semaine) {
  if (semaine <= 9 || semaine >= 44) return 5
  return 3
}

export default function Dashboard() {
  const [blocs, setBlocs] = useState([])
  const [series, setSeries] = useState([])
  const [fertilisations, setFertilisations] = useState([])
  const [traitements, setTraitements] = useState([])
  const [travaux, setTravaux] = useState([])
  const [planches, setPlanches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: b }, { data: s }, { data: f }, { data: t }, { data: tr }, { data: p }] = await Promise.all([
      supabase.from('blocs').select('*').order('nom'),
      supabase.from('series').select('*, legumes(nom, familles(couleur))').order('semaine_plantation'),
      supabase.from('serie_fertilisations').select('*, series(nom, semaine_plantation, longueur_metres, legumes(nom))'),
      supabase.from('serie_traitements').select('*, series(nom, semaine_plantation, legumes(nom)), types_traitement(nom)'),
      supabase.from('travail_sol').select('*'),
      supabase.from('planches').select('*'),
    ])
    setBlocs(b || [])
    setSeries(s || [])
    setFertilisations(f || [])
    setTraitements(t || [])
    setTravaux(tr || [])
    setPlanches(p || [])
    setLoading(false)
  }

  const seriesImminentes = series.filter(s =>
    s.semaine_plantation >= SEMAINE_COURANTE &&
    s.semaine_plantation <= SEMAINE_COURANTE + 2
  )

  const alertesPrepa = series.filter(s => {
    if (!s.semaine_plantation) return false
    const debutPrepa = s.semaine_plantation - getSemainesPrepa(s.semaine_plantation)
    return debutPrepa <= SEMAINE_COURANTE + 1 && debutPrepa >= SEMAINE_COURANTE - 1
  })

  const alertesFerti = fertilisations.filter(f => {
    const sem = (f.series?.semaine_plantation || 0) + f.semaines_apres_plantation
    return sem >= SEMAINE_COURANTE - 1 && sem <= SEMAINE_COURANTE + 2
  })

  const alertesTraitement = traitements.filter(t => {
    const sem = (t.series?.semaine_plantation || 0) + t.semaines_apres_plantation
    return sem >= SEMAINE_COURANTE - 1 && sem <= SEMAINE_COURANTE + 2
  })

  const planchesPretes = planches.filter(p => {
    const etapes = ['broyer', 'fumier', 'covercrop', 'sous_soleuse', 'cultibutte', 'granules', 'vibroplanche']
    const travPlanche = travaux.filter(t => t.planche_id === p.id && t.fait)
    return travPlanche.length >= etapes.length
  }).length

  const blocsChamp = blocs.filter(b => b.type !== 'serre')
  const blocsSerre = blocs.filter(b => b.type === 'serre')

  const totalAlertes = alertesPrepa.length + alertesFerti.length + alertesTraitement.length

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Semaine {SEMAINE_COURANTE} · saison 2026</p>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Blocs plein champ</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#111' }}>{blocsChamp.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Serres</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#111' }}>{blocsSerre.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Planches prêtes</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1D9E75' }}>{planchesPretes}</div>
        </div>
        <div style={{ background: totalAlertes > 0 ? '#fffbeb' : '#fff', border: `1px solid ${totalAlertes > 0 ? '#fcd34d' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Alertes cette semaine</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: totalAlertes > 0 ? '#d97706' : '#111' }}>{totalAlertes}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          {alertesPrepa.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Tractor size={14} color="#d97706" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Préparation sol urgente</span>
              </div>
              {alertesPrepa.map((serie, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 6 }}>
                  <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{serie.legumes?.nom}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      Plantation sem. {serie.semaine_plantation} · Démarrer prépa avant sem. {serie.semaine_plantation - getSemainesPrepa(serie.semaine_plantation)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {seriesImminentes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Bell size={14} color="#3b82f6" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Plantations imminentes</span>
              </div>
              {seriesImminentes.map((serie, i) => {
                const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{serie.legumes?.nom}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>Semaine {serie.semaine_plantation} · {serie.longueur_metres}m</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {alertesPrepa.length === 0 && seriesImminentes.length === 0 && !loading && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 16, fontSize: 13, color: '#166534' }}>
              ✓ Aucune alerte plantation cette semaine
            </div>
          )}
        </div>

        <div>
          {alertesFerti.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sprout size={14} color="#1D9E75" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Fertilisations à faire</span>
              </div>
              {alertesFerti.map((f, i) => (
                <div key={i} style={{ padding: '9px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{f.series?.legumes?.nom}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Sem. {(f.series?.semaine_plantation || 0) + f.semaines_apres_plantation} · {f.dose_kg_ha} kg/ha
                  </div>
                </div>
              ))}
            </div>
          )}

          {alertesTraitement.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Shield size={14} color="#8b5cf6" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Traitements à faire</span>
              </div>
              {alertesTraitement.map((t, i) => (
                <div key={i} style={{ padding: '9px 12px', background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{t.series?.legumes?.nom}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Sem. {(t.series?.semaine_plantation || 0) + t.semaines_apres_plantation} · {t.types_traitement?.nom}
                  </div>
                </div>
              ))}
            </div>
          )}

          {alertesFerti.length === 0 && alertesTraitement.length === 0 && !loading && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 16, fontSize: 13, color: '#166534' }}>
              ✓ Aucune fertilisation ni traitement urgent
            </div>
          )}
        </div>
      </div>
    </div>
  )
}