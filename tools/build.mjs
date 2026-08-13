#!/usr/bin/env node
/**
 * data/plans.yml から plans/all/index.html（全市の俯瞰ページ）を生成する。
 *
 *   node tools/build.mjs            生成する
 *   node tools/build.mjs --check    生成結果が現在のファイルと一致するか検査する（CI用）
 *
 * 生成物はリポジトリにコミットします。GitHub Pages にビルド工程を入れずに済み、
 * 計画を1本足したときに図がどう変わるかが差分でレビューできるためです。
 *
 * 出力に生成時刻を混ぜないでください。--check が毎回落ちます。
 * 日付は doc.meta の updated / survey_date から取ります。
 *
 * 分類の規則は tools/view-model.mjs にあります。ここは HTML の組み立てだけです。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'
import { validate } from './validate.mjs'
import { readPalette } from './palette.mjs'
import { buildModel, slotOf } from './view-model.mjs'
import { fiscalYearShort } from './fiscal-year.mjs'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c])

/** 分野色。domain を持たない計画（国・県）は分野色を持たないので muted にする。 */
export const colorOf = (p, domains) => {
  const s = slotOf(p, domains)
  return s == null ? 'var(--muted)' : `var(--c${s})`
}

export const PAGE_CSS = `
:root{
  color-scheme: light;
  --page:#f9f9f7; --surface:#fcfcfb;
  --ink:#0b0b0b; --ink2:#52514e; --muted:#898781;
  --grid:#e1e0d9; --axis:#c3c2b7; --ring:rgba(11,11,11,0.10);
  --wash:rgba(11,11,11,0.035);
  --warn:#fab219; --crit:#d03b3b;
}
:root[data-theme="dark"]{
  color-scheme: dark;
  --page:#0d0d0d; --surface:#1a1a19;
  --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781;
  --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,0.10);
  --wash:rgba(255,255,255,0.05);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    color-scheme: dark;
    --page:#0d0d0d; --surface:#1a1a19;
    --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,0.10);
    --wash:rgba(255,255,255,0.05);
  }
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:var(--page); color:var(--ink);
  font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif;
  font-size:15px; line-height:1.75; letter-spacing:.01em;
}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:26px;line-height:1.4;margin:0 0 6px;letter-spacing:-.01em}
h2{font-size:19px;margin:0 0 4px;letter-spacing:-.01em}
p{margin:.5em 0}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--axis)}
a:hover{border-bottom-color:currentColor}
a:focus-visible,button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.sub{color:var(--ink2);font-size:13.5px}
.mut{color:var(--muted);font-size:12.5px}
header.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;
  padding-bottom:18px;border-bottom:2px solid var(--ink);margin-bottom:26px}
.badge{display:inline-block;font-size:11.5px;letter-spacing:.06em;padding:3px 9px;border:1px solid var(--ring);
  border-radius:999px;color:var(--ink2);background:var(--surface)}
a.badge{text-decoration:none;margin-right:8px}
a.badge:hover{background:var(--wash);border-color:var(--axis)}
button.tg{font:inherit;font-size:12.5px;padding:6px 12px;border:1px solid var(--ring);border-radius:8px;
  background:var(--surface);color:var(--ink2);cursor:pointer}
button.tg:hover{background:var(--wash)}
section{background:var(--surface);border:1px solid var(--ring);border-radius:14px;padding:22px 22px 24px;margin:0 0 22px}
section > .hd{margin-bottom:16px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
.tile{border:1px solid var(--ring);border-radius:11px;padding:13px 14px;background:var(--page)}
.tile .v{font-size:30px;line-height:1.15;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tile .v small{font-size:14px;font-weight:500;color:var(--ink2);margin-left:2px}
.tile .k{font-size:12px;color:var(--ink2);margin-top:3px}
.tile.alert{border-color:var(--warn);box-shadow:inset 3px 0 0 var(--warn)}
.dot{width:9px;height:9px;border-radius:3px;flex:none;box-shadow:inset 0 0 0 1px var(--ring)}
.todo{font-size:10px;line-height:1.6;padding:0 4px;border-radius:4px;border:1px solid var(--warn);
  color:var(--ink2);margin-left:5px;white-space:nowrap}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--ink2);margin-top:14px}
.legend span{display:inline-flex;align-items:center;gap:6px}
footer{color:var(--muted);font-size:12px;padding:8px 4px 0;line-height:1.9}
@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}
.tier{border:1px solid var(--ring);border-radius:12px;padding:12px 14px;background:var(--page)}
.tier .tl{font-size:11.5px;letter-spacing:.06em;color:var(--muted);margin-bottom:2px;
  display:flex;justify-content:space-between;gap:10px}
.tier .tl b{font-weight:600;color:var(--ink2);font-variant-numeric:tabular-nums}
.tier .tt{font-size:15px;font-weight:600}
.tier .td{font-size:12.5px;color:var(--ink2);margin-top:2px}
.arrow{display:flex;align-items:center;justify-content:center;gap:8px;color:var(--muted);
  font-size:11.5px;padding:7px 0}
.arrow::before,.arrow::after{content:"";height:1px;width:34px;background:var(--axis)}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
.chip{font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid var(--ring);background:var(--surface);
  display:inline-flex;align-items:center;gap:6px}
.bands{display:flex;flex-direction:column;gap:0}
table.rel{border-collapse:collapse;width:100%;margin-top:14px;font-size:13px}
table.rel th,table.rel td{padding:7px 10px;border-bottom:1px solid var(--grid);text-align:left}
table.rel th{font-size:11.5px;letter-spacing:.05em;color:var(--muted);font-weight:600;
  border-bottom:1px solid var(--axis);white-space:nowrap}
table.rel td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
`.trim()

const THEME_JS = `
document.getElementById('tg').addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme');
  const sysDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  const now = cur ? cur : (sysDark?'dark':'light');
  document.documentElement.setAttribute('data-theme', now==='dark'?'light':'dark');
});
`.trim()

const TITLE = '壱岐市の全計画 76件の俯瞰'
const DESC = '長崎県壱岐市が公表している行政計画76件（市66・社会福祉協議会1・長崎県9）を、'
  + '位置づけの階層・計画期間・分野別の一覧で俯瞰します。data/plans.yml から生成しています。'

export function buildPage(doc) {
  const m = buildModel(doc)
  return [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(TITLE)} | 壱岐市 計画マップ</title>`,
    `<meta name="description" content="${esc(DESC)}">`,
    '<link rel="canonical" href="https://keikaku.ikilab.org/plans/all/">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="壱岐市 計画マップ">',
    `<meta property="og:title" content="${esc(TITLE)}">`,
    `<meta property="og:description" content="${esc(DESC)}">`,
    '<meta property="og:url" content="https://keikaku.ikilab.org/plans/all/">',
    '<meta property="og:locale" content="ja_JP">',
    '<meta property="og:image" content="https://keikaku.ikilab.org/assets/og.png">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<link rel="stylesheet" href="../../assets/palette.css">',
    '<style>',
    PAGE_CSS,
    '</style>',
    '</head>',
    '<body>',
    '<div class="wrap">',
    headerBlock(),
    statsSection(m),
    taikeiSection(m),
    // Task 4〜6でここにセクションを足します
    footerBlock(m),
    '</div>',
    '<script>',
    THEME_JS,
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

function headerBlock() {
  return `<header class="top">
  <div>
    <a class="badge" href="../../">← 計画マップ</a>
    <span class="badge">IKILAB ／ 長崎県壱岐市</span>
    <h1>${esc(TITLE)}</h1>
    <p class="sub">壱岐市が公表している行政計画を、位置づけの階層・計画期間・分野別の一覧で俯瞰します。
    このページは <code>data/plans.yml</code> から生成しているので、データを直せば図も表も追随します。
    <strong>分野ごとの掘り下げは各分野のページの役割です。</strong>ここには構造だけを置いています。</p>
  </div>
  <button class="tg" id="tg">◐ 表示切替</button>
</header>`
}

function statsSection(m) {
  const nearest = m.expiry[0]
  const tile = (v, unit, k, alert) =>
    `<div class="tile${alert ? ' alert' : ''}"><div class="v">${v}<small>${esc(unit)}</small></div><div class="k">${esc(k)}</div></div>`
  return `<section>
  <div class="hd"><h2>数でみる</h2></div>
  <div class="tiles">
    ${tile(m.plans.length, '件', '収録している計画')}
    ${tile(nearest ? nearest.count : 0, '件', `${nearest ? fiscalYearShort(nearest.year) : '—'}年度末に満了`, true)}
    ${tile(m.zuiji.length, '件', '随時修正（期間を定めない）')}
    ${tile(m.unclear.length, '件', '計画期間を確認できていない', true)}
    ${tile(m.todoCount, '件', '未調査の項目が残っている', true)}
  </div>
  <p class="mut" style="margin-top:12px">調査基準日 ${esc(m.meta.survey_date)}／データ更新 ${esc(m.meta.updated)}。
  収録の範囲と除外の基準は <a href="https://github.com/ikilab-org/iki-keikaku/blob/main/data/schema.md">data/schema.md</a> にあります。</p>
</section>`
}

export function taikeiSection(m) {
  const bands = m.bands.map((b, i) => {
    const chips = b.plans.map((p) => `<span class="chip"><span class="dot" style="background:${colorOf(p, m.domains)}"></span>`
      + `${esc(p.name)}${p.todo ? '<span class="todo" title="未調査の項目があります">未</span>' : ''}</span>`).join('\n        ')
    const arrow = b.arrow && i < m.bands.length - 1 ? `\n    <div class="arrow">${esc(b.arrow)}</div>` : ''
    return `    <div class="tier" data-band-count="${b.plans.length}">
      <div class="tl"><span>${esc(b.label)}</span><b>${b.plans.length}件</b></div>
      <div class="td">${esc(b.note)}</div>
      <div class="chips">
        ${chips}
      </div>
    </div>${arrow}`
  }).join('\n')

  const legend = Object.entries(m.domains)
    .sort((a, b) => a[1].slot - b[1].slot)
    .map(([, def]) => `<span><i class="dot" style="background:var(--c${def.slot})"></i>${esc(def.label)}</span>`)
    .join('\n    ')

  const rel = m.relations.map((r) => `      <tr><td>${esc(r.label)}</td><td class="n">${r.plans} / ${r.total}</td><td class="n">${r.edges}</td></tr>`).join('\n')

  return `<section>
  <div class="hd"><h2>体系</h2>
  <p class="sub">帯の順序は <code>tier</code>（位置づけの階層）です。<strong>個々の計画のあいだに線は引いていません。</strong>
  明示的な関係はまだ本数が薄く、線にすると「関係が無い」のか「まだ調べていない」のかが区別できなくなるためです。
  分かっている関係は下の表に本数で示します。</p></div>
  <div class="bands">
${bands}
  </div>
  <div class="legend">
    ${legend}
    <span><i class="dot" style="background:var(--muted)"></i>分野の割り当てなし（国・長崎県）</span>
  </div>
  <p class="mut" style="margin-top:9px">凡例のほか、<span style="font-size:10px;line-height:1.6;padding:0 4px;border-radius:4px;border:1px solid var(--warn);color:var(--ink2);white-space:nowrap">未</span>印は未調査の項目がある計画です。</p>
  <h3 style="font-size:14px;margin:22px 0 0;color:var(--ink2)">分かっている関係</h3>
  <p class="mut" style="margin:2px 0 0">分母は収録件数。<strong>本数の少なさは、関係が無いことではなく調査が進んでいないことを表します。</strong></p>
  <table class="rel">
    <thead><tr><th>関係</th><th class="n">持つ計画</th><th class="n">延べ本数</th></tr></thead>
    <tbody>
${rel}
    </tbody>
  </table>
</section>`
}

function footerBlock(m) {
  return `<footer>
  このページは <a href="https://github.com/ikilab-org/iki-keikaku/blob/main/data/plans.yml">data/plans.yml</a> から
  <a href="https://github.com/ikilab-org/iki-keikaku/blob/main/tools/build.mjs">tools/build.mjs</a> で生成しています。
  調査基準日 ${esc(m.meta.survey_date)}／データ更新 ${esc(m.meta.updated)}。<br>
  <strong>これは壱岐市の公式資料ではありません。</strong> 市・県・国が公表している資料をもとに IKILAB が独立して整理したものです。
  誤りにお気づきの場合は <a href="https://github.com/ikilab-org/iki-keikaku/issues">Issue</a> へお知らせください。<br>
  <a href="../../about/license/">ライセンス</a>　／　運営：<a href="https://ikilab.org">IKILAB</a>　／
  文章・図表・データは <a href="https://creativecommons.org/licenses/by/4.0/deed.ja">CC BY 4.0</a>、コードは
  <a href="https://opensource.org/licenses/MIT">MIT</a>。引用元の公表資料の権利は各機関に帰属します。
</footer>`
}

// --- CLI --------------------------------------------------------------------
// テストから import されたときに走らないよう、直接実行のときだけ動かす
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const out = new URL('../plans/all/index.html', import.meta.url)
  const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))

  // 壊れたデータからページを作らない。
  // 基準日は doc.meta.updated にする。現在時刻にすると、日が変わっただけで
  // 生成できたりできなかったりして再現しなくなる。
  const errors = validate(doc, new Date(doc.meta.updated)).filter((f) => f.severity === 'error')
  if (errors.length) {
    console.error(`data/plans.yml に error が ${errors.length}件あります。生成しません。`)
    for (const f of errors) console.error(`- ${f.id}: ${f.message}`)
    process.exit(1)
  }

  // 分野を増やしたのに配色を足していない、を生成前に見つける
  const { slots } = readPalette()
  for (const [key, def] of Object.entries(doc.domains ?? {})) {
    if (!slots[def.slot]) {
      console.error(`domains.${key} の slot ${def.slot} に対応する色が assets/palette.css にありません`)
      process.exit(1)
    }
  }

  const html = buildPage(doc)

  if (args.includes('--check')) {
    let current = null
    try { current = readFileSync(out, 'utf8') } catch { /* 未生成 */ }
    if (current === html) {
      console.log('plans/all/index.html は data/plans.yml と一致しています')
      process.exit(0)
    }
    console.error('plans/all/index.html が data/plans.yml と一致しません。')
    console.error('node tools/build.mjs を実行して、生成物もコミットしてください。')
    process.exit(1)
  }

  mkdirSync(new URL('.', out), { recursive: true })
  writeFileSync(out, html)
  console.log(`plans/all/index.html を生成しました（計画 ${doc.plans.length} 件）`)
}
