import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Printer } from 'lucide-react'

export default function MerculialeCommandes() {
  const [commandes, setCommandes] = useState([])
  const [epiceries, setEpiceries] = useState([])
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [commandeSelectionnee, setCommandeSelectionnee] = useState(null)
  const [form, setForm] = useState({ epicerie_id: '', notes: '' })
  const [lignes, setLignes] = useState([{ produit_id: '', quantite_colis: 1 }])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: c }, { data: e }, { data: p }] = await Promise.all([
      supabase.from('mercuriale_commandes').select('*, mercuriale_epiceries(nom, adresse, email), mercuriale_lignes(*, mercuriale_produits(nom, variete, unite, nombre_par_colis, prix_ht, prix_ttc))').order('date_commande', { ascending: false }),
      supabase.from('mercuriale_epiceries').select('*').order('nom'),
      supabase.from('mercuriale_produits').select('*').eq('disponible', true).order('nom'),
    ])
    setCommandes(c || [])
    setEpiceries(e || [])
    setProduits(p || [])
    setLoading(false)
  }

  async function handleSave() {
    const { data: commande } = await supabase.from('mercuriale_commandes').insert({
      epicerie_id: form.epicerie_id,
      notes: form.notes || null,
      statut: 'en_attente',
    }).select().single()

    if (commande) {
      const lignesValides = lignes.filter(l => l.produit_id && l.quantite_colis > 0)
      for (const ligne of lignesValides) {
        const produit = produits.find(p => p.id === ligne.produit_id)
        await supabase.from('mercuriale_lignes').insert({
          commande_id: commande.id,
          produit_id: ligne.produit_id,
          quantite_colis: parseInt(ligne.quantite_colis),
          prix_unitaire: produit?.prix_ht || 0,
        })
      }
    }
    setShowForm(false)
    setForm({ epicerie_id: '', notes: '' })
    setLignes([{ produit_id: '', quantite_colis: 1 }])
    fetchData()
  }

  async function changerStatut(id, statut) {
    await supabase.from('mercuriale_commandes').update({ statut }).eq('id', id)
    fetchData()
  }

  async function supprimerCommande(id) {
    await supabase.from('mercuriale_commandes').delete().eq('id', id)
    setCommandeSelectionnee(null)
    fetchData()
  }

  function updateLigne(i, key, val) {
    const updated = [...lignes]
    updated[i][key] = val
    setLignes(updated)
  }

  function totalCommande(commande) {
    return (commande.mercuriale_lignes || []).reduce((acc, l) => {
      return acc + (l.quantite_colis * (l.mercuriale_produits?.prix_ht || 0) * (l.mercuriale_produits?.nombre_par_colis || 1))
    }, 0).toFixed(2)
  }

  function imprimerBL(commande) {
    const epicerie = commande.mercuriale_epiceries?.nom || ''
    const adresse = commande.mercuriale_epiceries?.adresse || ''
    const email = commande.mercuriale_epiceries?.email || ''
    const date = new Date(commande.date_commande).toLocaleDateString('fr-FR')

    const lignesHTML = (commande.mercuriale_lignes || []).map(l => {
      const p = l.mercuriale_produits
      const total = (l.quantite_colis * (p?.prix_ht || 0) * (p?.nombre_par_colis || 1)).toFixed(2)
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${p?.nom || ''}${p?.variete ? ' · ' + p.variete : ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${l.quantite_colis} colis × ${p?.nombre_par_colis} ${p?.unite === 'kg' ? 'kg' : 'pièces'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${(p?.prix_ht || 0).toFixed(2)} €</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${total} €</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BL ${epicerie}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{font-size:22px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#f9fafb;padding:8px;text-align:left;font-size:12px;border-bottom:2px solid #e5e7eb}.total{text-align:right;margin-top:16px;font-size:15px;font-weight:bold}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1 style="margin:0 0 4px 0">Bon de livraison</h1>
        <div style="font-weight:bold;font-size:14px">Ferme des Volonteux</div>
        <div style="color:#6b7280;font-size:12px;line-height:1.8;margin-top:4px">
          SIRET 53759455800018<br/>
          N° TVA FR91537594558<br/>
          Code APE 0113Z<br/>
          maraicher26volonteux@gmail.com<br/>
          FR-BIO-15
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:bold">${epicerie}</div>
        <div style="color:#6b7280;font-size:12px;line-height:1.8;margin-top:4px">
          ${adresse ? adresse + '<br/>' : ''}
          ${email ? email + '<br/>' : ''}
          ${date}
        </div>
      </div>
    </div>
    <table><thead><tr>
      <th>Produit</th><th style="text-align:center">Quantité</th><th style="text-align:right">Prix HT/unité</th><th style="text-align:right">Total HT</th>
    </tr></thead><tbody>${lignesHTML}</tbody></table>
    <div class="total">Total HT : ${totalCommande(commande)} €</div>
    ${commande.notes ? `<div style="margin-top:20px;padding:12px;background:#f9fafb;border-radius:6px;font-size:13px">Notes : ${commande.notes}</div>` : ''}
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  const statutCouleur = { en_attente: '#fcd34d', confirmee: '#86efac', livree: '#e5e7eb' }
  const statutLabel = { en_attente: 'En attente', confirmee: 'Confirmée', livree: 'Livrée' }
  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Commandes</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{commandes.filter(c => c.statut === 'en_attente').length} en attente · {commandes.length} total</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> Nouvelle commande
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Nouvelle commande</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Épicerie</div>
              <select value={form.epicerie_id} onChange={e => setForm({ ...form, epicerie_id: e.target.value })} style={inputStyle}>
                <option value="">-- Choisir --</option>
                {epiceries.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Notes</div>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} placeholder="Optionnel" />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 8 }}>Produits</div>
          {lignes.map((ligne, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 2 }}>
                <select value={ligne.produit_id} onChange={e => updateLigne(i, 'produit_id', e.target.value)} style={inputStyle}>
                  <option value="">-- Produit --</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.nom}{p.variete ? ` · ${p.variete}` : ''} — {p.nombre_par_colis} {p.unite === 'kg' ? 'kg' : 'pièces'}/colis</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <input type="number" min="1" value={ligne.quantite_colis} onChange={e => updateLigne(i, 'quantite_colis', e.target.value)} style={inputStyle} placeholder="Nb colis" />
              </div>
              {lignes.length > 1 && (
                <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
              )}
            </div>
          ))}
          <button onClick={() => setLignes([...lignes, { produit_id: '', quantite_colis: 1 }])}
            style={{ fontSize: 12, color: '#1D9E75', background: 'none', border: '1px solid #86efac', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginBottom: 14 }}>
            + Ajouter un produit
          </button>

          <div>
            <button onClick={handleSave} disabled={!form.epicerie_id}
              style={{ background: form.epicerie_id ? '#1D9E75' : '#e5e7eb', color: form.epicerie_id ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              Créer la commande
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {commandes.map(commande => (
          <div key={commande.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
              onClick={() => setCommandeSelectionnee(commandeSelectionnee?.id === commande.id ? null : commande)}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: statutCouleur[commande.statut], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{commande.mercuriale_epiceries?.nom}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {new Date(commande.date_commande).toLocaleDateString('fr-FR')} · {commande.mercuriale_lignes?.length || 0} produit(s) · {totalCommande(commande)} € HT
                </div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: statutCouleur[commande.statut] + '44', color: '#111' }}>
                {statutLabel[commande.statut]}
              </span>
              <button onClick={e => { e.stopPropagation(); imprimerBL(commande) }}
                style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Printer size={12} /> BL
              </button>
            </div>

            {commandeSelectionnee?.id === commande.id && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px' }}>
                {(commande.mercuriale_lignes || []).map((l, i) => {
                  const p = l.mercuriale_produits
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f9fafb' }}>
                      <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''}</span>
                      <span style={{ color: '#6b7280' }}>{l.quantite_colis} colis × {p?.nombre_par_colis} {p?.unite === 'kg' ? 'kg' : 'pièces'}</span>
                      <span>{(l.quantite_colis * (p?.prix_ht || 0) * (p?.nombre_par_colis || 1)).toFixed(2)} € HT</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {commande.statut === 'en_attente' && (
                    <button onClick={() => changerStatut(commande.id, 'confirmee')}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1D9E75', color: '#fff' }}>
                      Confirmer
                    </button>
                  )}
                  {commande.statut === 'confirmee' && (
                    <button onClick={() => changerStatut(commande.id, 'livree')}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>
                      Marquer livrée
                    </button>
                  )}
                  <button onClick={() => supprimerCommande(commande.id)}
                    style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', background: '#fef2f2', color: '#ef4444' }}>
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && commandes.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
            Aucune commande pour l'instant
          </div>
        )}
      </div>
    </div>
  )
}