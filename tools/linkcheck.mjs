#!/usr/bin/env node
/**
 * data/plans.yml に載っているすべてのURLの死活を確認する。
 *
 * 行政サイトの募集告示・入札公告は掲載期間終了後に削除される。
 * このスクリプトを週次で回し、失効したURLを検知して Issue を立てる。
 * 404 だけでなく、「200 を返すが本文が空」のページも失効として扱う
 * （カテゴリ移設後の旧URLがこの型になる）。
 * （sources/POLICY.md「出典URLの寿命管理」の自動化部分）
 *
 * 使い方:
 *   node tools/linkcheck.mjs              # 結果を標準出力
 *   node tools/linkcheck.mjs --json       # JSON で出力
 *   node tools/linkcheck.mjs --fail-on-dead  # 失効があれば exit 1
 */
import { readFileSync } from 'node:fs'

const TIMEOUT_MS = 20000
const CONCURRENCY = 4
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const failOnDead = args.includes('--fail-on-dead')

// --- plans.yml から URL を抽出（依存を増やさないため簡易パーサ） -------------
// "url:" / "pdf:" で始まる行と、sources 配下の "- url:" を拾う。
// 完全なYAMLパースは不要（URLの抽出だけが目的）。
const raw = readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8')
const lines = raw.split('\n')

const targets = []
let currentPlan = '(unknown)'
for (const line of lines) {
  const idMatch = line.match(/^\s*-\s+id:\s*(\S+)/)
  if (idMatch) currentPlan = idMatch[1]
  const urlMatch = line.match(/^\s*-?\s*(?:url|pdf):\s*(https?:\/\/\S+)/)
  if (urlMatch) targets.push({ plan: currentPlan, url: urlMatch[1].replace(/[,"']+$/, '') })
}

// 重複を除く
const seen = new Set()
const unique = targets.filter(t => (seen.has(t.url) ? false : (seen.add(t.url), true)))

// --- 死活確認 ---------------------------------------------------------------
async function check({ plan, url }) {
  const started = Date.now()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    // HEAD を拒否するサーバがあるため、失敗したら GET でリトライ
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl.signal })
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal })
    }

    // ステータスコードだけでは足りない。長崎県サイトではカテゴリの移設後、
    // 旧URLが 200 を返しながら中身が空のフラグメントになる（2026-08-11、Issue #1）。
    // HTML なら本文を取得して、ページとして成立しているかを見る。
    let empty
    if (res.ok && (res.headers.get('content-type') || '').includes('html')) {
      const body = await (await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal })).text()
      if (!/<title/i.test(body)) empty = `${body.length}バイトの空ページ（200だが本文なし。移設・削除の可能性）`
    }

    clearTimeout(timer)
    return {
      plan, url,
      status: res.status,
      ok: res.ok && !empty,
      error: empty,
      finalUrl: res.url !== url ? res.url : undefined,
      ms: Date.now() - started,
    }
  } catch (e) {
    clearTimeout(timer)
    return { plan, url, status: 0, ok: false, error: String(e.message || e), ms: Date.now() - started }
  }
}

async function run() {
  const results = []
  const queue = [...unique]
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const t = queue.shift()
      results.push(await check(t))
    }
  })
  await Promise.all(workers)
  results.sort((a, b) => Number(a.ok) - Number(b.ok) || a.plan.localeCompare(b.plan))

  const dead = results.filter(r => !r.ok)

  if (asJson) {
    console.log(JSON.stringify({ checked: results.length, dead: dead.length, results }, null, 2))
  } else {
    console.log(`確認 ${results.length} 件 / 失効 ${dead.length} 件\n`)
    for (const r of results) {
      const mark = r.ok ? 'OK  ' : r.status === 200 ? '空   ' : 'DEAD'
      const extra = r.error ? `  (${r.error})` : r.finalUrl ? `  -> ${r.finalUrl}` : ''
      console.log(`${mark} ${String(r.status).padStart(3)} [${r.plan}] ${r.url}${extra}`)
    }
    if (dead.length) {
      console.log('\n--- 失効したURL ---')
      for (const r of dead) console.log(`- [${r.plan}] ${r.url} (${r.status || r.error})`)
      console.log('\n対応: sources/POLICY.md の手順に従い、保存済み資料または代替の一次資料へ差し替える。')
    }
  }

  if (failOnDead && dead.length) process.exit(1)
}

run()
