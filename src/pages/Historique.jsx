import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ANNEES = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]
const BLOCS_CHAMP = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']

const COULEURS_ROTATION = {
  'Ratatouille · Melon · Pastèque': '#E24B4A',
  'Petit maraîchage · Salade': '#1D9E75',
  'P. de t. primeur · Carotte · Racine': '#EF9F27',
  'Poireaux · Oignon': '#378ADD',
  'P. de t. conserve': '#9B7FD4',
  'Courge': '#E24B4A',
  'Choux': '#8B5E8A',
  'Carotte primeur · P. de t. douce': '#A0735A',
  'Butternut': '#E24B4A',
}

function getCouleur(description) {
  for (const [key, couleur] of Object.entries(COULEURS_ROTATION)) {
    if (description?.includes(key.split(' · ')[0])) return couleur
  }
  return '#9ca3af'
}

export default function Historique() {
  const [blocs, setBlocs] = useState([])
  const [rotations, setRotations] = useState([])
  const [cultures, setCultures] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('grille')
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(2026)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
const [{ data: b }, { data: r }, { data: c }] = await Promise.all([
  supabase.from('blocs').select('*').order('nom'),
  supabase.from('rotations_planifiees').select('*, blocs(nom)').order('annee'),
  supabase.from('cultures').select('*, legumes(nom, familles(nom, couleur)), planches(bloc_id)').order('annee'),
])

    setBlocs(b || [])
    setRotations(r || [])
    setCultures(c || [])
    setLoading(false)
  }

function getRotation(nomBloc, annee) {
  return rotations.find(r => r.blocs?.nom?.toLowerCase() === nomBloc.toLowerCase() && r.annee === annee)
}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Historique des rotations</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>2021 → 2030</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {[['grille', 'Grille'], ['annee', 'Par année'], ['conformite', 'Conformité']].map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)} style={{ padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer', background: vue === v ? '#1D9E75' : '#f9fafb', color: vue === v ? '#fff' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      {vue === 'grille' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: '#111', borderBottom: '1px solid #e5e7eb', minWidth: 50 }}>Année</th>
                {BLOCS_CHAMP.map(b => (
                  <th key={b} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 500, color: '#111', borderBottom: '1px solid #e5e7eb', minWidth: 90 }}>
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANNEES.map(annee => (
                <tr key={annee} style={{ background: annee === 2026 ? '#f0fdf4' : 'transparent' }}>
                  <td style={{ padding: '8px 14px', fontWeight: annee === 2026 ? 600 : 400, color: annee === 2026 ? '#1D9E75' : '#111', borderBottom: '1px solid #f3f4f6' }}>
                    {annee} {annee === 2026 && '←'}
                  </td>
                  {BLOCS_CHAMP.map(nomBloc => {
                    const rotation = getRotation(nomBloc, annee)
                    const couleur = rotation ? getCouleur(rotation.description) : null
                    return (
                      <td key={nomBloc} style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', borderLeft: '1px solid #f3f4f6' }}>
                        {rotation ? (
                          <div style={{ background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 4, padding: '3px 5px', fontSize: 10, color: '#111', lineHeight: 1.3 }}>
                            {rotation.description.split(' · ').map((d, i) => (
                              <div key={i}>{d}</div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#e5e7eb' }}>—</span>
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
                style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: anneeSelectionnee === a ? '#1D9E75' : '#f9fafb', color: anneeSelectionnee === a ? '#fff' : '#111', fontWeight: a === 2026 ? 600 : 400 }}>
                {a}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {BLOCS_CHAMP.map(nomBloc => {
              const rotation = getRotation(nomBloc, anneeSelectionnee)
              const couleur = rotation ? getCouleur(rotation.description) : '#e5e7eb'
              return (
                <div key={nomBloc} style={{ background: couleur + '22', border: `1px solid ${couleur}`, borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 6 }}>Bloc {nomBloc}</div>
                  <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>
                    {rotation ? rotation.description.split(' · ').map((d, i) => <div key={i}>{d}</div>) : <span style={{ color: '#9ca3af' }}>Non défini</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {vue === 'conformite' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 500, color: '#111' }}>
            Vérification des intervalles de rotation
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
              Blocs A/B/C → rotation 3 ans minimum · Blocs D→H → rotation 6 ans minimum
            </div>
            {BLOCS_CHAMP.filter(b => b !== 'I').map(nomBloc => {
              const rotationsBloc = ANNEES.map(a => ({ annee: a, rotation: getRotation(nomBloc, a) })).filter(r => r.rotation)
              const rotationRequise = ['A', 'B', 'C'].includes(nomBloc) ? 3 : 6
              const conflits = []
              for (let i = 0; i < rotationsBloc.length; i++) {
                for (let j = i + 1; j < rotationsBloc.length; j++) {
                  const desc1 = rotationsBloc[i].rotation.description.split(' · ')[0]
                  const desc2 = rotationsBloc[j].rotation.description.split(' · ')[0]
                  if (desc1 === desc2) {
                    const intervalle = rotationsBloc[j].annee - rotationsBloc[i].annee
                    if (intervalle < rotationRequise) {
                      conflits.push({ annee1: rotationsBloc[i].annee, annee2: rotationsBloc[j].annee, culture: desc1, intervalle })
                    }
                    break
                  }
                }
              }
              return (
                <div key={nomBloc} style={{ marginBottom: 12, padding: '10px 12px', background: conflits.length > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${conflits.length > 0 ? '#fca5a5' : '#86efac'}`, borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: conflits.length > 0 ? 6 : 0 }}>
                    Bloc {nomBloc} {conflits.length === 0 ? '✓ Conforme' : `✗ ${conflits.length} conflit(s)`}
                  </div>
                  {conflits.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#dc2626' }}>
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