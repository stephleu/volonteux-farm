import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function seConnecter(e) {
    e.preventDefault()
    setEnvoi(true)
    setErreur('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    setEnvoi(false)
    if (error) setErreur('Email ou mot de passe incorrect.')
  }

  const champ = { width: '100%', fontSize: 13, padding: '8px 10px', border: '1.5px solid var(--trait)', borderRadius: 0, marginBottom: 12 }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--fond)', padding: 16 }}>
      <form onSubmit={seConnecter} style={{ width: 'min(100%, 340px)', background: 'var(--papier)', border: '2.5px solid var(--trait)', padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 26, fontStretch: '75%', lineHeight: 1, textTransform: 'uppercase' }}>Les<br />Volonteux</div>
        <div style={{ height: 7, borderTop: '2px solid var(--trait)', borderBottom: '2px solid var(--trait)', margin: '10px 0 8px' }} />
        <div style={{ fontFamily: 'var(--script)', fontStyle: 'italic', fontSize: 18, marginBottom: 20 }}>Gestion maraîchère</div>

        <label style={{ fontSize: 11, color: 'var(--encre-douce)' }}>Email
          <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} style={champ} />
        </label>
        <label style={{ fontSize: 11, color: 'var(--encre-douce)' }}>Mot de passe
          <input type="password" autoComplete="current-password" required value={motDePasse} onChange={e => setMotDePasse(e.target.value)} style={champ} />
        </label>
        {erreur && <p style={{ fontSize: 12, color: 'var(--rouge)', margin: '0 0 12px' }}>{erreur}</p>}
        <button type="submit" disabled={envoi} style={{ width: '100%', padding: 10, border: 'none', borderRadius: 0, background: 'var(--encre)', color: 'var(--papier)', fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
