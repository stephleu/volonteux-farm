// Transforme le BL HTML en PDF avec un Chrome sans écran (même rendu que l'impression).
// Sur Vercel : Chromium fourni par @sparticuz/chromium. En local : CHROME_PATH vers son Chrome.
// (Le « _ » en tête du nom empêche Vercel d'en faire une adresse /api à part.)
import puppeteer from 'puppeteer-core'

export async function pdfDepuisHtml(html) {
  const local = process.env.CHROME_PATH
  let chromium = null
  if (!local) {
    // Les fonctions Vercel tournent sur Amazon Linux 2023 sans les bibliothèques dont Chromium a besoin
    // (libnss3…). @sparticuz/chromium les fournit, mais seulement s'il sait qu'il est sur ce système :
    // il le lit dans cette variable AU MOMENT DE SON IMPORT, d'où l'import après l'avoir posée.
    process.env.AWS_LAMBDA_JS_RUNTIME ||= `nodejs${process.versions.node.split('.')[0]}.x`
    chromium = (await import('@sparticuz/chromium')).default
  }
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
