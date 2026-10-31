import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Minus, X, Printer, Mail } from 'lucide-react'
import { SELECT_COMMANDE, prixLigne, prixMercu, totalCommande, htmlBonDeLivraison, imprimerHtml } from '../../lib/bonDeLivraison'
import { EnTetePage, BoutonAjouter } from '../../components/ui.jsx'
import { useChargement } from '../../lib/useChargement'

export default function MerculialeCommandes() {
  const [commandes, setCommandes] = useState([])
  const [epiceries, setEpiceries] = useState([])
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [commandeSelectionnee, setCommandeSelectionnee] = useState(null)
  const [form, setForm] = useState({ epicerie_id: '', notes: '' })
  const [lignes, setLignes] = useState([{ produit_id: '', quantite_colis: 1 }])

  async function fetchData() {
    const [{ data: c }, { data: e }, { data: p }] = await Promise.all([
      supabase.from('mercuriale_commandes').select(SELECT_COMMANDE).order('date_commande', { ascending: false }),
      supabase.from('mercuriale_epiceries').select('*').order('nom'),
      supabase.from('mercuriale_produits').select('*').eq('disponible', true).order('nom'),
    ])
    setCommandes(c || [])
    setEpiceries(e || [])
    setProduits(p || [])
    setLoading(false)
  }
  useChargement(fetchData)

  async function handleSave() {
    const { data: commande, error } = await supabase.from('mercuriale_commandes').insert({
      epicerie_id: form.epicerie_id,
      notes: form.notes || null,
      statut: 'en_attente',
    }).select().single()
    if (error) {
      alert(`Commande non enregistrée : ${error.message}`)
      return
    }

    // Toutes les lignes en une fois ; si ça échoue, on ne laisse pas une commande vide
    const lignesValides = lignes.filter(l => l.produit_id && l.quantite_colis > 0)
    const { error: erreurLignes } = await supabase.from('mercuriale_lignes').insert(lignesValides.map(ligne => ({
      commande_id: commande.id,
      produit_id: ligne.produit_id,
      quantite_colis: parseInt(ligne.quantite_colis),
      prix_unitaire: prixMercu(produits.find(p => p.id === ligne.produit_id)),
    })))
    if (erreurLignes) {
      await supabase.from('mercuriale_commandes').delete().eq('id', commande.id)
      alert(`Commande non enregistrée : ${erreurLignes.message}`)
      return
    }
    setShowForm(false)
    setForm({ epicerie_id: '', notes: '' })
    setLignes([{ produit_id: '', quantite_colis: 1 }])
    fetchData()
  }

  async function changerStatut(id, statut) {
    await supabase.from('mercuriale_commandes').update({ statut }).eq('id', id)
    // Commande livrée : le BL part automatiquement chez le comptable
    // (envoyerBL recharge déjà la liste)
    if (statut === 'livree') await envoyerBL({ id })
    else fetchData()
  }

  // ---- Modification d'une commande (sans prévenir l'épicerie) ----

  async function changerQuantite(ligne, delta) {
    const quantite = ligne.quantite_colis + delta
    if (quantite <= 0) return supprimerLigne(ligne)
    const { error } = await supabase.from('mercuriale_lignes').update({ quantite_colis: quantite }).eq('id', ligne.id)
    if (error) alert(`Modification impossible : ${error.message}`)
    fetchData()
  }

  async function supprimerLigne(ligne) {
    if (!window.confirm(`Retirer ${ligne.mercuriale_produits?.nom} de la commande ?`)) return
    const { error } = await supabase.from('mercuriale_lignes').delete().eq('id', ligne.id)
    if (error) alert(`Suppression impossible : ${error.message}`)
    fetchData()
  }

  async function ajouterProduit(commande, produitId) {
    const existante = (commande.mercuriale_lignes || []).find(l => l.produit_id === produitId)
    if (existante) return changerQuantite(existante, 1)
    const { error } = await supabase.from('mercuriale_lignes').insert({
      commande_id: commande.id,
      produit_id: produitId,
      quantite_colis: 1,
      prix_unitaire: prixMercu(produits.find(p => p.id === produitId)),
    })
    if (error) alert(`Ajout impossible : ${error.message}`)
    fetchData()
  }

  // ---- Envoi du BL au comptable (fonction serveur api/envoyer-bl) ----

  const [envoiBL, setEnvoiBL] = useState({}) // id commande → { etat: 'en_cours' | 'erreur', message }

  async function envoyerBL(commande) {
    setEnvoiBL(e => ({ ...e, [commande.id]: { etat: 'en_cours' } }))
    const { data: { session } } = await supabase.auth.getSession()
    let erreur = null
    try {
      const reponse = await fetch('/api/envoyer-bl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ commandeId: commande.id }),
      })
      const resultat = await reponse.json().catch(() => ({}))
      if (!reponse.ok) erreur = resultat.erreur || `erreur ${reponse.status}`
    } catch {
      erreur = 'serveur injoignable'
    }
    setEnvoiBL(e => ({ ...e, [commande.id]: erreur ? { etat: 'erreur', message: erreur } : undefined }))
    fetchData()
  }

  async function supprimerCommande(id) {
    const commande = commandes.find(c => c.id === id)
    if (!window.confirm(`Supprimer définitivement la commande de ${commande?.mercuriale_epiceries?.nom || 'cette épicerie'} du ${commande ? new Date(commande.date_commande).toLocaleDateString('fr-FR') : ''} ?`)) return
    await supabase.from('mercuriale_lignes').delete().eq('commande_id', id)
    const { error } = await supabase.from('mercuriale_commandes').delete().eq('id', id)
    if (error) alert(`Suppression impossible : ${error.message}`)
    setCommandeSelectionnee(null)
    fetchData()
  }

  function updateLigne(i, key, val) {
    const updated = [...lignes]
    updated[i][key] = val
    setLignes(updated)
  }

  const imprimerBL = commande => imprimerHtml(htmlBonDeLivraison(commande))

  const statutCouleur = { en_attente: '#fff09e', confirmee: '#9dca9a', livree: '#d6d3cc' }
  const statutLabel = { en_attente: 'En attente', confirmee: 'Confirmée', livree: 'Livrée' }
  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }
  const boutonQuantite = { width: 22, height: 22, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }

  return (
    <div>
      <EnTetePage titre="Commandes" sousTitre={<>{commandes.filter(c => c.statut === 'en_attente').length} en attente · {commandes.length} total</>}>
        <BoutonAjouter onClick={() => setShowForm(true)}>Nouvelle commande</BoutonAjouter>
      </EnTetePage>

      {showForm && (
        <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Nouvelle commande</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Épicerie</div>
              <select value={form.epicerie_id} onChange={e => setForm({ ...form, epicerie_id: e.target.value })} style={inputStyle}>
                <option value="">-- Choisir --</option>
                {epiceries.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Notes</div>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} placeholder="Optionnel" />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)', marginBottom: 8 }}>Produits</div>
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)' }}><X size={14} /></button>
              )}
            </div>
          ))}
          <button onClick={() => setLignes([...lignes, { produit_id: '', quantite_colis: 1 }])}
            style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px solid var(--vert)', borderRadius: 0, padding: '4px 10px', cursor: 'pointer', marginBottom: 14 }}>
            + Ajouter un produit
          </button>

          <div>
            <button onClick={handleSave} disabled={!form.epicerie_id}
              style={{ background: form.epicerie_id ? 'var(--accent)' : 'var(--trait-leger)', color: form.epicerie_id ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              Créer la commande
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {commandes.map(commande => (
          <div key={commande.id} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
              onClick={() => setCommandeSelectionnee(commandeSelectionnee?.id === commande.id ? null : commande)}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: statutCouleur[commande.statut], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre)' }}>{commande.mercuriale_epiceries?.nom}</div>
                <div style={{ fontSize: 12, color: 'var(--encre-douce)' }}>
                  {new Date(commande.date_commande).toLocaleDateString('fr-FR')} · {commande.mercuriale_lignes?.length || 0} produit(s) · {totalCommande(commande)} € HT
                  {commande.notes && <strong style={{ color: 'var(--encre)' }}> · {commande.notes}</strong>}
                </div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 0, background: statutCouleur[commande.statut] + '44', color: 'var(--encre)' }}>
                {statutLabel[commande.statut]}
              </span>
              <button onClick={e => { e.stopPropagation(); imprimerBL(commande) }}
                style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Printer size={12} /> BL
              </button>
            </div>

            {commandeSelectionnee?.id === commande.id && (
              <div style={{ borderTop: '1px solid var(--trait-leger)', padding: '12px 16px' }}>
                {/* Lignes modifiables (l'épicerie n'est pas prévenue) tant que la commande n'est pas livrée ;
                    une fois livrée, elle est figée : son BL a été envoyé au comptable */}
                {commande.statut === 'livree' && (
                  <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--encre-douce)' }}>Commande livrée : figée, elle ne peut plus être modifiée.</div>
                )}
                {(commande.mercuriale_lignes || []).map(l => {
                  const p = l.mercuriale_produits
                  return (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 150px 100px 24px', alignItems: 'center', gap: 10, fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--trait-leger)' }}>
                      <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {commande.statut !== 'livree' && <button onClick={() => changerQuantite(l, -1)} aria-label="Retirer un colis" style={boutonQuantite}><Minus size={11} /></button>}
                        <strong style={{ minWidth: 22, textAlign: 'center' }}>{l.quantite_colis}</strong>
                        {commande.statut !== 'livree' && <button onClick={() => changerQuantite(l, 1)} aria-label="Ajouter un colis" style={boutonQuantite}><Plus size={11} /></button>}
                      </span>
                      <span style={{ color: 'var(--encre-douce)' }}>colis × {p?.nombre_par_colis} {p?.unite === 'kg' ? 'kg' : 'pièces'}</span>
                      <span style={{ textAlign: 'right' }}>{(l.quantite_colis * prixLigne(l) * (p?.nombre_par_colis || 1)).toFixed(2)} € HT</span>
                      {commande.statut !== 'livree'
                        ? <button onClick={() => supprimerLigne(l)} aria-label="Supprimer la ligne" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)', padding: 0 }}><X size={13} /></button>
                        : <span />}
                    </div>
                  )
                })}
                {commande.statut !== 'livree' && (
                  <select value="" onChange={e => e.target.value && ajouterProduit(commande, e.target.value)}
                    style={{ ...inputStyle, width: 'auto', marginTop: 8 }}>
                    <option value="">+ Ajouter un produit…</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom}{p.variete ? ` · ${p.variete}` : ''}</option>)}
                  </select>
                )}

                <div style={{ fontSize: 12, color: 'var(--encre-douce)', marginTop: 10 }}>
                  {envoiBL[commande.id]?.etat === 'en_cours' ? 'Envoi du BL au comptable…'
                    : envoiBL[commande.id]?.etat === 'erreur' ? <span style={{ color: 'var(--rouge)' }}>BL non envoyé : {envoiBL[commande.id].message}</span>
                    : commande.bl_envoye_le ? `BL envoyé au comptable le ${new Date(commande.bl_envoye_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
                    : 'BL pas encore envoyé au comptable (envoi automatique quand la commande est marquée livrée)'}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => imprimerBL(commande)}
                    style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Printer size={12} /> Imprimer le BL
                  </button>
                  <button onClick={() => envoyerBL(commande)} disabled={envoiBL[commande.id]?.etat === 'en_cours'}
                    style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={12} /> {commande.bl_envoye_le ? 'Renvoyer le BL au comptable' : 'Envoyer le BL au comptable'}
                  </button>
                  {commande.statut === 'en_attente' && (
                    <button onClick={() => changerStatut(commande.id, 'confirmee')}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 0, cursor: 'pointer', background: 'var(--accent)', color: 'var(--papier)' }}>
                      Confirmer
                    </button>
                  )}
                  {commande.statut === 'confirmee' && (
                    <button onClick={() => changerStatut(commande.id, 'livree')}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 0, cursor: 'pointer', background: 'var(--bleu)', color: 'var(--papier)' }}>
                      Marquer livrée
                    </button>
                  )}
                  {commande.statut !== 'livree' && (
                    <button onClick={() => supprimerCommande(commande.id)}
                      style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12, border: '1px solid var(--rouge-clair)', borderRadius: 0, cursor: 'pointer', background: 'var(--rouge-pale)', color: 'var(--rouge)' }}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && commandes.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--encre-pale)' }}>
            Aucune commande pour l'instant
          </div>
        )}
      </div>
    </div>
  )
}