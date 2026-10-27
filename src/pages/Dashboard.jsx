import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { semaineCourante, anneeCourante } from '../lib/dates'
import { AlertTriangle, Bell, Tractor, Sprout, Shield } from 'lucide-react'

const SEMAINE_COURANTE = semaineCourante()
const ANNEE = anneeCourante()

function getSemainesPrepa(semaine) {
  if (semaine <= 9 || semaine >= 44) return 5
  return 3
}

export default function Dashboard() {
  const [series, setSeries] = useState([])
  const [fertilisations, setFertilisations] = useState([])
  const [traitements, setTraitements] = useState([])
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: s }, { data: f }, { data: t }, { data: c }] = await Promise.all([
      supabase.from('series').select('*, legumes(nom, familles(couleur))').eq('annee', ANNEE).order('semaine_plantation'),
      supabase.from('serie_fertilisations').select('*, series!inner(nom, annee, semaine_plantation, longueur_metres, legumes(nom))').eq('series.annee', ANNEE),
      supabase.from('serie_traitements').select('*, series!inner(nom, annee, semaine_plantation, legumes(nom)), types_traitement(nom)').eq('series.annee', ANNEE),
      supabase.from('mercuriale_commandes')
        .select('*, mercuriale_epiceries(nom), mercuriale_lignes(*, mercuriale_produits(nom, variete, unite, nombre_par_colis))')
        .in('statut', ['en_attente', 'confirmee'])
        .order('date_commande', { ascending: false }),
    ])
    setSeries(s || [])
    setFertilisations(f || [])
    setTraitements(t || [])
    setCommandes(c || [])
    setLoading(false)
  }

  const seriesImminentes = series.filter(s =>
    s.semaine_plantation === SEMAINE_COURANTE
  )

  const alertesPrepa = series.filter(s => {
    if (!s.semaine_plantation) return false
    const debutPrepa = s.semaine_plantation - getSemainesPrepa(s.semaine_plantation)
    return debutPrepa <= SEMAINE_COURANTE + 1 && debutPrepa >= SEMAINE_COURANTE - 1
  })

  // Grouper les alertes prépa par semaine de plantation
  const semaisnesPrepaGroupees = [...new Set(alertesPrepa.map(s => s.semaine_plantation))].sort((a, b) => a - b)

  const alertesFerti = fertilisations.filter(f => {
    const sem = (f.series?.semaine_plantation || 0) + f.semaines_apres_plantation
    return sem >= SEMAINE_COURANTE - 1 && sem <= SEMAINE_COURANTE + 2
  })

  const alertesTraitement = traitements.filter(t => {
    const sem = (t.series?.semaine_plantation || 0) + t.semaines_apres_plantation
    return sem >= SEMAINE_COURANTE - 1 && sem <= SEMAINE_COURANTE + 2
  })

  const totalAlertes = alertesPrepa.length + alertesFerti.length + alertesTraitement.length
  const statutLabel = { en_attente: 'En attente', confirmee: 'Confirmée' }
  const statutCouleur = { en_attente: '#fff09e', confirmee: '#9dca9a' }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>Semaine {SEMAINE_COURANTE} · saison {ANNEE}</p>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {/* COMMANDES EN COURS */}
      {commandes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre)', marginBottom: 10 }}>
            Commandes en cours · {commandes.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {commandes.map(commande => (
              <div key={commande.id} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--fond)', borderBottom: '1px solid var(--trait)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>{commande.mercuriale_epiceries?.nom}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--encre-douce)' }}>{new Date(commande.date_commande).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 0, background: statutCouleur[commande.statut] + '44', color: 'var(--encre)' }}>
                      {statutLabel[commande.statut]}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '0 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', padding: '6px 0', borderBottom: '1px solid var(--trait-leger)', fontSize: 11, color: 'var(--encre-pale)', fontWeight: 500 }}>
                    <span>Produit</span>
                    <span style={{ textAlign: 'center' }}>Unité / colis</span>
                    <span style={{ textAlign: 'right' }}>Qté colis</span>
                  </div>
                  {(commande.mercuriale_lignes || []).map((l, i) => {
                    const p = l.mercuriale_produits
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', padding: '6px 0', borderBottom: '1px solid var(--trait-leger)', fontSize: 12 }}>
                        <span style={{ color: 'var(--encre)' }}>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''}</span>
                        <span style={{ textAlign: 'center', color: 'var(--encre-douce)' }}>{p?.nombre_par_colis} {p?.unite === 'kg' ? 'kg' : 'pièces'}</span>
                        <span style={{ textAlign: 'right', fontWeight: 500, color: 'var(--encre)' }}>{l.quantite_colis}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALERTES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          {alertesPrepa.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Tractor size={14} color="#9a6a00" />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Préparation sol urgente</span>
              </div>
              {semaisnesPrepaGroupees.map(sem => {
                const seriesSem = alertesPrepa.filter(s => s.semaine_plantation === sem)
                const blocs = [...new Set(seriesSem.map(s => s.legumes?.nom))].join(', ')
                return (
                  <div key={sem} style={{ display: 'flex', gap: 10, padding: '9px 12px', background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', borderRadius: 0, marginBottom: 6 }}>
                    <AlertTriangle size={14} color="#9a6a00" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)' }}>
                        Plantation sem. {sem} · prépa avant sem. {sem - getSemainesPrepa(sem)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>{seriesSem.length} série{seriesSem.length > 1 ? 's' : ''} concernée{seriesSem.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {seriesImminentes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Bell size={14} color="#1a3e76" />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Plantations cette semaine</span>
              </div>
              <div style={{ background: 'var(--bleu-pale)', border: '1px solid var(--bleu-clair)', borderRadius: 0, padding: '8px 12px' }}>
                {seriesImminentes.map((serie, i) => {
                  const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < seriesImminentes.length - 1 ? '1px solid var(--bleu-pale)' : 'none' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--encre)', flex: 1 }}>{serie.legumes?.nom}</span>
                      <span style={{ fontSize: 11, color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {alertesPrepa.length === 0 && seriesImminentes.length === 0 && !loading && (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 16, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucune alerte plantation cette semaine
            </div>
          )}
        </div>

        <div>
          {alertesFerti.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sprout size={14} color="#3f7a3b" />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Fertilisations à faire</span>
              </div>
              {alertesFerti.map((f, i) => (
                <div key={i} style={{ padding: '9px 12px', background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)' }}>{f.series?.legumes?.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>
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
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Traitements à faire</span>
              </div>
              {alertesTraitement.map((t, i) => (
                <div key={i} style={{ padding: '9px 12px', background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 0, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)' }}>{t.series?.legumes?.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--encre-douce)' }}>
                    Sem. {(t.series?.semaine_plantation || 0) + t.semaines_apres_plantation} · {t.types_traitement?.nom}
                  </div>
                </div>
              ))}
            </div>
          )}

          {alertesFerti.length === 0 && alertesTraitement.length === 0 && !loading && (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 16, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucune fertilisation ni traitement urgent
            </div>
          )}
        </div>
      </div>
    </div>
  )
}