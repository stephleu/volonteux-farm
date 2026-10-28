// Ateliers de la ferme : chaque produit de la mercuriale appartient à l'un d'eux
export const ATELIERS = [
  { id: 'maraichage', nom: 'Maraîchage', description: 'Légumes de saison' },
  { id: 'arboriculture', nom: 'Arboriculture', description: 'Fruits et transformation de fruits' },
  { id: 'epices', nom: 'Épices Volonteux', description: 'Piments, sels et épices' },
]

export const nomAtelier = id => ATELIERS.find(a => a.id === id)?.nom || 'Autres'
