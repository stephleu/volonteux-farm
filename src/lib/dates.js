// Semaines ISO (lundi → dimanche, semaine 1 = celle du premier jeudi de janvier)
export function semaineIso(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d - premierJeudi) / 86400000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7)
}

export const semaineCourante = () => semaineIso(new Date())
export const anneeCourante = () => new Date().getFullYear()

// Mêmes bornes partout dans le site
export function getSaison(semaine) {
  if (!semaine) return 'printemps'
  if (semaine <= 9) return 'hiver'
  if (semaine <= 22) return 'printemps'
  if (semaine <= 39) return 'ete'
  return 'automne'
}
