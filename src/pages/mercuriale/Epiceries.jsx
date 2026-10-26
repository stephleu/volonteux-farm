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

  const inputStyle = { width: '100%', fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--encre)' }}>Épiceries</h1>
          <p style={{ fontSize: 13, color: 'var(--encre-douce)', marginTop: 4 }}>{epiceries.length} épiceries</p>
        </div>
        <button onClick={() => { setForm({ nom: '', adresse: '', email: '' }); setEditEpicerie(null); setShowForm(true) }}
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
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} placeholder="La Carline" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Adresse</div>
              <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} style={inputStyle} placeholder="12 rue..." />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--encre-douce)', marginBottom: 3 }}>Email</div>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="contact@..." />
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
          <div key={e.id} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre)' }}>{e.nom}</div>
              <div style={{ fontSize: 12, color: 'var(--encre-douce)', marginTop: 2 }}>
                {e.adresse && <span>{e.adresse}</span>}
                {e.adresse && e.email && <span> · </span>}
                {e.email && <a href={`mailto:${e.email}`} style={{ color: 'var(--accent)' }}>{e.email}</a>}
              </div>
            </div>
            <button onClick={() => ouvrirEdit(e)}
              style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: 'var(--fond)', color: 'var(--encre-douce)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pencil size={12} /> Modifier
            </button>
            <button onClick={() => supprimerEpicerie(e.id)}
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