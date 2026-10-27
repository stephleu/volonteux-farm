// Génère le plan de culture 2027 à partir de 2026, en suivant les rotations.
//
//   node scripts/plan-2027.mjs            → simulation, rien n'est écrit
//   node scripts/plan-2027.mjs --apply    → crée les séries et placements 2027
//   node scripts/plan-2027.mjs --effacer  → supprime tout ce que ce script a créé
//   node scripts/plan-2027.mjs --serres [--apply] → ne refait que les serres (plein champ inchangé)
//
// Plein champ : chaque bloc reçoit en 2027 les cultures du bloc qui avait sa rotation en 2026
// (vérifié contre rotations_planifiees). Les séries gardent leurs mètres et leurs dates
// (décalées de 52 semaines, donc même semaine et même jour), et sont posées planche par
// planche sur le bloc cible en respectant les successions.
// Serres : chaque serre reprend telle quelle le contenu d'une serre d'une année précédente
// (même géométrie : 4 planches de 50 m), voir SERRES_TOURNANTES et DAV.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const ANNEE = 2027
const MARQUE = 'Plan 2027 généré'
const APPLIQUER = process.argv.includes('--apply')
const SERRES_SEULEMENT = process.argv.includes('--serres')
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

// Serres : le contenu complet de chaque serre 2026 (S1 à S8) part d'un bloc dans une serre 2027,
// en gardant sa disposition (on peut juste permuter l'ordre des planches). L'affectation est choisie
// pour ne pas planter avant la fin des cultures d'automne 2026, ne pas remettre la même famille
// principale deux ans de suite au même endroit, et ne pas laisser une serre à sa place.
const SERRES_TOURNANTES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
// Dav (S9) : mêmes séries qu'en 2026, planches tournées (n° planche 2026 → n° planche 2027)
// 2026 : 1 concombre, 2 haricot, 3 tomate cerise → 2027 : 1 tomate cerise, 2 concombre, 3 haricot
const DAV = { serre: 'S9', planches: { 3: 1, 1: 2, 2: 3 } }

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

const [blocs, planches, series, toutesCultures, rotations, legumes] = await Promise.all([
  tout('blocs'), tout('planches'), tout('series'), tout('cultures'), tout('rotations_planifiees'), tout('legumes'),
])

// --serres : on ne refait que les serres du plan généré (le plein champ validé ne bouge pas)
const idsBlocsSerre = new Set(blocs.filter(b => b.type === 'serre').map(b => b.id))
const planchesSerre = new Set(planches.filter(p => idsBlocsSerre.has(p.bloc_id)).map(p => p.id))
const culturesAEffacer = SERRES_SEULEMENT
  ? toutesCultures.filter(c => c.notes === MARQUE && c.annee === ANNEE && planchesSerre.has(c.planche_id))
  : []
const seriesAEffacer = [...new Set(culturesAEffacer.map(c => c.serie_id))]
const idsAEffacer = new Set(culturesAEffacer.map(c => c.id))
const cultures = toutesCultures.filter(c => !idsAEffacer.has(c.id))

if (!SERRES_SEULEMENT && series.some(s => s.annee === ANNEE && s.notes === MARQUE)) {
  console.error(`Un plan ${ANNEE} généré existe déjà : lancer d'abord --effacer (ou --serres pour ne refaire que les serres).`)
  process.exit(1)
}
if (SERRES_SEULEMENT) console.log(`Serres : ${culturesAEffacer.length} placements et ${seriesAEffacer.length} séries ${ANNEE} générés seront remplacés.\n`)

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

// Pose `metres` sur les planches, dans l'ordre, dans les créneaux libres de la période
function poser(planchesCible, metres, debut, fin, premiere) {
  const placements = []
  let reste = metres
  for (const planche of planchesCible) {
    if (reste <= 0) break
    const [position, libre] = creneauLibre(planche, debut, fin)
    if (libre < 1) continue
    const m = Math.min(reste, libre)
    occuper(planche, position, m, debut, fin)
    placements.push({ planche, position, longueur: m, debut, fin, premiere })
    reste -= m
  }
  return { placements, reste }
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

for (const [cible, source] of SERRES_SEULEMENT ? [] : Object.entries(BLOCS_2027)) {
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
    const { placements, reste } = poser(planchesCible, metres, debut, fin, ligne.premiere_recolte)
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

const nomLegume = new Map(legumes.map(l => [l.id, l.nom]))
const familleLegume = new Map(legumes.map(l => [l.id, l.famille_id]))
const estChou = s => /^chou/i.test(nomLegume.get(s.legume_id) || '')
const BLOC_SALADES = 'C' // Petit maraîchage · Salade en 2027 : les choux sortent des serres et y vont
const choux = new Map() // serie_id → { source, metres }

function contenuSerre(nom) {
  const planchesSource = planchesDe([nom])
  const contenu = []
  for (const c of cultures) {
    const index = planchesSource.findIndex(p => p.id === c.planche_id)
    if (index < 0 || c.annee !== ANNEE - 1 || c.type !== 'prevu' || !c.serie_id) continue
    const s = serieParId.get(c.serie_id)
    if (estChou(s)) {
      const e = choux.get(s.id) || { source: s, metres: 0 }
      e.metres += Number(c.longueur_metres)
      choux.set(s.id, e)
      continue
    }
    const debut = decaler(c.date_plantation, 1)
    contenu.push({ c, s, index, numero: planchesSource[index].numero, debut, fin: decaler(c.date_fin_prevue, 1) || debut })
  }
  return contenu
}

// Famille et cultures principales d'une serre : ce qui occupe le plus de mètres de janvier à juillet
function principal(contenu) {
  const parFamille = new Map()
  const parLegume = new Map()
  for (const e of contenu) {
    if (e.c.date_plantation.slice(5, 7) > '07') continue
    const m = Number(e.c.longueur_metres)
    parFamille.set(familleLegume.get(e.s.legume_id), (parFamille.get(familleLegume.get(e.s.legume_id)) || 0) + m)
    parLegume.set(nomLegume.get(e.s.legume_id), (parLegume.get(nomLegume.get(e.s.legume_id)) || 0) + m)
  }
  const tri = m => [...m].sort((a, b) => b[1] - a[1])
  return { famille: tri(parFamille)[0]?.[0] ?? null, cultures: tri(parLegume).slice(0, 3).map(([n]) => n).join(' · ') || 'petites cultures' }
}

const paquets = SERRES_TOURNANTES.map(nom => {
  const contenu = contenuSerre(nom)
  return { nom, contenu, ...principal(contenu) }
})
const familleEn2026 = Object.fromEntries(paquets.map(p => [p.nom, p.famille]))

function permutations(liste) {
  if (liste.length <= 1) return [liste]
  return liste.flatMap((x, i) => permutations([...liste.slice(0, i), ...liste.slice(i + 1)]).map(r => [x, ...r]))
}

// Chevauchements si on pose le paquet dans la serre cible, planche source i → planche cible perm[i]
function chevauchements(paquet, cible, perm) {
  const planchesCible = planchesDe([cible])
  let n = 0
  for (const e of paquet.contenu) {
    const planche = planchesCible[perm[e.index]]
    if (!planche) { n += 1000; continue }
    const position = Number(e.c.position_debut) || 0
    const metres = Number(e.c.longueur_metres)
    for (const o of occupation.get(planche.id) || []) {
      if (o.debut <= e.fin && e.debut <= o.fin && o.position < position + metres && position < o.position + o.longueur) n++
    }
  }
  return n
}

// Meilleur ordre de planches pour chaque couple (paquet, serre cible)
const PERMS = permutations([0, 1, 2, 3])
const meilleur = {}
for (const paquet of paquets) {
  for (const cible of SERRES_TOURNANTES) {
    let choix = null
    for (const perm of PERMS) {
      const n = chevauchements(paquet, cible, perm)
      const garde = perm.every((x, i) => x === i) ? 0 : 1 // à égalité, on garde l'ordre des planches
      if (!choix || n * 10 + garde < choix.n * 10 + choix.garde) choix = { perm, n, garde }
    }
    const memeFamille = paquet.famille && paquet.famille === familleEn2026[cible]
    meilleur[`${paquet.nom}>${cible}`] = { ...choix, cout: choix.n * 100 + (memeFamille ? 20 : 0) + (paquet.nom === cible ? 1000 : 0) + choix.garde, memeFamille }
  }
}

// Affectation serres 2026 → serres 2027 qui minimise le coût total (8! possibilités)
let affectation = null
for (const cibles of permutations(SERRES_TOURNANTES)) {
  const cout = paquets.reduce((acc, p, i) => acc + meilleur[`${p.nom}>${cibles[i]}`].cout, 0)
  if (!affectation || cout < affectation.cout) affectation = { cibles, cout }
}

function poserCopie(contenu, planchePour, ans = 1) {
  const parSerie = new Map()
  for (const e of contenu) {
    const entree = parSerie.get(e.s.id) || { metres: 0, placements: [] }
    const planche = planchePour(e)
    entree.metres += Number(e.c.longueur_metres)
    entree.placements.push({ planche, position: Number(e.c.position_debut) || 0, longueur: Number(e.c.longueur_metres), debut: e.debut, fin: e.fin, premiere: decaler(e.c.premiere_recolte, ans) })
    occuper(planche, Number(e.c.position_debut) || 0, Number(e.c.longueur_metres), e.debut, e.fin)
    parSerie.set(e.s.id, entree)
  }
  for (const [id, { metres, placements }] of parSerie) {
    nouvellesSeries.push({ ligne: serie2027(serieParId.get(id), metres, ans), placements })
  }
}

paquets.forEach((paquet, i) => {
  const cible = affectation.cibles[i]
  const { perm, n, memeFamille } = meilleur[`${paquet.nom}>${cible}`]
  const planchesCible = planchesDe([cible])
  // Chevauchements comptés avant de poser, sinon le paquet se compterait lui-même
  poserCopie(paquet.contenu, e => planchesCible[perm[e.index]])
  const ordre = perm.every((x, j) => x === j) ? '' : ` · planches ${perm.map((x, j) => `${j + 1}→${x + 1}`).join(' ')}`
  rapport.push(`${cible} ← ${paquet.nom} 2026 · ${paquet.cultures}${ordre}${n ? ` · ⚠ ${n} chevauchement(s) avec l'automne 2026` : ''}${memeFamille ? ' · ⚠ même famille qu\'en 2026' : ''}`)
  if (n) manques.push(`${cible} : ${n} culture(s) arrivent avant la fin d'une culture d'automne 2026`)
})

// Dav (S9) : mêmes séries qu'en 2026, planches tournées
{
  const planchesCible = planchesDe([DAV.serre])
  const contenu = contenuSerre(DAV.serre)
  poserCopie(contenu, e => planchesCible.find(p => p.numero === DAV.planches[e.numero]) || planchesCible[e.index])
  rapport.push(`${DAV.serre} ← ${DAV.serre} 2026, planches tournées : ${contenu.map(e => `${nomLegume.get(e.s.legume_id)} ${e.numero}→${DAV.planches[e.numero] ?? e.numero}`).join(', ')}`)
}

for (const item of choux.values()) {
  const ligne = serie2027({ ...item.source, sous_abri: false }, item.metres)
  const debut = ligne.date_plantation
  const fin = ligne.derniere_recolte || debut
  const { placements, reste } = poser(planchesDe(GROUPES[BLOC_SALADES]), item.metres, debut, fin, ligne.premiere_recolte)
  if (placements.length) {
    ligne.longueur_metres = item.metres - reste
    nouvellesSeries.push({ ligne, placements })
  }
  rapport.push(`  ${item.source.nom} : sorti des serres, ${item.metres - reste} m en plein champ (bloc ${BLOC_SALADES})`)
  if (reste > 0) {
    manques.push(`${BLOC_SALADES} : ${item.source.nom} — ${reste} m sans place`)
    nouvellesSeries.push({ ligne: serie2027({ ...item.source, sous_abri: false }, reste), placements: [] })
  }
}

// ---------- Séries 2026 jamais placées : reprises en 2027, sans emplacement ----------

if (!SERRES_SEULEMENT) {
  const placees = new Set(cultures.map(c => c.serie_id))
  const nonPlacees = series.filter(s => s.annee === ANNEE - 1 && !placees.has(s.id))
  for (const s of nonPlacees) nouvellesSeries.push({ ligne: serie2027(s, Number(s.longueur_metres)), placements: [] })
  rapport.push(`Séries 2026 sans emplacement, reprises en 2027 sans emplacement : ${nonPlacees.length}`)
  rapport.push(`Bloc I : rien de prévu, laissé vide`)
}

console.log(rapport.join('\n'))
console.log(`\nTotal : ${nouvellesSeries.length} séries, ${nouvellesSeries.reduce((a, s) => a + s.placements.length, 0)} placements`)
console.log(`\nCe qui ne rentre pas (${manques.length}) :`)
console.log(manques.map(m => '  - ' + m).join('\n') || '  rien')

if (!APPLIQUER) {
  console.log('\nSimulation uniquement. Relancer avec --apply pour créer le plan 2027.')
  process.exit(0)
}

if (SERRES_SEULEMENT) {
  for (let i = 0; i < culturesAEffacer.length; i += 200) {
    const { error } = await supabase.from('cultures').delete().in('id', culturesAEffacer.slice(i, i + 200).map(c => c.id))
    if (error) throw new Error(`suppression placements : ${error.message}`)
  }
  for (let i = 0; i < seriesAEffacer.length; i += 200) {
    const { error } = await supabase.from('series').delete().in('id', seriesAEffacer.slice(i, i + 200))
    if (error) throw new Error(`suppression séries : ${error.message}`)
  }
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
