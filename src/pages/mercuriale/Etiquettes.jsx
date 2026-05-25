import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Printer } from 'lucide-react'
import { jsPDF } from 'jspdf'

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

    etiquettes.forEach((etiq, index) => {
      if (index > 0) doc.addPage([LARGEUR, HAUTEUR], 'landscape')

      // Bordure
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.rect(1, 1, LARGEUR - 2, HAUTEUR - 2)

      // Ligne verticale séparatrice
      const colDroite = LARGEUR * 0.62
      doc.setDrawColor(220, 220, 220)
      doc.line(colDroite, MARGE, colDroite, HAUTEUR - MARGE)

      // === COLONNE GAUCHE ===
      let y = MARGE + 4

      doc.setFontSize(5.5)
      doc.setTextColor(140, 140, 140)
      doc.setFont('helvetica', 'normal')
      doc.text('Catégorie 2  ·  Origine France', MARGE, y)
      y += 6

      doc.setFontSize(15)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text(etiq.produit, MARGE, y)
      y += 5

      if (etiq.variete) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(etiq.variete, MARGE, y)
        y += 5
      } else {
        y += 2
      }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 20)
      doc.text(etiq.quantite, MARGE, y)
      y += 7

      doc.setDrawColor(220, 220, 220)
      doc.line(MARGE, y, colDroite - 2, y)
      y += 4

      doc.setFontSize(5.5)
      doc.setTextColor(140, 140, 140)
      doc.setFont('helvetica', 'normal')
      doc.text('Producteur', MARGE, y)
      y += 3.5
      doc.setFontSize(7.5)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text('Ferme des Volonteux', MARGE, y)

      // === COLONNE DROITE ===
      const xD = colDroite + 3
      let yD = MARGE + 2

      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', xD, yD, 32, 21)
      } else {
        doc.setFillColor(0, 0, 0)
        doc.roundedRect(xD, yD, 32, 21, 1.5, 1.5, 'F')
        doc.setFontSize(8)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('FR-BIO-15', xD + 16, yD + 9, { align: 'center' })
        doc.setFontSize(5.5)
        doc.setFont('helvetica', 'normal')
        doc.text('Agriculture France', xD + 16, yD + 14, { align: 'center' })
      }
      yD += 24

      // Destinataire
      doc.setFontSize(5.5)
      doc.setTextColor(140, 140, 140)
      doc.setFont('helvetica', 'normal')
      doc.text('Destinataire', xD, yD)
      yD += 3.5
      doc.setFontSize(8)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text(etiq.epicerie, xD, yD)
      yD += 4
      if (etiq.adresse) {
        doc.setFontSize(6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        const maxW = LARGEUR - colDroite - MARGE - 3
        const lignesAdresse = doc.splitTextToSize(etiq.adresse, maxW)
        doc.text(lignesAdresse, xD, yD)
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Étiquettes</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Génère un PDF 4×2 pouces · une étiquette par colis</p>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 10 }}>Sélectionner une commande</div>
        <select value={commandeSelectionnee} onChange={e => setCommandeSelectionnee(e.target.value)}
          style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 14 }}>
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
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 8 }}>Détail des étiquettes</div>
              {(commande.mercuriale_lignes || []).map((l, i) => {
                const p = l.mercuriale_produits
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''}</span>
                    <span style={{ color: '#6b7280' }}>{l.quantite_colis} colis × {p?.nombre_par_colis} {p?.unite === 'kg' ? 'kg' : 'pièces'}</span>
                    <span style={{ color: '#1D9E75', fontWeight: 500 }}>{l.quantite_colis} étiquette{l.quantite_colis > 1 ? 's' : ''}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 13, fontWeight: 500 }}>
                Total : {totalEtiquettes} étiquette{totalEtiquettes > 1 ? 's' : ''}
              </div>
            </div>

            <button onClick={() => genererPDF(commande)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              <Printer size={14} /> Générer PDF ({totalEtiquettes} étiquette{totalEtiquettes > 1 ? 's' : ''})
            </button>
          </div>
        )}

        {commandes.length === 0 && !loading && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
            Aucune commande en attente ou confirmée
          </div>
        )}
      </div>
    </div>
  )
}