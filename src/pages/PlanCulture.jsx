import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function PlanCulture() {
  const [blocs, setBlocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('champ')
  const [ouverts, setOuverts] = useState({})
  const refs = useRef({})

  useEffect(() => { fetchBlocs() }, [])

  async function fetchBlocs() {
    const { data } = await supabase.from('blocs').select('*').order('nom')
    setBlocs(data || [])
    setLoading(false)
  }

const blocsChamp = blocs.filter(b => b.type !== 'serre').sort((a, b) => a.nom.localeCompare(b.nom))
const blocsSerre = blocs.filter(b => b.type === 'serre').sort((a, b) => a.nom.localeCompare(b.nom))
  const blocsAffiches = vue === 'champ' ? blocsChamp : blocsSerre

  function toggleBloc(id) {
    setOuverts(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function scrollTo(id) {
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setOuverts(prev => ({ ...prev, [id]: true }))
  }

  const couleurRotation = (type) => {
    if (type === 'ete') return { bg: 'var(--vert-pale)', border: 'var(--vert)', label: 'Rotation 3 ans' }
    if (type === 'hiver') return { bg: 'var(--bleu-pale)', border: 'var(--bleu-clair)', label: 'Rotation 6 ans' }
    if (type === 'bonus') return { bg: 'var(--fond)', border: 'var(--trait-leger)', label: 'Bonus' }
    if (type === 'serre') return { bg: '#fdf4ff', border: '#e9d5ff', label: 'Serre' }
    return { bg: 'var(--papier)', border: 'var(--trait-leger)', label: '' }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Plan de culture 2026</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>Blocs plein champ et serres</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
          {['champ', 'serres'].map(v => (
            <button key={v} onClick={() => setVue(v)} style={{
              padding: '7px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
              background: vue === v ? 'var(--accent)' : 'var(--fond)',
              color: vue === v ? 'var(--papier)' : 'var(--encre-douce)',
              fontWeight: vue === v ? 500 : 400,
            }}>{v === 'champ' ? 'Plein champ' : 'Serres'}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, padding: '10px 12px', background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0 }}>
        {blocsAffiches.map(bloc => {
          const { border } = couleurRotation(bloc.type)
          return (
            <button key={bloc.id} onClick={() => scrollTo(bloc.id)} style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${border}`, borderRadius: 0,
              background: 'var(--papier)', color: 'var(--encre)',
            }}>
              {bloc.nom}
            </button>
          )
        })}
      </div>

      {loading && <p style={{ color: 'var(--encre-douce)', fontSize: 13 }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {blocsAffiches.map(bloc => {
          const { bg, border, label } = couleurRotation(bloc.type)
          const ouvert = ouverts[bloc.id]
          return (
            <div key={bloc.id} ref={el => refs.current[bloc.id] = el}
              style={{ background: bg, border: `1px solid ${border}`, borderRadius: 0, overflow: 'hidden' }}>
              <div onClick={() => toggleBloc(bloc.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--encre)' }}>Bloc {bloc.nom}</span>
                  <span style={{ fontSize: 11, color: 'var(--encre-douce)', background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '2px 6px' }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{bloc.nombre_planches} planches</span>
                </div>
                <span style={{ fontSize: 16, color: 'var(--encre-douce)', transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </div>

              {ouvert && (
                <div style={{ borderTop: `1px solid ${border}`, padding: '12px 16px' }}>
                  <PlanchesBloc bloc={bloc} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlanchesBloc({ bloc }) {
  const [planches, setPlanches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchPlanches() }, [bloc.id])

  async function fetchPlanches() {
    const { data } = await supabase
      .from('planches')
      .select('*, cultures(*, legumes(nom, familles(couleur)))')
      .eq('bloc_id', bloc.id)
      .order('numero')
    setPlanches(data || [])
    setLoading(false)
  }

  async function creerPlanches() {
    const nouvelles = Array.from({ length: bloc.nombre_planches }, (_, i) => ({
      bloc_id: bloc.id, numero: i + 1, longueur: 50, largeur: 1.4,
    }))
    await supabase.from('planches').insert(nouvelles)
    fetchPlanches()
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>

  if (planches.length === 0) return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginBottom: 10 }}>Planches non encore créées.</p>
      <button onClick={creerPlanches} style={{ background: 'var(--accent)', color: 'var(--papier)', border: 'none', borderRadius: 0, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
        Créer les {bloc.nombre_planches} planches
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {planches.map(planche => {
        const culture = planche.cultures?.[0]
        const couleur = culture ? (culture.legumes?.familles?.couleur || '#9dca9a') : '#e8e6e0'
        return (
          <div key={planche.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--papier)', border: `1px solid ${culture ? couleur : 'var(--trait-leger)'}`,
            borderRadius: 0, padding: '7px 12px', cursor: 'pointer',
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--encre)', minWidth: 60 }}>
              {bloc.nom}-{String(planche.numero).padStart(2, '0')}
            </div>
            <div style={{ flex: 1, height: 18, background: culture ? couleur + '33' : 'var(--fond)', borderRadius: 0, position: 'relative', overflow: 'hidden' }}>
              {culture && (
                <div style={{ position: 'absolute', inset: 0, background: couleur + '66', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--encre)' }}>{culture.legumes?.nom}</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--encre-pale)', minWidth: 30, textAlign: 'right' }}>50m</div>
          </div>
        )
      })}
    </div>
  )
}