import { useEffect, useRef } from 'react'

// Lance `charger` au premier affichage, puis à chaque changement de `cles` (ex. [annee]).
// Chaque page garde sa fonction de chargement (souvent fetchData) qu'elle rappelle après une modification.
export function useChargement(charger, cles = []) {
  const derniere = useRef(charger)
  useEffect(() => { derniere.current = charger })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { derniere.current() }, cles)
}
