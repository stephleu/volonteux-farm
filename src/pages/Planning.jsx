import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { semaineCourante as calculSemaineCourante, anneeCourante, getSaison as getSaisonFromSemaine } from '../lib/dates'
import { AlertTriangle } from 'lucide-react'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ANNEE = anneeCourante()
const ANNEES = [2025, 2026, 2027, 2028]

function getSemaineToDate(semaine, annee = ANNEE) {
  const d = new Date(annee, 0, 1 + (semaine - 1) * 7)
  return d
}

function getMoisFromSemaine(semaine, annee) {
  return getSemaineToDate(semaine, annee).getMonth()
}

function getSemainesPrepa(semaine) {
  const saison = getSaisonFromSemaine(semaine)
  return saison === 'hiver' ? 5 : 3
}

export default function Planning() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('semaine')
  const [filtreFournisseur, setFiltreFournisseur] = useState('tous')
  const [filtreType, setFiltreType] = useState('tous')
  const [semaineCourante] = useState(calculSemaineCourante)
  const [voirTout, setVoirTout] = useState(false)
  const [annee, setAnnee] = useState(ANNEE)
  // Masquer les semaines passées n'a de sens que pour l'année en cours
  const masquerPassees = annee === ANNEE && !voirTout

  useEffect(() => { fetchData() }, [annee])

  async function fetchData() {
    // Séries de l'année déjà placées dans l'assolement (au moins une culture)
    const { data } = await supabase
      .from('series')
      .select('*, legumes(nom, familles(couleur)), varietes(nom), cultures!inner(id)')
      .eq('annee', annee)
      .order('semaine_plantation')

    setSeries(data || [])
    setLoading(false)
  }

  const seriesFiltrees = series.filter(s => {
    if (filtreFournisseur !== 'tous' && s.fournisseur !== filtreFournisseur) return false
    if (filtreType !== 'tous' && s.type !== filtreType) return false
    if (masquerPassees && s.semaine_plantation && s.semaine_plantation < semaineCourante) return false
    return true
  })

  const seriesParMois = MOIS.map((mois, i) => ({
    mois,
    index: i,
    series: seriesFiltrees.filter(s => s.semaine_plantation && getMoisFromSemaine(s.semaine_plantation, annee) === i)
  })).filter(m => m.series.length > 0)

  const seriesParSemaine = seriesFiltrees.reduce((acc, s) => {
    const sem = s.semaine_plantation
    if (!sem) return acc
    if (!acc[sem]) acc[sem] = []
    acc[sem].push(s)
    return acc
  }, {})

  const semaines = Object.keys(seriesParSemaine).map(Number).sort((a, b) => a - b)

  // Les alertes ne concernent que l'année en cours
  const alertes = series.filter(s => {
    if (annee !== ANNEE || !s.semaine_plantation) return false
    const semainesPrepa = getSemainesPrepa(s.semaine_plantation)
    const semaineDebutPrepa = s.semaine_plantation - semainesPrepa
    return semaineDebutPrepa <= semaineCourante + 2 && semaineDebutPrepa >= semaineCourante - 1
  })

  const commandesDesbos = seriesFiltrees.filter(s => s.fournisseur === 'Desbos')
  const commandesPepi = seriesFiltrees.filter(s => s.fournisseur === 'Pépinière interne')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Planning plantation</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>
            Saison{' '}
            <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={{ fontSize: 13, padding: '2px 6px', border: '1px solid var(--trait)', borderRadius: 0 }}>
              {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {' '}· {seriesFiltrees.length} séries{masquerPassees ? ' à venir' : ''} sur {series.length} planifiées
          </p>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          {[['semaine', 'Par semaine'], ['mois', 'Par mois'], ['fournisseur', 'Fournisseurs'], ['alertes', 'Alertes']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? 'var(--accent)' : 'var(--fond)', color: vue === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={filtreFournisseur} onChange={e => setFiltreFournisseur(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          <option value="tous">Tous fournisseurs</option>
          <option value="Desbos">Desbos</option>
          <option value="Pépinière interne">Pépinière interne</option>
          <option value="Semis direct">Semis direct</option>
        </select>
        <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          <option value="tous">Plants + Semis</option>
          <option value="plant">Plants seulement</option>
          <option value="semis">Semis seulement</option>
        </select>
        {annee === ANNEE && (
          <button onClick={() => setVoirTout(!voirTout)}
            style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: voirTout ? 'var(--accent)' : 'var(--papier)', color: voirTout ? 'var(--papier)' : 'var(--encre)' }}>
            {voirTout ? `Masquer les semaines passées (avant sem. ${semaineCourante})` : "Voir toute l'année"}
          </button>
        )}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'semaine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {semaines.map(sem => {
            const seriesSem = seriesParSemaine[sem]
            const semainesPrepa = getSemainesPrepa(sem)
            const semaineDebutPrepa = sem - semainesPrepa
            // Urgent : plantation à venir cette année et préparation du sol à commencer
            const urgence = annee === ANNEE && sem >= semaineCourante && semaineDebutPrepa <= semaineCourante + 1
            const date = getSemaineToDate(sem, annee)
            const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
            const totalPlants = seriesSem.filter(s => s.type === 'plant').reduce((acc, s) => acc + (s.nombre_plants || 0), 0)
            return (
              <div key={sem} style={{ background: 'var(--papier)', border: `1px solid ${urgence ? 'var(--jaune)' : 'var(--trait-leger)'}`, borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: urgence ? 'var(--jaune-pale)' : 'var(--fond)', borderBottom: '1px solid var(--trait)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {urgence && <AlertTriangle size={14} color="#9a6a00" />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Semaine {sem}</span>
                    <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{dateStr}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {totalPlants > 0 && <span style={{ fontSize: 11, color: 'var(--encre-douce)' }}>{totalPlants} plants</span>}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>Prépa sol avant sem. {semaineDebutPrepa} ({semainesPrepa} sem.)</span>
                  </div>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  {seriesSem.map((serie, i) => {
                    const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < seriesSem.length - 1 ? '1px solid var(--trait-leger)' : 'none' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--encre)', flex: 1 }}>
                          {serie.legumes?.nom}
                          {serie.varietes?.nom && <span style={{ color: 'var(--encre-douce)' }}> · {serie.varietes.nom}</span>}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 0, background: serie.type === 'plant' ? 'var(--jaune-pale)' : 'var(--bleu-pale)', color: serie.type === 'plant' ? 'var(--ocre)' : 'var(--bleu)' }}>
                          {serie.type === 'plant' ? 'Plant' : 'Semis'}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 0, background: serie.fournisseur === 'Desbos' ? 'var(--bleu-pale)' : serie.fournisseur === 'Pépinière interne' ? 'var(--vert-pale)' : 'var(--fond)', color: serie.fournisseur === 'Desbos' ? 'var(--bleu)' : serie.fournisseur === 'Pépinière interne' ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                          {serie.fournisseur}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                        {serie.nombre_plants && <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{serie.nombre_plants} plants</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {semaines.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucune série avec semaine de plantation définie
            </div>
          )}
        </div>
      )}

      {vue === 'mois' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {seriesParMois.map(({ mois, series: seriesMois }) => (
            <div key={mois} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--fond)', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                {mois} · {seriesMois.length} plantation{seriesMois.length > 1 ? 's' : ''}
              </div>
              <div style={{ padding: '8px 14px' }}>
                {seriesMois.map((serie, i) => {
                  const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < seriesMois.length - 1 ? '1px solid var(--trait-leger)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                      <span style={{ fontSize: 12, color: 'var(--encre-pale)', minWidth: 50 }}>Sem. {serie.semaine_plantation}</span>
                      <span style={{ fontSize: 13, color: 'var(--encre)', flex: 1 }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 0, background: serie.type === 'plant' ? 'var(--jaune-pale)' : 'var(--bleu-pale)', color: serie.type === 'plant' ? 'var(--ocre)' : 'var(--bleu)' }}>
                        {serie.type === 'plant' ? 'Plant' : 'Semis'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {vue === 'fournisseur' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bleu-pale)', borderBottom: '1px solid var(--bleu-clair)', fontSize: 13, fontWeight: 500, color: 'var(--bleu)' }}>
              Desbos · {commandesDesbos.length} séries
            </div>
            <div style={{ padding: '8px 14px' }}>
              {commandesDesbos.map((serie, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < commandesDesbos.length - 1 ? '1px solid var(--trait-leger)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--encre-pale)', minWidth: 50 }}>Sem. {serie.semaine_plantation}</span>
                  <span style={{ flex: 1, color: 'var(--encre)' }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                  <span style={{ color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                  {serie.nombre_plants && <span style={{ color: 'var(--bleu)', fontWeight: 500 }}>{serie.nombre_plants} plants</span>}
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--trait)', fontSize: 12, fontWeight: 500, color: 'var(--bleu)' }}>
                Total : {commandesDesbos.reduce((acc, s) => acc + (s.nombre_plants || 0), 0)} plants
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--vert-pale)', borderBottom: '1px solid var(--vert)', fontSize: 13, fontWeight: 500, color: 'var(--vert-fonce)' }}>
              Pépinière interne · {commandesPepi.length} séries
            </div>
            <div style={{ padding: '8px 14px' }}>
              {commandesPepi.map((serie, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < commandesPepi.length - 1 ? '1px solid var(--trait-leger)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--encre-pale)', minWidth: 50 }}>Sem. {serie.semaine_plantation}</span>
                  <span style={{ flex: 1, color: 'var(--encre)' }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                  <span style={{ color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                  {serie.nombre_plants && <span style={{ color: 'var(--vert-fonce)', fontWeight: 500 }}>{serie.nombre_plants} plants</span>}
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--trait)', fontSize: 12, fontWeight: 500, color: 'var(--vert-fonce)' }}>
                Total : {commandesPepi.reduce((acc, s) => acc + (s.nombre_plants || 0), 0)} plants
              </div>
            </div>
          </div>
        </div>
      )}

      {vue === 'alertes' && (
        <div>
          {alertes.length === 0 ? (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 20, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucune alerte urgente cette semaine
            </div>
          ) : alertes.map((serie, i) => {
            const semainesPrepa = getSemainesPrepa(serie.semaine_plantation)
            const semaineDebutPrepa = serie.semaine_plantation - semainesPrepa
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', borderRadius: 0, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#9a6a00" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)', marginBottom: 3 }}>
                    {serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--encre-douce)' }}>
                    Plantation semaine {serie.semaine_plantation} · Début prépa sol avant semaine {semaineDebutPrepa} ({semainesPrepa} semaines minimum)
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}