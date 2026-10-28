// Envoie le bon de livraison d'une commande par email au comptable.
// Appelé par la page Commandes (bouton, ou automatiquement quand une commande passe « livrée »).
//
// Réglages dans Vercel > Settings > Environment Variables (jamais dans le code) :
//   SMTP_HOST, SMTP_PORT (465 par défaut), SMTP_USER, SMTP_PASS : boîte mail d'envoi (ex. o2switch)
//   EMAIL_COMPTABLE : destinataire ; EMAIL_EXPEDITEUR (facultatif, sinon SMTP_USER)
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { supabaseUrl, supabaseKey } from '../src/lib/supabase.js'
import { SELECT_COMMANDE, htmlBonDeLivraison, numeroBL } from '../src/lib/bonDeLivraison.js'
import { pdfDepuisHtml } from './_bl-pdf.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'méthode non autorisée' })

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_COMPTABLE, EMAIL_EXPEDITEUR } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_COMPTABLE) {
    return res.status(500).json({ erreur: "l'envoi d'email n'est pas encore configuré dans Vercel" })
  }

  // Seules les personnes connectées au site peuvent envoyer un BL : on agit avec leur session
  const jeton = (req.headers.authorization || '').replace(/^Bearer /, '')
  const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${jeton}` } } })
  const { data: { user } = {}, error: erreurSession } = await supabase.auth.getUser(jeton)
  if (erreurSession || !user) return res.status(401).json({ erreur: 'session expirée, reconnectez-vous' })

  const commandeId = req.body?.commandeId
  const { data: commande, error } = await supabase.from('mercuriale_commandes').select(SELECT_COMMANDE).eq('id', commandeId).single()
  if (error || !commande) return res.status(404).json({ erreur: 'commande introuvable' })

  const numero = numeroBL(commande)
  const epicerie = commande.mercuriale_epiceries?.nom || 'épicerie'
  const date = new Date(commande.date_commande).toLocaleDateString('fr-FR')
  let pdf
  try {
    pdf = await pdfDepuisHtml(htmlBonDeLivraison(commande))
  } catch (e) {
    return res.status(500).json({ erreur: `PDF impossible à générer (${e.message})` })
  }

  try {
    const port = Number(SMTP_PORT) || 465
    const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
    await transport.sendMail({
      from: `Ferme des Volonteux <${EMAIL_EXPEDITEUR || SMTP_USER}>`,
      to: EMAIL_COMPTABLE,
      subject: `Bon de livraison N° ${numero} · ${epicerie} · ${date}`,
      text: `Bonjour,\n\nVeuillez trouver ci-joint le bon de livraison N° ${numero} (${epicerie}, ${date}).\n\nFerme des Volonteux`,
      attachments: [{ filename: `BL-${numero}-${epicerie.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
    })
  } catch (e) {
    return res.status(502).json({ erreur: `envoi impossible (${e.message})` })
  }

  await supabase.from('mercuriale_commandes').update({ bl_envoye_le: new Date().toISOString() }).eq('id', commande.id)
  res.status(200).json({ ok: true })
}
