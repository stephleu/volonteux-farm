import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jukgbdrhvhvewpumtruz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1a2diZHJodmh2ZXdwdW10cnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTI5ODksImV4cCI6MjA5NDg2ODk4OX0.CgAX8konj5BQp4IQdFRwW6xVXY27wo-WuyUS8dFzB4w'

export const supabase = createClient(supabaseUrl, supabaseKey)