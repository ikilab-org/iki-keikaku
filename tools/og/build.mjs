#!/usr/bin/env node
/**
 * OGP画像（1200×630）を生成する。
 *
 *   npm i -D playwright     （初回のみ。または npx playwright install chromium）
 *   node tools/og/build.mjs
 *
 * tools/og/cards.html の各カードを2倍解像度で撮影し、1200×630 に縮小して
 * assets/ へ出力する。カードの文言やレイアウトを変えたいときは cards.html を編集する。
 *
 * 出力:
 *   assets/og.png          ハブページ用
 *   assets/og-fukushi.png  福祉分野マップ用
 *   assets/og-kaigo.png    介護保険の検証用
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const outDir = resolve(root, 'assets')
mkdirSync(outDir, { recursive: true })

const CARDS = [
  { id: 'og', out: 'og.png' },
  { id: 'og-fukushi', out: 'og-fukushi.png' },
  { id: 'og-kaigo', out: 'og-kaigo.png' },
  { id: 'og-koutsuu', out: 'og-koutsuu.png' },
  { id: 'og-shisetsu-2036', out: 'og-shisetsu-2036.png' },
]

const W = 1200, H = 630, SCALE = 2

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: W + 80, height: H + 80 },
  deviceScaleFactor: SCALE,
})
await page.goto('file://' + resolve(here, 'cards.html'))
await page.waitForTimeout(500)   // フォントの読み込み待ち

for (const { id, out } of CARDS) {
  const el = await page.$('#' + id)
  if (!el) { console.error(`カードが見つかりません: #${id}`); continue }
  const buf = await el.screenshot({ type: 'png' })
  // 2倍で撮ったものを 1200×630 に縮小する（文字が最も滑らかになる）
  const sharp = await import('sharp').catch(() => null)
  const path = resolve(outDir, out)
  if (sharp) {
    await sharp.default(buf).resize(W, H).png({ compressionLevel: 9 }).toFile(path)
  } else {
    // sharp が無い場合は等倍で撮り直す
    const p2 = await browser.newPage({ viewport: { width: W + 80, height: H + 80 }, deviceScaleFactor: 1 })
    await p2.goto('file://' + resolve(here, 'cards.html'))
    await p2.waitForTimeout(300)
    await (await p2.$('#' + id)).screenshot({ path, type: 'png' })
    await p2.close()
  }
  console.log(`生成: assets/${out}`)
}

await browser.close()
console.log('\n各ページの <head> に次を入れてください（パスはページからの相対）:')
console.log('  <meta property="og:image" content="https://keikaku.ikilab.org/assets/og-fukushi.png">')
