#!/usr/bin/env node
/**
 * 計画期間の満了が近いもの／既に満了しているのに後継が未確認のものを検出する。
 *
 * 壱岐市は令和8年度末に福祉分野の4計画が同時満了し、
 * 令和8年12月〜令和9年2月に5計画が相次いでパブリックコメントにかかる。
 * 見落とすと意見提出のタイミングを逃すため、月次で回して Issue を立てる。
 *
 * 使い方:
 *   node tools/expiring.mjs                 # 既定 = 今日基準、18か月先まで
 *   node tools/expiring.mjs --months 24
 *   node tools/expiring.mjs --today 2026-08-11
 *   node tools/expiring.mjs --json
 */
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const getArg = (k, d) => {
  const i = args.indexOf(k)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const MONTHS = Number(getArg('--months', 18))
const today = new Date(getArg('--today', new Date().toISOString().slice(0, 10)))
const asJson = args.includes('--json')

// --- plans.yml の簡易パース（必要なフィールドのみ） -------------------------
const raw = readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8')
const blocks = raw.split(/\n(?=  - id: )/).slice(1)

const plans = blocks.map(b => {
  const g = (re) => (b.match(re) || [])[1]
  const period = b.match(/period:\s*\{\s*start:\s*(\S+?),\s*end:\s*(\S+?)\s*\}/)
  const pc = b.match(/public_comment:\s*\{\s*start:\s*([\d-]+),\s*end:\s*([\d-]+)\s*\}/)
  return {
    id: g(/- id:\s*(\S+)/),
    name: g(/\n\s+name:\s*(.+)/)?.trim(),
    level: g(/\n\s+level:\s*(\S+)/),
    status: g(/\n\s+status:\s*(\S+)/),
    start: period && period[1] !== 'null' ? Number(period[1]) : null,
    end: period && period[2] !== 'null' ? Number(period[2]) : null,
    pcStart: pc ? pc[1] : null,
    pcEnd: pc ? pc[2] : null,
    todo: /\n\s+todo:/.test(b),
  }
}).filter(p => p.id)

// 日本の年度末 = 翌年3月31日
const fyEnd = (y) => new Date(`${y + 1}-03-31`)
const monthsBetween = (a, b) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())

const soon = []
const overdue = []
const pubcom = []

for (const p of plans) {
  if (p.end != null) {
    const end = fyEnd(p.end)
    const m = monthsBetween(today, end)
    // status: expired は「意図的に残している過去の計画」なので対象外
    if (m < 0 && p.status !== 'expired') overdue.push({ ...p, monthsPast: -m })
    else if (m <= MONTHS) soon.push({ ...p, monthsLeft: m })
  }
  if (p.pcStart) {
    const s = new Date(`${p.pcStart}-01`)
    const m = monthsBetween(today, s)
    if (m >= -2 && m <= MONTHS) pubcom.push({ ...p, monthsToPc: m })
  }
}

soon.sort((a, b) => a.monthsLeft - b.monthsLeft)
pubcom.sort((a, b) => a.monthsToPc - b.monthsToPc)
overdue.sort((a, b) => a.monthsPast - b.monthsPast)

const todos = plans.filter(p => p.todo)

if (asJson) {
  console.log(JSON.stringify({ today: today.toISOString().slice(0, 10), soon, pubcom, overdue, todos }, null, 2))
} else {
  const fy = (y) => `令和${y - 2018}年度（${y}年度）`
  console.log(`基準日 ${today.toISOString().slice(0, 10)} ／ ${MONTHS}か月先まで\n`)

  console.log(`## 満了が近い計画（${soon.length}件）`)
  for (const p of soon) console.log(`- あと${p.monthsLeft}か月　${p.name}　→ ${fy(p.end)}末で満了`)

  console.log(`\n## パブリックコメントが近い計画（${pubcom.length}件）`)
  for (const p of pubcom) {
    const when = p.monthsToPc < 0 ? `実施中または直近（${p.pcStart}〜${p.pcEnd}）` : `${p.monthsToPc}か月後（${p.pcStart}〜${p.pcEnd}）`
    console.log(`- ${when}　${p.name}`)
  }

  console.log(`\n## 満了済み（${overdue.length}件）`)
  for (const p of overdue) console.log(`- ${p.monthsPast}か月経過　${p.name}　（後継の確認要）`)

  console.log(`\n## 未調査の項目（${todos.length}件）`)
  for (const p of todos) console.log(`- ${p.name}（id: ${p.id}）`)
}
