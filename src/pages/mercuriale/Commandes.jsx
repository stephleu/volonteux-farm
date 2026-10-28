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
      prix_unitaire: produits.find(p => p.id === ligne.produit_id)?.prix_ht || 0,
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

  // Prix au moment de la commande (prix_unitaire), pas le prix actuel du produit
  const prixLigne = l => Number(l.prix_unitaire ?? l.mercuriale_produits?.prix_ht ?? 0)

  function totalCommande(commande) {
    return (commande.mercuriale_lignes || []).reduce((acc, l) => {
      return acc + (l.quantite_colis * prixLigne(l) * (l.mercuriale_produits?.nombre_par_colis || 1))
    }, 0).toFixed(2)
  }

  function imprimerBL(commande) {
    const echapper = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const epicerie = echapper(commande.mercuriale_epiceries?.nom)
    const adresse = echapper(commande.mercuriale_epiceries?.adresse)
    const email = echapper(commande.mercuriale_epiceries?.email)
    const date = new Date(commande.date_commande).toLocaleDateString('fr-FR')

    const euros = n => `${n.toFixed(2).replace('.', ',')} €`
    const totalHT = Number(totalCommande(commande))
    const tva = totalHT * 0.055
    const numero = String(commande.id).slice(0, 8).toUpperCase()

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
      @page { size: A4; margin: 14mm; }
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
      @media screen { body { padding: 14mm; max-width: 210mm; margin: 0 auto; } }
    </style>
    </head><body>
    <div class="entete">
      <div>
        <div class="ferme">Ferme des<br/>Volonteux</div>
        <div class="script">Maraîchage · Arboriculture · Épices</div>
      </div>
      <div class="titre">Bon de livraison<small>N° ${numero} · ${date}</small></div>
    </div>
    <div class="filet"></div>

    <div class="blocs">
      <div class="bloc">
        <div class="etiquette">Fournisseur</div>
        <div class="nom">Ferme des Volonteux</div>
        SIRET 537 594 558 00018 · APE 0113Z<br/>
        TVA FR91537594558 · FR-BIO-15<br/>
        maraicher26volonteux@gmail.com
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

    const w = window.open('', '_blank')
    if (!w) {
      alert('Le navigateur a bloqué la fenêtre du bon de livraison : autorisez les fenêtres pop-up pour ce site.')
      return
    }
    // On attend les polices et le logo avant d'imprimer, sinon la première impression sort en police par défaut
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

  const statutCouleur = { en_attente: '#fff09e', confirmee: '#9dca9a', livree: '#d6d3cc' }
  const statutLabel = { en_attente: 'En attente', confirmee: 'Confirmée', livree: 'Livrée' }
  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Commandes</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{commandes.filter(c => c.statut === 'en_attente').length} en attente · {commandes.length} total</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--papier)', border: 'none', borderRadius: 0, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> Nouvelle commande
        </button>
      </div>

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
                {(commande.mercuriale_lignes || []).map((l, i) => {
                  const p = l.mercuriale_produits
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--trait-leger)' }}>
                      <span>{p?.nom}{p?.variete ? ` · ${p.variete}` : ''}</span>
                      <span style={{ color: 'var(--encre-douce)' }}>{l.quantite_colis} colis × {p?.nombre_par_colis} {p?.unite === 'kg' ? 'kg' : 'pièces'}</span>
                      <span>{(l.quantite_colis * prixLigne(l) * (p?.nombre_par_colis || 1)).toFixed(2)} € HT</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
                  <button onClick={() => supprimerCommande(commande.id)}
                    style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--rouge-clair)', borderRadius: 0, cursor: 'pointer', background: 'var(--rouge-pale)', color: 'var(--rouge)' }}>
                    Supprimer
                  </button>
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