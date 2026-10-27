// Génère le plan de culture 2027 à partir de 2026, en suivant les rotations.
//
//   node scripts/plan-2027.mjs            → simulation, rien n'est écrit
//   node scripts/plan-2027.mjs --apply    → crée les séries et placements 2027
//   node scripts/plan-2027.mjs --effacer  → supprime tout ce que ce script a créé
//
// Plein champ : chaque bloc reçoit en 2027 les cultures du bloc qui avait sa rotation en 2026
// (vérifié contre rotations_planifiees). Les séries gardent leurs mètres et leurs dates
// (décalées de 52 semaines, donc même semaine et même jour), et sont posées planche par
// planche sur le bloc cible en respectant les successions.
// Serres : chaque serre reprend telle quelle le contenu d'une serre d'une année précédente
// (même géométrie : 4 planches de 50 m), selon SERRES_2027.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const ANNEE = 2027
const MARQUE = 'Plan 2027 généré'
const APPLIQUER = process.argv.includes('--apply')
const EFFACER = process.argv.includes('--effacer')

const sourceClient = fs.readFileSync(path.join(ICI, '../src/lib/supabase.js'), 'utf8')
// Depuis la sécurisation de la base, les scripts ont besoin de la clé « service_role »
// (Supabase > Project Settings > API), passée en variable d'environnement, jamais écrite dans le code
const supabase = createClient(
  sourceClient.match(/supabaseUrl = '([^']+)'/)[1],
  process.env.SUPABASE_SERVICE_ROLE_KEY || sourceClient.match(/supabaseKey = '([^']+)'/)[1],
)

const GROUPES = {
  A: ['A1', 'A2'], B: ['B1', 'B2', 'B3'], C: ['C'],
  D: ['D'], E: ['E'], F: ['F1', 'F2'], G: ['G'], H: ['H1', 'H2'],
}
// Groupe cible 2027 ← groupe source 2026 (même rotation)
const BLOCS_2027 = { A: 'C', B: 'A', C: 'B', D: 'H', E: 'D', F: 'E', G: 'F', H: 'G' }

// Serre cible 2027 ← serre et année sources (cf. tableau d'assolement des serres)
const SERRES_2027 = {
  S1: { serre: 'S5', annee: 2026, quoi: 'petites cultures de S5' },
  S2: { serre: 'S3', annee: 2025, quoi: 'p. de t. 3 · courgette 34' },
  S3: { serre: 'S1', annee: 2026, quoi: 'courgette 16 · haricot / concombre' },
  S4: { serre: 'S2', annee: 2026, quoi: 'tomate 24 · haricot' },
  S5: { serre: 'S3', annee: 2026, quoi: 'aubergine · poivron' },
  S6: { serre: 'S7', annee: 2026, quoi: 'courgette 12' },
  S7: { serre: 'S6', annee: 2026, quoi: 'tomate 11/13' },
  S8: { serre: 'S4', annee: 2026, quoi: 'petites cultures de S4' },
}

async function tout(table, select = '*') {
  const lignes = []
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(debut, debut + 999)
    if (error) throw new Error(`${table} : ${error.message}`)
    lignes.push(...data)
    if (data.length < 1000) return lignes
  }
}

async function inserer(table, lignes) {
  const crees = []
  for (let i = 0; i < lignes.length; i += 200) {
    const { data, error } = await supabase.from(table).insert(lignes.slice(i, i + 200)).select()
    if (error) throw new Error(`insertion ${table} : ${error.message}`)
    crees.push(...data)
  }
  return crees
}

if (EFFACER) {
  const { error: e1, count: nc } = await supabase.from('cultures').delete({ count: 'exact' }).eq('notes', MARQUE)
  const { error: e2, count: ns } = await supabase.from('series').delete({ count: 'exact' }).eq('notes', MARQUE)
  if (e1 || e2) throw new Error((e1 || e2).message)
  console.log(`Effacé : ${ns} séries et ${nc} placements « ${MARQUE} ».`)
  process.exit(0)
}

const decaler = (date, ans) => {
  if (!date) return null
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 364 * ans)
  return d.toISOString().slice(0, 10)
}

const [blocs, planches, series, cultures, rotations] = await Promise.all([
  tout('blocs'), tout('planches'), tout('series'), tout('cultures'), tout('rotations_planifiees'),
])
if (series.some(s => s.annee === ANNEE && s.notes === MARQUE)) {
  console.error(`Un plan ${ANNEE} généré existe déjà : lancer d'abord --effacer.`)
  process.exit(1)
}

const blocParNom = new Map(blocs.map(b => [b.nom, b]))
const blocDe = new Map(planches.map(p => [p.id, blocs.find(b => b.id === p.bloc_id)]))
const serieParId = new Map(series.map(s => [s.id, s]))
const longueur = p => Number(p.longueur) || 50
const planchesDe = noms => noms.flatMap(n => planches.filter(p => p.bloc_id === blocParNom.get(n)?.id).sort((a, b) => a.numero - b.numero))

const rapport = []
const manques = []
const nouvellesSeries = []   // { ligne, placements: [{ planche, position, longueur, debut, fin, premiere }] }

// Occupation des planches cibles : on tient compte de ce qui y est déjà (ex. mâche plantée fin 2026)
const occupation = new Map()
for (const c of cultures) {
  if (!c.date_plantation || !c.date_fin_prevue) continue
  const liste = occupation.get(c.planche_id) || []
  liste.push({ debut: c.date_plantation, fin: c.date_fin_prevue, position: Number(c.position_debut) || 0, longueur: Number(c.longueur_metres) })
  occupation.set(c.planche_id, liste)
}

// Plus grand créneau libre d'une planche sur une période : [position, longueur]
function creneauLibre(planche, debut, fin) {
  const pris = (occupation.get(planche.id) || [])
    .filter(o => o.debut <= fin && debut <= o.fin)
    .sort((a, b) => a.position - b.position)
  let meilleur = [0, 0]
  let curseur = 0
  for (const o of pris) {
    if (o.position - curseur > meilleur[1]) meilleur = [curseur, o.position - curseur]
    curseur = Math.max(curseur, o.position + o.longueur)
  }
  if (longueur(planche) - curseur > meilleur[1]) meilleur = [curseur, longueur(planche) - curseur]
  return meilleur
}

function occuper(planche, position, metres, debut, fin) {
  occupation.set(planche.id, [...(occupation.get(planche.id) || []), { debut, fin, position, longueur: metres }])
}

function serie2027(source, metres, ans = 1) {
  return {
    legume_id: source.legume_id,
    variete_id: source.variete_id,
    nom: source.nom,
    fournisseur: source.fournisseur,
    type: source.type,
    longueur_metres: metres,
    semaine_plantation: source.semaine_plantation,
    annee: ANNEE,
    nombre_plants: source.espacement_plants ? Math.round((metres * 100 / source.espacement_plants) * source.rangs) : null,
    date_plantation: decaler(source.date_plantation, ans),
    premiere_recolte: decaler(source.premiere_recolte, ans),
    derniere_recolte: decaler(source.derniere_recolte, ans),
    rangs: source.rangs,
    espacement_plants: source.espacement_plants,
    sous_abri: source.sous_abri,
    notes: MARQUE,
  }
}

// ---------- Plein champ ----------

const premierSousBloc = g => blocParNom.get(GROUPES[g][0])?.id
const rotation = (g, annee) => rotations.find(r => r.bloc_id === premierSousBloc(g) && r.annee === annee)?.description

for (const [cible, source] of Object.entries(BLOCS_2027)) {
  const voulu = rotation(cible, ANNEE)
  const fourni = rotation(source, ANNEE - 1)
  if (voulu !== fourni) {
    console.error(`Rotation incohérente : ${cible} attend « ${voulu} » en ${ANNEE} mais ${source} avait « ${fourni} » en ${ANNEE - 1}`)
    process.exit(1)
  }

  // Mètres de chaque série 2026 posés dans le groupe source
  const nomsSource = new Set(GROUPES[source])
  const metresParSerie = new Map()
  for (const c of cultures) {
    if (c.annee !== ANNEE - 1 || !c.serie_id || !nomsSource.has(blocDe.get(c.planche_id)?.nom)) continue
    metresParSerie.set(c.serie_id, (metresParSerie.get(c.serie_id) || 0) + Number(c.longueur_metres))
  }
  const aPlacer = [...metresParSerie].map(([id, metres]) => ({ source: serieParId.get(id), metres }))
    .sort((a, b) => (a.source.date_plantation || '').localeCompare(b.source.date_plantation || '') || b.metres - a.metres)

  const planchesCible = planchesDe(GROUPES[cible])
  const capacite = planchesCible.reduce((acc, p) => acc + longueur(p), 0)
  let place = 0
  let perdu = 0
  for (const { source: s, metres } of aPlacer) {
    const ligne = serie2027(s, metres)
    const debut = ligne.date_plantation
    const fin = ligne.derniere_recolte || debut
    const placements = []
    let reste = metres
    for (const planche of planchesCible) {
      if (reste <= 0) break
      const [position, libre] = creneauLibre(planche, debut, fin)
      if (libre < 1) continue
      const m = Math.min(reste, libre)
      occuper(planche, position, m, debut, fin)
      placements.push({ planche, position, longueur: m, debut, fin, premiere: ligne.premiere_recolte })
      reste -= m
    }
    if (reste > 0) {
      // Le reste devient une série à part, sans emplacement, à placer à la main (ex. bloc I)
      manques.push(`${cible} : ${s.nom} — ${reste} m sur ${metres} ne rentrent pas`)
      ligne.longueur_metres = metres - reste
      ligne.nombre_plants = s.espacement_plants ? Math.round((ligne.longueur_metres * 100 / s.espacement_plants) * s.rangs) : null
      nouvellesSeries.push({ ligne: serie2027(s, reste), placements: [] })
      perdu += reste
    }
    place += metres - reste
    if (placements.length) nouvellesSeries.push({ ligne, placements })
  }
  rapport.push(`${cible.padEnd(2)} ← ${source} 2026 · ${voulu} : ${aPlacer.length} séries, ${place} m posés${perdu ? `, ${perdu} m qui ne rentrent pas` : ''} (bloc de ${planchesCible.length} planches, ${capacite} m)`)
}

// ---------- Serres ----------

for (const [cible, { serre, annee, quoi }] of Object.entries(SERRES_2027)) {
  const planchesSource = planchesDe([serre])
  const planchesCible = planchesDe([cible])
  const ans = ANNEE - annee
  const parSerie = new Map()
  for (const c of cultures) {
    if (c.annee !== annee || !c.serie_id) continue
    const i = planchesSource.findIndex(p => p.id === c.planche_id)
    if (i < 0) continue
    if (!planchesCible[i]) { manques.push(`${cible} : pas de planche n°${planchesSource[i].numero}`); continue }
    const debut = decaler(c.date_plantation, ans)
    const fin = decaler(c.date_fin_prevue, ans) || debut
    const entree = parSerie.get(c.serie_id) || { metres: 0, placements: [] }
    entree.metres += Number(c.longueur_metres)
    entree.placements.push({ planche: planchesCible[i], position: Number(c.position_debut) || 0, longueur: Number(c.longueur_metres), debut, fin, premiere: decaler(c.premiere_recolte, ans) })
    parSerie.set(c.serie_id, entree)
  }
  for (const [id, { metres, placements }] of parSerie) {
    nouvellesSeries.push({ ligne: serie2027(serieParId.get(id), metres, ans), placements })
  }
  rapport.push(`${cible} ← ${serre} ${annee} · ${quoi} : ${parSerie.size} séries, ${[...parSerie.values()].reduce((a, e) => a + e.metres, 0)} m`)
}

// ---------- Séries 2026 jamais placées : reprises en 2027, sans emplacement ----------

const placees = new Set(cultures.map(c => c.serie_id))
const nonPlacees = series.filter(s => s.annee === ANNEE - 1 && !placees.has(s.id))
for (const s of nonPlacees) nouvellesSeries.push({ ligne: serie2027(s, Number(s.longueur_metres)), placements: [] })
rapport.push(`Séries 2026 sans emplacement, reprises en 2027 sans emplacement : ${nonPlacees.length}`)
rapport.push(`Bloc I et serre S9 (Dav) : rien de prévu, laissés vides`)

console.log(rapport.join('\n'))
console.log(`\nTotal : ${nouvellesSeries.length} séries, ${nouvellesSeries.reduce((a, s) => a + s.placements.length, 0)} placements`)
console.log(`\nCe qui ne rentre pas (${manques.length}) :`)
console.log(manques.map(m => '  - ' + m).join('\n') || '  rien')

if (!APPLIQUER) {
  console.log('\nSimulation uniquement. Relancer avec --apply pour créer le plan 2027.')
  process.exit(0)
}

const saison = semaine => (semaine <= 9 ? 'hiver' : semaine <= 22 ? 'printemps' : semaine <= 39 ? 'ete' : 'automne')
const creees = await inserer('series', nouvellesSeries.map(s => s.ligne))
await inserer('cultures', nouvellesSeries.flatMap((s, i) => s.placements.map(p => ({
  planche_id: p.planche.id,
  legume_id: s.ligne.legume_id,
  variete_id: s.ligne.variete_id,
  serie_id: creees[i].id,
  type: 'prevu',
  statut: 'en_culture',
  date_plantation: p.debut,
  date_fin_prevue: p.fin,
  premiere_recolte: p.premiere,
  longueur_metres: p.longueur,
  position_debut: p.position,
  saison: saison(s.ligne.semaine_plantation || 14),
  annee: ANNEE,
  notes: MARQUE,
}))))
console.log(`\nPlan ${ANNEE} créé.`)
