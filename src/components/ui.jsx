import { Plus } from 'lucide-react'

// Éléments d'interface communs à toutes les pages (identité Volonteux : angles droits, doubles filets)

// En-tête de page : titre, ligne d'information en dessous, et à droite les onglets ou boutons
export function EnTetePage({ titre, sousTitre, children, marge = 20 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: marge }}>
      <div>
        <h1>{titre}</h1>
        {sousTitre && <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{sousTitre}</p>}
      </div>
      {children}
    </div>
  )
}

// Boutons d'onglets collés : options = [['valeur', 'Libellé'], …]
export function Onglets({ valeur, onChange, options, petit = false }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--trait)', overflow: 'hidden' }}>
      {options.map(([v, libelle]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ padding: petit ? '5px 12px' : '7px 14px', fontSize: petit ? 12 : 13, border: 'none', cursor: 'pointer', background: valeur === v ? 'var(--accent)' : 'var(--fond)', color: valeur === v ? 'var(--papier)' : 'var(--encre-douce)' }}>
          {libelle}
        </button>
      ))}
    </div>
  )
}

// Séparateur à chaque nouvelle année dans les plannings
export function SeparateurAnnee({ annee }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontStretch: '75%', textTransform: 'uppercase' }}>{annee}</div>
      <div style={{ height: 6, borderTop: '2px solid var(--trait)', borderBottom: '2px solid var(--trait)', margin: '4px 0 8px' }} />
    </div>
  )
}

// Bouton principal « + Nouvelle … »
export function BoutonAjouter({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--papier)', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
      <Plus size={14} /> {children}
    </button>
  )
}
