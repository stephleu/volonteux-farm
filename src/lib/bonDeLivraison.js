// Bon de livraison en HTML : utilisé pour l'impression (page Commandes) et pour l'email
// envoyé au comptable (api/envoyer-bl.js). Pensé pour une impression noir et blanc.

// Ce qu'il faut charger d'une commande pour faire son BL
export const SELECT_COMMANDE = '*, mercuriale_epiceries(nom, adresse, email), mercuriale_lignes(*, mercuriale_produits(nom, variete, unite, nombre_par_colis, prix_ht, prix_ttc))'

// Prix au moment de la commande (prix_unitaire), pas le prix actuel du produit
export const prixLigne = l => Number(l.prix_unitaire ?? l.mercuriale_produits?.prix_ht ?? 0)

export function totalCommande(commande) {
  return (commande.mercuriale_lignes || []).reduce((acc, l) => {
    return acc + (l.quantite_colis * prixLigne(l) * (l.mercuriale_produits?.nombre_par_colis || 1))
  }, 0).toFixed(2)
}

export const numeroBL = commande => String(commande.id).slice(0, 8).toUpperCase()

export function htmlBonDeLivraison(commande) {
  const echapper = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const epicerie = echapper(commande.mercuriale_epiceries?.nom)
  const adresse = echapper(commande.mercuriale_epiceries?.adresse)
  const email = echapper(commande.mercuriale_epiceries?.email)
  const date = new Date(commande.date_commande).toLocaleDateString('fr-FR')

  const euros = n => `${n.toFixed(2).replace('.', ',')} €`
  const totalHT = Number(totalCommande(commande))
  const tva = totalHT * 0.055
  const numero = numeroBL(commande)

  const lignesHTML = (commande.mercuriale_lignes || []).map(l => {
    const p = l.mercuriale_produits
    const total = l.quantite_colis * prixLigne(l) * (p?.nombre_par_colis || 1)
    return `<tr>
      <td><strong>${echapper(p?.nom)}</strong>${p?.variete ? ` <em>${echapper(p.variete)}</em>` : ''}</td>
      <td class="c">${l.quantite_colis}</td>
      <td class="c">${p?.nombre_par_colis} ${p?.unite === 'kg' ? 'kg' : 'pièces'}</td>
      <td class="d">${euros(prixLigne(l))}</td>
      <td class="d">${euros(total)}</td>
    </tr>`
  }).join('')

  // Mise en page de la ferme (mono condensée, filets noirs), pensée pour une impression noir et blanc
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>BL ${numero} · ${epicerie}</title>
  <link href="https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75..112.5,400..800&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet">
  <style>
    /* Marge de page à 0 : le navigateur n'imprime plus son en-tête ni son pied de page (titre, adresse, date) ;
       la marge est reprise par le padding du body */
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; font: 10.5px/1.45 'Martian Mono', 'Courier New', monospace; font-stretch: 87.5%; }
    .entete { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .ferme { font-size: 26px; font-weight: 800; font-stretch: 75%; text-transform: uppercase; line-height: .95; }
    .titre { font-size: 15px; font-weight: 800; font-stretch: 75%; text-transform: uppercase; text-align: right; }
    .titre small { display: block; font-size: 10.5px; font-weight: 400; text-transform: none; }
    .filet { height: 6px; border-top: 2px solid #000; border-bottom: 2px solid #000; margin: 8px 0 14px; }
    .blocs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .bloc { border: 1.5px solid #000; padding: 8px 10px; }
    .etiquette { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
    .nom { font-size: 13px; font-weight: 800; font-stretch: 75%; text-transform: uppercase; }
    .livraison { border: 1.5px solid #000; padding: 6px 10px; margin-bottom: 14px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 8.5px; text-transform: uppercase; letter-spacing: .06em; text-align: left; padding: 6px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
    td { padding: 6px; border-bottom: .5px solid #000; vertical-align: top; }
    td em, .script { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 12.5px; }
    .c { text-align: center; } .d { text-align: right; white-space: nowrap; }
    .totaux { margin: 10px 0 0 auto; width: 46%; }
    .totaux div { display: flex; justify-content: space-between; padding: 3px 6px; }
    .totaux .grand { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: 800; font-size: 12px; margin-top: 3px; }
    .pied { margin-top: 28px; font-size: 8.5px; text-align: center; }
    body { padding: 14mm; }
    @media screen { body { max-width: 210mm; margin: 0 auto; } }
  </style>
  </head><body>
  <div class="entete">
    <div>
      <div class="ferme">Ferme des<br/>Volonteux</div>
      <div class="script">SCOP agricole depuis 2012</div>
    </div>
    <div class="titre">Bon de livraison<small>N° ${numero} · ${date}</small></div>
  </div>
  <div class="filet"></div>

  <div class="blocs">
    <div class="bloc">
      <div class="etiquette">Fournisseur</div>
      <div class="nom">Ferme des Volonteux</div>
      SIRET 537 594 558 00018 · APE 0113Z<br/>
      TVA FR91537594558 · FR-BIO-15
    </div>
    <div class="bloc">
      <div class="etiquette">Livré à</div>
      <div class="nom">${epicerie}</div>
      ${adresse ? adresse + '<br/>' : ''}
      ${email ? email : ''}
    </div>
  </div>

  ${commande.notes ? `<div class="livraison">${echapper(commande.notes)}</div>` : ''}

  <table>
    <thead><tr>
      <th>Produit</th><th class="c">Colis</th><th class="c">Contenu / colis</th><th class="d">Prix HT / unité</th><th class="d">Total HT</th>
    </tr></thead>
    <tbody>${lignesHTML}</tbody>
  </table>

  <div class="totaux">
    <div><span>Total HT</span><span>${euros(totalHT)}</span></div>
    <div><span>TVA 5,5 %</span><span>${euros(tva)}</span></div>
    <div class="grand"><span>Total TTC</span><span>${euros(totalHT + tva)}</span></div>
  </div>

  <div class="pied">Ferme des Volonteux · Agriculture biologique FR-BIO-15 · Merci !</div>
  </body></html>`
  return html
}

// Ouvre le BL dans une nouvelle fenêtre et lance l'impression (navigateur uniquement)
export function imprimerHtml(html) {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Le navigateur a bloqué la fenêtre du bon de livraison : autorisez les fenêtres pop-up pour ce site.')
    return
  }
  // On attend les polices avant d'imprimer, sinon la première impression sort en police par défaut
  let imprime = false
  const imprimer = () => {
    if (imprime) return
    imprime = true
    ;(w.document.fonts?.ready || Promise.resolve()).then(() => { w.focus(); w.print() })
  }
  w.onload = imprimer
  w.document.write(html)
  w.document.close()
  setTimeout(imprimer, 1500) // au cas où l'événement de chargement serait déjà passé
}
