#!/usr/bin/env node
/**
 * data/plans.yml の出典（url / pdf / sources[].url）と sources/MANIFEST.md を突き合わせ、
 * 台帳に未登録の出典を検出する。
 *
 * sources/POLICY.md「3. 記録すること」は、すべての出典を MANIFEST.md に記録すると定めている。
 * URLと資料名は plans.yml にすでにあるので、台帳の骨格行は自動生成できる。
 * 残存性・保存・参照箇所は人が判断する項目なので、このツールは自動で埋めない
 * （誤った残存性が公開文書に入るより、「要判定」で未調査と分かるほうが安全）。
 *
 * 使い方:
 *   node tools/manifest.mjs                     # 未登録の出典を一覧表示
 *   node tools/manifest.mjs --json               # JSON で出力
 *   node tools/manifest.mjs --fail-on-missing    # 未登録があれば exit 1（CI用）
 *   node tools/manifest.mjs --append             # 未登録分の骨格行を MANIFEST.md に追記
 *   node tools/manifest.mjs --today 2026-08-12   # 追記する最終確認日（既定は今日）
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'

// level → MANIFEST.md のセクションとベースURL。
// national はページ全体でフルURLを使う運用のため base を持たない。
const LEVEL_TO_SECTION = {
  municipal:   { section: '壱岐市', base: 'https://www.city.iki.nagasaki.jp' },
  council:     { section: '壱岐市', base: 'https://www.city.iki.nagasaki.jp' },
  prefectural: { section: '長崎県', base: 'https://www.pref.nagasaki.jp' },
  national:    { section: '国', base: null },
}
// MANIFEST.md 内での出現順。--append の挿入位置探索にも使う。
const SECTION_ORDER = ['壱岐市', '長崎県', '国']
const EXPIRED_TITLE_RE = /^失効した出典/

/**
 * base 配下のURLなら相対パスに、そうでなければフルURLのまま返す。
 * `startsWith` だけだとホスト境界を見ないため、
 * `https://www.city.iki.nagasaki.jp.example.com/...` のような別ホストを誤って
 * 「ベースURL配下」と判定しうる。base 自体との完全一致、または base の直後が `/` の
 * 場合だけを「配下」とみなす。
 */
const toPath = (url, base) => {
  if (!base) return url
  if (url === base || url.startsWith(base + '/')) return url.slice(base.length)
  return url
}

// --- data/plans.yml から出典を抽出する ---------------------------------------

/**
 * plans.yml のすべての計画から、出典候補（url / pdf / sources[].url）を抽出する。
 * MANIFEST.md との突き合わせは行わない（それは findUnregistered の役割）。
 */
export function extractSources(doc) {
  const out = []
  for (const p of doc?.plans ?? []) {
    if (!p?.id || !p?.name || !p?.level) continue
    const cfg = LEVEL_TO_SECTION[p.level]
    if (!cfg) continue
    const { section, base } = cfg

    if (p.url) {
      out.push({ id: p.id, section, label: `${p.name}（掲載ページ）`, path: toPath(p.url, base), url: p.url })
    }
    if (p.pdf) {
      out.push({ id: p.id, section, label: `${p.name}（本体PDF）`, path: toPath(p.pdf, base), url: p.pdf })
    }
    for (const s of p.sources ?? []) {
      if (!s?.url) continue
      out.push({ id: p.id, section, label: `${p.name}／${s.label}`, path: toPath(s.url, base), url: s.url })
    }
  }
  return out
}

// --- sources/MANIFEST.md から登録済みURLを抽出する ---------------------------

/** `## 見出し` で本文を区切る（見出し行より前の本文は破棄する） */
function splitSections(manifestText) {
  const lines = manifestText.split(/\r?\n/)
  const sections = []
  let current = null
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      current = { title: m[1], lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  return sections
}

/** 表の行（| で始まる行）にあるバッククォート付きのパス・URLだけを拾う */
function extractBacktickTargets(bodyLines) {
  const out = []
  for (const line of bodyLines) {
    if (!line.trim().startsWith('|')) continue
    for (const m of line.matchAll(/`(\/[^`]*|https?:\/\/[^`]*)`/g)) out.push(m[1])
  }
  return out
}

/** `| a | b | c |` 形式の行をセルの配列に分割する（前後の空要素は除く） */
function tableCells(line) {
  return line.trim().split('|').slice(1, -1).map((c) => c.trim())
}

/**
 * 「失効した出典（記録として保持）」の表は、2列目（旧URL）だけを拾う。
 * 4列目「代替」欄にもURL（移設先候補など）が書かれることがあり、そこまで拾うと
 * 「代替欄に書いただけのURL」を登録済みと誤認して、同じURLを持つ本当に未登録の
 * 出典を見逃す経路になる。
 */
function extractExpiredOldUrls(bodyLines) {
  const out = []
  for (const line of bodyLines) {
    if (!line.trim().startsWith('|')) continue
    const cells = tableCells(line)
    const oldUrlCell = cells[1]
    if (!oldUrlCell) continue
    const m = oldUrlCell.match(/^`(\/[^`]*|https?:\/\/[^`]*)`$/)
    if (m) out.push(m[1])
  }
  return out
}

function extractBaseUrl(bodyLines) {
  for (const line of bodyLines) {
    const m = line.match(/ベースURL:\s*`(https?:\/\/[^`]+)`/)
    if (m) return m[1]
  }
  return null
}

/**
 * MANIFEST.md に書かれている出典URLの集合を、フルURLに正規化して作る。
 *
 * 「失効した出典（記録として保持）」の表の**2列目（旧URL）**にあるURLも登録済みとして扱う。
 * 失効の記録は意図的に残されているものであり、未登録として再度報告しないため
 * （POLICY.md 6節）。失効の表はどのベースURL配下かを明示しないので、
 * 壱岐市・長崎県それぞれのベースURLで補ったURLをすべて登録済みとみなす。
 * **4列目「代替」欄は見ない。** 代替欄はURLとは限らない自由記述であり、そこに書かれた
 * URLまで登録済みとして拾うと、たまたま同じURLを持つ本当に未登録の出典を見逃す
 * （このツールの目的である「機械的な網羅」が壊れる）。
 */
export function extractRegisteredUrls(manifestText) {
  const sections = splitSections(manifestText)
  const known = new Set()
  const bases = []

  for (const title of SECTION_ORDER) {
    const sec = sections.find((s) => s.title === title)
    if (!sec) continue
    const base = extractBaseUrl(sec.lines)
    if (base) bases.push(base)
    for (const target of extractBacktickTargets(sec.lines)) {
      known.add(target.startsWith('http') ? target : (base ? base + target : target))
    }
  }

  const expiredSec = sections.find((s) => EXPIRED_TITLE_RE.test(s.title))
  if (expiredSec) {
    for (const target of extractExpiredOldUrls(expiredSec.lines)) {
      if (target.startsWith('http')) { known.add(target); continue }
      if (bases.length === 0) { known.add(target); continue }
      for (const base of bases) known.add(base + target)
    }
  }

  return known
}

// --- 突き合わせ ---------------------------------------------------------------

/**
 * plans.yml の出典のうち、MANIFEST.md に未登録のものを返す。
 * 同じURLが複数の計画から参照されていても、1件だけ報告する。
 */
export function findUnregistered(doc, manifestText) {
  const registered = extractRegisteredUrls(manifestText)
  const seen = new Set()
  const missing = []
  for (const src of extractSources(doc)) {
    if (registered.has(src.url) || seen.has(src.url)) continue
    seen.add(src.url)
    missing.push(src)
  }
  return missing
}

// --- --append: 骨格行を MANIFEST.md に追記する -------------------------------

/** 壱岐市は6列（残存性・最終確認・保存・参照箇所）、長崎県・国は4列 */
function formatRow(section, item, today) {
  const path = '`' + item.path + '`'
  return section === '壱岐市'
    ? `| ${item.label} | ${path} | 要判定 | ${today} | ― | ― |`
    : `| ${item.label} | ${path} | 要判定 | ${today} |`
}

/** セクション見出しの行番号と、そのセクションの表が終わる行番号（ベースURL行 or 次の見出し）を返す */
function findSectionRange(lines, title) {
  const headerIdx = lines.findIndex((l) => l.trim() === `## ${title}`)
  if (headerIdx === -1) return null
  let endIdx = lines.length
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^ベースURL:/.test(lines[i]) || /^##\s/.test(lines[i])) { endIdx = i; break }
  }
  return { headerIdx, endIdx }
}

function lastTableRowIndex(lines, start, end) {
  let last = -1
  for (let i = start; i < end; i++) {
    if (lines[i].trim().startsWith('|')) last = i
  }
  return last
}

/**
 * 未登録分の骨格行を、該当セクションの表の末尾（ベースURL行より前）に追記する。
 * 既存の行はいっさい書き換えない。純粋関数（ファイルI/Oはしない）。
 *
 * 戻り値の `skipped` は、該当セクションの見出しが MANIFEST.md に見つからず
 * 追記できなかった件数（セクションごと）。呼び出し側（CLI）が黙って落とさず、
 * 必ず警告・件数として扱えるようにするための情報。
 */
export function buildAppendedManifest(manifestText, missing, today) {
  const bySection = new Map()
  for (const m of missing) {
    if (!bySection.has(m.section)) bySection.set(m.section, [])
    bySection.get(m.section).push(m)
  }

  const lines = manifestText.split(/\r?\n/)
  const skipped = []
  // ファイル内で後ろにあるセクションから処理する。
  // 挿入で行がずれても、まだ処理していない前方のセクションの行番号には影響しない。
  for (const title of [...SECTION_ORDER].reverse()) {
    const rows = bySection.get(title)
    if (!rows || !rows.length) continue
    const range = findSectionRange(lines, title)
    if (!range) {
      skipped.push({ section: title, count: rows.length })
      continue
    }
    const insertAt = lastTableRowIndex(lines, range.headerIdx, range.endIdx) + 1
    lines.splice(insertAt, 0, ...rows.map((r) => formatRow(title, r, today)))
  }
  return { text: lines.join('\n'), skipped }
}

// --- CLI --------------------------------------------------------------------
// テストから import されたときに走らないよう、直接実行のときだけ動かす
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
  const today = getArg('--today', new Date().toISOString().slice(0, 10))

  const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
  const manifestPath = new URL('../sources/MANIFEST.md', import.meta.url)
  const manifestText = readFileSync(manifestPath, 'utf8')

  const missing = findUnregistered(doc, manifestText)
  const total = new Set(extractSources(doc).map((s) => s.url)).size

  if (args.includes('--append')) {
    if (missing.length === 0) {
      console.log('未登録の出典はありません。追記の必要はありません。')
    } else {
      const { text, skipped } = buildAppendedManifest(manifestText, missing, today)
      writeFileSync(manifestPath, text, 'utf8')
      const skippedCount = skipped.reduce((n, s) => n + s.count, 0)
      const appendedCount = missing.length - skippedCount
      console.log(`${appendedCount} 件の骨格行を sources/MANIFEST.md に追記しました（最終確認日: ${today}）。`)
      for (const s of skipped) {
        console.error(`警告: MANIFEST.md に「## ${s.section}」の見出しが見つからず、${s.count} 件を追記できませんでした。`)
      }
      console.log('残存性はすべて「要判定」です。POLICY.md「2. 出典の選び方」の区分に沿って人が確認してください。')
    }
  } else if (args.includes('--json')) {
    console.log(JSON.stringify({ total, missing: missing.length, findings: missing }, null, 2))
  } else {
    console.log(`出典 ${total} 件中、未登録 ${missing.length} 件\n`)
    for (const section of SECTION_ORDER) {
      const rows = missing.filter((m) => m.section === section)
      if (!rows.length) continue
      console.log(`## ${section}（${rows.length}件）`)
      for (const r of rows) console.log(`- ${r.label}: \`${r.path}\`（${r.id}）`)
      console.log('')
    }
  }

  if (args.includes('--fail-on-missing') && missing.length > 0) process.exit(1)
}
