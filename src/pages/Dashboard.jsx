import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { semaineCourante, anneeCourante, ecartSemaines, semaineReelle } from '../lib/dates'
import { Bell, Shield } from 'lucide-react'
import PlanchesAPreparer from '../components/PlanchesAPreparer.jsx'
import { semainesPrepa } from '../lib/travailSol'
import FertilisationsAFaire from '../components/FertilisationsAFaire.jsx'

const SEMAINE_COURANTE = semaineCourante()
const ANNEE = anneeCourante()
const ANNEES = [ANNEE - 1, ANNEE, ANNEE + 1]

// Écart en semaines entre aujourd'hui et « semaine de plantation + décalage » d'une série
const ecart = (serie, decalage = 0) => ecartSemaines(serie.annee, (serie.semaine_plantation || 0) + decalage)
// Numéro de semaine affiché, ramené dans la bonne année (sem. 54 de 2026 → sem. 2)
const semaine = (serie, decalage = 0) => semaineReelle(serie.annee, (serie.semaine_plantation || 0) + decalage)


export default function Dashboard() {
  const [series, setSeries] = useState([])
  const [traitements, setTraitements] = useState([])
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: s }, { data: t }, { data: c }, { data: st }] = await Promise.all([
      // Années voisines aussi : une plantation de décembre a ses passages en janvier, une plantation
      // de janvier a sa préparation du sol en décembre
      supabase.from('series').select('*, legumes(nom, familles(couleur))').in('annee', ANNEES).order('semaine_plantation'),
      supabase.from('serie_traitements').select('*, series!inner(nom, annee, semaine_plantation, legumes(nom)), types_traitement(nom)').in('series.annee', ANNEES),
      supabase.from('mercuriale_commandes')
        .select('*, mercuriale_epiceries(nom), mercuriale_lignes(*, mercuriale_produits(nom, variete, unite, nombre_par_colis))')
        .in('statut', ['en_attente', 'confirmee'])
        .order('date_commande', { ascending: false }),
      supabase.from('suivi_traitements').select('traitement_id').eq('fait', true),
    ])
    // Les passages déjà marqués « fait » ne sont plus des alertes
    const traitementsFaits = new Set((st || []).map(x => x.traitement_id))
    setSeries(s || [])
    setTraitements((t || []).filter(x => !traitementsFaits.has(x.id)))
    setCommandes(c || [])
    setLoading(false)
  }

  const seriesImminentes = series.filter(s => s.semaine_plantation && ecart(s) === 0)

  const alertesPrepa = series.filter(s => {
    if (!s.semaine_plantation) return false
    const debutPrepa = ecart(s, -semainesPrepa(s.semaine_plantation))
    return debutPrepa >= -1 && debutPrepa <= 1
  })

  // Traitements : aussi ceux en retard (jusqu'à 12 semaines), tant qu'ils ne sont pas marqués faits
  const alertesTraitement = traitements.filter(t => {
    const e = ecart(t.series, t.semaines_apres_plantation)
    return e >= -12 && e <= 3
  })

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
          {/* Deux commandes côte à côte (une par moitié d'écran), limité à la moitié de la hauteur, le reste défile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), calc(50% - 8px)))', gap: 16, alignItems: 'start', maxHeight: '50vh', overflowY: 'auto' }}>
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
          {/* Planches dont la plantation approche et dont le travail du sol n'est pas fini */}
          <PlanchesAPreparer />

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
          {/* Granulés à épandre : par semaine, serre ou bloc, planches, kilos et sacs */}
          <FertilisationsAFaire />

          {alertesTraitement.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Shield size={14} color="#1a3e76" />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Traitements à faire</span>
              </div>
              {alertesTraitement.map((t, i) => {
                const sem = semaine(t.series, t.semaines_apres_plantation)
                const enRetard = ecart(t.series, t.semaines_apres_plantation) < 0
                return (
                  <div key={i} style={{ padding: '9px 12px', background: enRetard ? 'var(--rouge-pale)' : 'var(--bleu-pale)', border: `1px solid ${enRetard ? 'var(--rouge-clair)' : 'var(--bleu-clair)'}`, borderRadius: 0, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)' }}>{t.series?.legumes?.nom}{t.series?.nom ? <span style={{ fontWeight: 400, color: 'var(--encre-pale)' }}> · {t.series.nom}</span> : null}</div>
                    <div style={{ fontSize: 11, color: enRetard ? 'var(--rouge)' : 'var(--encre-douce)' }}>
                      Sem. {sem} · {t.types_traitement?.nom}{enRetard ? ' · en retard' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {alertesTraitement.length === 0 && !loading && (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 16, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucun traitement urgent
            </div>
          )}
        </div>
      </div>
    </div>
  )
}