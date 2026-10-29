// Étapes du travail du sol, communes à la page Travail du sol, à la fumure de fond et au tableau de bord
export const ETAPES = ['broyer', 'fumier', 'covercrop', 'sous_soleuse', 'cultibutte', 'granules', 'vibroplanche']
export const ETAPES_LABELS = {
  broyer: 'Broyer', fumier: 'Fumier', covercrop: 'Covercrop',
  sous_soleuse: 'S.soleuse', cultibutte: 'Cultibutte',
  granules: 'Granulés', vibroplanche: 'Vibroplanche'
}

// Fumure de fond aux granulés (étape « Granulés ») : dose du légume en t/ha, 1 t/ha si non réglée
export const LARGEUR_PLANCHE_M = 1.4
export const SAC_GRANULES_KG = 25
export const doseFumure = legume => (legume?.fumure_fond_t_ha ?? 1)
// t/ha × surface (m²) : 1 t/ha = 0,1 kg/m²
export const kgFumure = (legume, longueurMetres) => doseFumure(legume) * 0.1 * longueurMetres * LARGEUR_PLANCHE_M

// Étapes (1er passage) faites sur une planche, d'après les lignes travail_sol de l'année
export const etapesFaites = (travaux, plancheId) =>
  ETAPES.filter(e => travaux.some(t => t.planche_id === plancheId && t.etape === e && t.passage === 1 && t.fait))
