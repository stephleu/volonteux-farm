// Transforme le BL HTML en PDF avec un Chrome sans écran (même rendu que l'impression).
// Sur Vercel : Chromium fourni par @sparticuz/chromium. En local : CHROME_PATH vers son Chrome.
// (Le « _ » en tête du nom empêche Vercel d'en faire une adresse /api à part.)
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function pdfDepuisHtml(html) {
  const local = process.env.CHROME_PATH
  const navigateur = await puppeteer.launch({
    executablePath: local || await chromium.executablePath(),
    args: local ? [] : chromium.args,
    headless: true,
  })
  try {
    const page = await navigateur.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await navigateur.close()
  }
}
