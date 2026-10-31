import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { EnTetePage, Onglets } from '../components/ui.jsx'
import { useChargement } from '../lib/useChargement'

const ANNEES = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]

const BLOCS_GROUPES = [
  { parent: 'A', sousBlocs: ['A1', 'A2'], type: 'ete' },
  { parent: 'B', sousBlocs: ['B1', 'B2', 'B3'], type: 'ete' },
  { parent: 'C', sousBlocs: ['C'], type: 'ete' },
  { parent: 'D', sousBlocs: ['D'], type: 'hiver' },
  { parent: 'E', sousBlocs: ['E'], type: 'hiver' },
  { parent: 'F', sousBlocs: ['F1', 'F2'], type: 'hiver' },
  { parent: 'G', sousBlocs: ['G'], type: 'hiver' },
  { parent: 'H', sousBlocs: ['H1', 'H2'], type: 'hiver' },
  { parent: 'I', sousBlocs: ['I'], type: 'bonus' },
]

// Couleurs en hexadécimal (pas de var(--…)) : on leur ajoute un suffixe de transparence ('22')
const COULEURS_ROTATION = {
  'Ratatouille': '#a3281b',
  'Petit maraîchage': '#1a3e76',
  'P. de t. primeur': '#EF9F27',
  'Poireaux': '#1a3e76',
  'P. de t. conserve': '#9B7FD4',
  'Courge': '#E8873A',
  'Choux': '#8B5E8A',
  'Carotte primeur': '#A0735A',
  'Butternut': '#a3281b',
}
const COULEUR_NEUTRE = '#8a867f'

function getCouleur(description) {
  if (!description) return COULEUR_NEUTRE
  for (const [key, couleur] of Object.entries(COULEURS_ROTATION)) {
    if (description.includes(key)) return couleur
  }
  return COULEUR_NEUTRE
}

// « P. de t. conserve · Avril/Septembre » → ['P. de t. conserve'] ; les précisions de date ne sont pas des cultures
const culturesDe = description => description.split(' · ').filter(c => !/^[A-ZÉ][a-zé]+\/[A-ZÉ][a-zé]+$/.test(c))

export default function Historique() {
  const [rotations, setRotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('grille')
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(2026)

  async function fetchData() {
    const { data: r } = await supabase.from('rotations_planifiees').select('*, blocs(nom)').order('annee')
    setRotations(r || [])
    setLoading(false)
  }
  useChargement(fetchData)

  function getRotation(nomBloc, annee) {
    return rotations.find(r => r.blocs?.nom === nomBloc && r.annee === annee)
  }

  function getRotationGroupe(groupe, annee) {
    // Prend la rotation du premier sous-bloc non bonus
    const sousBlocPrincipal = groupe.sousBlocs.find(sb => sb !== 'D2')
    return getRotation(sousBlocPrincipal || groupe.sousBlocs[0], annee)
  }

  return (
    <div>
      <EnTetePage titre="Historique des rotations" sousTitre="2021 → 2030">
        <Onglets valeur={vue} onChange={setVue} options={[['grille', 'Grille'], ['annee', 'Par année'], ['conformite', 'Conformité']]} />
      </EnTetePage>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'grille' && (
        <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--fond)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--encre)', borderBottom: '1px solid var(--trait)', minWidth: 50 }}>Année</th>
                {BLOCS_GROUPES.map(g => (
                  <th key={g.parent} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 500, color: 'var(--encre)', borderBottom: '1px solid var(--trait)', minWidth: 100 }}>
                    Bloc {g.parent}
                    {g.sousBlocs.length > 1 && (
                      <div style={{ fontSize: 10, color: 'var(--encre-pale)', fontWeight: 400 }}>
                        {g.sousBlocs.join(', ')}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANNEES.map(annee => (
                <tr key={annee} style={{ background: annee === 2026 ? 'var(--vert-pale)' : 'transparent' }}>
                  <td style={{ padding: '8px 14px', fontWeight: annee === 2026 ? 600 : 400, color: annee === 2026 ? 'var(--accent)' : 'var(--encre)', borderBottom: '1px solid var(--trait-leger)' }}>
                    {annee} {annee === 2026 && '←'}
                  </td>
                  {BLOCS_GROUPES.map(groupe => {
                    const rotation = getRotationGroupe(groupe, annee)
                    const couleur = rotation ? getCouleur(rotation.description) : null
                    return (
                      <td key={groupe.parent} style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--trait-leger)', borderLeft: '1px solid var(--trait-leger)' }}>
                        {rotation ? (
                          <div style={{ background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 0, padding: '3px 5px', fontSize: 10, color: 'var(--encre)', lineHeight: 1.3 }}>
                            {rotation.description.split(' · ').map((d, i) => (
                              <div key={i}>{d}</div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--trait-leger)' }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vue === 'annee' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {ANNEES.map(a => (
              <button key={a} onClick={() => setAnneeSelectionnee(a)}
                style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: anneeSelectionnee === a ? 'var(--accent)' : 'var(--fond)', color: anneeSelectionnee === a ? 'var(--papier)' : 'var(--encre)', fontWeight: a === 2026 ? 600 : 400 }}>
                {a}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {BLOCS_GROUPES.map(groupe => {
              const rotation = getRotationGroupe(groupe, anneeSelectionnee)
              const couleur = rotation ? getCouleur(rotation.description) : '#e3e0d8'
              return (
                <div key={groupe.parent} style={{ background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 0, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre)', marginBottom: 4 }}>
                    Bloc {groupe.parent}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)', fontWeight: 400, marginLeft: 6 }}>
                      {groupe.sousBlocs.join(' + ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--encre-douce)', lineHeight: 1.5 }}>
                    {rotation ? rotation.description.split(' · ').map((d, i) => <div key={i}>{d}</div>) : <span style={{ color: 'var(--encre-pale)' }}>Non défini</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {vue === 'conformite' && (
        <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
            Vérification des intervalles de rotation
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--encre-douce)', marginBottom: 14 }}>
              Blocs A/B/C → rotation 3 ans minimum · Blocs D/E/F/G/H → rotation 5 ans minimum
            </div>
            {BLOCS_GROUPES.filter(g => g.type !== 'bonus').map(groupe => {
              const rotationRequise = groupe.type === 'ete' ? 3 : 5
              const rotationsGroupe = ANNEES.map(a => ({
                annee: a,
                rotation: getRotationGroupe(groupe, a)
              })).filter(r => r.rotation)

              // Chaque culture de la rotation (pas seulement la première) doit respecter l'intervalle minimum
              const conflits = []
              for (let i = 0; i < rotationsGroupe.length; i++) {
                for (const culture of culturesDe(rotationsGroupe[i].rotation.description)) {
                  const suivante = rotationsGroupe.slice(i + 1).find(r => culturesDe(r.rotation.description).includes(culture))
                  if (!suivante) continue
                  const intervalle = suivante.annee - rotationsGroupe[i].annee
                  if (intervalle < rotationRequise) {
                    conflits.push({ annee1: rotationsGroupe[i].annee, annee2: suivante.annee, culture, intervalle })
                  }
                }
              }

              return (
                <div key={groupe.parent} style={{ marginBottom: 10, padding: '10px 12px', background: conflits.length > 0 ? 'var(--rouge-pale)' : 'var(--vert-pale)', border: `1px solid ${conflits.length > 0 ? 'var(--rouge-clair)' : 'var(--vert)'}`, borderRadius: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)', marginBottom: conflits.length > 0 ? 6 : 0 }}>
                    Bloc {groupe.parent} ({groupe.sousBlocs.join(', ')}) {conflits.length === 0 ? '✓ Conforme' : `✗ ${conflits.length} conflit(s)`}
                  </div>
                  {conflits.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--rouge)' }}>
                      {c.culture} : {c.annee1} → {c.annee2} ({c.intervalle} ans, min. {rotationRequise} ans)
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}