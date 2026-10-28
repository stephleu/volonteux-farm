import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://jukgbdrhvhvewpumtruz.supabase.co'
export const supabaseKey ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1a2diZHJodmh2ZXdwdW10cnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTI5ODksImV4cCI6MjA5NDg2ODk4OX0.CgAX8konj5BQp4IQdFRwW6xVXY27wo-WuyUS8dFzB4w'

export const supabase = createClient(supabaseUrl, supabaseKey)

// La base renvoie au plus 1000 lignes par requête : on charge par pages.
// `requete` construit la requête à chaque page, ex. () => supabase.from('cultures').select('*')
export async function chargerTout(requete) {
  const data = []
  for (let debut = 0; ; debut += 1000) {
    const { data: page, error } = await requete().range(debut, debut + 999)
    if (error) return { data, error }
    data.push(...page)
    if (page.length < 1000) return { data, error: null }
  }
}