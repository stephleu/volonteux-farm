// Appelé chaque jour par Vercel (voir "crons" dans vercel.json).
// Un projet Supabase gratuit se met en pause après une semaine sans activité :
// une petite lecture quotidienne suffit à le garder éveillé.
import { supabase } from '../src/lib/supabase.js'

export default async function handler(req, res) {
  // Table lisible sans connexion (catalogue public), donc toujours accessible ici
  const { error } = await supabase.from('mercuriale_produits').select('id').limit(1)
  res.status(error ? 502 : 200).json({ ok: !error, erreur: error?.message ?? null })
}
