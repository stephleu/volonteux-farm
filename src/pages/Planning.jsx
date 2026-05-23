import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Bell } from 'lucide-react'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function getSemaineToDate(semaine, annee = 2026) {
  const d = new Date(annee, 0, 1 + (semaine - 1) * 7)
  return d
}

function getMoisFromSemaine(semaine) {
  return getSemaineToDate(semaine).getMonth()
}

function getSaisonFromSemaine(semaine) {
  if (semaine <= 9) return 'hiver'
  if (semaine <= 22) return 'printemps'
  if (semaine <= 39) return 'ete'
  return 'automne'
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
  const [semaineCourante] = useState(21)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase
      .from('series')
      .select('*, legumes(nom, familles(couleur)), varietes(nom)')
      .order('semaine_plantation')
    setSeries(data || [])
    setLoading(false)
  }

  const seriesFiltrees = series.filter(s => {
    if (filtreFournisseur !== 'tous' && s.fournisseur !== filtreFournisseur) return false
    if (filtreType !== 'tous' && s.type !== filtreType) return false
    return true
  })

  const seriesParMois = MOIS.map((mois, i) => ({
    mois,
    index: i,
    series: seriesFiltrees.filter(s => s.semaine_plantation && getMoisFromSemaine(s.semaine_plantation) === i)
  })).filter(m => m.series.length > 0)

  const seriesParSemaine = seriesFiltrees.reduce((acc, s) => {
    const sem = s.semaine_plantation
    if (!sem) return acc
    if (!acc[sem]) acc[sem] = []
    acc[sem].push(s)
    return acc
  }, {})

  const semaines = Object.keys(seriesParSemaine).map(Number).sort((a, b) => a - b)

  const alertes = series.filter(s => {
    if (!s.semaine_plantation) return false
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
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Planning plantation</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Saison 2026 · {series.length} séries planifiées</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {[['semaine', 'Par semaine'], ['mois', 'Par mois'], ['fournisseur', 'Fournisseurs'], ['alertes', 'Alertes']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? '#1D9E75' : '#f9fafb', color: vue === v ? '#fff' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={filtreFournisseur} onChange={e => setFiltreFournisseur(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <option value="tous">Tous fournisseurs</option>
          <option value="Desbos">Desbos</option>
          <option value="Pépinière interne">Pépinière interne</option>
          <option value="Semis direct">Semis direct</option>
        </select>
        <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <option value="tous">Plants + Semis</option>
          <option value="plant">Plants seulement</option>
          <option value="semis">Semis seulement</option>
        </select>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      {vue === 'semaine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {semaines.map(sem => {
            const seriesSem = seriesParSemaine[sem]
            const semainesPrepa = getSemainesPrepa(sem)
            const semaineDebutPrepa = sem - semainesPrepa
            const urgence = semaineDebutPrepa <= semaineCourante + 1
            const date = getSemaineToDate(sem, 2026)
            const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
            const totalPlants = seriesSem.filter(s => s.type === 'plant').reduce((acc, s) => acc + (s.nombre_plants || 0), 0)
            return (
              <div key={sem} style={{ background: '#fff', border: `1px solid ${urgence ? '#fcd34d' : '#e5e7eb'}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: urgence ? '#fffbeb' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {urgence && <AlertTriangle size={14} color="#d97706" />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Semaine {sem}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{dateStr}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {totalPlants > 0 && <span style={{ fontSize: 11, color: '#6b7280' }}>{totalPlants} plants</span>}
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Prépa sol avant sem. {semaineDebutPrepa} ({semainesPrepa} sem.)</span>
                  </div>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  {seriesSem.map((serie, i) => {
                    const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < seriesSem.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#111', flex: 1 }}>
                          {serie.legumes?.nom}
                          {serie.varietes?.nom && <span style={{ color: '#6b7280' }}> · {serie.varietes.nom}</span>}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: serie.type === 'plant' ? '#fef3c7' : '#ede9fe', color: serie.type === 'plant' ? '#92400e' : '#5b21b6' }}>
                          {serie.type === 'plant' ? 'Plant' : 'Semis'}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: serie.fournisseur === 'Desbos' ? '#E6F1FB' : serie.fournisseur === 'Pépinière interne' ? '#EAF3DE' : '#f3f4f6', color: serie.fournisseur === 'Desbos' ? '#0C447C' : serie.fournisseur === 'Pépinière interne' ? '#27500A' : '#6b7280' }}>
                          {serie.fournisseur}
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{serie.longueur_metres}m</span>
                        {serie.nombre_plants && <span style={{ fontSize: 12, color: '#6b7280' }}>{serie.nombre_plants} plants</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {semaines.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
              Aucune série avec semaine de plantation définie
            </div>
          )}
        </div>
      )}

      {vue === 'mois' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {seriesParMois.map(({ mois, series: seriesMois }) => (
            <div key={mois} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 500, color: '#111' }}>
                {mois} · {seriesMois.length} plantation{seriesMois.length > 1 ? 's' : ''}
              </div>
              <div style={{ padding: '8px 14px' }}>
                {seriesMois.map((serie, i) => {
                  const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < seriesMois.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                      <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 50 }}>Sem. {serie.semaine_plantation}</span>
                      <span style={{ fontSize: 13, color: '#111', flex: 1 }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: serie.type === 'plant' ? '#fef3c7' : '#ede9fe', color: serie.type === 'plant' ? '#92400e' : '#5b21b6' }}>
                        {serie.type === 'plant' ? 'Plant' : 'Semis'}
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{serie.longueur_metres}m</span>
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
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#E6F1FB', borderBottom: '1px solid #b5d4f4', fontSize: 13, fontWeight: 500, color: '#0C447C' }}>
              Desbos · {commandesDesbos.length} séries
            </div>
            <div style={{ padding: '8px 14px' }}>
              {commandesDesbos.map((serie, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < commandesDesbos.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: 12 }}>
                  <span style={{ color: '#9ca3af', minWidth: 50 }}>Sem. {serie.semaine_plantation}</span>
                  <span style={{ flex: 1, color: '#111' }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                  <span style={{ color: '#6b7280' }}>{serie.longueur_metres}m</span>
                  {serie.nombre_plants && <span style={{ color: '#0C447C', fontWeight: 500 }}>{serie.nombre_plants} plants</span>}
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid #e5e7eb', fontSize: 12, fontWeight: 500, color: '#0C447C' }}>
                Total : {commandesDesbos.reduce((acc, s) => acc + (s.nombre_plants || 0), 0)} plants
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#EAF3DE', borderBottom: '1px solid #c0dd97', fontSize: 13, fontWeight: 500, color: '#27500A' }}>
              Pépinière interne · {commandesPepi.length} séries
            </div>
            <div style={{ padding: '8px 14px' }}>
              {commandesPepi.map((serie, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < commandesPepi.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: 12 }}>
                  <span style={{ color: '#9ca3af', minWidth: 50 }}>Sem. {serie.semaine_plantation}</span>
                  <span style={{ flex: 1, color: '#111' }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                  <span style={{ color: '#6b7280' }}>{serie.longueur_metres}m</span>
                  {serie.nombre_plants && <span style={{ color: '#27500A', fontWeight: 500 }}>{serie.nombre_plants} plants</span>}
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid #e5e7eb', fontSize: 12, fontWeight: 500, color: '#27500A' }}>
                Total : {commandesPepi.reduce((acc, s) => acc + (s.nombre_plants || 0), 0)} plants
              </div>
            </div>
          </div>
        </div>
      )}

      {vue === 'alertes' && (
        <div>
          {alertes.length === 0 ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 20, fontSize: 13, color: '#166534' }}>
              ✓ Aucune alerte urgente cette semaine
            </div>
          ) : alertes.map((serie, i) => {
            const semainesPrepa = getSemainesPrepa(serie.semaine_plantation)
            const semaineDebutPrepa = serie.semaine_plantation - semainesPrepa
            const couleur = serie.legumes?.familles?.couleur || '#1D9E75'
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 3 }}>
                    {serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
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