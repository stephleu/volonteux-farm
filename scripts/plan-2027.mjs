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
// (même géométrie : 4 planches de 50 m), selon SERRES_2027.

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

// Chaque série est posée dans les créneaux libres de sa serre (sans chevaucher les autres
// cultures, y compris celles plantées fin 2026 et encore en place). Ce qui ne rentre pas va
// ensuite dans les serres qui ont de la place. Les choux sortent des serres : plein champ, avec les salades.
const nomLegume = new Map(legumes.map(l => [l.id, l.nom]))
const estChou = s => /^chou/i.test(nomLegume.get(s.legume_id) || '')
const SERRES_DEBORDEMENT = ['S1', 'S9', 'S8', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']
const BLOC_SALADES = 'C' // Petit maraîchage · Salade en 2027
const debordements = []
const choux = []

for (const [cible, { serre, annee, quoi }] of Object.entries(SERRES_2027)) {
  const planchesSource = new Set(planchesDe([serre]).map(p => p.id))
  const ans = ANNEE - annee
  const metresParSerie = new Map()
  for (const c of cultures) {
    if (c.annee !== annee || !c.serie_id || c.type !== 'prevu' || !planchesSource.has(c.planche_id)) continue
    metresParSerie.set(c.serie_id, (metresParSerie.get(c.serie_id) || 0) + Number(c.longueur_metres))
  }
  const aPlacer = [...metresParSerie].map(([id, metres]) => ({ source: serieParId.get(id), metres, ans }))
    .sort((a, b) => (a.source.date_plantation || '').localeCompare(b.source.date_plantation || '') || b.metres - a.metres)

  let place = 0
  for (const item of aPlacer) {
    if (estChou(item.source)) { choux.push(item); continue }
    const ligne = serie2027(item.source, item.metres, ans)
    const debut = ligne.date_plantation
    const fin = ligne.derniere_recolte || debut
    const { placements, reste } = poser(planchesDe([cible]), item.metres, debut, fin, ligne.premiere_recolte)
    place += item.metres - reste
    if (reste > 0) debordements.push({ ...item, metres: reste, depuis: cible })
    if (placements.length) {
      ligne.longueur_metres = item.metres - reste
      nouvellesSeries.push({ ligne, placements })
    }
  }
  rapport.push(`${cible} ← ${serre} ${annee} · ${quoi} : ${place} m posés`)
}

for (const item of debordements) {
  const ligne = serie2027(item.source, item.metres, item.ans)
  const debut = ligne.date_plantation
  const fin = ligne.derniere_recolte || debut
  const { placements, reste } = poser(planchesDe(SERRES_DEBORDEMENT.filter(s => s !== item.depuis)), item.metres, debut, fin, ligne.premiere_recolte)
  const ou = [...new Set(placements.map(p => blocDe.get(p.planche.id)?.nom))].join(', ')
  if (placements.length) {
    ligne.longueur_metres = item.metres - reste
    nouvellesSeries.push({ ligne, placements })
    rapport.push(`  ${item.source.nom} : ${item.metres - reste} m de ${item.depuis} déplacés en ${ou}`)
  }
  if (reste > 0) {
    manques.push(`${item.depuis} : ${item.source.nom} — ${reste} m sans place dans aucune serre`)
    nouvellesSeries.push({ ligne: serie2027(item.source, reste, item.ans), placements: [] })
  }
}

for (const item of choux) {
  const ligne = serie2027({ ...item.source, sous_abri: false }, item.metres, item.ans)
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
    nouvellesSeries.push({ ligne: serie2027({ ...item.source, sous_abri: false }, reste, item.ans), placements: [] })
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
