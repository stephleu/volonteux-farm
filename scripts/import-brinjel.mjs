// Import des exports Brinjel (plan de culture + assolement) dans Supabase.
//
//   node scripts/import-brinjel.mjs <assolement.csv> <plan-de-culture.csv>           → simulation, rien n'est écrit
//   node scripts/import-brinjel.mjs <assolement.csv> <plan-de-culture.csv> --apply   → sauvegarde puis import
//
// Les correspondances qu'on ne peut pas deviner (nom d'un légume, d'une serre…) se règlent
// dans scripts/brinjel-correspondances.json.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const ANNEES = [2025, 2026]

const [fichierAssolement, fichierPlan] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const HORS_LIGNE = process.argv.includes('--hors-ligne')
const APPLIQUER = process.argv.includes('--apply') && !HORS_LIGNE
if (!fichierAssolement || !fichierPlan) {
  console.error('Usage : node scripts/import-brinjel.mjs <assolement.csv> <plan-de-culture.csv> [--apply]')
  process.exit(1)
}

const sourceClient = fs.readFileSync(path.join(ICI, '../src/lib/supabase.js'), 'utf8')
const supabase = createClient(
  sourceClient.match(/supabaseUrl = '([^']+)'/)[1],
  sourceClient.match(/supabaseKey = '([^']+)'/)[1],
)

const cheminCorrespondances = path.join(ICI, 'brinjel-correspondances.json')
const correspondances = fs.existsSync(cheminCorrespondances)
  ? JSON.parse(fs.readFileSync(cheminCorrespondances, 'utf8'))
  : {}

// ---------- Lecture des CSV (Brinjel exporte en UTF-16, séparateur tabulation) ----------

function lireCsv(fichier) {
  const brut = fs.readFileSync(fichier)
  const texte = brut[0] === 0xff && brut[1] === 0xfe ? brut.toString('utf16le').slice(1) : brut.toString('utf8').replace(/^﻿/, '')
  const [entete, ...lignes] = texte.split(/\r?\n/).filter(l => l.trim())
  const colonnes = entete.split('\t')
  return lignes.map(l => Object.fromEntries(l.split('\t').map((v, i) => [colonnes[i], v.trim()])))
}

const nombre = s => (s === '' || s == null ? null : Number(String(s).replace(',', '.')))
const dateFr = s => (s ? `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : null)
const normaliser = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
// « Poireaux » = « poireau », « Piments » = « piment »
const cleNom = s => normaliser(s).replace(/(x|s)$/, '')
const majuscule = s => s.charAt(0).toUpperCase() + s.slice(1)

function semaineIso(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const jour = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - jour + 3)
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d - premierJeudi) / 86400000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7)
}

// Mêmes bornes que getSaison() dans Assolement.jsx
function saison(semaine) {
  if (semaine <= 9) return 'hiver'
  if (semaine <= 22) return 'printemps'
  if (semaine <= 39) return 'ete'
  return 'automne'
}

// ---------- Familles : corrections décidées avec l'utilisateur ----------

const FAMILLES = {
  'apiacee': 'Apiacées',
  'brassicaceae': 'Brassicacées',
  'chenopodiacea': 'Chénopodiacées',
  'asteracee': 'Astéracées',
  'solanace': 'Solanacées',
  'curcubitace': 'Cucurbitacées',
  'liliacees': 'Liliacées',
  'valerianella': 'Valérianacées',
  'chicoree': 'Astéracées',
  'lamiacee': 'Lamiacées',
  'convolvulacee': 'Convolvulacées',
}
function familleCorrigee(familleBrinjel, culture) {
  if (normaliser(familleBrinjel) === 'poace') return normaliser(culture) === 'mais' ? 'Poacées' : 'Fabacées'
  return FAMILLES[normaliser(familleBrinjel)] || familleBrinjel
}

// ---------- Emplacements Brinjel → bloc + numéro de planche ----------

const SOUS_BLOCS = ['A', 'B', 'F', 'H'] // A127 = sous-bloc A1, planche 27

function lireEmplacement(nom) {
  let m
  if ((m = nom.match(/^(\d)(\d)$/))) return { bloc: `serre:${m[1]}`, numero: Number(m[2]), serre: true }
  if ((m = nom.match(/^Dav\s*1(\d)$/i))) return { bloc: 'serre:9', numero: Number(m[1]), serre: true }
  if ((m = nom.match(/^([A-Za-z])(\d)(\d+)$/)) && SOUS_BLOCS.includes(m[1].toUpperCase()))
    return { bloc: m[1].toUpperCase() + m[2], numero: Number(m[3]), serre: false }
  if ((m = nom.match(/^([A-Za-z])(\d+)$/))) return { bloc: m[1].toUpperCase(), numero: Number(m[2]), serre: false }
  return null
}

// ---------- Programme ----------

const rapport = []
const note = (...l) => rapport.push(l.join(' '))
const anomalies = []

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

let idFictif = 0
const creer = async (table, ligne) => (APPLIQUER ? (await inserer(table, [ligne]))[0] : { ...ligne, id: `nouveau-${table}-${++idFictif}` })

const plan = lireCsv(fichierPlan)
const assolement = lireCsv(fichierAssolement)

const base = {}
for (const t of ['familles', 'legumes', 'varietes', 'blocs', 'planches', 'series', 'cultures', 'serie_fertilisations', 'serie_traitements', 'suivi_ferti', 'suivi_traitements', 'travail_sol', 'rotations_planifiees', 'durees_culture', 'types_traitement']) {
  // --hors-ligne : simulation sur une base vide, pour tester la lecture des CSV sans Supabase
  base[t] = HORS_LIGNE ? [] : await tout(t)
}

if (APPLIQUER) {
  const dossier = path.join(ICI, '../sauvegardes')
  fs.mkdirSync(dossier, { recursive: true })
  const fichier = path.join(dossier, `avant-import-brinjel-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(fichier, JSON.stringify(base, null, 1))
  console.log(`Sauvegarde complète : ${fichier}`)
}

// Familles : les noms Brinjel déjà en base sont renommés (on garde leurs couleurs)
const RENOMMER_FAMILLES = {
  'Apiacée': 'Apiacées', 'Astéracée': 'Astéracées', 'Brassicaceae': 'Brassicacées',
  'Chénopodiacea': 'Chénopodiacées', 'Convolvulacée': 'Convolvulacées', 'Cucurbitacée': 'Cucurbitacées',
  'Lamiacée': 'Lamiacées', 'Poacée': 'Poacées', 'Solanacée': 'Solanacées', 'Valerianella': 'Valérianacées',
}
const famillesARenommer = base.familles.filter(f => RENOMMER_FAMILLES[f.nom])
for (const f of famillesARenommer) {
  note(`~ famille « ${f.nom} » → « ${RENOMMER_FAMILLES[f.nom]} »`)
  f.nom = RENOMMER_FAMILLES[f.nom]
}
// « Chicorée » n'est pas une famille : la chicorée passe en Astéracées
const famillesASupprimer = base.familles.filter(f => f.nom === 'Chicorée')
for (const f of famillesASupprimer) note(`- famille « ${f.nom} » (la chicorée passe en Astéracées)`)
const familleParCle = new Map(base.familles.filter(f => !famillesASupprimer.includes(f)).map(f => [cleNom(f.nom), f]))
const PALETTE = ['#9dca9a', '#fff09e', '#a9bbd8', '#e3a69d', '#d6c3a5', '#c9b6e4', '#f2c48d', '#b5d9d0']
async function famille(nom) {
  const cle = cleNom(nom)
  if (!familleParCle.has(cle)) {
    note(`+ famille « ${nom} »`)
    familleParCle.set(cle, await creer('familles', { nom, couleur: PALETTE[familleParCle.size % PALETTE.length] }))
  }
  return familleParCle.get(cle)
}

// Légumes
const legumeParCle = new Map(base.legumes.map(l => [cleNom(l.nom), l]))
const famillesAMettreAJour = new Map()
async function legume(culture, familleBrinjel) {
  const nomVoulu = correspondances.legumes?.[culture] || culture
  const cle = cleNom(nomVoulu)
  const fam = await famille(familleCorrigee(familleBrinjel, culture))
  if (!legumeParCle.has(cle)) {
    note(`+ légume « ${majuscule(nomVoulu)} » (${fam.nom})`)
    legumeParCle.set(cle, await creer('legumes', { nom: majuscule(nomVoulu), famille_id: fam.id }))
  } else if (legumeParCle.get(cle).famille_id !== fam.id) {
    famillesAMettreAJour.set(legumeParCle.get(cle).id, fam)
  }
  return legumeParCle.get(cle)
}

// Variétés
const varieteParCle = new Map(base.varietes.map(v => [`${v.legume_id}|${cleNom(v.nom)}`, v]))
async function variete(leg, nom) {
  if (!nom) return null
  const cle = `${leg.id}|${cleNom(nom)}`
  if (!varieteParCle.has(cle)) {
    note(`+ variété « ${nom} » (${leg.nom})`)
    varieteParCle.set(cle, await creer('varietes', { legume_id: leg.id, nom }))
  }
  return varieteParCle.get(cle)
}

// Blocs et planches. Bloc D unique (choix de l'utilisateur) : D1 devient D, D2 disparaît
const blocD1 = base.blocs.find(b => b.nom === 'D1')
const blocD2 = base.blocs.find(b => b.nom === 'D2')
const planchesD2 = blocD2 ? base.planches.filter(p => p.bloc_id === blocD2.id) : []
if (blocD1 && !base.blocs.some(b => b.nom === 'D')) {
  note(`~ bloc « D1 » → « D »`)
  blocD1.nom = 'D'
}
if (blocD2) note(`- bloc « D2 » et ses ${planchesD2.length} planches`)
const blocParNom = new Map(base.blocs.filter(b => b !== blocD2).map(b => [normaliser(b.nom), b]))
for (const p of planchesD2) base.planches.splice(base.planches.indexOf(p), 1)
function nomBloc(code) {
  if (correspondances.blocs?.[code]) return correspondances.blocs[code]
  return code.startsWith('serre:') ? `Serre ${code.slice(6)}` : code
}
const planchesParBloc = new Map()
const referencesD2 = ['cultures', 'travail_sol'].flatMap(t => base[t].filter(l => planchesD2.some(p => p.id === l.planche_id)).map(l => ({ table: t, ...l })))
for (const p of base.planches) planchesParBloc.set(`${p.bloc_id}|${p.numero}`, p)
const longueursAMettreAJour = []
async function planche(emplacement, longueur) {
  const lu = lireEmplacement(emplacement)
  if (!lu) { anomalies.push(`Emplacement illisible : « ${emplacement} »`); return null }
  const nom = nomBloc(lu.bloc)
  let bloc = blocParNom.get(normaliser(nom))
  if (!bloc) {
    note(`+ bloc « ${nom} »${lu.serre ? ' (serre)' : ''}`)
    bloc = await creer('blocs', { nom, type: lu.serre ? 'serre' : 'plein_champ', nombre_planches: 0 })
    blocParNom.set(normaliser(nom), bloc)
  }
  const cle = `${bloc.id}|${lu.numero}`
  if (!planchesParBloc.has(cle)) {
    note(`+ planche ${nom}-${String(lu.numero).padStart(2, '0')} (${longueur} m)`)
    planchesParBloc.set(cle, await creer('planches', { bloc_id: bloc.id, numero: lu.numero, longueur, largeur: 1.4 }))
  } else if (Number(planchesParBloc.get(cle).longueur ?? 50) !== longueur) {
    planchesParBloc.get(cle).longueur = longueur
    longueursAMettreAJour.push({ id: planchesParBloc.get(cle).id, longueur })
  }
  return planchesParBloc.get(cle)
}

// ---------- 1. Séries (plan de culture) ----------

const cleSerie = (culture, varieteNom, date, longueur, semis, abri) =>
  [cleNom(culture), cleNom(varieteNom), date, longueur, semis, abri].join('|')

const seriesBrinjel = []
for (const p of plan) {
  const date = p.planting_date || p.sowing_date
  const annee = Number(date.slice(0, 4))
  if (!ANNEES.includes(annee)) continue
  const leg = await legume(p.crop, p.family)
  const vari = await variete(leg, p.variety)
  const semis = p.planting_type === 'direct_seeded'
  const longueur = nombre(p.length)
  const rangs = nombre(p.rows)
  const espacement = nombre(p.spacing_plants)
  const semaine = semaineIso(date)
  seriesBrinjel.push({
    cle: cleSerie(p.crop, p.variety, date, longueur, semis, p.in_greenhouse === 'true'),
    resteAPlacer: longueur,
    ligne: {
      legume_id: leg.id,
      variete_id: vari?.id || null,
      nom: `${majuscule(p.crop)}${p.variety ? ' · ' + p.variety : ''} · sem. ${semaine}`,
      fournisseur: p.provider || null,
      type: semis ? 'semis' : 'plant',
      longueur_metres: longueur,
      semaine_plantation: semaine,
      annee,
      nombre_plants: espacement ? Math.round((longueur * 100 / espacement) * rangs) : null,
      date_plantation: date,
      premiere_recolte: p.first_harvest_date || null,
      derniere_recolte: p.last_harvest_date || null,
      rangs,
      espacement_plants: espacement,
      sous_abri: p.in_greenhouse === 'true',
    },
  })
}

// ---------- 2. Placements (assolement) ----------

const placements = []
for (const a of assolement) {
  const date = dateFr(a['Date au champ'])
  if (!ANNEES.includes(Number(date.slice(0, 4)))) continue
  const semis = a['Type de série'].startsWith('Semis')
  const abri = a['Sous abri'] === 'oui'
  const cle = cleSerie(a['Espèce'], a['Variété'], date, nombre(a['Longueur série totale (m)']), semis, abri)
  const longueur = nombre(a['Longueur série affectée (m)'])
  // Séries identiques en double dans Brinjel : on remplit la première avant de passer à la suivante
  const serie = seriesBrinjel.find(s => s.cle === cle && s.resteAPlacer >= longueur) || seriesBrinjel.find(s => s.cle === cle)
  if (!serie) { anomalies.push(`Placement sans série : ${a['Emplacement']} ${a['Espèce']} ${a['Variété']} ${a['Date au champ']}`); continue }
  serie.resteAPlacer -= longueur
  placements.push({
    serie, longueur,
    emplacement: a['Emplacement'],
    longueurPlanche: nombre(a['Longueur emplacement (m)']),
    debut: date,
    fin: dateFr(a['Dernière récolte']) || date,
    premiereRecolte: dateFr(a['Première récolte']),
  })
}

for (const s of seriesBrinjel) {
  if (s.resteAPlacer < 0) anomalies.push(`Série placée sur plus que sa longueur (${-s.resteAPlacer} m de trop dans Brinjel) : ${s.ligne.nom}`)
}

// Position sur la planche : premier créneau libre parmi les cultures présentes en même temps
const occupation = new Map()
for (const pl of placements) {
  pl.planche = await planche(pl.emplacement, pl.longueurPlanche)
  if (!pl.planche) continue
  const voisins = (occupation.get(pl.planche.id) || []).filter(o => o.debut <= pl.fin && pl.debut <= o.fin)
  let position = 0
  for (const o of [...voisins].sort((x, y) => x.position - y.position)) {
    if (position + pl.longueur <= o.position) break
    position = Math.max(position, o.position + o.longueur)
  }
  if (position + pl.longueur > pl.longueurPlanche) {
    anomalies.push(`Planche ${pl.emplacement} déjà pleine le ${pl.debut} dans Brinjel (la culture précédente n'est pas finie) : ${pl.serie.ligne.nom} (${pl.longueur} m) importé quand même, en chevauchement`)
    position = Math.max(0, pl.longueurPlanche - pl.longueur)
  }
  pl.position = position
  occupation.set(pl.planche.id, [...(occupation.get(pl.planche.id) || []), { debut: pl.debut, fin: pl.fin, position, longueur: pl.longueur }])
}

// ---------- 3. Ce qui sera remplacé ----------

const seriesAEffacer = base.series.filter(s => ANNEES.includes(s.annee))
const idsSeriesAEffacer = new Set(seriesAEffacer.map(s => s.id))
const culturesAEffacer = base.cultures.filter(c => ANNEES.includes(c.annee) || idsSeriesAEffacer.has(c.serie_id))

note('')
note(`Séries Brinjel ${ANNEES.join('-')} : ${seriesBrinjel.length} (dont ${seriesBrinjel.filter(s => s.resteAPlacer === s.ligne.longueur_metres).length} sans emplacement)`)
note(`Placements : ${placements.filter(p => p.planche).length}`)
note(`Légumes dont la famille sera corrigée : ${[...famillesAMettreAJour].map(([id, f]) => `${base.legumes.find(l => l.id === id)?.nom} → ${f.nom}`).join(', ') || 'aucun'}`)
note(`Planches dont la longueur change : ${longueursAMettreAJour.length}`)
note(`À effacer : ${seriesAEffacer.length} séries, ${culturesAEffacer.length} cultures (dont ${culturesAEffacer.filter(c => c.type === 'reel').length} « réel »),`,
  `${base.serie_fertilisations.filter(f => idsSeriesAEffacer.has(f.serie_id)).length} fertilisations et`,
  `${base.serie_traitements.filter(t => idsSeriesAEffacer.has(t.serie_id)).length} traitements de séries`)

const idsCulturesEffacees = new Set(culturesAEffacer.map(c => c.id))
for (const r of referencesD2.filter(r => !(r.table === 'cultures' && idsCulturesEffacees.has(r.id)))) {
  anomalies.push(`Le bloc D2 est encore utilisé par ${r.table} (${r.id}) : il ne pourra pas être supprimé`)
}
console.log(rapport.join('\n'))
console.log(`\nAnomalies (${anomalies.length}) :`)
console.log(anomalies.map(a => '  - ' + a).join('\n') || '  aucune')

if (!APPLIQUER) {
  console.log('\nSimulation uniquement. Relancer avec --apply pour importer.')
  process.exit(0)
}

// ---------- 4. Écriture ----------

const idsCultures = culturesAEffacer.map(c => c.id)
const idsSeries = [...idsSeriesAEffacer]
for (let i = 0; i < idsCultures.length; i += 200) {
  const { error } = await supabase.from('cultures').delete().in('id', idsCultures.slice(i, i + 200))
  if (error) throw new Error(`suppression cultures : ${error.message}`)
}
for (const table of ['suivi_ferti', 'suivi_traitements', 'serie_fertilisations', 'serie_traitements']) {
  if (!base[table][0] || !('serie_id' in base[table][0])) continue
  for (let i = 0; i < idsSeries.length; i += 200) {
    const { error } = await supabase.from(table).delete().in('serie_id', idsSeries.slice(i, i + 200))
    if (error) throw new Error(`suppression ${table} : ${error.message}`)
  }
}
for (let i = 0; i < idsSeries.length; i += 200) {
  const { error } = await supabase.from('series').delete().in('id', idsSeries.slice(i, i + 200))
  if (error) throw new Error(`suppression séries : ${error.message}`)
}

for (const f of famillesARenommer) await supabase.from('familles').update({ nom: f.nom }).eq('id', f.id)
for (const [id, fam] of famillesAMettreAJour) await supabase.from('legumes').update({ famille_id: fam.id }).eq('id', id)
for (const f of famillesASupprimer) {
  const { error } = await supabase.from('familles').delete().eq('id', f.id)
  if (error) console.log(`Famille « ${f.nom} » non supprimée : ${error.message}`)
}
if (blocD1?.nom === 'D') await supabase.from('blocs').update({ nom: 'D' }).eq('id', blocD1.id)
if (blocD2) {
  const { error: e1 } = await supabase.from('planches').delete().in('id', planchesD2.map(p => p.id))
  const { error: e2 } = e1 ? {} : await supabase.from('blocs').delete().eq('id', blocD2.id)
  if (e1 || e2) console.log(`Bloc D2 non supprimé : ${(e1 || e2).message}`)
}
for (const { id, longueur } of longueursAMettreAJour) await supabase.from('planches').update({ longueur }).eq('id', id)

const seriesCreees = await inserer('series', seriesBrinjel.map(s => s.ligne))
seriesBrinjel.forEach((s, i) => { s.id = seriesCreees[i].id })

await inserer('cultures', placements.filter(p => p.planche).map(p => ({
  planche_id: p.planche.id,
  legume_id: p.serie.ligne.legume_id,
  variete_id: p.serie.ligne.variete_id,
  serie_id: p.serie.id,
  type: 'prevu',
  statut: 'en_culture',
  date_plantation: p.debut,
  date_fin_prevue: p.fin,
  premiere_recolte: p.premiereRecolte,
  longueur_metres: p.longueur,
  position_debut: p.position,
  saison: saison(p.serie.ligne.semaine_plantation),
  annee: p.serie.ligne.annee,
})))

// nombre_planches des blocs
for (const bloc of blocParNom.values()) {
  const n = [...planchesParBloc.values()].filter(p => p.bloc_id === bloc.id).length
  if (n !== bloc.nombre_planches) await supabase.from('blocs').update({ nombre_planches: n }).eq('id', bloc.id)
}

console.log('\nImport terminé.')
