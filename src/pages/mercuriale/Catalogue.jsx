import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, X, Check, Minus, Plus } from 'lucide-react'

export default function MercurialeCatalogue() {
  const [produits, setProduits] = useState([])
  const [epiceries, setEpiceries] = useState([])
  const [panier, setPanier] = useState({})
  const [epicerieId, setEpicerieId] = useState('')
  const [loading, setLoading] = useState(true)
  const [commande, setCommande] = useState(false)
  const [confirme, setConfirme] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('mercuriale_produits').select('*').eq('disponible', true).order('nom'),
      supabase.from('mercuriale_epiceries').select('*').order('nom'),
    ])
    setProduits(p || [])
    setEpiceries(e || [])
    setLoading(false)
  }

  function updatePanier(produitId, val) {
    const qty = Math.max(0, parseInt(val) || 0)
    if (qty === 0) {
      const newPanier = { ...panier }
      delete newPanier[produitId]
      setPanier(newPanier)
    } else {
      setPanier({ ...panier, [produitId]: qty })
    }
  }

  const nbArticles = Object.values(panier).reduce((a, b) => a + b, 0)
  const totalHT = Object.entries(panier).reduce((acc, [id, qty]) => {
    const p = produits.find(p => p.id === id)
    return acc + (p ? qty * p.prix_ht * p.nombre_par_colis : 0)
  }, 0)

  async function passerCommande() {
    if (!epicerieId) return
    const { data: cmd } = await supabase.from('mercuriale_commandes').insert({
      epicerie_id: epicerieId,
      statut: 'en_attente',
    }).select().single()

    if (cmd) {
      for (const [produitId, qty] of Object.entries(panier)) {
        const p = produits.find(p => p.id === produitId)
        await supabase.from('mercuriale_lignes').insert({
          commande_id: cmd.id,
          produit_id: produitId,
          quantite_colis: qty,
          prix_unitaire: p?.prix_ht || 0,
        })
      }
    }
    setPanier({})
    setEpicerieId('')
    setCommande(false)
    setConfirme(true)
    setTimeout(() => setConfirme(false), 4000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75' }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Ferme des Volonteux</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>FR-BIO-15 · Agriculture France</div>
          </div>
        </div>
        <button onClick={() => setCommande(true)} disabled={nbArticles === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: nbArticles > 0 ? '#1D9E75' : '#e5e7eb', color: nbArticles > 0 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: nbArticles > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
          <ShoppingCart size={15} />
          {nbArticles > 0 ? `${nbArticles} colis · ${totalHT.toFixed(2)} € HT` : 'Panier vide'}
        </button>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {confirme && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#166534' }}>
            <Check size={14} /> Commande envoyée ! Nous vous recontacterons rapidement.
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
            {produits.map(p => {
              const qtyPanier = panier[p.id] || 0
              return (
                <div key={p.id} style={{ background: '#fff', border: `1px solid ${qtyPanier > 0 ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{p.nom}</span>
                      {p.variete && <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.variete}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                      Colis de {p.nombre_par_colis} {p.unite === 'kg' ? 'kg' : 'pièces'}
                      {p.quantite_dispo > 0 && <span style={{ color: '#1D9E75', marginLeft: 6 }}>· {p.quantite_dispo} dispo</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{(p.prix_ht * p.nombre_par_colis).toFixed(2)} €</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>HT / colis</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => updatePanier(p.id, qtyPanier - 1)} disabled={qtyPanier === 0}
                      style={{ width: 26, height: 26, border: '1px solid #e5e7eb', borderRadius: 5, cursor: qtyPanier > 0 ? 'pointer' : 'default', background: qtyPanier > 0 ? '#f9fafb' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                      <Minus size={11} />
                    </button>
                    <input type="number" min="0" value={qtyPanier || ''} placeholder="0"
                      onChange={e => updatePanier(p.id, e.target.value)}
                      style={{ width: 36, textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 5, padding: '3px 4px', fontSize: 12 }} />
                    <button onClick={() => updatePanier(p.id, qtyPanier + 1)}
                      style={{ width: 26, height: 26, border: '1px solid #1D9E75', borderRadius: 5, cursor: 'pointer', background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {commande && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Valider la commande</span>
              <button onClick={() => setCommande(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Votre épicerie</div>
              <select value={epicerieId} onChange={e => setEpicerieId(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <option value="">-- Sélectionner --</option>
                {epiceries.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              {Object.entries(panier).map(([id, qty]) => {
                const p = produits.find(p => p.id === id)
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''} × {qty} colis</span>
                    <span style={{ fontWeight: 500 }}>{(qty * (p?.prix_ht || 0) * (p?.nombre_par_colis || 1)).toFixed(2)} €</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14, marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <span>Total HT</span>
                <span>{totalHT.toFixed(2)} €</span>
              </div>
            </div>
            <button onClick={passerCommande} disabled={!epicerieId}
              style={{ width: '100%', background: epicerieId ? '#1D9E75' : '#e5e7eb', color: epicerieId ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, padding: '11px', cursor: epicerieId ? 'pointer' : 'default', fontSize: 14, fontWeight: 600 }}>
              Envoyer la commande
            </button>
          </div>
        </div>
      )}
    </div>
  )
}