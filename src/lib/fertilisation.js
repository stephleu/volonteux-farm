// Tableau des fertilisations par légume (tables ferti_lignes et ferti_lignes_passages) :
// chaque série prend la ligne de son légume, choisie selon sa semaine de plantation.

// Requête : toutes les lignes du tableau avec leurs passages
export const SELECT_PLANS = '*, legumes(nom), ferti_lignes_passages(*)'

// Ligne du tableau qui s'applique à une série (légume, semaine de plantation, variété), dans l'ordre :
// une ligne qui liste sa variété (ex. chou chinois et rave), puis une ligne qui liste sa semaine
// (ex. carotte primeur, sem. 14), sinon la ligne par défaut du légume (ni variété ni semaine)
export function planPour(plans, legumeId, semainePlantation, varieteId = null) {
  const lignes = plans.filter(p => p.legume_id === legumeId)
  return (varieteId && lignes.find(p => (p.variete_ids || []).includes(varieteId)))
    || lignes.find(p => (p.semaines || []).includes(semainePlantation))
    || lignes.find(p => !(p.semaines || []).length && !(p.variete_ids || []).length)
    || null
}

// Passages en cours de culture d'une série, avec la semaine (non ramenée à l'année : peut dépasser 52)
export function passagesDeSerie(plans, serie) {
  const plan = planPour(plans, serie.legume_id, serie.semaine_plantation, serie.variete_id)
  return (plan?.ferti_lignes_passages || [])
    .filter(p => Number(p.dose_kg_ha) > 0)
    .map(passage => ({
      cle: `${serie.id}:${passage.id}`,
      serie,
      passage,
      plan,
      dose_kg_ha: Number(passage.dose_kg_ha),
      semaines_apres_plantation: passage.semaines_apres_plantation,
      semaineFerti: (serie.semaine_plantation || 0) + passage.semaines_apres_plantation,
    }))
}

// Fumure de fond (t/ha) d'une culture : ligne du tableau de son légume, 1 t/ha à défaut de ligne
export function fumureFond(plans, legumeId, semainePlantation, varieteId = null) {
  const plan = planPour(plans, legumeId, semainePlantation, varieteId)
  return plan ? Number(plan.fumure_fond_t_ha) : 1
}

// Nom affiché d'une ligne : « Carotte · primeur »
export const nomPlan = plan => `${plan.legumes?.nom || ''}${plan.variante ? ` · ${plan.variante}` : ''}`
