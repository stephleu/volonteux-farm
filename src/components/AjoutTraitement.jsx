import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { BoutonAjouter } from './ui.jsx'

// Panneau « ajouter à une série » : on cherche une série, puis on lui ajoute un ou plusieurs
// traitements. (Les fertilisations viennent du tableau par légume, voir TableauFerti.)
const LIGNE_VIDE = { type_traitement_id: '', semaines_apres_plantation: '' }

// `serieFixe` : série déjà choisie (formulaire de modification d'une série), pas de recherche.
export default function AjoutTraitement({ series = [], typesTraitement = [], onAjout, serieFixe = null }) {
  const [ouvert, setOuvert] = useState(!!serieFixe)
  const [recherche, setRecherche] = useState('')
  const [serie, setSerie] = useState(serieFixe)
  const [lignes, setLignes] = useState([LIGNE_VIDE])
  const [envoi, setEnvoi] = useState(false)

  const lignesValides = lignes.filter(l => l.semaines_apres_plantation !== '' && l.type_traitement_id)

  const q = recherche.trim().toLowerCase()
  const resultats = q
    ? series.filter(s => [s.legumes?.nom, s.varietes?.nom, s.nom].some(t => t?.toLowerCase().includes(q))).slice(0, 12)
    : []

  function fermer() {
    setOuvert(!!serieFixe)
    setRecherche('')
    setSerie(serieFixe)
    setLignes([LIGNE_VIDE])
  }

  function modifierLigne(i, cle, valeur) {
    setLignes(lignes.map((l, j) => (j === i ? { ...l, [cle]: valeur } : l)))
  }

  async function enregistrer() {
    setEnvoi(true)
    const { error } = await supabase.from('serie_traitements').insert(lignesValides.map(l => ({
      serie_id: serie.id,
      semaines_apres_plantation: parseInt(l.semaines_apres_plantation),
      type_traitement_id: l.type_traitement_id,
    })))
    setEnvoi(false)
    if (error) {
      alert(`Enregistrement impossible : ${error.message}`)
      return
    }
    fermer()
    onAjout()
  }

  const champ = { width: '100%', fontSize: 12, padding: '5px 7px', border: '1px solid var(--trait)', borderRadius: 0 }

  if (!ouvert) {
    return (
      <BoutonAjouter onClick={() => setOuvert(true)}>Ajouter un traitement</BoutonAjouter>
    )
  }

  return (
    <div style={serieFixe ? {} : { background: 'var(--papier)', border: '1px solid var(--trait)', padding: 16, marginBottom: 16 }}>
      {!serieFixe && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Ajouter des traitements à une série</span>
          <button onClick={fermer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--encre-pale)' }}><X size={16} /></button>
        </div>
      )}

      {!serie ? (
        <>
          <input autoFocus value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Chercher une série : légume, variété…" style={{ ...champ, fontSize: 13, padding: '8px 10px', marginBottom: 8 }} />
          {q && resultats.length === 0 && <p style={{ fontSize: 12, color: 'var(--encre-pale)' }}>Aucune série trouvée</p>}
          {resultats.map(s => (
            <button key={s.id} onClick={() => setSerie(s)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 4, border: '1px solid var(--trait-leger)', background: 'var(--fond)', cursor: 'pointer', fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.legumes?.familles?.couleur || '#9dca9a', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.legumes?.nom}{s.varietes?.nom ? ` · ${s.varietes.nom}` : ''}</span>
              <span style={{ color: 'var(--encre-douce)' }}>sem. {s.semaine_plantation} · {s.longueur_metres} m</span>
            </button>
          ))}
        </>
      ) : (
        <>
          {!serieFixe && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', marginBottom: 12, fontSize: 13 }}>
              <strong style={{ flex: 1 }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''} · sem. {serie.semaine_plantation} · {serie.longueur_metres} m</strong>
              <button onClick={() => setSerie(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Changer</button>
            </div>
          )}

          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 2 }}>
                <select value={l.type_traitement_id} onChange={e => modifierLigne(i, 'type_traitement_id', e.target.value)} style={champ}>
                  <option value="">-- Type de traitement --</option>
                  {typesTraitement.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <select value={l.semaines_apres_plantation} onChange={e => modifierLigne(i, 'semaines_apres_plantation', e.target.value)} style={champ}>
                  <option value="">Sem. après plantation</option>
                  {Array.from({ length: 31 }, (_, s) => s).map(s => <option key={s} value={s}>Sem. +{s} (sem. {(serie.semaine_plantation || 0) + s})</option>)}
                </select>
              </div>
              {lignes.length > 1 && (
                <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rouge)' }}><X size={14} /></button>
              )}
            </div>
          ))}
          <button onClick={() => setLignes([...lignes, LIGNE_VIDE])} style={{ fontSize: 12, background: 'none', border: '1px solid var(--trait)', padding: '4px 10px', cursor: 'pointer', marginBottom: 12 }}>
            + Un autre passage
          </button>

          <div>
            <button onClick={enregistrer} disabled={envoi || lignesValides.length === 0}
              style={{ background: lignesValides.length ? 'var(--accent)' : 'var(--trait-leger)', color: lignesValides.length ? 'var(--papier)' : 'var(--encre-pale)', border: 'none', borderRadius: 0, padding: '8px 16px', cursor: lignesValides.length ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
              {envoi ? 'Enregistrement…' : `Enregistrer ${lignesValides.length || ''} passage${lignesValides.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
