import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Check } from 'lucide-react'

export default function MercurialeProduits() {
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProduit, setEditProduit] = useState(null)
  const [form, setForm] = useState({
    nom: '', variete: '', unite: 'piece', nombre_par_colis: 10,
    prix_ht: '', prix_remise: '', prix_ttc: '',
    disponible: true, quantite_dispo: 0,
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('mercuriale_produits').select('*').order('nom')
    setProduits(data || [])
    setLoading(false)
  }

  function calculPrixTTC(ht) {
    return ht ? (parseFloat(ht) * 1.055).toFixed(2) : ''
  }

  function calculPrixRemise(ht) {
    return ht ? (parseFloat(ht) * 0.8).toFixed(2) : ''
  }

  function handlePrixHT(val) {
    setForm({
      ...form,
      prix_ht: val,
      prix_remise: calculPrixRemise(val),
      prix_ttc: calculPrixTTC(val),
    })
  }

  function handlePrixTTC(val) {
  const ttc = parseFloat(val)
  const ht = ttc ? (ttc / 1.055).toFixed(2) : ''
  setForm({
    ...form,
    prix_ttc: val,
    prix_ht: ht,
    prix_remise: ht ? (parseFloat(ht) * 0.8).toFixed(2) : '',
  })
}

  async function handleSave() {
    const payload = {
      nom: form.nom,
      variete: form.variete || null,
      unite: form.unite,
      nombre_par_colis: parseInt(form.nombre_par_colis),
      prix_ht: parseFloat(form.prix_ht),
      prix_remise: parseFloat(form.prix_remise),
      prix_ttc: parseFloat(form.prix_ttc),
      disponible: form.disponible,
      quantite_dispo: parseInt(form.quantite_dispo),
    }
    if (editProduit) {
      await supabase.from('mercuriale_produits').update(payload).eq('id', editProduit.id)
    } else {
      await supabase.from('mercuriale_produits').insert(payload)
    }
    setShowForm(false)
    setEditProduit(null)
    resetForm()
    fetchData()
  }

  async function toggleDispo(produit) {
    await supabase.from('mercuriale_produits').update({ disponible: !produit.disponible }).eq('id', produit.id)
    fetchData()
  }

  async function supprimerProduit(id) {
    await supabase.from('mercuriale_produits').delete().eq('id', id)
    fetchData()
  }

  function resetForm() {
    setForm({ nom: '', variete: '', unite: 'piece', nombre_par_colis: 10, prix_ht: '', prix_remise: '', prix_ttc: '', disponible: true, quantite_dispo: 0 })
  }

  function ouvrirEdit(produit) {
    setForm({
      nom: produit.nom,
      variete: produit.variete || '',
      unite: produit.unite,
      nombre_par_colis: produit.nombre_par_colis,
      prix_ht: produit.prix_ht,
      prix_remise: produit.prix_remise,
      prix_ttc: produit.prix_ttc,
      disponible: produit.disponible,
      quantite_dispo: produit.quantite_dispo,
    })
    setEditProduit(produit)
    setShowForm(true)
  }

  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Produits</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{produits.length} produits au catalogue</p>
        </div>
        <button onClick={() => { resetForm(); setEditProduit(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> Nouveau produit
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{editProduit ? 'Modifier le produit' : 'Nouveau produit'}</span>
            <button onClick={() => { setShowForm(false); setEditProduit(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Nom</div>
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} placeholder="Carotte" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Variété</div>
              <input value={form.variete} onChange={e => setForm({ ...form, variete: e.target.value })} style={inputStyle} placeholder="Optionnel" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Unité</div>
              <select value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })} style={inputStyle}>
                <option value="piece">Pièce</option>
                <option value="kg">Kg</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Nb par colis</div>
              <input type="number" value={form.nombre_par_colis} onChange={e => setForm({ ...form, nombre_par_colis: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Prix HT (€)</div>
              <input type="number" step="0.01" value={form.prix_ht} onChange={e => handlePrixHT(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Prix -20% HT (€)</div>
              <input type="number" step="0.01" value={form.prix_remise} onChange={e => setForm({ ...form, prix_remise: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Prix TTC (€)</div>
              <input type="number" step="0.01" value={form.prix_ttc} onChange={e => handlePrixTTC(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Quantité dispo (colis)</div>
              <input type="number" value={form.quantite_dispo} onChange={e => setForm({ ...form, quantite_dispo: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.disponible} onChange={e => setForm({ ...form, disponible: e.target.checked })} />
                Disponible
              </label>
            </div>
          </div>
          <button onClick={handleSave} disabled={!form.nom || !form.prix_ht}
            style={{ background: form.nom && form.prix_ht ? '#1D9E75' : '#e5e7eb', color: form.nom && form.prix_ht ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            {editProduit ? 'Mettre à jour' : 'Créer le produit'}
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px 80px 100px', padding: '8px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
          <div>Produit</div>
          <div style={{ textAlign: 'center' }}>Unité</div>
          <div style={{ textAlign: 'center' }}>Colis</div>
          <div style={{ textAlign: 'right' }}>Prix HT</div>
          <div style={{ textAlign: 'right' }}>-20%</div>
          <div style={{ textAlign: 'right' }}>TTC</div>
          <div style={{ textAlign: 'center' }}>Qté</div>
          <div style={{ textAlign: 'center' }}>Actions</div>
        </div>
        {produits.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px 80px 100px', padding: '10px 14px', borderBottom: '1px solid #f3f4f6', alignItems: 'center', opacity: p.disponible ? 1 : 0.5 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{p.nom}{p.variete ? ` · ${p.variete}` : ''}</div>
              {!p.disponible && <span style={{ fontSize: 10, color: '#ef4444' }}>Indisponible</span>}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#6b7280' }}>{p.unite === 'kg' ? 'Kg' : 'Pièce'}</div>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#6b7280' }}>{p.nombre_par_colis}</div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>{p.prix_ht?.toFixed(2)} €</div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#1D9E75' }}>{p.prix_remise?.toFixed(2)} €</div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>{p.prix_ttc?.toFixed(2)} €</div>
            <div style={{ textAlign: 'center', fontSize: 12 }}>{p.quantite_dispo}</div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              <button onClick={() => toggleDispo(p)}
                style={{ padding: '3px 8px', fontSize: 11, border: `1px solid ${p.disponible ? '#86efac' : '#e5e7eb'}`, borderRadius: 5, cursor: 'pointer', background: p.disponible ? '#f0fdf4' : '#f9fafb', color: p.disponible ? '#166534' : '#6b7280' }}>
                {p.disponible ? <Check size={11} /> : '—'}
              </button>
              <button onClick={() => ouvrirEdit(p)}
                style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', background: '#f9fafb', color: '#6b7280' }}>
                Modifier
              </button>
              <button onClick={() => supprimerProduit(p.id)}
                style={{ padding: '3px 6px', fontSize: 11, border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', background: '#fef2f2', color: '#ef4444' }}>
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
        {!loading && produits.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
            Aucun produit — cliquez sur "Nouveau produit" pour commencer
          </div>
        )}
      </div>
    </div>
  )
}