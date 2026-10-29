// Semaines ISO (lundi → dimanche, semaine 1 = celle du premier jeudi de janvier)
export function semaineIso(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d - premierJeudi) / 86400000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7)
}

export const semaineCourante = () => semaineIso(new Date())

// Lundi de la semaine ISO `semaine` de `annee`. Une semaine au-delà de 52/53 déborde
// naturellement sur l'année suivante (ex. 2026, semaine 54 → 2e semaine de 2027).
export function lundiSemaine(annee, semaine) {
  const quatreJanvier = new Date(Date.UTC(annee, 0, 4, 12))
  const lundiSemaine1 = quatreJanvier.getTime() - ((quatreJanvier.getUTCDay() + 6) % 7) * 86400000
  return new Date(lundiSemaine1 + (semaine - 1) * 7 * 86400000)
}

// Nombre de semaines entre aujourd'hui et la semaine `semaine` de `annee` (négatif = passé)
export function ecartSemaines(annee, semaine) {
  const a = new Date()
  const lundiActuel = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate(), 12) - ((a.getDay() + 6) % 7) * 86400000
  return Math.round((lundiSemaine(annee, semaine) - lundiActuel) / (7 * 86400000))
}

// Année et semaine réelles d'une semaine qui a pu déborder (2026 sem. 55 → 2027 sem. 3)
export function anneeEtSemaine(annee, semaine) {
  const lundi = lundiSemaine(annee, semaine)
  const jeudi = new Date(lundi.getTime() + 3 * 86400000) // l'année ISO est celle du jeudi
  return { annee: jeudi.getUTCFullYear(), semaine: semaineIso(lundi.toISOString().slice(0, 10)) }
}

// Numéro de semaine réel (1 à 53) d'une semaine qui a pu déborder sur l'année suivante
export const semaineReelle = (annee, semaine) => semaineIso(lundiSemaine(annee, semaine).toISOString().slice(0, 10))
export const anneeCourante = () => new Date().getFullYear()

// Mêmes bornes partout dans le site
export function getSaison(semaine) {
  if (!semaine) return 'printemps'
  if (semaine <= 9) return 'hiver'
  if (semaine <= 22) return 'printemps'
  if (semaine <= 39) return 'ete'
  return 'automne'
}
