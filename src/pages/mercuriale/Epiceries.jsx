import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Pencil, Copy, Mail, RefreshCw } from 'lucide-react'
import { ATELIERS } from '../../lib/ateliers'

const FORM_VIDE = { nom: '', adresse: '', email: '', identifiant: '', mot_de_passe: '' }

// « La Carline » → « la-carline »
const versIdentifiant = nom => nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Mot de passe facile à dicter : pas de 0/O ni 1/l/I
function genererMotDePasse() {
  const lettres = 'abcdefghjkmnpqrstuvwxyz23456789'
  const octets = crypto.getRandomValues(new Uint8Array(8))
  return [...octets].map(o => lettres[o % lettres.length]).join('')
}

const lienCommande = () => `${window.location.origin}/mercuriale/catalogue`

function messageAcces(e) {
  return `Bonjour,

Voici vos accès pour commander à la Ferme des Volonteux :

Adresse : ${lienCommande()}
Identifiant : ${e.identifiant}
Mot de passe : ${e.mot_de_passe}

À bientôt !`
}

export default function MerculialeEpiceries() {
  const [epiceries, setEpiceries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEpicerie, setEditEpicerie] = useState(null)
  const [form, setForm] = useState(FORM_VIDE)
  const [copie, setCopie] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('mercuriale_epiceries').select('*').order('nom')
    setEpiceries(data || [])
    setLoading(false)
  }

  async function handleSave() {
    const payload = { ...form, identifiant: form.identifiant.trim() || null, mot_de_passe: form.mot_de_passe.trim() || null }
    const { error } = editEpicerie
      ? await supabase.from('mercuriale_epiceries').update(payload).eq('id', editEpicerie.id)
      : await supabase.from('mercuriale_epiceries').insert(payload)
    if (error) {
      alert(error.message.includes('identifiant') || error.code === '23505'
        ? 'Cet identifiant est déjà utilisé par une autre épicerie.'
        : `Enregistrement impossible : ${error.message}`)
      return
    }
    setShowForm(false)
    setEditEpicerie(null)
    setForm(FORM_VIDE)
    fetchData()
  }

  const ateliersDe = e => e.ateliers || ATELIERS.map(a => a.id)

  async function basculerAtelier(e, atelier) {
    const actuels = ateliersDe(e)
    const ateliers = actuels.includes(atelier) ? actuels.filter(a => a !== atelier) : [...actuels, atelier]
    // Mise à jour immédiate à l'écran, puis enregistrement
    setEpiceries(liste => liste.map(x => (x.id === e.id ? { ...x, ateliers } : x)))
    const { error } = await supabase.from('mercuriale_epiceries').update({ ateliers }).eq('id', e.id)
    if (error) {
      alert(`Enregistrement impossible : ${error.message}`)
      fetchData()
    }
  }

  async function supprimerEpicerie(e) {
    if (!window.confirm(`Supprimer l'épicerie ${e.nom} ?`)) return
    const { error } = await supabase.from('mercuriale_epiceries').delete().eq('id', e.id)
    if (error) alert(`Suppression impossible (elle a sans doute des commandes) : ${error.message}`)
    fetchData()
  }

  function ouvrirNouvelle() {
    setForm({ ...FORM_VIDE, mot_de_passe: genererMotDePasse() })
    setEditEpicerie(null)
    setShowForm(true)
  }

  function ouvrirEdit(e) {
    setForm({ nom: e.nom, adresse: e.adresse || '', email: e.email || '', identifiant: e.identifiant || versIdentifiant(e.nom), mot_de_passe: e.mot_de_passe || genererMotDePasse() })
    setEditEpicerie(e)
    setShowForm(true)
  }

  async function copierMessage(e) {
    try {
      await navigator.clipboard.writeText(messageAcces(e))
      setCopie(e.id)
      setTimeout(() => setCopie(null), 2000)
    } catch {
      window.prompt('Copiez ce message :', messageAcces(e))
    }
  }

  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }
  const petitBouton = { padding: '5px 10px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', color: 'var(--encre-douce)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Épiceries</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>
            {epiceries.length} épiceries · page de commande : <a href={lienCommande()} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{lienCommande()}</a>
          </p>
        </div>
        <button onClick={ouvrirNouvelle}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--papier)', border: 'none', borderRadius: 0, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> Nouvelle épicerie
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{editEpicerie ? 'Modifier' : 'Nouvelle épicerie'}</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Nom</div>
              <input value={form.nom} placeholder="La Carline" style={inputStyle}
                onChange={e => setForm({ ...form, nom: e.target.value, ...(!editEpicerie && { identifiant: versIdentifiant(e.target.value) }) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Adresse</div>
              <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} style={inputStyle} placeholder="12 rue..." />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Email</div>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="contact@..." />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Identifiant de commande</div>
              <input value={form.identifiant} onChange={e => setForm({ ...form, identifiant: e.target.value })} style={inputStyle} placeholder="la-carline" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Mot de passe</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={form.mot_de_passe} onChange={e => setForm({ ...form, mot_de_passe: e.target.value })} style={inputStyle} />
                <button onClick={() => setForm({ ...form, mot_de_passe: genererMotDePasse() })} title="Générer un nouveau mot de passe" style={{ ...petitBouton, padding: '4px 8px' }}>
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={!form.nom}
            style={{ background: form.nom ? 'var(--accent)' : 'var(--trait-leger)', color: form.nom ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            {editEpicerie ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {epiceries.map(e => (
          <div key={e.id} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre)' }}>{e.nom}</div>
              <div style={{ fontSize: 12, color: 'var(--encre-douce)', marginTop: 2 }}>
                {e.adresse && <span>{e.adresse}</span>}
                {e.adresse && e.email && <span> · </span>}
                {e.email && <a href={`mailto:${e.email}`} style={{ color: 'var(--accent)' }}>{e.email}</a>}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {e.identifiant && e.mot_de_passe
                  ? <span>Accès : <strong>{e.identifiant}</strong> / <strong>{e.mot_de_passe}</strong></span>
                  : <span style={{ color: 'var(--rouge)' }}>Pas encore d'accès : cliquez sur Modifier pour en créer un</span>}
              </div>
              {/* Ateliers visibles et commandables par cette épicerie (tout coché par défaut) */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
                {ATELIERS.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={ateliersDe(e).includes(a.id)} onChange={() => basculerAtelier(e, a.id)} />
                    {a.nom}
                  </label>
                ))}
              </div>
            </div>
            {e.identifiant && e.mot_de_passe && (
              <>
                <button onClick={() => copierMessage(e)} style={petitBouton}>
                  <Copy size={12} /> {copie === e.id ? 'Copié !' : 'Copier les accès'}
                </button>
                {e.email && (
                  <a href={`mailto:${e.email}?subject=${encodeURIComponent('Vos accès pour commander à la Ferme des Volonteux')}&body=${encodeURIComponent(messageAcces(e))}`} style={petitBouton}>
                    <Mail size={12} /> Envoyer par email
                  </a>
                )}
              </>
            )}
            <button onClick={() => ouvrirEdit(e)} style={petitBouton}>
              <Pencil size={12} /> Modifier
            </button>
            <button onClick={() => supprimerEpicerie(e)}
              style={{ padding: '5px 8px', fontSize: 12, border: '1px solid var(--rouge-clair)', borderRadius: 0, cursor: 'pointer', background: 'var(--rouge-pale)', color: 'var(--rouge)' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {!loading && epiceries.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--encre-pale)' }}>
            Aucune épicerie — cliquez sur "Nouvelle épicerie" pour commencer
          </div>
        )}
      </div>
    </div>
  )
}
