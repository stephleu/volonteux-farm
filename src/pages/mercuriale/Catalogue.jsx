import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, X, Check, Minus, Plus, LogOut } from 'lucide-react'
import { ATELIERS } from '../../lib/ateliers'

// Page publique de commande pour les épiceries. Chaque épicerie se connecte avec l'identifiant
// et le mot de passe donnés par la ferme (page Épiceries) ; on les garde dans ce navigateur
// pour ne pas les redemander à chaque visite.
const CLE_ACCES = 'volonteux-acces-epicerie'

function lireAcces() {
  try { return JSON.parse(localStorage.getItem(CLE_ACCES)) } catch { return null }
}
function garderAcces(acces) {
  try { acces ? localStorage.setItem(CLE_ACCES, JSON.stringify(acces)) : localStorage.removeItem(CLE_ACCES) } catch { /* navigation privée */ }
}

const STATUTS = { en_attente: 'En attente', confirmee: 'Confirmée', livree: 'Livrée' }
const LIVRAISONS = { debut: 'Début de semaine', fin: 'Fin de semaine' }

function Entete({ epicerie, onDeconnexion, children }) {
  return (
    <div style={{ background: 'var(--papier)', borderBottom: '2.5px solid var(--trait)', padding: '14px clamp(16px, 4vw, 32px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 50 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase', lineHeight: 1 }}>Ferme des Volonteux</div>
        <div style={{ fontSize: 11, color: 'var(--encre-pale)', marginTop: 4 }}>
          FR-BIO-15 · Agriculture France{epicerie && <> · commande pour <strong style={{ color: 'var(--encre)' }}>{epicerie.nom}</strong></>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {children}
        {onDeconnexion && (
          <button onClick={onDeconnexion} title="Se déconnecter" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--trait)', padding: '8px 10px', cursor: 'pointer', fontSize: 12 }}>
            <LogOut size={13} /> Déconnexion
          </button>
        )}
      </div>
    </div>
  )
}

function Connexion({ onConnecte }) {
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function seConnecter(e) {
    e.preventDefault()
    setEnvoi(true)
    setErreur('')
    const { data, error } = await supabase.rpc('epicerie_connexion', { p_identifiant: identifiant, p_mot_de_passe: motDePasse })
    setEnvoi(false)
    if (error) return setErreur('Connexion impossible pour le moment. Réessayez dans un instant.')
    if (!data?.length) return setErreur('Identifiant ou mot de passe incorrect.')
    onConnecte({ identifiant: identifiant.trim(), motDePasse, epicerie: data[0] })
  }

  const champ = { width: '100%', fontSize: 14, padding: '9px 10px', border: '1.5px solid var(--trait)', borderRadius: 0, marginBottom: 12 }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fond)' }}>
      <Entete />
      <div style={{ display: 'grid', placeItems: 'center', padding: '48px 16px' }}>
        <form onSubmit={seConnecter} style={{ width: 'min(100%, 360px)', background: 'var(--papier)', border: '2.5px solid var(--trait)', padding: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase' }}>Espace épiceries</div>
          <div style={{ height: 7, borderTop: '2px solid var(--trait)', borderBottom: '2px solid var(--trait)', margin: '10px 0 16px' }} />
          <label style={{ fontSize: 12, color: 'var(--encre-douce)' }}>Identifiant
            <input autoComplete="username" required value={identifiant} onChange={e => setIdentifiant(e.target.value)} style={champ} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--encre-douce)' }}>Mot de passe
            <input type="password" autoComplete="current-password" required value={motDePasse} onChange={e => setMotDePasse(e.target.value)} style={champ} />
          </label>
          {erreur && <p style={{ fontSize: 12, color: 'var(--rouge)', margin: '0 0 12px' }}>{erreur}</p>}
          <button type="submit" disabled={envoi} style={{ width: '100%', padding: 11, border: 'none', background: 'var(--encre)', color: 'var(--papier)', fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
            {envoi ? 'Connexion…' : 'Accéder au catalogue'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--encre-pale)', margin: '14px 0 0' }}>Accès perdu ? Contactez la ferme : maraicher26volonteux@gmail.com</p>
        </form>
      </div>
    </div>
  )
}

export default function MercurialeCatalogue() {
  const [acces, setAcces] = useState(lireAcces)
  const [produits, setProduits] = useState([])
  const [historique, setHistorique] = useState([])
  const [panier, setPanier] = useState({})
  const [livraison, setLivraison] = useState('')
  const [loading, setLoading] = useState(true)
  const [commande, setCommande] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [confirme, setConfirme] = useState(false)

  useEffect(() => {
    if (!acces) return
    let actif = true
    Promise.all([
      supabase.from('mercuriale_produits').select('*').eq('disponible', true).order('nom'),
      supabase.rpc('epicerie_commandes', { p_identifiant: acces.identifiant, p_mot_de_passe: acces.motDePasse }),
    ]).then(([{ data: p }, { data: h, error }]) => {
      if (!actif) return
      // Mot de passe changé par la ferme depuis la dernière visite : on redemande la connexion
      if (error?.message?.includes('incorrect')) { garderAcces(null); setAcces(null); return }
      setProduits(p || [])
      setHistorique(h || [])
      setLoading(false)
    })
    return () => { actif = false }
  }, [acces, confirme])

  function connecter(nouveau) {
    garderAcces(nouveau)
    setAcces(nouveau)
  }

  function deconnecter() {
    garderAcces(null)
    setAcces(null)
    setPanier({})
  }

  if (!acces) return <Connexion onConnecte={connecter} />

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

  // Produits rangés par atelier de la ferme (ateliers vides masqués)
  const sections = ATELIERS
    .map(atelier => ({ atelier, produits: produits.filter(p => (p.atelier || 'maraichage') === atelier.id) }))
    .filter(s => s.produits.length > 0)

  const nbArticles = Object.values(panier).reduce((a, b) => a + b, 0)
  const totalHT = Object.entries(panier).reduce((acc, [id, qty]) => {
    const p = produits.find(p => p.id === id)
    return acc + (p ? qty * p.prix_ht * p.nombre_par_colis : 0)
  }, 0)

  async function passerCommande() {
    if (Object.keys(panier).length === 0) return
    setEnvoi(true)
    // Tout est vérifié côté base : identifiant, mot de passe, prix du catalogue
    const { error } = await supabase.rpc('epicerie_commander', {
      p_identifiant: acces.identifiant,
      p_mot_de_passe: acces.motDePasse,
      p_lignes: Object.entries(panier).map(([produit_id, quantite_colis]) => ({ produit_id, quantite_colis })),
      // Le jour de livraison est enregistré dans la note de la commande (visible dans Commandes et sur le BL)
      p_notes: `Livraison : ${LIVRAISONS[livraison].toLowerCase()}`,
    })
    setEnvoi(false)
    if (error) {
      alert("La commande n'a pas pu être envoyée. Réessayez dans un instant ou contactez la ferme.")
      return
    }
    setPanier({})
    setLivraison('')
    setCommande(false)
    setConfirme(true)
    setTimeout(() => setConfirme(false), 5000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fond)' }}>
      <Entete epicerie={acces.epicerie} onDeconnexion={deconnecter}>
        <button onClick={() => setCommande(true)} disabled={nbArticles === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: nbArticles > 0 ? 'var(--accent)' : 'var(--trait-leger)', color: nbArticles > 0 ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '9px 18px', cursor: nbArticles > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
          <ShoppingCart size={15} />
          {nbArticles > 0 ? `${nbArticles} colis · ${totalHT.toFixed(2)} € HT` : 'Panier vide'}
        </button>
      </Entete>

      <div style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
        {confirme && (
          <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--vert-fonce)' }}>
            <Check size={14} /> Commande envoyée ! Nous vous recontacterons rapidement.
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--encre-pale)' }}>Chargement...</div>
        ) : (
          <>
            {/* Sommaire des ateliers */}
            <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {sections.map(({ atelier, produits: liste }) => (
                <a key={atelier.id} href={`#atelier-${atelier.id}`}
                  style={{ padding: '6px 12px', border: '1.5px solid var(--trait)', background: 'var(--papier)', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {atelier.nom} · {liste.length}
                </a>
              ))}
            </nav>

            {sections.map(({ atelier, produits: liste }) => (
              <section key={atelier.id} id={`atelier-${atelier.id}`} style={{ marginBottom: 32, scrollMarginTop: 90 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 22, margin: 0 }}>{atelier.nom}</h2>
                  <span style={{ fontFamily: 'var(--script)', fontStyle: 'italic', fontSize: 18 }}>{atelier.description}</span>
                </div>
                <div style={{ height: 7, borderTop: '2px solid var(--trait)', borderBottom: '2px solid var(--trait)', margin: '8px 0 10px' }} />

                {/* Une ligne par produit : nom · colis · prix · quantité */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {liste.map(p => {
                    const qtyPanier = panier[p.id] || 0
                    return (
                      <div key={p.id} style={{ background: qtyPanier > 0 ? 'var(--jaune-pale)' : 'var(--papier)', border: `1px solid ${qtyPanier > 0 ? 'var(--trait)' : 'var(--trait-leger)'}`, borderLeft: `4px solid ${qtyPanier > 0 ? 'var(--encre)' : 'var(--trait-leger)'}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px 16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--encre)' }}>{p.nom}</span>
                          {p.variete && <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}> · {p.variete}</span>}
                        </div>
                        <div style={{ flex: '0 1 170px', fontSize: 12, color: 'var(--encre-douce)' }}>
                          Colis de {p.nombre_par_colis} {p.unite === 'kg' ? 'kg' : 'pièces'}
                          {p.quantite_dispo > 0 && <span style={{ color: 'var(--accent)' }}> · {p.quantite_dispo} dispo</span>}
                        </div>
                        <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--encre)' }}>{(p.prix_ht * p.nombre_par_colis).toFixed(2)} €</span>
                          <span style={{ fontSize: 10, color: 'var(--encre-pale)' }}> HT/colis</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => updatePanier(p.id, qtyPanier - 1)} disabled={qtyPanier === 0} aria-label={`Retirer un colis de ${p.nom}`}
                            style={{ width: 28, height: 28, border: '1px solid var(--trait)', borderRadius: 0, cursor: qtyPanier > 0 ? 'pointer' : 'default', background: 'var(--fond)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--encre-douce)' }}>
                            <Minus size={11} />
                          </button>
                          <input type="number" min="0" value={qtyPanier || ''} placeholder="0" aria-label={`Colis de ${p.nom}`}
                            onChange={e => updatePanier(p.id, e.target.value)}
                            style={{ width: 40, textAlign: 'center', border: '1px solid var(--trait)', borderRadius: 0, padding: '4px', fontSize: 13 }} />
                          <button onClick={() => updatePanier(p.id, qtyPanier + 1)} aria-label={`Ajouter un colis de ${p.nom}`}
                            style={{ width: 28, height: 28, border: '1px solid var(--accent)', borderRadius: 0, cursor: 'pointer', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--papier)' }}>
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
            {sections.length === 0 && <p style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)' }}>Aucun produit disponible pour le moment.</p>}
          </>
        )}

        {historique.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase', marginBottom: 10 }}>Vos dernières commandes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historique.map(c => {
                const total = c.lignes.reduce((acc, l) => acc + l.quantite_colis * Number(l.prix_unitaire || 0) * (l.nombre_par_colis || 1), 0)
                return (
                  <details key={c.id} style={{ background: 'var(--papier)', border: '1px solid var(--trait-leger)', padding: '10px 14px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13 }}>
                      {new Date(c.date_commande).toLocaleDateString('fr-FR')} · {c.lignes.length} produit(s) · {total.toFixed(2)} € HT · <strong>{STATUTS[c.statut] || c.statut}</strong>
                    </summary>
                    <div style={{ marginTop: 8 }}>
                      {c.lignes.map((l, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--encre-douce)', padding: '2px 0' }}>
                          {l.nom}{l.variete ? ` · ${l.variete}` : ''} — {l.quantite_colis} colis de {l.nombre_par_colis} {l.unite === 'kg' ? 'kg' : 'pièces'}
                        </div>
                      ))}
                      {c.notes && <div style={{ fontSize: 12, marginTop: 4 }}>{c.notes}</div>}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {commande && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--papier)', border: '2.5px solid var(--trait)', padding: 24, width: 460, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Valider la commande · {acces.epicerie.nom}</span>
              <button onClick={() => setCommande(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={18} /></button>
            </div>
            <div style={{ background: 'var(--fond)', borderRadius: 0, padding: 12, marginBottom: 12 }}>
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
            <div style={{ fontSize: 12, color: 'var(--encre-douce)', marginBottom: 6 }}>Livraison souhaitée</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {Object.entries(LIVRAISONS).map(([valeur, libelle]) => (
                <label key={valeur} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '8px 10px', border: `1.5px solid ${livraison === valeur ? 'var(--trait)' : 'var(--trait-leger)'}`, background: livraison === valeur ? 'var(--jaune-pale)' : 'var(--papier)' }}>
                  <input type="checkbox" checked={livraison === valeur} onChange={() => setLivraison(livraison === valeur ? '' : valeur)} />
                  {libelle}
                </label>
              ))}
            </div>
            <button onClick={passerCommande} disabled={envoi || !livraison}
              style={{ width: '100%', background: livraison ? 'var(--accent)' : 'var(--trait-leger)', color: livraison ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '11px', cursor: livraison ? 'pointer' : 'default', fontSize: 14, fontWeight: 600 }}>
              {envoi ? 'Envoi…' : livraison ? 'Envoyer la commande' : 'Choisissez un jour de livraison'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
