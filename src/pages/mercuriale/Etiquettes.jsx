import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Printer } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { EnTetePage } from '../../components/ui.jsx'

export default function MerculialeEtiquettes() {
  const [commandes, setCommandes] = useState([])
  const [commandeSelectionnee, setCommandeSelectionnee] = useState('')
  const [loading, setLoading] = useState(true)
  const [logoBase64, setLogoBase64] = useState(null)

  useEffect(() => {
    fetchData()
    chargerLogo()
  }, [])

  async function chargerLogo() {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      setLogoBase64(canvas.toDataURL('image/png'))
    }
    img.onerror = () => setLogoBase64(null)
    img.src = '/logo-bio.png'
  }

  async function fetchData() {
    const { data } = await supabase
      .from('mercuriale_commandes')
      .select('*, mercuriale_epiceries(nom, adresse), mercuriale_lignes(*, mercuriale_produits(nom, variete, unite, nombre_par_colis))')
      .in('statut', ['en_attente', 'confirmee'])
      .order('date_commande', { ascending: false })
    setCommandes(data || [])
    setLoading(false)
  }

  function genererPDF(commande) {
    const LARGEUR = 99
    const HAUTEUR = 49
    const MARGE = 4

    const doc = new jsPDF({
      unit: 'mm',
      format: [LARGEUR, HAUTEUR],
      orientation: 'landscape',
    })

    const epicerie = commande.mercuriale_epiceries?.nom || ''
    const adresse = commande.mercuriale_epiceries?.adresse || ''

    const etiquettes = (commande.mercuriale_lignes || []).flatMap(ligne => {
      const p = ligne.mercuriale_produits
      return Array.from({ length: ligne.quantite_colis }, () => ({
        produit: p?.nom || '',
        variete: p?.variete || '',
        quantite: `${p?.nombre_par_colis} ${p?.unite === 'kg' ? 'kg' : 'pièces'}`,
        epicerie,
        adresse,
      }))
    })

    // Mise en page de la ferme en noir et blanc : mono (Courier) en capitales, doubles filets, italique pour la variété
    const colDroite = LARGEUR * 0.62
    const largeurGauche = colDroite - MARGE - 3

    // Taille de police la plus grande (≤ max) pour que le texte tienne sur la largeur
    function ajuster(texte, max, largeur) {
      let taille = max
      doc.setFontSize(taille)
      while (taille > 7 && doc.getTextWidth(texte) > largeur) doc.setFontSize(taille -= 0.5)
      return taille
    }

    function doubleFilet(x1, x2, y) {
      doc.setLineWidth(0.35)
      doc.line(x1, y, x2, y)
      doc.line(x1, y + 1, x2, y + 1)
    }

    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)

    etiquettes.forEach((etiq, index) => {
      if (index > 0) doc.addPage([LARGEUR, HAUTEUR], 'landscape')

      // Cadre et séparation des deux colonnes
      doc.setLineWidth(0.6)
      doc.rect(1.5, 1.5, LARGEUR - 3, HAUTEUR - 3)
      doc.setLineWidth(0.35)
      doc.line(colDroite, MARGE, colDroite, HAUTEUR - MARGE)

      // === COLONNE GAUCHE : le produit ===
      doc.setFont('courier', 'bold')
      doc.setFontSize(7)
      doc.text('FERME DES VOLONTEUX', MARGE, MARGE + 3)
      doubleFilet(MARGE, colDroite - 3, MARGE + 4.5)

      let y = MARGE + 13
      doc.setFont('courier', 'bold')
      ajuster(etiq.produit.toUpperCase(), 16, largeurGauche)
      doc.text(etiq.produit.toUpperCase(), MARGE, y)
      y += 5.5

      if (etiq.variete) {
        doc.setFont('times', 'italic')
        ajuster(etiq.variete, 10, largeurGauche)
        doc.text(etiq.variete, MARGE, y)
      }
      y += 7

      doc.setFont('courier', 'bold')
      doc.setFontSize(12)
      doc.text(etiq.quantite.toUpperCase(), MARGE, y)

      doubleFilet(MARGE, colDroite - 3, HAUTEUR - MARGE - 6)
      doc.setFont('courier', 'normal')
      doc.setFontSize(5.5)
      doc.text('CATÉGORIE 2 · ORIGINE FRANCE', MARGE, HAUTEUR - MARGE - 1.5)

      // === COLONNE DROITE : le label bio et le destinataire ===
      const xD = colDroite + 3
      const largeurDroite = LARGEUR - colDroite - MARGE - 3
      let yD = MARGE

      // Logo bio à 15 mm de haut, en gardant ses proportions
      const HAUTEUR_LOGO = 15
      if (logoBase64) {
        const { width, height } = doc.getImageProperties(logoBase64)
        doc.addImage(logoBase64, 'PNG', xD, yD, HAUTEUR_LOGO * width / height, HAUTEUR_LOGO)
      } else {
        doc.setLineWidth(0.6)
        doc.rect(xD, yD, 17.5, HAUTEUR_LOGO)
        doc.setFont('courier', 'bold')
        doc.setFontSize(6.5)
        doc.text('FR-BIO-15', xD + 8.75, yD + 7, { align: 'center' })
        doc.setFontSize(4)
        doc.text('AGRICULTURE FRANCE', xD + 8.75, yD + 10.5, { align: 'center' })
      }
      yD += HAUTEUR_LOGO + 5

      doc.setFont('courier', 'bold')
      doc.setFontSize(5.5)
      doc.text('DESTINATAIRE', xD, yD)
      yD += 3.5
      doc.setFontSize(8)
      const lignesNom = doc.splitTextToSize(etiq.epicerie.toUpperCase(), largeurDroite)
      doc.text(lignesNom, xD, yD)
      yD += lignesNom.length * 3.4 + 0.5
      if (etiq.adresse) {
        doc.setFont('courier', 'normal')
        doc.setFontSize(6)
        doc.text(doc.splitTextToSize(etiq.adresse, largeurDroite).slice(0, 3), xD, yD)
      }
    })

    const pdfBlob = doc.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
  }

  const commande = commandes.find(c => c.id === commandeSelectionnee)
  const totalEtiquettes = commande
    ? (commande.mercuriale_lignes || []).reduce((acc, l) => acc + l.quantite_colis, 0)
    : 0

  return (
    <div>
      <EnTetePage titre="Étiquettes" sousTitre="Génère un PDF 4×2 pouces · une étiquette par colis" />

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)', marginBottom: 10 }}>Sélectionner une commande</div>
        <select value={commandeSelectionnee} onChange={e => setCommandeSelectionnee(e.target.value)}
          style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid var(--trait)', borderRadius: 0, marginBottom: 14 }}>
          <option value="">-- Choisir une commande --</option>
          {commandes.map(c => (
            <option key={c.id} value={c.id}>
              {c.mercuriale_epiceries?.nom} · {new Date(c.date_commande).toLocaleDateString('fr-FR')} · {c.mercuriale_lignes?.length} produit(s)
            </option>
          ))}
        </select>

        {commande && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)', marginBottom: 8 }}>Détail des étiquettes</div>
              {(commande.mercuriale_lignes || []).map((l, i) => {
                const p = l.mercuriale_produits
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--trait-leger)' }}>
                    <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''}</span>
                    <span style={{ color: 'var(--encre-douce)' }}>{l.quantite_colis} colis × {p?.nombre_par_colis} {p?.unite === 'kg' ? 'kg' : 'pièces'}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{l.quantite_colis} étiquette{l.quantite_colis > 1 ? 's' : ''}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 13, fontWeight: 500 }}>
                Total : {totalEtiquettes} étiquette{totalEtiquettes > 1 ? 's' : ''}
              </div>
            </div>

            <button onClick={() => genererPDF(commande)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--papier)', border: 'none', borderRadius: 0, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              <Printer size={14} /> Générer PDF ({totalEtiquettes} étiquette{totalEtiquettes > 1 ? 's' : ''})
            </button>
          </div>
        )}

        {commandes.length === 0 && !loading && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--encre-pale)' }}>
            Aucune commande en attente ou confirmée
          </div>
        )}
      </div>
    </div>
  )
}