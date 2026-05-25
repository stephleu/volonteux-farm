import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Pencil } from 'lucide-react'

export default function MerculialeEpiceries() {
  const [epiceries, setEpiceries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEpicerie, setEditEpicerie] = useState(null)
  const [form, setForm] = useState({ nom: '', adresse: '', email: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('mercuriale_epiceries').select('*').order('nom')
    setEpiceries(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (editEpicerie) {
      await supabase.from('mercuriale_epiceries').update(form).eq('id', editEpicerie.id)
    } else {
      await supabase.from('mercuriale_epiceries').insert(form)
    }
    setShowForm(false)
    setEditEpicerie(null)
    setForm({ nom: '', adresse: '', email: '' })
    fetchData()
  }

  async function supprimerEpicerie(id) {
    await supabase.from('mercuriale_epiceries').delete().eq('id', id)
    fetchData()
  }

  function ouvrirEdit(epicerie) {
    setForm({ nom: epicerie.nom, adresse: epicerie.adresse || '', email: epicerie.email || '' })
    setEditEpicerie(epicerie)
    setShowForm(true)
  }

  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111' }}>Épiceries</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{epiceries.length} épiceries</p>
        </div>
        <button onClick={() => { setForm({ nom: '', adresse: '', email: '' }); setEditEpicerie(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> Nouvelle épicerie
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{editEpicerie ? 'Modifier' : 'Nouvelle épicerie'}</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Nom</div>
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} placeholder="La Carline" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Adresse</div>
              <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} style={inputStyle} placeholder="12 rue..." />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Email</div>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="contact@..." />
            </div>
          </div>
          <button onClick={handleSave} disabled={!form.nom}
            style={{ background: form.nom ? '#1D9E75' : '#e5e7eb', color: form.nom ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            {editEpicerie ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>Chargement...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {epiceries.map(e => (
          <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{e.nom}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {e.adresse && <span>{e.adresse}</span>}
                {e.adresse && e.email && <span> · </span>}
                {e.email && <a href={`mailto:${e.email}`} style={{ color: '#1D9E75' }}>{e.email}</a>}
              </div>
            </div>
            <button onClick={() => ouvrirEdit(e)}
              style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#f9fafb', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pencil size={12} /> Modifier
            </button>
            <button onClick={() => supprimerEpicerie(e.id)}
              style={{ padding: '5px 8px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', background: '#fef2f2', color: '#ef4444' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {!loading && epiceries.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
            Aucune épicerie — cliquez sur "Nouvelle épicerie" pour commencer
          </div>
        )}
      </div>
    </div>
  )
}