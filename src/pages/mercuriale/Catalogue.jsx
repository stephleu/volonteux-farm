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
    <div style={{ minHeight: '100vh', background: 'var(--fond)' }}>
      {/* Header */}
      <div style={{ background: 'var(--papier)', borderBottom: '1px solid var(--trait)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--encre)' }}>Ferme des Volonteux</div>
            <div style={{ fontSize: 11, color: 'var(--encre-pale)' }}>FR-BIO-15 · Agriculture France</div>
          </div>
        </div>
        <button onClick={() => setCommande(true)} disabled={nbArticles === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: nbArticles > 0 ? 'var(--accent)' : 'var(--trait-leger)', color: nbArticles > 0 ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '9px 18px', cursor: nbArticles > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
          <ShoppingCart size={15} />
          {nbArticles > 0 ? `${nbArticles} colis · ${totalHT.toFixed(2)} € HT` : 'Panier vide'}
        </button>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {confirme && (
          <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--vert-fonce)' }}>
            <Check size={14} /> Commande envoyée ! Nous vous recontacterons rapidement.
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--encre-pale)' }}>Chargement...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
            {produits.map(p => {
              const qtyPanier = panier[p.id] || 0
              return (
                <div key={p.id} style={{ background: 'var(--papier)', border: `1px solid ${qtyPanier > 0 ? 'var(--accent)' : 'var(--trait-leger)'}`, borderRadius: 0, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--encre)' }}>{p.nom}</span>
                      {p.variete && <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>{p.variete}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginTop: 1 }}>
                      Colis de {p.nombre_par_colis} {p.unite === 'kg' ? 'kg' : 'pièces'}
                      {p.quantite_dispo > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· {p.quantite_dispo} dispo</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--encre)' }}>{(p.prix_ht * p.nombre_par_colis).toFixed(2)} €</div>
                    <div style={{ fontSize: 10, color: 'var(--encre-pale)' }}>HT / colis</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => updatePanier(p.id, qtyPanier - 1)} disabled={qtyPanier === 0}
                      style={{ width: 26, height: 26, border: '1px solid var(--trait)', borderRadius: 0, cursor: qtyPanier > 0 ? 'pointer' : 'default', background: qtyPanier > 0 ? 'var(--fond)' : 'var(--fond)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--encre-douce)' }}>
                      <Minus size={11} />
                    </button>
                    <input type="number" min="0" value={qtyPanier || ''} placeholder="0"
                      onChange={e => updatePanier(p.id, e.target.value)}
                      style={{ width: 36, textAlign: 'center', border: '1px solid var(--trait)', borderRadius: 0, padding: '3px 4px', fontSize: 12 }} />
                    <button onClick={() => updatePanier(p.id, qtyPanier + 1)}
                      style={{ width: 26, height: 26, border: '1px solid var(--accent)', borderRadius: 0, cursor: 'pointer', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--papier)' }}>
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
          <div style={{ background: 'var(--papier)', borderRadius: 0, padding: 28, width: 440, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Valider la commande</span>
              <button onClick={() => setCommande(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--encre-douce)', marginBottom: 4 }}>Votre épicerie</div>
              <select value={epicerieId} onChange={e => setEpicerieId(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid var(--trait)', borderRadius: 0 }}>
                <option value="">-- Sélectionner --</option>
                {epiceries.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--fond)', borderRadius: 0, padding: 12, marginBottom: 16 }}>
              {Object.entries(panier).map(([id, qty]) => {
                const p = produits.find(p => p.id === id)
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--trait-leger)' }}>
                    <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''} × {qty} colis</span>
                    <span style={{ fontWeight: 500 }}>{(qty * (p?.prix_ht || 0) * (p?.nombre_par_colis || 1)).toFixed(2)} €</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--trait)' }}>
                <span>Total HT</span>
                <span>{totalHT.toFixed(2)} €</span>
              </div>
            </div>
            <button onClick={passerCommande} disabled={!epicerieId}
              style={{ width: '100%', background: epicerieId ? 'var(--accent)' : 'var(--trait-leger)', color: epicerieId ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '11px', cursor: epicerieId ? 'pointer' : 'default', fontSize: 14, fontWeight: 600 }}>
              Envoyer la commande
            </button>
          </div>
        </div>
      )}
    </div>
  )
}