import { useState, useEffect, useRef } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { anneeCourante } from '../lib/dates'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const SEMAINES_PAR_MOIS = [4, 4, 5, 4, 4, 5, 4, 4, 4, 5, 4, 5]
const HAUTEUR_MOIS = 24
// Fenêtre de 6 mois : pour l'année en cours, elle démarre au mois actuel (au plus tard juillet → décembre)
const offsetInitial = annee => (annee === anneeCourante() ? Math.min(6, new Date().getMonth()) : 0)

export default function Assolement() {
  const [blocs, setBlocs] = useState([])
  const [planches, setPlanches] = useState([])
  const [series, setSeries] = useState([])
  const [cultures, setCultures] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('champ')
  const [ouverts, setOuverts] = useState({})
  const [offsetMois, setOffsetMois] = useState(() => offsetInitial(anneeCourante()))
  const [dragSerie, setDragSerie] = useState(null)
  const [showSeries, setShowSeries] = useState(false)
  const [cultureSelectionnee, setCultureSelectionnee] = useState(null)
  const [modifCulture, setModifCulture] = useState(null)
  const [triSeries, setTriSeries] = useState('recent')
  const [propositionDebord, setPropositionDebord] = useState(null)
  const [annee, setAnnee] = useState(anneeCourante)
  const [rechercheSerie, setRechercheSerie] = useState('')
  const [culturesSelectionnees, setCulturesSelectionnees] = useState(new Set())
  const [modeSelection, setModeSelection] = useState(false)
  const refs = useRef({})
  // Hauteur de la barre d'outils collée en haut : la barre de bloc ouverte se colle juste dessous
  const barreRef = useRef(null)
  const [hauteurBarre, setHauteurBarre] = useState(56)

  useEffect(() => {
    const el = barreRef.current
    if (!el) return
    const observateur = new ResizeObserver(() => setHauteurBarre(el.offsetHeight))
    observateur.observe(el)
    return () => observateur.disconnect()
  }, [])

  const moisAffiches = MOIS.slice(offsetMois, offsetMois + 6)
  const semaineDebut = SEMAINES_PAR_MOIS.slice(0, offsetMois).reduce((a, b) => a + b, 0) + 1
  const semaineFin = SEMAINES_PAR_MOIS.slice(0, offsetMois + 6).reduce((a, b) => a + b, 0)

  useEffect(() => { fetchData() }, [annee])

  async function fetchData() {
    const [{ data: b }, { data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('blocs').select('*').order('nom'),
      chargerTout(() => supabase.from('planches').select('*').order('numero').order('id')),
      chargerTout(() => supabase.from('series').select('*, legumes(nom, familles(couleur), espacement_plants, rangs), varietes(nom)').eq('annee', annee).order('created_at', { ascending: false }).order('id')),
      // Cultures de l'année, plus celles d'une autre saison encore en place (ex. plantée en novembre, récoltée en février)
      chargerTout(() => supabase.from('cultures').select('*, legumes(nom, familles(couleur)), varietes(nom)')
        .or(`annee.eq.${annee},and(date_plantation.lte.${annee}-12-31,date_fin_prevue.gte.${annee}-01-01)`)
        .order('date_plantation').order('id')),
    ])
    setBlocs(b || [])
    setPlanches(p || [])
    setSeries(s || [])
    setCultures(c || [])
    setLoading(false)
  }

  const seriesPlacees = new Set(cultures.map(c => c.serie_id).filter(Boolean))
  const seriesDisponibles = series
    .filter(s => !seriesPlacees.has(s.id))
    .filter(s => {
      if (!rechercheSerie) return true
      const q = rechercheSerie.toLowerCase()
      return s.legumes?.nom?.toLowerCase().includes(q) || s.varietes?.nom?.toLowerCase().includes(q) || s.nom?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (triSeries === 'alpha') return (a.legumes?.nom || '').localeCompare(b.legumes?.nom || '')
      if (triSeries === 'semaine') return (a.semaine_plantation || 0) - (b.semaine_plantation || 0)
      return 0
    })

  const blocsAffiches = blocs
    .filter(b => vue === 'champ' ? b.type !== 'serre' : b.type === 'serre')
    .sort((a, b) => a.nom.localeCompare(b.nom))

  function getSaison(semaine) {
    if (semaine <= 9) return 'hiver'
    if (semaine <= 22) return 'printemps'
    if (semaine <= 39) return 'ete'
    return 'automne'
  }

  function semaineToDate(semaine, annee) {
    const d = new Date(annee, 0, 1 + (semaine - 1) * 7)
    return d.toISOString().split('T')[0]
  }

  function getSemaineDepuisDate(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const start = new Date(annee, 0, 1)
    return Math.ceil((d - start) / (7 * 24 * 3600 * 1000))
  }

  function longueurPlanche(plancheId) {
    return Number(planches.find(p => p.id === plancheId)?.longueur) || 50
  }

  // Seules les cultures présentes sur la même période prennent de la place (successions)
  // (sans dates connues, on considère que la culture occupe la planche toute la période)
  function presentesPendant(culturesPlanche, debut, fin) {
    if (!debut || !fin) return culturesPlanche
    return culturesPlanche.filter(c => !c.date_plantation || !c.date_fin_prevue || (c.date_plantation <= fin && debut <= c.date_fin_prevue))
  }

  // Premier trou assez long pour `voulu` mètres sur la période ; à défaut, le plus grand trou.
  // Renvoie { position, libre } (libre = longueur du trou)
  function creneauLibre(plancheId, culturesPlanche, debut, fin, voulu) {
    const prises = presentesPendant(culturesPlanche, debut, fin)
      .map(c => [Number(c.position_debut) || 0, (Number(c.position_debut) || 0) + Number(c.longueur_metres || 0)])
      .sort((a, b) => a[0] - b[0])
    const trous = []
    let curseur = 0
    for (const [deb, fn] of prises) {
      if (deb > curseur) trous.push({ position: curseur, libre: deb - curseur })
      curseur = Math.max(curseur, fn)
    }
    const longueur = longueurPlanche(plancheId)
    if (longueur > curseur) trous.push({ position: curseur, libre: longueur - curseur })
    return trous.find(t => t.libre >= voulu) || trous.sort((a, b) => b.libre - a.libre)[0] || { position: 0, libre: 0 }
  }

  async function placerSerie(plancheId, serie) {
    if (!serie) return

    if (serie._deplacer) {
      // Déplacement vers une autre planche : il faut la place sur toute la période de la culture
      const autres = cultures.filter(c => c.planche_id === plancheId && c.id !== serie._cultureId)
      const { position, libre } = creneauLibre(plancheId, autres, serie.date_plantation, serie.date_fin_prevue, serie.longueur_metres)
      setDragSerie(null)
      if (libre < serie.longueur_metres) {
        alert(`Pas assez de place sur cette planche : ${libre} m libres pour ${serie.longueur_metres} m.`)
        return
      }
      await supabase.from('cultures').update({ planche_id: plancheId, position_debut: position }).eq('id', serie._cultureId)
      fetchData()
      return
    }

    const saison = getSaison(serie.semaine_plantation || 14)
    const bloc = blocs.find(b => planches.find(p => p.id === plancheId && p.bloc_id === b.id))
    const lieu = bloc?.type === 'serre' ? 'serre' : 'exterieur'
    const { data: duree } = await supabase
      .from('durees_culture')
      .select('duree_semaines')
      .eq('legume_id', serie.legume_id)
      .eq('lieu', lieu)
      .eq('saison', saison)
      .single()
    const dureeSemaines = duree?.duree_semaines || 12
    const semPlantation = serie.semaine_plantation || 14
    const debut = serie.date_plantation || semaineToDate(semPlantation, annee)
    const fin = serie.derniere_recolte || semaineToDate(semPlantation + dureeSemaines, annee)
    const culturesPlanche = cultures.filter(c => c.planche_id === plancheId)
    const metresASerie = serie.longueur_metres || 50
    const { position, libre: metresDisponibles } = creneauLibre(plancheId, culturesPlanche, debut, fin, metresASerie)

    if (metresASerie > metresDisponibles) {
      const planchesBloc = planches.filter(p => p.bloc_id === bloc?.id).sort((a, b) => a.numero - b.numero)
      const indexActuel = planchesBloc.findIndex(p => p.id === plancheId)
      const plancheSuivante = planchesBloc[indexActuel + 1]
      setPropositionDebord({
        serie, plancheId, position,
        plancheSuivante: plancheSuivante || null,
        metresPlanche: metresDisponibles,
        metresDebord: metresASerie - metresDisponibles,
        debut, fin, lieu,
      })
      setDragSerie(null)
      return
    }

    await supabase.from('cultures').insert({
      planche_id: plancheId,
      legume_id: serie.legume_id,
      variete_id: serie.variete_id || null,
      serie_id: serie.id,
      type: 'prevu', statut: 'en_culture',
      date_plantation: debut,
      date_fin_prevue: fin,
      premiere_recolte: serie.premiere_recolte || null,
      longueur_metres: metresASerie,
      position_debut: position,
      saison, annee,
    })
    setDragSerie(null)
    fetchData()
  }

  async function retirerSelectionMultiple() {
    for (const id of culturesSelectionnees) {
      await supabase.from('cultures').delete().eq('id', id)
    }
    setCulturesSelectionnees(new Set())
    setModeSelection(false)
    fetchData()
  }

  async function confirmerDebord(accepter) {
    const { serie, plancheId, position, plancheSuivante, metresPlanche, metresDebord, debut, fin } = propositionDebord
    const semPlantation = serie.semaine_plantation || 14

    if (metresPlanche > 0) await supabase.from('cultures').insert({
      planche_id: plancheId,
      legume_id: serie.legume_id,
      variete_id: serie.variete_id || null,
      serie_id: serie.id,
      type: 'prevu', statut: 'en_culture',
      date_plantation: debut,
      date_fin_prevue: fin,
      premiere_recolte: serie.premiere_recolte || null,
      longueur_metres: metresPlanche,
      position_debut: position,
      saison: getSaison(semPlantation), annee,
    })

    if (accepter && plancheSuivante) {
      const bloc = blocs.find(b => planches.find(p => p.id === plancheId && p.bloc_id === b.id))
      const planchesBloc = planches.filter(p => p.bloc_id === bloc?.id).sort((a, b) => a.numero - b.numero)
      const indexSuivante = planchesBloc.findIndex(p => p.id === plancheSuivante.id)

      let resteAplacer = metresDebord
      let indexCourant = indexSuivante

      while (resteAplacer > 0 && indexCourant < planchesBloc.length) {
        const plancheActuelle = planchesBloc[indexCourant]
        const culturesActuelle = cultures.filter(c => c.planche_id === plancheActuelle.id)
        const { position: positionLibre, libre } = creneauLibre(plancheActuelle.id, culturesActuelle, debut, fin, resteAplacer)
        const metresAplacer = Math.min(resteAplacer, libre)

        if (metresAplacer > 0) {
          await supabase.from('cultures').insert({
            planche_id: plancheActuelle.id,
            legume_id: serie.legume_id,
            variete_id: serie.variete_id || null,
            serie_id: serie.id,
            type: 'prevu', statut: 'en_culture',
            date_plantation: debut,
            date_fin_prevue: fin,
            premiere_recolte: serie.premiere_recolte || null,
            longueur_metres: metresAplacer,
            position_debut: positionLibre,
            saison: getSaison(semPlantation), annee,
          })
          resteAplacer -= metresAplacer
        }
        indexCourant++
      }

      if (resteAplacer > 0) {
        alert(`Attention : il reste ${resteAplacer}m qui n'ont pas pu être placés — fin de bloc atteinte.`)
      }
    }

    setPropositionDebord(null)
    fetchData()
  }

  async function retirerCulture(id) {
    await supabase.from('cultures').delete().eq('id', id)
    setCultureSelectionnee(null)
    setModifCulture(null)
    fetchData()
  }

  async function modifierCulture(id, updates) {
    const { data: cultureActuelle } = await supabase
      .from('cultures')
      .select('*')
      .eq('id', id)
      .single()

    if (!cultureActuelle) {
      setModifCulture(null)
      setCultureSelectionnee(null)
      fetchData()
      return
    }

    const ancienneLongueur = Number(cultureActuelle.longueur_metres) || 0
    const nouvelleLongueur = updates.longueur_metres || ancienneLongueur
    const debutCulture = updates.date_plantation || cultureActuelle.date_plantation
    const finCulture = updates.date_fin_prevue || cultureActuelle.date_fin_prevue
    // Sur la planche actuelle, la culture peut s'étendre jusqu'à la prochaine culture présente en même temps
    const positionActuelle = Number(cultureActuelle.position_debut) || 0
    const voisinesApres = presentesPendant(cultures.filter(c => c.planche_id === cultureActuelle.planche_id && c.id !== id), debutCulture, finCulture)
      .map(c => Number(c.position_debut) || 0)
      .filter(p => p >= positionActuelle)
    const limite = Math.min(longueurPlanche(cultureActuelle.planche_id), ...voisinesApres)
    const longueurCorrigee = Math.min(nouvelleLongueur, Math.max(ancienneLongueur, limite - positionActuelle))

    await supabase.from('cultures').update({
      ...updates,
      longueur_metres: longueurCorrigee
    }).eq('id', id)

    // Seul ce qui n'a pas tenu sur la planche actuelle est reporté sur les suivantes
    if (nouvelleLongueur > longueurCorrigee) {
      const surplus = nouvelleLongueur - longueurCorrigee
      const plancheId = cultureActuelle.planche_id
      const bloc = blocs.find(b => planches.find(p => p.id === plancheId && p.bloc_id === b.id))
      const planchesBloc = planches.filter(p => p.bloc_id === bloc?.id).sort((a, b) => a.numero - b.numero)
      const indexActuel = planchesBloc.findIndex(p => p.id === plancheId)

      const { data: toutesLesCultures } = await supabase
        .from('cultures')
        .select('*')
        .in('planche_id', planchesBloc.map(p => p.id))

      let resteAplacer = surplus
      let indexCourant = indexActuel + 1

      while (resteAplacer > 0 && indexCourant < planchesBloc.length) {
        const plancheActuelle = planchesBloc[indexCourant]
        const culturesPlanche = (toutesLesCultures || []).filter(c => c.planche_id === plancheActuelle.id)
        const { position: positionLibre, libre } = creneauLibre(plancheActuelle.id, culturesPlanche, debutCulture, finCulture, resteAplacer)
        const metresAplacer = Math.min(resteAplacer, libre)

        if (metresAplacer > 0) {
          await supabase.from('cultures').insert({
            planche_id: plancheActuelle.id,
            legume_id: cultureActuelle.legume_id,
            variete_id: cultureActuelle.variete_id || null,
            serie_id: cultureActuelle.serie_id,
            type: updates.type || cultureActuelle.type,
            statut: updates.statut || cultureActuelle.statut,
            date_plantation: debutCulture,
            date_fin_prevue: finCulture,
            premiere_recolte: cultureActuelle.premiere_recolte,
            longueur_metres: metresAplacer,
            position_debut: positionLibre,
            saison: cultureActuelle.saison,
            annee: cultureActuelle.annee,
          })
          resteAplacer -= metresAplacer
        }
        indexCourant++
      }

      if (resteAplacer > 0) {
        alert(`Attention : il reste ${resteAplacer}m non placés — fin de bloc atteinte.`)
      }
    }

    setModifCulture(null)
    setCultureSelectionnee(null)
    fetchData()
  }

  return (
    <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 48px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div ref={barreRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'sticky', top: 0, background: 'var(--fond)', padding: '10px 0', zIndex: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Assolement</h1>
            <select value={annee} onChange={e => { const a = parseInt(e.target.value); setAnnee(a); setOffsetMois(offsetInitial(a)) }}
              style={{ fontSize: 13, padding: '5px 10px', border: '1px solid var(--trait)', borderRadius: 0 }}>
              {[2024, 2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
              {['champ', 'serres'].map(v => (
                <button key={v} onClick={() => setVue(v)} style={{ padding: '5px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: vue === v ? 'var(--accent)' : 'var(--fond)', color: vue === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
                  {v === 'champ' ? 'Plein champ' : 'Serres'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button onClick={() => {
              if (modeSelection && culturesSelectionnees.size > 0) {
                retirerSelectionMultiple()
              } else {
                setModeSelection(!modeSelection)
                setCulturesSelectionnees(new Set())
              }
            }} style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: modeSelection ? 'var(--rouge)' : 'var(--papier)', color: modeSelection ? 'var(--papier)' : 'var(--encre)' }}>
              {modeSelection ? (culturesSelectionnees.size > 0 ? `Retirer (${culturesSelectionnees.size})` : 'Annuler') : 'Sélection multiple'}
            </button>
            <button onClick={() => setShowSeries(!showSeries)} style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: showSeries ? 'var(--accent)' : 'var(--papier)', color: showSeries ? 'var(--papier)' : 'var(--encre)' }}>
              {showSeries ? 'Masquer séries' : `Placer une série (${seriesDisponibles.length})`}
            </button>
            <button onClick={() => setOffsetMois(Math.max(0, offsetMois - 1))} disabled={offsetMois === 0}
              style={{ border: '1px solid var(--trait)', borderRadius: 0, padding: '5px 8px', cursor: 'pointer', background: 'var(--papier)' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--encre)', minWidth: 140, textAlign: 'center' }}>
              {moisAffiches[0]} — {moisAffiches[moisAffiches.length - 1]} {annee}
            </span>
            <button onClick={() => setOffsetMois(Math.min(6, offsetMois + 1))} disabled={offsetMois === 6}
              style={{ border: '1px solid var(--trait)', borderRadius: 0, padding: '5px 8px', cursor: 'pointer', background: 'var(--papier)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ minWidth: 600 }}>
          {/* Ligne des mois collée sous la barre d'outils */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', height: HAUTEUR_MOIS, position: 'sticky', top: hauteurBarre, zIndex: 8, background: 'var(--fond)', borderBottom: '1px solid var(--trait)', marginBottom: 4 }}>
            <div />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {moisAffiches.map(m => (
                <div key={m} style={{ fontSize: 11, color: 'var(--encre-douce)', textAlign: 'center', borderLeft: '1px solid var(--trait)' }}>{m}</div>
              ))}
            </div>
          </div>

          {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

          {blocsAffiches.map(bloc => {
            const planchesBloc = planches.filter(p => p.bloc_id === bloc.id)
            const ouvert = ouverts[bloc.id]
            return (
              <div key={bloc.id} ref={el => refs.current[bloc.id] = el} style={{ marginBottom: 6 }}>
                <div onClick={() => setOuverts(prev => ({ ...prev, [bloc.id]: !prev[bloc.id] }))}
                  style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', cursor: 'pointer', background: 'var(--trait-leger)', borderRadius: 0, padding: '5px 8px', marginBottom: 3, ...(ouvert && { position: 'sticky', top: hauteurBarre + HAUTEUR_MOIS, zIndex: 6 }) }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Bloc {bloc.nom} {ouvert ? '▾' : '▸'}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
                    {moisAffiches.map(m => <div key={m} style={{ borderLeft: '1px solid var(--trait)', height: 18 }} />)}
                  </div>
                </div>

                {ouvert && planchesBloc.map(planche => {
                  const culturesPlanche = cultures.filter(c => c.planche_id === planche.id)
                  const hauteur = Math.max(24, culturesPlanche.length * 26)
                  return (
                    <div key={planche.id}
                      style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'flex-start', marginBottom: 2 }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); placerSerie(planche.id, dragSerie) }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--encre-douce)', paddingTop: 4 }}>
                        {bloc.nom}-{String(planche.numero).padStart(2, '0')}
                        {Number(planche.longueur) !== 50 && planche.longueur && <span style={{ color: 'var(--encre-pale)' }}> · {planche.longueur}m</span>}
                      </div>
                      <div style={{ position: 'relative', background: 'var(--fond)', borderRadius: 0, border: dragSerie ? '1px dashed var(--accent)' : '1px solid var(--trait)', height: hauteur }}>
                        {moisAffiches.map((m, i) => (
                          <div key={m} style={{ position: 'absolute', left: `${(i / 6) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--trait)' }} />
                        ))}
                        {culturesPlanche.map((culture, i) => {
                          const semDeb = getSemaineDepuisDate(culture.date_plantation)
                          const semFin = getSemaineDepuisDate(culture.date_fin_prevue)
                          if (!semDeb || !semFin) return null
                          const leftPct = ((semDeb - semaineDebut) / (semaineFin - semaineDebut + 1)) * 100
                          const widthPct = ((semFin - semDeb) / (semaineFin - semaineDebut + 1)) * 100
                          if (leftPct > 100 || leftPct + widthPct < 0) return null
                          const couleur = culture.legumes?.familles?.couleur || '#9dca9a'
                          const estSelectionnee = cultureSelectionnee?.id === culture.id
                          const estCochee = culturesSelectionnees.has(culture.id)
                          const top = i * 26 + 2
                          return (
                            <div key={culture.id}
                              draggable={!modeSelection}
                              onDragStart={e => {
                                e.stopPropagation()
                                setDragSerie({ ...culture, _deplacer: true, _cultureId: culture.id })
                              }}
                              onDragEnd={() => setDragSerie(null)}
                              onClick={e => {
                                e.stopPropagation()
                                if (modeSelection) {
                                  const newSet = new Set(culturesSelectionnees)
                                  if (newSet.has(culture.id)) newSet.delete(culture.id)
                                  else newSet.add(culture.id)
                                  setCulturesSelectionnees(newSet)
                                } else {
                                  setCultureSelectionnee(estSelectionnee ? null : culture)
                                  setModifCulture(null)
                                }
                              }}
                              style={{
                                position: 'absolute',
                                // Barre coupée aux bords de la période affichée (début et fin)
                                left: `${Math.max(0, leftPct)}%`,
                                width: `${Math.min(100, leftPct + widthPct) - Math.max(0, leftPct)}%`,
                                top, height: 22,
                                background: couleur + 'cc',
                                borderRadius: 0,
                                display: 'flex', alignItems: 'center', paddingLeft: 4,
                                cursor: modeSelection ? 'pointer' : 'grab',
                                border: estCochee ? '2px solid var(--rouge)' : estSelectionnee ? '2px solid var(--encre)' : 'none',
                                zIndex: estSelectionnee ? 5 : 1,
                                overflow: 'hidden',
                                opacity: estCochee ? 0.7 : 1,
                              }}>
                              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--papier)', whiteSpace: 'nowrap' }}>
                                {estCochee ? '✓ ' : ''}{culture.legumes?.nom}{culture.varietes?.nom ? ` · ${culture.varietes.nom}` : ''} · {culture.longueur_metres}m
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {cultureSelectionnee && !modifCulture && !modeSelection && (
        <div style={{ width: 220, background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 14, flexShrink: 0, alignSelf: 'flex-start', marginTop: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>{cultureSelectionnee.legumes?.nom}</span>
            <button onClick={() => setCultureSelectionnee(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={14} /></button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 12 }}>
            {cultureSelectionnee.varietes?.nom && <div>Variété : {cultureSelectionnee.varietes.nom}</div>}
            <div>Plantation : {cultureSelectionnee.date_plantation}</div>
            {cultureSelectionnee.premiere_recolte && <div>1re récolte : {cultureSelectionnee.premiere_recolte}</div>}
            <div>Dernière récolte : {cultureSelectionnee.date_fin_prevue}</div>
            <div>Longueur : {cultureSelectionnee.longueur_metres}m</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setModifCulture(cultureSelectionnee)}
              style={{ width: '100%', padding: '7px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', color: 'var(--encre)' }}>
              Modifier
            </button>
            <button onClick={() => retirerCulture(cultureSelectionnee.id)}
              style={{ width: '100%', padding: '7px', fontSize: 12, border: '1px solid var(--rouge-clair)', borderRadius: 0, cursor: 'pointer', background: 'var(--rouge-pale)', color: 'var(--rouge)' }}>
              Retirer
            </button>
          </div>
        </div>
      )}

      {modifCulture && (
        <div style={{ width: 240, background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 14, flexShrink: 0, alignSelf: 'flex-start', marginTop: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Modifier</span>
            <button onClick={() => setModifCulture(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={14} /></button>
          </div>
          <ModifForm culture={modifCulture} onSave={modifierCulture} onCancel={() => setModifCulture(null)} />
        </div>
      )}

      {showSeries && (
        <div style={{ width: 180, background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 10, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)', marginBottom: 6 }}>Séries à placer</div>
          <input
            value={rechercheSerie}
            onChange={e => setRechercheSerie(e.target.value)}
            placeholder="Rechercher..."
            style={{ width: '100%', fontSize: 11, padding: '4px 7px', border: '1px solid var(--trait)', borderRadius: 0, marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {[['recent', 'Récent'], ['alpha', 'A→Z'], ['semaine', 'Chrono']].map(([val, label]) => (
              <button key={val} onClick={() => setTriSeries(val)} style={{
                flex: 1, padding: '2px 0', fontSize: 9, border: '1px solid var(--trait)',
                borderRadius: 0, cursor: 'pointer',
                background: triSeries === val ? 'var(--accent)' : 'var(--fond)',
                color: triSeries === val ? 'var(--papier)' : 'var(--encre-douce)',
              }}>{label}</button>
            ))}
          </div>
          {seriesDisponibles.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--encre-pale)' }}>Aucune série</p>
          )}
          {seriesDisponibles.map(serie => {
            const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
            return (
              <div key={serie.id} draggable
                onDragStart={() => setDragSerie(serie)}
                onDragEnd={() => setDragSerie(null)}
                style={{ padding: '4px 7px', marginBottom: 3, background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 0, cursor: 'grab', opacity: dragSerie?.id === serie.id ? 0.5 : 1 }}>
                <div style={{ fontSize: 10, color: 'var(--encre)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {serie.legumes?.nom} S{serie.semaine_plantation} · {serie.longueur_metres}m
                </div>
              </div>
            )
          })}
        </div>
      )}

      {propositionDebord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--papier)', borderRadius: 0, padding: 24, width: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--encre)', marginBottom: 12 }}>Débordement détecté</div>
            <div style={{ fontSize: 13, color: 'var(--encre-douce)', marginBottom: 16, lineHeight: 1.6 }}>
              La série <strong>{propositionDebord.serie.legumes?.nom}</strong> fait <strong>{propositionDebord.serie.longueur_metres}m</strong> mais il ne reste que <strong>{propositionDebord.metresPlanche}m</strong> disponibles.
              <br /><br />
              {propositionDebord.plancheSuivante
                ? <>Les <strong>{propositionDebord.metresDebord}m</strong> restants seront placés sur les planches suivantes.</>
                : <span style={{ color: 'var(--rouge)' }}>⚠ Fin de bloc — impossible de reporter.</span>
              }
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPropositionDebord(null)}
                style={{ flex: 1, padding: '8px', fontSize: 13, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)' }}>
                Annuler
              </button>
              {propositionDebord.plancheSuivante && (
                <button onClick={() => confirmerDebord(true)}
                  style={{ flex: 1, padding: '8px', fontSize: 13, border: 'none', borderRadius: 0, cursor: 'pointer', background: 'var(--accent)', color: 'var(--papier)', fontWeight: 500 }}>
                  Confirmer + reporter
                </button>
              )}
              <button onClick={() => confirmerDebord(false)}
                style={{ flex: 1, padding: '8px', fontSize: 13, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--papier)' }}>
                {propositionDebord.metresPlanche}m seulement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModifForm({ culture, onSave, onCancel }) {
  const [datePlantation, setDatePlantation] = useState(culture.date_plantation || '')
  const [dateFinPrevue, setDateFinPrevue] = useState(culture.date_fin_prevue || '')
  const [longueur, setLongueur] = useState(culture.longueur_metres || 50)
  const [type, setType] = useState(culture.type || 'prevu')
  const [statut, setStatut] = useState(culture.statut || 'en_culture')

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Date plantation</div>
        <input type="date" value={datePlantation} onChange={e => setDatePlantation(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Date fin prévue</div>
        <input type="date" value={dateFinPrevue} onChange={e => setDateFinPrevue(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Longueur (m)</div>
        <input type="number" step="0.5" value={longueur} onChange={e => setLongueur(parseFloat(e.target.value))}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Type</div>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          <option value="prevu">Prévu</option>
          <option value="reel">Réel</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Statut</div>
        <select value={statut} onChange={e => setStatut(e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          <option value="en_culture">En culture</option>
          <option value="engrais_vert">Engrais vert</option>
          <option value="repos">Repos</option>
          <option value="termine">Terminé</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '7px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)' }}>
          Annuler
        </button>
        <button onClick={() => onSave(culture.id, { date_plantation: datePlantation, date_fin_prevue: dateFinPrevue, longueur_metres: longueur, type, statut })}
          style={{ flex: 1, padding: '7px', fontSize: 12, border: 'none', borderRadius: 0, cursor: 'pointer', background: 'var(--accent)', color: 'var(--papier)', fontWeight: 500 }}>
          Sauvegarder
        </button>
      </div>
    </div>
  )
}