# 全計画の洗い出しと分類・関係の整理 実装計画

> **エージェント向け:** 必須サブスキル — `superpowers:subagent-driven-development`（推奨）または
> `superpowers:executing-plans` を使い、タスク単位で実装すること。手順はチェックボックス（`- [ ]`）形式。

**Goal:** 壱岐市が公表しているすべての行政計画を `data/plans.yml` に収録し、分野2階層・法定性・階層・実施機関で分類したうえで、計画どうしの関係を機械的に辿れる状態にする。

**Architecture:** 先に検証の土台（依存なしの最小YAMLパーサ＋バリデータ）を TDD で作り、次に既存31件をスキーマ移行して `validate` が error 0 の状態を作る。その状態を保ちながら、組織ごと巡回で計画を追加していく。バリデータが常に緑であることが、投入作業の安全網になる。

**Tech Stack:** Node.js 20+（CI は node 20、開発機は v22.17.0）、`node:test`（標準のテストランナー）、外部依存なし。

**設計:** [`docs/design/2026-08-12-zenkeikaku-bunrui.md`](2026-08-12-zenkeikaku-bunrui.md)（以下「設計」。章番号はこれを指す）

## Global Constraints

- **外部依存を追加しない。** `.github/workflows/` は `npm install` を実行せず `node tools/*.mjs` を直接叩く。`package.json` の `devDependencies` は playwright（OGP画像生成用）のみで、これを増やさない
- **Node 20 で動くこと。** CI は `actions/setup-node@v4` の `node-version: '20'`
- 年度はすべて西暦の年度（`2022` = 令和4年度 = 2022年4月〜2023年3月）
- **出典のないデータを追加しない。** 推測は `notes:` に「※推定」と明記する（`CONTRIBUTING.md`「守ってほしいこと」1・2）
- **所管課は例規集の組織規程を根拠にする。** 掲載ページの問い合わせ先を根拠にしない（`sources/POLICY.md`）
- **未調査の表し方は1つ。** フィールドを書かない（欠落）＋ `todo:` に内容を書く。`status: unknown` は計画全体が未調査のときのみ。`null` は「調査した結果、値が存在しない」の意味（設計 6.1）
- `department` の複数課区切りは全角スラッシュ `／`。中黒 `・` は班名に含まれるため使わない（`data/schema.md`）
- 内容を変えたら `CHANGELOG.md` に追記する
- コミットメッセージは日本語。何をどう変えたかが分かれば十分

## File Structure

| ファイル | 責務 |
|---|---|
| `tools/yaml.mjs` | **新規。** `plans.yml` が使う範囲だけのYAML解釈。構文解釈のみを持ち、計画の意味は知らない |
| `tools/yaml.test.mjs` | **新規。** 上記の単体テスト |
| `tools/validate.mjs` | **新規。** 計画データの整合性検査。`validate(doc, today)` を export し、CLI は main 実行時のみ動く |
| `tools/validate.test.mjs` | **新規。** 上記の単体テスト。ファイルI/Oを伴わず、オブジェクトを直接渡す |
| `data/schema.md` | スキーマの定義。新フィールドと未調査の表し方を追記 |
| `data/plans.yml` | データ本体。`domains` 新設、既存31件の移行、新規計画の投入 |
| `sources/POLICY.md` | 出典と調査の方針。「計画を洗い出す手順」と巡回台帳を追記 |
| `CONTRIBUTING.md` / `README.md` / `CHANGELOG.md` | 手順・ツール一覧・改訂履歴 |

`yaml.mjs` と `validate.mjs` を分けるのは、**前者が構文、後者が意味**という別々の責務だからです。
`yaml.mjs` は他自治体がフォークしても手を入れずに使えます。

---

# Phase A — 検証の土台

## Task 1: 依存なしのYAMLパーサ

**Files:**
- Create: `tools/yaml.mjs`
- Test: `tools/yaml.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces:
  - `parseYaml(text: string) -> object` — YAML文書全体をJSオブジェクトにする
  - `parseValue(s: string) -> any` — 1つの値（フロー形式を含む）を解釈する
  - `parseScalar(s: string) -> string|number|boolean|null` — 引用符・null・数値を解釈する
  - `stripComment(s: string) -> string` — 引用符の外の `" #"` 以降を落とす

**設計上の注意:** 日付めいた文字列（`2026-08-12`、`2024-03`）は**文字列のまま返す**こと。
`Date` に変換すると `meta.updated` や `adopted` の比較が壊れます。`period: { start: 2024 }` は数値。

- [ ] **Step 1: 失敗するテストを書く**

`tools/yaml.test.mjs` を新規作成:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml, parseValue, parseScalar, stripComment } from './yaml.mjs'

test('スカラーを型に落とす', () => {
  assert.equal(parseScalar('null'), null)
  assert.equal(parseScalar(''), null)
  assert.equal(parseScalar('2018'), 2018)
  assert.equal(parseScalar('0'), 0)
  assert.equal(parseScalar('true'), true)
  assert.equal(parseScalar("'引用'"), '引用')
  assert.equal(parseScalar('"引用"'), '引用')
})

test('日付めいた文字列は文字列のまま', () => {
  assert.equal(parseScalar('2026-08-12'), '2026-08-12')
  assert.equal(parseScalar('2024-03'), '2024-03')
})

test('引用符の外のコメントだけ落とす', () => {
  assert.equal(stripComment('2018   # 令和元年 = 2019年'), '2018')
  assert.equal(stripComment('https://example.com/a#b'), 'https://example.com/a#b')
  assert.equal(stripComment('"# は文字列の中"'), '"# は文字列の中"')
})

test('フロー形式のマップと配列', () => {
  assert.deepEqual(parseValue('{ start: 2024, end: 2026 }'), { start: 2024, end: 2026 })
  assert.deepEqual(parseValue('{ start: null, end: null }'), { start: null, end: null })
  assert.deepEqual(parseValue('[a, b]'), ['a', 'b'])
  assert.deepEqual(parseValue('[]'), [])
})

test('マップの配列を読む', () => {
  const doc = parseYaml(['plans:', '  - id: a', '    name: あ', '  - id: b', '    name: い'].join('\n'))
  assert.deepEqual(doc.plans, [{ id: 'a', name: 'あ' }, { id: 'b', name: 'い' }])
})

test('スカラーの配列と空配列', () => {
  const doc = parseYaml(['laws:', '  - 社会福祉法107条', '  - 再犯防止推進法8条1項'].join('\n'))
  assert.deepEqual(doc.laws, ['社会福祉法107条', '再犯防止推進法8条1項'])
})

test('折りたたみブロックスカラーは1行に畳む', () => {
  const doc = parseYaml(['notes: >-', '  一行目。', '  二行目。', 'next: x'].join('\n'))
  assert.equal(doc.notes, '一行目。 二行目。')
  assert.equal(doc.next, 'x')
})

test('入れ子のマップ', () => {
  const doc = parseYaml(['successor:', '  name: 次期', '  public_comment: { start: 2026-12, end: 2027-01 }'].join('\n'))
  assert.deepEqual(doc.successor, { name: '次期', public_comment: { start: '2026-12', end: '2027-01' } })
})

test('行頭コメントと空行を飛ばす', () => {
  const doc = parseYaml(['# 見出し', '', 'meta:', '  # 中のコメント', '  era_base: 2018', ''].join('\n'))
  assert.deepEqual(doc.meta, { era_base: 2018 })
})

test('実際の data/plans.yml を読み切る', () => {
  const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
  assert.equal(doc.plans.length, 31)
  assert.equal(doc.meta.era_base, 2018)
  assert.equal(doc.plans[0].id, 'sougou-4')
  assert.deepEqual(doc.plans.find((p) => p.id === 'bousai').period, { start: null, end: null })
  assert.equal(doc.plans.every((p) => typeof p.id === 'string'), true)
  const k9 = doc.plans.find((p) => p.id === 'kourei-9')
  assert.deepEqual(k9.predecessors, ['kourei-8', 'kourei-7'])
  assert.equal(k9.successor.public_comment.start, '2026-12')
  assert.equal(k9.sources[0].url.startsWith('https://'), true)
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

```bash
node --test tools/yaml.test.mjs
```

期待: `Cannot find module` でエラー（`tools/yaml.mjs` が無い）

- [ ] **Step 3: パーサを実装する**

`tools/yaml.mjs` を新規作成:

```js
/**
 * data/plans.yml が使う範囲だけを解釈する最小YAMLパーサ。
 *
 * 依存を増やさないために自前で持つ（.github/workflows は npm install をしない）。
 * 対応するのは次だけ。これ以外の構文が現れたら例外を投げる。
 *
 *   マップ / マップの配列 / スカラーの配列 / ネスト
 *   フロー形式  { start: 2024, end: 2026 }   [a, b]   []
 *   ブロックスカラー  >-  >  |  |-
 *   コメント（行頭、および引用符の外の " #" 以降）
 *   引用符つき文字列 'x' "x"
 *   null / true / false / 整数
 *
 * 日付めいた文字列（2026-08-12, 2024-03）は文字列のまま返す。
 * ブロックスカラーの中に空行や行頭 # を含む場合は想定していない。
 */

// --- 字句 -------------------------------------------------------------------

function tokenize(text) {
  return text.split(/\r?\n/).map((raw, i) => {
    const indent = raw.length - raw.replace(/^\s*/, '').length
    return { line: i + 1, indent, content: raw.slice(indent).replace(/\s+$/, '') }
  })
}

const isSkippable = (l) => l.content === '' || l.content.startsWith('#')

function skip(lines, i) {
  while (i < lines.length && isSkippable(lines[i])) i++
  return i
}

/** 引用符の外にある " #" 以降を落とす */
export function stripComment(s) {
  let quote = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = null
    } else if (c === "'" || c === '"') {
      quote = c
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i).replace(/\s+$/, '')
    }
  }
  return s.replace(/\s+$/, '')
}

// --- スカラー ---------------------------------------------------------------

/** フロー形式の中身を、深さと引用符を見ながらカンマで割る */
function splitFlow(s) {
  const out = []
  let depth = 0, quote = null, cur = ''
  for (const c of s) {
    if (quote) {
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue }
    if (c === '{' || c === '[') depth++
    if (c === '}' || c === ']') depth--
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  if (cur.trim() !== '') out.push(cur)
  return out.map((x) => x.trim())
}

export function parseScalar(s) {
  const v = s.trim()
  if (v === '' || v === 'null' || v === '~') return null
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'")
  if (/^".*"$/.test(v)) return v.slice(1, -1)
  if (/^-?\d+$/.test(v)) return Number(v)
  return v
}

export function parseValue(s) {
  const v = s.trim()
  if (v.startsWith('[') && v.endsWith(']')) {
    return splitFlow(v.slice(1, -1)).map(parseValue)
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const obj = {}
    for (const part of splitFlow(v.slice(1, -1))) {
      const m = part.match(/^([^:]+):\s*(.*)$/)
      if (!m) throw new Error(`フロー形式のマップを解釈できません: ${part}`)
      obj[m[1].trim()] = parseValue(m[2])
    }
    return obj
  }
  return parseScalar(v)
}

// --- ブロックスカラー -------------------------------------------------------

function parseBlockScalar(lines, i, parentIndent, style) {
  const body = []
  while (i < lines.length) {
    const l = lines[i]
    if (l.content !== '' && l.indent <= parentIndent) break
    body.push(l.content)
    i++
  }
  while (body.length && body[body.length - 1] === '') body.pop()
  const folded = style.startsWith('>')
  return [folded ? body.join(' ').replace(/\s+/g, ' ').trim() : body.join('\n'), i]
}

// --- 構造 -------------------------------------------------------------------

const KEY = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(?:\s+(.*))?$/

function parseNode(lines, i, indent) {
  const j = skip(lines, i)
  if (j >= lines.length) return [null, j]
  return lines[j].content.startsWith('- ') || lines[j].content === '-'
    ? parseSequence(lines, j, indent)
    : parseMapping(lines, j, indent)
}

function parseMapping(lines, i, indent) {
  const map = {}
  while (i < lines.length) {
    i = skip(lines, i)
    if (i >= lines.length) break
    const l = lines[i]
    if (l.indent < indent) break
    if (l.indent > indent) throw new Error(`${l.line}行目: 字下げが揃っていません`)
    if (l.content.startsWith('- ')) break

    const m = l.content.match(KEY)
    if (!m) throw new Error(`${l.line}行目: キーとして解釈できません: ${l.content}`)
    const key = m[1]
    const rest = stripComment(m[2] ?? '')

    if (/^[>|][-+]?$/.test(rest)) {
      const [v, n] = parseBlockScalar(lines, i + 1, indent, rest)
      map[key] = v
      i = n
    } else if (rest === '') {
      const j = skip(lines, i + 1)
      if (j < lines.length && lines[j].indent > indent) {
        const [v, n] = parseNode(lines, j, lines[j].indent)
        map[key] = v
        i = n
      } else {
        map[key] = null
        i = i + 1
      }
    } else {
      map[key] = parseValue(rest)
      i = i + 1
    }
  }
  return [map, i]
}

function parseSequence(lines, i, indent) {
  const arr = []
  while (i < lines.length) {
    i = skip(lines, i)
    if (i >= lines.length) break
    const l = lines[i]
    if (l.indent < indent) break
    if (l.indent > indent) throw new Error(`${l.line}行目: 字下げが揃っていません`)
    if (!l.content.startsWith('- ') && l.content !== '-') break

    const rest = l.content === '-' ? '' : l.content.slice(2)
    if (rest === '') {
      const j = skip(lines, i + 1)
      if (j < lines.length && lines[j].indent > indent) {
        const [v, n] = parseNode(lines, j, lines[j].indent)
        arr.push(v)
        i = n
      } else {
        arr.push(null)
        i = i + 1
      }
    } else if (KEY.test(rest)) {
      // "- id: x" は、字下げ indent+2 のマップの1行目とみなす
      const sub = [{ ...l, indent: indent + 2, content: rest }, ...lines.slice(i + 1)]
      const [v, n] = parseMapping(sub, 0, indent + 2)
      arr.push(v)
      i = i + n
    } else {
      arr.push(parseValue(stripComment(rest)))
      i = i + 1
    }
  }
  return [arr, i]
}

export function parseYaml(text) {
  const lines = tokenize(text)
  const i = skip(lines, 0)
  if (i >= lines.length) return {}
  const [value] = parseNode(lines, i, lines[i].indent)
  return value
}
```

- [ ] **Step 4: テストを走らせて通ることを確認**

```bash
node --test tools/yaml.test.mjs
```

期待: `# pass 10` / `# fail 0`

- [ ] **Step 5: 既存ツールが壊れていないことを確認**

```bash
node tools/expiring.mjs --today 2026-08-12
```

期待: これまでどおり動く（`yaml.mjs` は既存ツールから参照していないため無影響。回帰がないことの確認）

- [ ] **Step 6: コミット**

```bash
git add tools/yaml.mjs tools/yaml.test.mjs
git commit -m "依存なしの最小YAMLパーサを追加

plans.yml が使う構文だけを解釈する。参照整合の検査には配列の解釈が要り、
既存2ツールの正規表現パーサでは足りないため。外部依存は増やさない。"
```

---

## Task 2: バリデータ — 構造の検査

**Files:**
- Create: `tools/validate.mjs`
- Test: `tools/validate.test.mjs`

**Interfaces:**
- Consumes: なし（`validate()` は純粋関数。`parseYaml` を使うのは Task 5 で足す CLI だけ）
- Produces:
  - `validate(doc: object, today?: Date) -> Array<{severity: 'error'|'warn', id: string, message: string}>`
  - `ENUM: { level, status, tier, statutory, agency }` — 各フィールドの許容値（配列）

このタスクでは **id・enum・分類キー**の検査だけを実装します。参照整合は Task 3、値の突合は Task 4、骨格は Task 5。

**CLI を後回しにする理由:** `validate()` を純粋関数として先に固めると、テストがファイルI/Oなしで書けます。

- [ ] **Step 1: 失敗するテストを書く**

`tools/validate.test.mjs` を新規作成:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate } from './validate.mjs'

const TODAY = new Date('2026-08-12')

/** 検査に通る最小の文書を作り、必要な差分だけ上書きする */
function doc(plans, extra = {}) {
  return {
    domains: { fukushi: { label: '健康・福祉', slot: 1 } },
    categories: { kourei: { label: '高齢者・介護', domain: 'fukushi' } },
    plans: plans.map((p) => ({
      level: 'municipal', domain: 'fukushi', category: 'kourei', tier: 'kobetsu',
      status: 'current', period: { start: 2024, end: 2029 },
      url: 'https://example.jp/a', name: '計画', ...p,
    })),
    ...extra,
  }
}
const messages = (d) => validate(d, TODAY).map((f) => `${f.severity}:${f.id}:${f.message}`)
const errorsOf = (d) => validate(d, TODAY).filter((f) => f.severity === 'error')

test('問題のない文書では何も報告しない', () => {
  assert.deepEqual(validate(doc([{ id: 'a' }]), TODAY), [])
})

test('id の重複を error にする', () => {
  const found = errorsOf(doc([{ id: 'a' }, { id: 'a' }]))
  assert.equal(found.length, 1)
  assert.match(found[0].message, /重複/)
})

test('id の書式違反を error にする', () => {
  assert.match(errorsOf(doc([{ id: 'Sougou_4' }]))[0].message, /英小文字/)
})

test('enum 違反を error にする', () => {
  assert.match(errorsOf(doc([{ id: 'a', status: '現行' }]))[0].message, /status: 現行/)
  assert.match(errorsOf(doc([{ id: 'a', tier: 'top' }]))[0].message, /tier: top/)
  assert.match(errorsOf(doc([{ id: 'a', agency: 'water' }]))[0].message, /agency: water/)
})

test('agency の省略は error にしない（既定は mayor）', () => {
  assert.deepEqual(validate(doc([{ id: 'a' }]), TODAY), [])
})

test('未定義の domain / category を error にする', () => {
  assert.match(errorsOf(doc([{ id: 'a', domain: 'nai' }]))[0].message, /domains にありません/)
  assert.match(errorsOf(doc([{ id: 'a', category: 'nai' }]))[0].message, /categories にありません/)
})

test('category が属する domain と食い違う場合を error にする', () => {
  const d = doc([{ id: 'a', domain: 'kyouiku' }])
  d.domains.kyouiku = { label: '教育・文化', slot: 2 }
  assert.match(errorsOf(d)[0].message, /category: kourei の domain/)
})

test('categories が未定義の domain を指す場合を error にする', () => {
  const d = doc([{ id: 'a' }])
  d.categories.kourei.domain = 'nai'
  assert.ok(messages(d).some((m) => m.startsWith('error:categories.kourei:')))
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: `Cannot find module './validate.mjs'`

- [ ] **Step 3: 構造の検査を実装する**

`tools/validate.mjs` を新規作成:

```js
#!/usr/bin/env node
/**
 * data/plans.yml の整合性を検査する。
 *
 * error … 整合性の破れ、または骨格の必須項目が todo: なしで欠落
 * warn  … 必須項目が欠落しているが todo: がある（明示的な猶予）、
 *         または意味を壊さない冗長な記述
 *
 * 判定の根拠は docs/design/2026-08-12-zenkeikaku-bunrui.md の 7.2 / 7.3。
 */

export const ENUM = {
  level: ['national', 'prefectural', 'municipal', 'council'],
  status: ['current', 'expiring', 'expired', 'planned', 'unknown'],
  tier: ['sougou', 'bumon', 'kobetsu', 'jisshi', 'shisetsu'],
  statutory: ['mandatory', 'effort', 'request', 'voluntary'],
  agency: ['mayor', 'education', 'fire', 'agri', 'assembly', 'election', 'audit'],
}

export function validate(doc, today = new Date()) {
  const found = []
  const add = (severity, id, message) => found.push({ severity, id, message })
  const plans = doc.plans ?? []
  const domains = doc.domains ?? {}
  const categories = doc.categories ?? {}
  const byId = new Map()

  for (const p of plans) {
    if (!p?.id) { add('error', '(id なし)', 'id がありません'); continue }
    if (byId.has(p.id)) add('error', p.id, 'id が重複しています')
    else byId.set(p.id, p)
    if (!/^[a-z0-9-]+$/.test(p.id)) add('error', p.id, 'id は英小文字・数字・ハイフンのみです')
  }

  for (const p of plans) {
    if (!p?.id) continue
    const id = p.id

    for (const [field, allowed] of Object.entries(ENUM)) {
      if (p[field] !== undefined && !allowed.includes(p[field])) {
        add('error', id, `${field}: ${p[field]} は未定義の値です（${allowed.join(' / ')}）`)
      }
    }

    if (p.domain !== undefined && !(p.domain in domains)) {
      add('error', id, `domain: ${p.domain} が domains にありません`)
    }
    if (p.category !== undefined) {
      if (!(p.category in categories)) {
        add('error', id, `category: ${p.category} が categories にありません`)
      } else {
        const owner = categories[p.category]?.domain
        if (owner && p.domain !== undefined && owner !== p.domain) {
          add('error', id, `domain: ${p.domain} は category: ${p.category} の domain（${owner}）と一致しません`)
        }
      }
    }
  }

  for (const [key, def] of Object.entries(categories)) {
    if (def?.domain && !(def.domain in domains)) {
      add('error', `categories.${key}`, `domain: ${def.domain} が domains にありません`)
    }
  }

  return found
}
```

- [ ] **Step 4: テストを走らせて通ることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: `# pass 8` / `# fail 0`

- [ ] **Step 5: コミット**

```bash
git add tools/validate.mjs tools/validate.test.mjs
git commit -m "バリデータの構造検査を追加（id・enum・分類キー）"
```

---

## Task 3: バリデータ — 関係の検査

**Files:**
- Modify: `tools/validate.mjs`
- Modify: `tools/validate.test.mjs`

**Interfaces:**
- Consumes: `validate()`（Task 2）
- Produces: 同じ `validate()` に、参照切れ・包含の相互性・`parent` 重複・`conforms_to` の宛先・`related` の両側記載の検査が加わる

**判定の要点:** `related` の両側記載だけが **warn**。無向辺として辺の集合が変わらないためです（設計 4.4）。

- [ ] **Step 1: 失敗するテストを追記**

`tools/validate.test.mjs` の末尾に追記:

```js
test('参照切れを error にする', () => {
  assert.match(errorsOf(doc([{ id: 'a', parent: 'nai' }]))[0].message, /parent: nai という計画がありません/)
  assert.match(errorsOf(doc([{ id: 'a', conforms_to: ['nai'] }]))[0].message, /conforms_to: nai/)
  assert.match(errorsOf(doc([{ id: 'a', predecessors: ['nai'] }]))[0].message, /predecessors: nai/)
})

test('includes と embedded_in が対応していない場合を error にする', () => {
  const found = errorsOf(doc([{ id: 'oya', includes: ['ko'] }, { id: 'ko' }]))
  assert.equal(found.length, 1)
  assert.match(found[0].message, /ko.embedded_in が oya を指していません/)
})

test('embedded_in の片方向を error にする', () => {
  const found = errorsOf(doc([{ id: 'oya' }, { id: 'ko', embedded_in: 'oya' }]))
  assert.match(found[0].message, /oya.includes に ko がありません/)
})

test('包含が両方向に書かれていれば通る', () => {
  assert.deepEqual(validate(doc([{ id: 'oya', includes: ['ko'] }, { id: 'ko', embedded_in: 'oya' }]), TODAY), [])
})

test('parent と embedded_in が同じ計画を指す場合を error にする', () => {
  const d = doc([{ id: 'oya', includes: ['ko'] }, { id: 'ko', embedded_in: 'oya', parent: 'oya' }])
  assert.ok(errorsOf(d).some((f) => /包含は embedded_in に一本化/.test(f.message)))
})

test('conforms_to が市の計画を指す場合を error にする', () => {
  const d = doc([{ id: 'shi', conforms_to: ['hoka'] }, { id: 'hoka' }])
  assert.match(errorsOf(d)[0].message, /conforms_to: hoka は市の計画です/)
})

test('conforms_to が県の計画を指す場合は通る', () => {
  const d = doc([{ id: 'shi', conforms_to: ['ken'] },
                 { id: 'ken', level: 'prefectural', domain: undefined, category: undefined, tier: undefined }])
  assert.deepEqual(validate(d, TODAY), [])
})

test('related の両側記載は warn で、1件だけ報告する', () => {
  const found = validate(doc([{ id: 'a', related: ['b'] }, { id: 'b', related: ['a'] }]), TODAY)
  assert.equal(found.length, 1)
  assert.equal(found[0].severity, 'warn')
  assert.equal(found[0].id, 'a')
})

test('related の片側記載は何も報告しない', () => {
  assert.deepEqual(validate(doc([{ id: 'a', related: ['b'] }, { id: 'b' }]), TODAY), [])
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: 参照切れ系のテストが FAIL（検査が未実装のため報告が0件）

- [ ] **Step 3: 関係の検査を実装する**

`tools/validate.mjs` の `ENUM` の直後に定数を追加:

```js
const ARRAY_REFS = ['includes', 'conforms_to', 'related', 'predecessors']
const SCALAR_REFS = ['parent', 'embedded_in']
```

`validate()` 内、`if (p.category !== undefined) { ... }` のブロックの直後に追加:

```js
    for (const f of SCALAR_REFS) {
      if (p[f] !== undefined && !byId.has(p[f])) add('error', id, `${f}: ${p[f]} という計画がありません`)
    }
    for (const f of ARRAY_REFS) {
      for (const ref of p[f] ?? []) {
        if (!byId.has(ref)) add('error', id, `${f}: ${ref} という計画がありません`)
      }
    }

    for (const child of p.includes ?? []) {
      if (byId.get(child)?.embedded_in !== id) {
        add('error', id, `includes に ${child} があるのに、${child}.embedded_in が ${id} を指していません`)
      }
    }
    if (p.embedded_in && !(byId.get(p.embedded_in)?.includes ?? []).includes(id)) {
      add('error', id, `embedded_in が ${p.embedded_in} を指すのに、${p.embedded_in}.includes に ${id} がありません`)
    }
    if (p.parent !== undefined && p.parent === p.embedded_in) {
      add('error', id, `parent と embedded_in が同じ ${p.parent} を指しています（包含は embedded_in に一本化）`)
    }

    for (const ref of p.conforms_to ?? []) {
      if (byId.get(ref)?.level === 'municipal') {
        add('error', id, `conforms_to: ${ref} は市の計画です（国・県の計画を指します）`)
      }
    }

    // 無向辺なので片側でよい。両側にあるときは id の小さい側から1件だけ報告する
    for (const other of p.related ?? []) {
      if ((byId.get(other)?.related ?? []).includes(id) && id < other) {
        add('warn', id, `related: ${other} と相互に書かれています（無向なので片側でよい）`)
      }
    }
```

- [ ] **Step 4: テストを走らせて通ることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: `# fail 0`

- [ ] **Step 5: コミット**

```bash
git add tools/validate.mjs tools/validate.test.mjs
git commit -m "バリデータに関係の検査を追加（参照切れ・包含の相互性・conforms_to の宛先）"
```

---

## Task 4: バリデータ — 値の突合

**Files:**
- Modify: `tools/validate.mjs`
- Modify: `tools/validate.test.mjs`

**Interfaces:**
- Consumes: `validate()`（Task 3）
- Produces: 同じ `validate()` に、`laws[].obligation` の集約検査・期間の逆転・日付書式・`status` と期間の突合が加わる

**集約規則:** `statutory` は `laws[].obligation` の最も強い値と一致すること（`mandatory` > `effort` > `request` > `voluntary`、設計 3.3）。`laws` が文字列だけの場合は集約検査をしません。

- [ ] **Step 1: 失敗するテストを追記**

`tools/validate.test.mjs` の末尾に追記:

```js
test('laws の最も強い義務と statutory が食い違う場合を error にする', () => {
  const d = doc([{ id: 'a', statutory: 'effort', laws: [
    { law: '子ども・子育て支援法61条1項', obligation: 'mandatory' },
    { law: 'こども基本法10条2項', obligation: 'effort' },
  ] }])
  assert.match(errorsOf(d)[0].message, /最も強い義務（mandatory）と一致しません/)
})

test('集約規則どおりなら通る', () => {
  const d = doc([{ id: 'a', statutory: 'mandatory', laws: [
    { law: '子ども・子育て支援法61条1項', obligation: 'mandatory' },
    { law: 'こども基本法10条2項', obligation: 'effort' },
  ] }])
  assert.deepEqual(validate(d, TODAY), [])
})

test('laws が文字列だけなら集約検査をしない', () => {
  const d = doc([{ id: 'a', statutory: 'effort', laws: ['介護保険法117条'] }])
  assert.deepEqual(validate(d, TODAY), [])
})

test('obligation の未定義値を error にする', () => {
  const d = doc([{ id: 'a', laws: [{ law: 'X', obligation: 'must' }] }])
  assert.match(errorsOf(d)[0].message, /obligation: must/)
})

test('期間の逆転を error にする', () => {
  assert.match(errorsOf(doc([{ id: 'a', period: { start: 2029, end: 2024 } }]))[0].message, /より後です/)
})

test('日付の書式違反を error にする', () => {
  assert.match(errorsOf(doc([{ id: 'a', adopted: '2024/03' }]))[0].message, /YYYY-MM ではありません/)
  const d = doc([{ id: 'a', successor: { public_comment: { start: '2026-13', end: '2027-01' } } }])
  assert.match(errorsOf(d)[0].message, /public_comment.start: 2026-13/)
})

test('status と期間の矛盾を error にする', () => {
  const past = doc([{ id: 'a', status: 'current', period: { start: 2018, end: 2020 } }])
  assert.match(errorsOf(past)[0].message, /2020年度末を過ぎています/)
  const future = doc([{ id: 'a', status: 'expired', period: { start: 2024, end: 2029 } }])
  assert.match(errorsOf(future)[0].message, /まだ到来していません/)
})

test('年度末は翌年3月31日として扱う', () => {
  // 2026年度末 = 2027-03-31。基準日 2026-08-12 では未到来
  assert.deepEqual(validate(doc([{ id: 'a', status: 'expiring', period: { start: 2024, end: 2026 } }]), TODAY), [])
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: 全25件のうち **20 pass / 5 fail**。追記8件のうち FAIL するのは5件です。

残る3件（`集約規則どおりなら通る`・`laws が文字列だけなら集約検査をしない`・`年度末は翌年3月31日として扱う`）は
**「何も報告されないこと」を確かめるテスト**なので、検査が未実装の状態でも通ります。
実装後に初めて検査として効きます（誤った集約規則を書けば落ちる）。**これは異常ではありません。**

- [ ] **Step 3: 値の突合を実装する**

`tools/validate.mjs` の `SCALAR_REFS` の直後に定数を追加:

```js
const RANK = { mandatory: 4, effort: 3, request: 2, voluntary: 1 }
const YYYY_MM = /^\d{4}-(0[1-9]|1[0-2])$/
/** 日本の年度末 = 翌年3月31日 */
const fyEnd = (y) => new Date(`${y + 1}-03-31`)
```

`validate()` 内、`related` の検査の直後に追加:

```js
    const obligations = (p.laws ?? []).filter((l) => l && typeof l === 'object' && l.obligation)
    for (const l of obligations) {
      if (!(l.obligation in RANK)) add('error', id, `laws の obligation: ${l.obligation} は未定義の値です`)
    }
    if (obligations.length && p.statutory !== undefined) {
      const strongest = obligations.reduce((a, l) => (RANK[l.obligation] > RANK[a] ? l.obligation : a), 'voluntary')
      if (strongest !== p.statutory) {
        add('error', id, `statutory: ${p.statutory} は laws の最も強い義務（${strongest}）と一致しません`)
      }
    }

    const { start, end } = p.period ?? {}
    if (typeof start === 'number' && typeof end === 'number' && start > end) {
      add('error', id, `period の start（${start}）が end（${end}）より後です`)
    }
    if (p.adopted !== undefined && !YYYY_MM.test(String(p.adopted))) {
      add('error', id, `adopted: ${p.adopted} は YYYY-MM ではありません`)
    }
    for (const key of ['start', 'end']) {
      const v = p.successor?.public_comment?.[key]
      if (v !== undefined && !YYYY_MM.test(String(v))) {
        add('error', id, `successor.public_comment.${key}: ${v} は YYYY-MM ではありません`)
      }
    }
    if (typeof end === 'number') {
      const over = fyEnd(end) < today
      if (p.status === 'expired' && !over) {
        add('error', id, `status: expired ですが、${end}年度末はまだ到来していません`)
      }
      if ((p.status === 'current' || p.status === 'expiring') && over) {
        add('error', id, `status: ${p.status} ですが、${end}年度末を過ぎています`)
      }
    }
```

- [ ] **Step 4: テストを走らせて通ることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: `# fail 0`

- [ ] **Step 5: コミット**

```bash
git add tools/validate.mjs tools/validate.test.mjs
git commit -m "バリデータに値の突合を追加（法定性の集約・期間・日付・status の整合）"
```

---

## Task 5: バリデータ — 骨格の検査とCLI

**Files:**
- Modify: `tools/validate.mjs`
- Modify: `tools/validate.test.mjs`

**Interfaces:**
- Consumes: `validate()`（Task 4）、`parseYaml`（Task 1）
- Produces: `node tools/validate.mjs [--json] [--fail-on-error] [--today YYYY-MM-DD]` として実行できる

**条件付き必須（設計 7.3）:**

| フィールド | 必須となる条件 |
|---|---|
| `name` `level` `status` | 常に |
| `domain` `category` `tier` | `level` が `municipal` / `council` |
| `period` | 上記に同じ。`status` が `planned` / `unknown` は免除 |
| `url` | 上記に同じ。`embedded_in` があるもの、`pdf` か `sources` があるものは免除 |

欠落していて `todo:` があれば **warn**、なければ **error**。

**CLI は main 実行時のみ動かすこと。** そうしないとテストからの import で `data/plans.yml` を読みに行きます。

- [ ] **Step 1: 失敗するテストを追記**

`tools/validate.test.mjs` の末尾に追記:

```js
test('骨格の欠落は todo が無ければ error', () => {
  const d = { domains: {}, categories: {}, plans: [{ id: 'a', level: 'municipal', status: 'current' }] }
  const found = validate(d, TODAY).filter((f) => f.severity === 'error').map((f) => f.message)
  assert.ok(found.some((m) => m.startsWith('name がありません')))
  assert.ok(found.some((m) => m.startsWith('domain がありません')))
  assert.ok(found.some((m) => m.startsWith('tier がありません')))
  assert.ok(found.some((m) => m.startsWith('period がありません')))
  assert.ok(found.some((m) => m.startsWith('url がありません')))
})

test('骨格の欠落は todo があれば warn', () => {
  const d = { domains: {}, categories: {}, plans: [{ id: 'a', level: 'municipal', status: 'current', todo: '期間を確認する' }] }
  assert.equal(validate(d, TODAY).every((f) => f.severity === 'warn'), true)
})

test('県・国の計画には domain / category / tier を求めない', () => {
  const d = { domains: {}, categories: {}, plans: [{ id: 'ken', name: '県計画', level: 'prefectural', status: 'current' }] }
  assert.deepEqual(validate(d, TODAY), [])
})

test('status が planned / unknown なら period を求めない', () => {
  const base = { id: 'a', level: 'municipal', domain: 'fukushi', category: 'kourei', tier: 'kobetsu',
                 name: '計画', url: 'https://example.jp/a' }
  const d = doc([])
  d.plans = [{ ...base, status: 'planned' }]
  assert.deepEqual(validate(d, TODAY), [])
})

test('embedded_in があれば url を求めない', () => {
  const d = doc([{ id: 'oya', includes: ['ko'] },
                 { id: 'ko', embedded_in: 'oya', url: undefined }])
  assert.deepEqual(validate(d, TODAY), [])
})

test('pdf か sources があれば url を求めない', () => {
  // kourei-7 / kourei-8 の型。計画ページ側の単独PDFが削除され、議案書PDFが唯一の出典
  const d = doc([{ id: 'a', status: 'expired', period: { start: 2018, end: 2020 },
                   url: undefined, sources: [{ label: '議案書', url: 'https://example.jp/g.pdf' }] }])
  assert.deepEqual(validate(d, TODAY), [])
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: 追記した6件のうち骨格系が FAIL

- [ ] **Step 3: 骨格の検査を実装する**

`tools/validate.mjs` の `validate()` 内、`status` と期間の突合の直後（`for (const p of plans)` ループの末尾）に追加:

```js
    const required = ['name', 'level', 'status']
    if (p.level === 'municipal' || p.level === 'council') {
      required.push('domain', 'category', 'tier')
      if (p.status !== 'planned' && p.status !== 'unknown') required.push('period')
      if (!p.embedded_in && !p.pdf && !p.sources) required.push('url')
    }
    for (const f of required) {
      if (p[f] === undefined) {
        add(p.todo ? 'warn' : 'error', id, `${f} がありません${p.todo ? '（todo あり）' : ''}`)
      }
    }
```

- [ ] **Step 4: テストを走らせて通ることを確認**

```bash
node --test tools/validate.test.mjs
```

期待: `# fail 0`

- [ ] **Step 5: CLI を追加する**

`tools/validate.mjs` の冒頭コメントの直後に import を追加します（Task 2〜4 の時点では
`validate()` が純粋関数のみだったため import が無い状態です）:

```js
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'
```

ファイル末尾（`validate()` の後）に追加:

```js
// --- CLI --------------------------------------------------------------------
// テストから import されたときに走らないよう、直接実行のときだけ動かす
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
  const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
  const findings = validate(doc, new Date(getArg('--today', new Date().toISOString().slice(0, 10))))
  const errors = findings.filter((f) => f.severity === 'error')
  const warns = findings.filter((f) => f.severity === 'warn')

  if (args.includes('--json')) {
    console.log(JSON.stringify({ plans: doc.plans?.length ?? 0, errors: errors.length, warns: warns.length, findings }, null, 2))
  } else {
    console.log(`計画 ${doc.plans?.length ?? 0} 件を検査しました\n`)
    console.log(`## error（${errors.length}件）`)
    for (const f of errors) console.log(`- ${f.id}: ${f.message}`)
    console.log(`\n## warn（${warns.length}件）`)
    for (const f of warns) console.log(`- ${f.id}: ${f.message}`)
  }

  if (args.includes('--fail-on-error') && errors.length > 0) process.exit(1)
}
```

- [ ] **Step 6: CLI を実データで走らせる**

```bash
node tools/validate.mjs --today 2026-08-12
```

期待: **error 34件・warn 15件**。移行前なので落ちて正しい。内訳は次のとおり。

- `domain` と `tier` の欠落（移行対象。Task 7 で解消）
- `seinen-kouken` と `saihan-boushi` の `parent` / `embedded_in` 重複（Task 7 で解消）
- warn 15件は `todo:` 付きの未調査エントリ（`danjo-3`・`keikan`・`kokyoshisetsu-*`・`kodomo-dokusho-2`・`influenza`・`csw-katsudou-2`）

```bash
node --test tools/validate.test.mjs && echo "テストは緑"
```

- [ ] **Step 7: import しても CLI が走らないことを確認**

```bash
node -e "import('./tools/validate.mjs').then(m => console.log('exportされた関数:', typeof m.validate))"
```

期待: `exportされた関数: function` だけが出力され、検査結果は表示されない

- [ ] **Step 8: コミット**

```bash
git add tools/validate.mjs tools/validate.test.mjs
git commit -m "バリデータに骨格の検査とCLIを追加

todo なしの欠落は error、todo つきは warn。level に応じた条件付き必須と、
embedded_in・pdf・sources による url の免除を実装。"
```

---

# Phase B — スキーマとデータの移行

## Task 6: スキーマ定義の改訂

**Files:**
- Modify: `data/schema.md`

**Interfaces:**
- Consumes: 設計 3章・4章・6.1
- Produces: 投入担当者が参照する唯一のスキーマ定義。以降のタスクはこれに従う

- [ ] **Step 1: フィールド表に新フィールドを追加**

`data/schema.md` の `plans[] の各フィールド` の表に、`category` の行の直後へ追加:

```markdown
| `domain` | ○ | string | `domains` のキー。大分類（[下記](#domain-と-category)） |
```

`laws` の行を差し替え:

```markdown
| `laws` | | string[] \| object[] | 根拠法。条項まで書く。`{ law, obligation }` で義務の別も持てる（[下記](#laws-と-statutory)） |
```

`department` の行の直後へ追加:

```markdown
| `statutory` | | enum | 法定性。`mandatory` / `effort` / `request` / `voluntary`（[下記](#laws-と-statutory)） |
| `tier` | ○ | enum | 計画の階層。`sougou` / `bumon` / `kobetsu` / `jisshi` / `shisetsu`（[下記](#tier)） |
| `agency` | | enum | 実施機関。省略時は `mayor`（[下記](#agency)） |
```

`related` の行の直前へ追加:

```markdown
| `conforms_to` | | id[] | 法令上、整合・調和が求められる国・県計画のID |
```

`related` の行を差し替え:

```markdown
| `related` | | id[] | 連携する計画のID。**無向**なので片側にだけ書く |
```

- [ ] **Step 2: 各フィールドの節を追記**

`### department` の節の直前に、設計 3.1〜3.5・4.4 の内容を写した節を追加します。
**設計そのものを参照させず、スキーマ側に自己完結して書くこと**（投入担当者が2つの文書を往復しないで済むように）。

````markdown
### domain と category

分野は2階層です。`domain` が大分類（配色の単位）、`category` が小分類。

```yaml
domains:
  fukushi: { label: 健康・福祉, slot: 1 }

categories:
  kourei: { label: 高齢者・介護, domain: fukushi }
```

`slot`（配色の割り当て番号）は `domains` が持ちます。`categories` には持たせません。
小分類は20前後になる見込みで、識別可能な色を割り当てられないためです。

計画の `domain` は、その `category` が属する `domain` と一致させます。食い違うと `validate` が error にします。

### laws と statutory

`statutory` は「市がこの計画を省略できるか」を表します。

| 値 | 意味 | 条文の型 |
|---|---|---|
| `mandatory` | 法定義務 | 「定めるものとする」「策定しなければならない」 |
| `effort` | 努力義務 | 「定めるよう努めるものとする」 |
| `request` | 国の要請・通知 | 法律ではなく通知・指針で策定を求められる |
| `voluntary` | 任意 | 法令上の根拠なし |

**判定は条文の文言を確認してから書きます。** 確認前は書かず、`todo:` に残します。

一体策定された計画は、根拠法ごとに義務の強さが違うことがあります。その場合は
`laws` に義務の別を持たせ、`statutory` には**最も強い義務**を書きます
（`mandatory` > `effort` > `request` > `voluntary`）。

```yaml
laws:
  - { law: 子ども・子育て支援法61条1項, obligation: mandatory }
  - { law: こども基本法10条2項, obligation: effort }
statutory: mandatory
```

`laws` は文字列のままでも書けます（`- 介護保険法117条`）。その場合 `obligation` は未判定として扱い、
集約の検査対象外になります。

### tier

体系図の縦軸です。

| 値 | 意味 | 例 |
|---|---|---|
| `sougou` | 市全体を対象とする総合的な計画 | 総合計画、過疎地域持続的発展計画 |
| `bumon` | 部門別の基本計画 | 地域福祉計画、障がい者計画、健康いき21 |
| `kobetsu` | 個別計画（法定の事業計画） | 介護保険事業計画、障がい福祉計画 |
| `jisshi` | 実施計画・行動計画 | 新型インフルエンザ等対策行動計画、国民保護計画 |
| `shisetsu` | 施設・財産の管理計画 | 公共施設等総合管理計画、個別施設計画 |

### agency

`level: municipal` の計画にのみ付けます。社会福祉協議会は `level: council` で区別します。

| 値 | 意味 | 組織の根拠 |
|---|---|---|
| `mayor` | 市長部局（**省略時の既定**） | 行政組織規則 |
| `education` | 教育委員会 | 教育委員会事務局組織規則 |
| `fire` | 消防本部 | 消防本部の組織規程 |
| `agri` | 農業委員会 | 農業委員会の組織規程 |
| `assembly` | 議会 | 議会事務局の組織規程 |
| `election` | 選挙管理委員会 | 選挙管理委員会事務局の組織規程 |
| `audit` | 監査委員 | 監査委員事務局の組織規程 |

**省略は常に「市長部局である」という主張です。**「実施機関が未確定」の意味では使いません。
市長部局以外が見つかったら、必ずこの表に値を追加してから使います。

### 関係のフィールド

| フィールド | 向き | 意味 |
|---|---|---|
| `parent` | 下→上 | 位置づけ上の上位計画。原則 `sougou-4`。**包含には使わない** |
| `includes` | 親→子 | 一体策定により包含している法定計画 |
| `embedded_in` | 子→親 | `includes` の逆。**両方に書く** |
| `conforms_to` | 市→県・国 | 法令上、整合・調和が求められる計画 |
| `related` | 無向 | 上記以外の連携。**片側にだけ書く** |
| `predecessors` | 現→過去 | 前期計画（新しい順） |
| `successor` | 現→次期 | 次期計画（オブジェクト。idではない） |

`related` を無向と決めているのは、片側記載が相互関係か一方向参照かを機械的に区別できなくなるのを
避けるためです。向きのある関係は `parent` / `includes` / `conforms_to` が担当します。

### 未調査の表し方

| 表すもの | 書き方 |
|---|---|
| フィールドが未調査 | **そのフィールドを書かない（欠落）＋ `todo:` に内容を書く** |
| 計画全体が未調査 | `status: unknown`（`todo:` も併記） |

**空文字や `null` で未調査を表しません。** `null` は「調査した結果、値が存在しない」の意味です
（随時修正の計画の `period: { start: null, end: null }` など）。

`agency` だけは既定値を持つため、欠落が未調査を表せません（欠落＝`mayor`）。
````

- [ ] **Step 3: categories の節を書き換える**

既存の `## categories` の節を差し替え:

````markdown
## domains と categories

```yaml
domains:
  fukushi: { label: 健康・福祉, slot: 1 }

categories:
  fukushi: { label: 地域福祉（総論・横断）, domain: fukushi }
```

`slot` は色の割り当て番号です。データ可視化の配色は、色覚特性を考慮して検証した並び順に依存するため、
**slot の番号は勝手に入れ替えないでください**。分野を増やす場合は、既存の slot を動かさずに末尾へ足すか、
配色の再検証を行ってください。

`slot` は `domains` にだけ持たせます。`categories` は20前後になる見込みで、
識別可能な色を割り当てられないためです。
````

- [ ] **Step 4: バリデーションの節を更新**

既存の `## バリデーション` の節を差し替え:

````markdown
## バリデーション

追加・変更したら次を流してください。

```bash
node tools/validate.mjs --fail-on-error   # 参照整合・enum・骨格の検査
node tools/linkcheck.mjs                  # URLが生きているか
node tools/expiring.mjs                   # 期間の入力ミスで変な年度が出ていないか
node --test                               # ツール自身の単体テスト（リポジトリ直下で実行）
```

`validate.mjs` は次の2段階で報告します。

- **error** … 整合性の破れ、または骨格の必須項目が `todo:` なしで欠落。`--fail-on-error` で exit 1
- **warn** … 必須項目が欠落しているが `todo:` がある（明示的な猶予）、または冗長な記述
````

- [ ] **Step 5: 文書内リンクの確認**

```bash
grep -n "domain-と-category\|laws-と-statutory\|#tier\|#agency" data/schema.md
```

期待: フィールド表のアンカーリンクが、追加した節の見出しと対応している

- [ ] **Step 6: コミット**

```bash
git add data/schema.md
git commit -m "スキーマに domain・statutory・tier・agency・conforms_to を追加

分野を2階層にし、slot を domains へ移す。laws は根拠法ごとに obligation を
持てる形に拡張し、statutory はその集約値と定義。未調査の表し方を統一。"
```

---

## Task 7: 既存31件の移行

**Files:**
- Modify: `data/plans.yml`

**Interfaces:**
- Consumes: `data/schema.md`（Task 6）、`tools/validate.mjs`（Task 5）
- Produces: `validate` の error が 0 になった `plans.yml`。以降の投入はこの状態を壊さずに進める

**このタスクの完了は `node tools/validate.mjs --fail-on-error` が exit 0 を返すこと。**

暫定の `domains` を使います（設計 3.2、Task 22 で確定させる）。

- [ ] **Step 1: 移行前の状態を記録**

```bash
node tools/validate.mjs --today 2026-08-12 | head -3
```

期待: `## error（34件）`。これが 0 になれば完了

- [ ] **Step 2: `domains` を追加し、`categories` に `domain` を付ける**

`data/plans.yml` の末尾の `categories:` ブロックを差し替え:

```yaml
# ---------------------------------------------------------------------------
# 分野の定義（図表の色分けとグルーピングに使う）
#
# domain = 大分類（配色の単位）。category = 小分類。
# 顔ぶれは骨格収集の完了時に確定させる（設計 3.2）。現時点は暫定。
# ---------------------------------------------------------------------------
domains:
  fukushi:    { label: 健康・福祉, slot: 1 }
  sougou:     { label: 市政総論, slot: 2 }
  kyouiku:    { label: 教育・文化, slot: 3 }
  sangyou:    { label: 産業・雇用, slot: 4 }
  kurashi:    { label: 生活環境, slot: 5 }
  bousai:     { label: 防災・安全, slot: 6 }
  kiban:      { label: 都市基盤・交通, slot: 7 }
  gyouzaisei: { label: 行財政運営, slot: 8 }

categories:
  fukushi: { label: 地域福祉（総論・横断）, domain: fukushi }
  shougai: { label: 障がい福祉, domain: fukushi }
  kourei:  { label: 高齢者・介護, domain: fukushi }
  kodomo:  { label: こども・子育て, domain: fukushi }
  iryou:   { label: 医療保険・保健事業, domain: fukushi }
  kenkou:  { label: 健康づくり・自殺対策, domain: fukushi }
  jyoui:   { label: 上位・関連行政計画, domain: sougou }
  other:   { label: その他（未整理）, domain: gyouzaisei }
```

- [ ] **Step 3: 各計画に `domain` と `tier` を付ける**

`level: municipal` と `level: council` の全件が対象です。`category` から `domain` が決まります。
`tier` は次のとおり（設計 3.4 の定義に照らして判断済み）。

| id | domain | tier | 判断の根拠 |
|---|---|---|---|
| `sougou-4` | `sougou` | `sougou` | 市の最上位計画 |
| `chiiki-fukushi-3` | `fukushi` | `bumon` | 福祉分野の分野横断的な上位計画 |
| `seinen-kouken` | `fukushi` | `kobetsu` | 地域福祉計画に包含された法定計画 |
| `saihan-boushi` | `fukushi` | `kobetsu` | 同上 |
| `shougai-keikaku-3` | `fukushi` | `bumon` | 障がい分野の基本計画（障害者基本法11条3項） |
| `shougai-fukushi-7` | `fukushi` | `kobetsu` | 数値目標を持つ法定の事業計画 |
| `kourei-9` | `fukushi` | `kobetsu` | 同上 |
| `kourei-8` | `fukushi` | `kobetsu` | 同上 |
| `kourei-7` | `fukushi` | `kobetsu` | 同上 |
| `kodomo-1` | `fukushi` | `bumon` | こども分野を包括する基本計画 |
| `data-health-3` | `fukushi` | `kobetsu` | 保健事業の実施計画 |
| `kenkou-iki21` | `fukushi` | `bumon` | 健康づくりの基本計画 |
| `jisatsu-2` | `fukushi` | `bumon` | 自殺対策の基本計画 |
| `kaso-r8` | `sougou` | `sougou` | 市全体を対象とする総合的な計画 |
| `koutsuu` | `kiban` | `bumon` | 公共交通分野の基本計画 |
| `bousai` | `bousai` | `jisshi` | 災害時の行動を定める |
| `danjo-3` | `sougou` | `bumon` | 男女共同参画の基本計画 |
| `keikan` | `kurashi` | `bumon` | 景観法に基づく分野の計画 |
| `kokyoshisetsu-sougou` | `gyouzaisei` | `shisetsu` | 施設・財産の管理計画 |
| `kokyoshisetsu-kobetsu` | `gyouzaisei` | `shisetsu` | 同上 |
| `kodomo-dokusho-2` | `kyouiku` | `bumon` | 教育分野の推進計画 |
| `influenza` | `fukushi` | `jisshi` | 行動計画 |
| `csw-katsudou-2` | `fukushi` | `bumon` | 社協の地域福祉活動計画 |

**`category` の変更が必要なもの**（現在の `category` が新しい `domain` と矛盾するため）:

- `koutsuu`: `jyoui` → 新しい小分類 `koutsuu` を作り `domain: kiban` に置く
- `bousai`: `jyoui` → 新しい小分類 `bousai` を作り `domain: bousai` に置く
- `danjo-3`: `jyoui` のまま（`domain: sougou`）
- `keikan`: `other` → 新しい小分類 `keikan` を作り `domain: kurashi` に置く
- `kokyoshisetsu-sougou` / `kokyoshisetsu-kobetsu`: `other` のまま（`domain: gyouzaisei`）
- `kodomo-dokusho-2`: `kodomo` → 新しい小分類 `dokusho` を作り `domain: kyouiku` に置く

`categories:` に追記:

```yaml
  koutsuu: { label: 公共交通, domain: kiban }
  bousai:  { label: 防災・危機管理, domain: bousai }
  keikan:  { label: 景観・都市計画, domain: kurashi }
  dokusho: { label: 読書・生涯学習, domain: kyouiku }
```

`kodomo-dokusho-2` には `agency: education` も付けます（教育委員会の所管）。

各計画への書き方（`kourei-9` の例。`category` の直後に `domain`、`status` の直前に `tier`）:

```yaml
  - id: kourei-9
    name: 壱岐市高齢者福祉計画・第9期介護保険事業計画
    short: 高齢者福祉・介護保険事業計画
    level: municipal
    domain: fukushi
    category: kourei
    tier: kobetsu
    status: expiring
```

- [ ] **Step 4: `parent` の重複を解消する**

`seinen-kouken` と `saihan-boushi` から `parent: chiiki-fukushi-3` の行を削除します。
`embedded_in: chiiki-fukushi-3` は残します（包含は `embedded_in` に一本化）。

- [ ] **Step 5: `meta.updated` を更新**

```yaml
meta:
  updated: 2026-08-12
```

- [ ] **Step 6: 検証**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "exit code = $?"
```

期待: `## error（0件）` と `exit code = 0`。**warn は1件（`danjo-3` の `url` 欠落）だけ残ります。**

移行前の warn 15件は、`todo:` 付きの7件が `domain` と `tier` を欠いていたことによるものでした。
Step 3 の対応表は**この7件を含む `municipal` / `council` の全23件**に `domain` と `tier` を割り当てるため、
6件は他の必須項目が揃っていて warn が解消します。`todo:` は消さないので、
`tools/expiring.mjs` の「未調査の項目」には7件とも残ります。

```bash
node tools/expiring.mjs --today 2026-08-12
node --test
```

期待: `expiring.mjs` はこれまでと同じ出力（`domain`/`tier` の追加は無関係）。テストは緑

- [ ] **Step 7: コミット**

```bash
git add data/plans.yml
git commit -m "既存31件を新スキーマへ移行

domains を新設し、slot を categories から移動。全件に domain と tier を付与。
seinen-kouken・saihan-boushi の parent を削除し、包含は embedded_in に一本化。
validate の error が 0 になった。"
```

---

## Task 8: 県計画への `conforms_to` を張る

**Files:**
- Modify: `data/plans.yml`

**Interfaces:**
- Consumes: Task 7 の状態
- Produces: 市計画から県計画への参照。設計 1章で挙げた「関係がデータに載っていない」の解消

**条文を確認してから書くこと。** `conforms_to` は**法令上、整合・調和が求められるもの**に限ります
（設計 4.2）。参考程度の関係は `related` です。

- [ ] **Step 1: 根拠となる条文を確認する**

次の対応について、e-Gov 法令検索で条文を確認し、「整合」「調和」を求める規定があるかを確かめます。

| 市計画 | 県計画 | 確認する条文 |
|---|---|---|
| `chiiki-fukushi-3` | `pref-fukushi-hoken-6` | 社会福祉法107条（市町村地域福祉計画）・108条（都道府県地域福祉支援計画） |
| `kourei-9` | `pref-chouju-9` | 介護保険法117条（市町村介護保険事業計画と都道府県計画の関係） |
| `shougai-fukushi-7` | `pref-shougai-fukushi-7` | 障害者総合支援法88条（市町村障害福祉計画） |
| `shougai-keikaku-3` | `pref-shougai-kihon-5` | 障害者基本法11条3項（市町村障害者計画） |
| `kodomo-1` | `pref-kosodate-jourei` | こども基本法10条2項 |
| `kenkou-iki21` | `pref-kenkou-21-3` | 健康増進法8条2項 |
| `jisatsu-2` | `pref-jisatsu-4` | 自殺対策基本法13条2項 |
| `saihan-boushi` | `pref-saihan-2` | 再犯防止推進法8条1項 |

**「整合を保つ」旨の規定が見つからないものには `conforms_to` を書かず、`related` に入れます。**
条文にない関係を法令上の要請として書くと、資料の信頼性を損ないます。

- [ ] **Step 2: 確認できたものに `conforms_to` を書く**

書き方（`kourei-9` の例。`predecessors` の直前に置く）:

```yaml
    conforms_to: [pref-chouju-9]
```

条文の根拠は `notes:` に1文で残します。例:

```yaml
    notes: >-
      （既存の記述）
      介護保険法117条により、都道府県介護保険事業支援計画との整合を求められる。
```

- [ ] **Step 3: 条文の根拠が無かったものを `related` に入れる**

```yaml
    related: [pref-kenkou-21-3]
```

- [ ] **Step 4: 検証**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "exit code = $?"
```

期待: exit 0。`conforms_to` が市の計画を指していれば error になるので、宛先の取り違えはここで落ちる

- [ ] **Step 5: コミット**

```bash
git add data/plans.yml
git commit -m "市計画から県計画への conforms_to を追加

法令上、整合・調和が求められるものに限る。条文に規定が無いものは related に入れた。"
```

---

## Task 9: 義務が混在する計画の `laws` を対応表にする

**Files:**
- Modify: `data/plans.yml`

**Interfaces:**
- Consumes: Task 8 の状態
- Produces: `laws[].obligation` と `statutory` の集約検査が効く状態

**対象は義務の強さが混在する計画だけです。** 全件を書き換える必要はありません（設計 3.3）。

- [ ] **Step 1: 一体策定された計画の根拠法を洗い出す**

次が候補です。条文を確認して `obligation` を決めます。

| id | 一体化されている計画 | 確認する条文 |
|---|---|---|
| `kodomo-1` | こども計画／子ども・子育て支援事業計画／次世代育成支援行動計画／こどもの貧困対策計画／子ども・若者計画 | こども基本法10条2項、子ども・子育て支援法61条1項、次世代育成支援対策推進法8条1項、子どもの貧困対策推進法9条1項、子ども・若者育成支援推進法9条2項 |
| `kenkou-iki21` | 健康増進計画／歯科口腔保健推進計画／食育推進計画 | 健康増進法8条2項、食育基本法18条1項、歯科口腔保健法（市町村計画の規定の有無） |
| `chiiki-fukushi-3` | 地域福祉計画／成年後見制度利用促進基本計画／再犯防止推進計画 | 社会福祉法107条1項、成年後見制度利用促進法14条1項、再犯防止推進法8条1項 |
| `kourei-9` | 高齢者福祉計画／介護保険事業計画 | 老人福祉法20条の8第1項、介護保険法117条1項 |
| `data-health-3` | データヘルス計画／特定健康診査等実施計画 | 国民健康保険法82条、高齢者医療確保法19条1項 |

- [ ] **Step 2: 混在するものだけ対応表に書き換える**

`kodomo-1` の例（子ども・子育て支援法は「定めるものとする」＝ `mandatory`、こども基本法は「努めるものとする」＝ `effort`）:

```yaml
    laws:
      - { law: 子ども・子育て支援法61条1項, obligation: mandatory }
      - { law: こども基本法10条2項, obligation: effort }
      - { law: 次世代育成支援対策推進法8条1項, obligation: effort }
    statutory: mandatory
```

**義務の強さが揃っている計画は、文字列のまま `statutory` だけ足します。**

```yaml
    laws: [老人福祉法20条の8, 介護保険法117条]
    statutory: mandatory
```

- [ ] **Step 3: 検証**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "exit code = $?"
```

期待: exit 0。集約規則に反する `statutory` を書いていればここで落ちる

わざと壊して検査が効くことを確かめます。

```bash
# kodomo-1 の statutory を effort に書き換えてから
node tools/validate.mjs --today 2026-08-12 | grep kodomo-1
```

期待: `statutory: effort は laws の最も強い義務（mandatory）と一致しません`。確認したら元に戻す

- [ ] **Step 4: コミット**

```bash
git add data/plans.yml
git commit -m "一体策定された計画の laws を根拠法と obligation の対応表にする

こども計画は子ども・子育て支援法61条1項が mandatory、こども基本法10条2項が
effort で混在する。statutory は最も強い義務を採る集約値。"
```

---

# Phase C — 洗い出しと投入

## Task 10: 巡回の手順と台帳を作る

**Files:**
- Modify: `sources/POLICY.md`

**Interfaces:**
- Consumes: 設計 5章
- Produces: 巡回台帳。以降の Task 11〜18 は、巡回のたびにこの台帳へ1行足す

**台帳が完了条件そのものです**（設計 10章の1）。「記録がないこと」と「確認して無かったこと」を区別できる形にします。

- [ ] **Step 1: 「計画を洗い出す手順」の節を追加**

`sources/POLICY.md` の `## 3. 記録すること` の直前に追加:

````markdown
## 2.5 計画を洗い出す手順

市サイトの `/shisei/machidukuri/keikaku/` は**計画の総覧ではありません。**
2026-08-12 時点で5節と数記事しかなく、実体は各課のページ（`/soshiki/...`）に散在しています。

### 起点は1つではない

[行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html)
第1条は、対象を「市長及び会計管理者の権限に属する事務並びに市長が設置する行政機関の事務を処理するために
必要な組織」と限定しています。**この規則だけを起点にすると市長部局しか巡回できません。**

| 対象機関 | 起点となる規程 |
|---|---|
| 市長部局 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条。総務部・地域振興部・市民部・保健環境部・農林水産部・産業推進部・建設部（**上下水道課は建設部**） |
| 教育委員会 | [教育委員会事務局組織規則](https://www.city.iki.nagasaki.jp/reiki/reiki_honbun/r014RG00000190.html) |
| 消防・農業委員会・議会・選挙管理委員会・監査委員 | 各事務局の組織規程 |

**病院事業は対象外です。** 壱岐市民病院は2015年に長崎県病院企業団へ移管され、
現在の長崎県壱岐病院は市の組織ではありません。

### 組織一覧ページを起点にしない

市の[組織一覧](https://www.city.iki.nagasaki.jp/soshiki/index.html)は規程と表記が食い違います。
2026-08-12 時点で、一覧は「水道課」、規程は「上下水道課」でした。
**組織一覧は巡回先を見つける補助として使い、正式名称と分掌は規程で確定させます。**

### 交差検証で漏れを検出する

| 情報源 | 拾えるもの | 落ちるもの |
|---|---|---|
| パブリックコメント実施状況の一覧 | 策定・改定の時期、正式表記 | パブコメを経ない計画 |
| 第4次総合計画の関連計画一覧・体系図 | 市自身が認識している体系 | 総合計画の策定後にできた計画 |
| 例規集の附属機関設置条例（○○審議会） | 消えない根拠 | 審議会を置かない計画 |
````

- [ ] **Step 2: 巡回台帳の枠を追加**

上の節の末尾に追加:

```markdown
### 巡回の記録

**計画を持たない組織も「なし」と記録します。** 記録がないことと、確認して無かったことは違います。

| 機関 | 組織 | 巡回日 | 見つかった計画 |
|---|---|---|---|
| | | | |
```

- [ ] **Step 3: コミット**

```bash
git add sources/POLICY.md
git commit -m "計画を洗い出す手順と巡回台帳を追加

行政組織規則は市長部局のみが対象のため、教育委員会・消防・行政委員会・議会は
別の規程を起点にする。組織一覧ページは規程と表記が食い違うため補助に留める。"
```

---

## 巡回手順（Task 11〜19 で共通）

Task 11〜19 は、対象の組織が違うだけで**同じ6ステップ**を踏みます。手順をここに1回だけ書き、
各タスクは「対象組織」「起点となる規程」「想定される計画」「コミットメッセージ」だけを持ちます。

**組織の境界でタスクを切るのは、1つ終わるたびに `validate` が緑の状態でコミットでき、
レビューできるためです。**

### 手順 A: 組織を巡回して計画を投入する

**Files:**
- Modify: `data/plans.yml`
- Modify: `sources/POLICY.md`（巡回台帳）

**Interfaces:**
- Consumes: `data/schema.md`（Task 6）、巡回台帳（Task 10）、`tools/validate.mjs`（Task 5）
- Produces: 対象組織が所管する計画のエントリ。`validate` の error は 0 のまま

**Step 1: 組織の正式名称と分掌事務を規程で確認する**

各タスクが指定する組織規程を開き、課・班と分掌事務を確認します。`department` はここから取ります。
**掲載ページの「このページに関するお問い合わせ」を根拠にしないでください**（`sources/POLICY.md`）。

**Step 2: 各課のページを見て計画を拾う**

`https://www.city.iki.nagasaki.jp/soshiki/<課>/` を開き、掲載記事から計画にあたるものを拾います。

- **拾うもの:** 法定・任意を問わない行政計画。名称が「ビジョン」「戦略」「方針」「プラン」でも、
  計画として機能するものを含める
- **拾わないもの:** 年度単位の事業計画、予算、個別事業の実施要綱、市以外の団体が策定する計画

**Step 3: エントリを書く**

第1段階の骨格（設計 6.2）だけを入れます。`statutory`・`laws`・`department` は条文と規程の確認が
要るため、ここでは `todo:` に回して構いません。

```yaml
  - id: <英小文字・数字・ハイフン>
    name: <正式名称>
    level: municipal
    agency: <mayor 以外のときだけ書く>
    domain: <domains のキー>
    category: <categories のキー>
    tier: <sougou / bumon / kobetsu / jisshi / shisetsu>
    status: <current / expiring / expired / planned / unknown>
    period: { start: <年度>, end: <年度> }
    department: <部 課 班>
    url: <掲載ページ>
    todo: 根拠法と法定性を条文で確認する
```

判断に迷ったときの規則は次のとおりです。

- **`period` が掲載ページから分からない** → `period` を書かず、`todo:` に「計画期間を確認する」を足す
  （`validate` は `todo:` があれば warn にする）
- **既存の `category` で表せない分野が出た** → `categories:` に小分類を追加し、適切な `domain` に紐づける。
  暫定の8 `domains` で収まらないものが出たら `todo:` に記録し、Task 22 で判断する
- **`agency` は `mayor` 以外のときだけ書く。** 省略は「市長部局である」という主張であり、
  未確定の意味では使わない（`data/schema.md`）

**Step 4: 検証**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "exit code = $?"
node tools/linkcheck.mjs 2>&1 | tail -20
```

期待: `validate` は exit 0。`linkcheck` で新規追加したURLが生きている

**Step 5: 巡回台帳に記録する**

`sources/POLICY.md` の表に、**課ごとに1行**足します。**計画が無かった課も「なし」と書きます。**
記録がないことと、確認して無かったことは違います。

```markdown
| 市長部局 | 総務部 総務課 | 2026-08-12 | 地域防災計画、国民保護計画 |
| 市長部局 | 総務部 財政課 | 2026-08-12 | 公共施設等総合管理計画、個別施設計画 |
| 市長部局 | 総務部 一緒に推進課 | 2026-08-12 | 第4次総合計画 |
| 市長部局 | 産業推進部 商工振興課 | 2026-08-12 | なし（計画の掲載を確認できず） |
```

**Step 6: コミット**

```bash
git add data/plans.yml sources/POLICY.md
git commit -m "<各タスクが指定するメッセージ>"
```

---

## Task 11: 総務部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 総務部 |
| 課 | 総務課・財政課・一緒に推進課 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 地域防災計画・国民保護計画（総務課 危機管理班）、公共施設等総合管理計画・個別施設計画（財政課）、第4次総合計画（一緒に推進課） |
| 既存エントリとの関係 | `bousai`・`kokyoshisetsu-sougou`・`kokyoshisetsu-kobetsu`・`sougou-4` は投入済み。**巡回では所管と `todo:` の解消を確認する** |
| コミットメッセージ | `総務部を巡回し、所管の計画を追加` |

---

## Task 12: 地域振興部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 地域振興部 |
| 課 | 地域共創課・観光課・文化スポーツ振興課 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 過疎地域持続的発展計画・男女共同参画基本計画（地域共創課）、観光振興計画（観光課）、スポーツ推進計画・文化振興計画（文化スポーツ振興課） |
| 既存エントリとの関係 | `kaso-r8`・`danjo-3` は投入済み。`danjo-3` は `todo:`（計画期間・根拠法・現行計画の所在）が立っているので、ここで解消を試みる |
| コミットメッセージ | `地域振興部を巡回し、所管の計画を追加` |

---

## Task 13: 市民部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 市民部 |
| 課 | 市民福祉課・子育て支援課・保護課・税務課 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 地域福祉計画・障がい者計画・障がい福祉計画（市民福祉課 地域福祉班）、こども計画（子育て支援課）、生活困窮者自立支援の関連計画（保護課） |
| 既存エントリとの関係 | `chiiki-fukushi-3`・`seinen-kouken`・`saihan-boushi`・`shougai-keikaku-3`・`shougai-fukushi-7`・`kodomo-1` は投入済み |
| コミットメッセージ | `市民部を巡回し、所管の計画を追加` |

---

## Task 14: 保健環境部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 保健環境部 |
| 課 | 保険課・長寿支援課・健康増進課・環境衛生課 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 高齢者福祉計画・介護保険事業計画（保険課／長寿支援課）、データヘルス計画（保険課 国保・後期・年金班）、健康いき21・自殺対策計画・新型インフルエンザ等対策行動計画（健康増進課）、一般廃棄物処理基本計画・環境基本計画・地球温暖化対策実行計画（環境衛生課） |
| 既存エントリとの関係 | `kourei-9/8/7`・`data-health-3`・`kenkou-iki21`・`jisatsu-2`・`influenza` は投入済み。**環境衛生課は未着手で、収穫が多いと見込まれる** |
| コミットメッセージ | `保健環境部を巡回し、所管の計画を追加` |

---

## Task 15: 農林水産部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 農林水産部 |
| 課 | 農林課・水産課・家畜診療所 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 農業振興地域整備計画・人・農地プラン（地域計画）・鳥獣被害防止計画（農林課）、水産振興計画・漁港整備計画（水産課） |
| 既存エントリとの関係 | 該当なし。**すべて新規** |
| コミットメッセージ | `農林水産部を巡回し、所管の計画を追加` |

---

## Task 16: 産業推進部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 産業推進部 |
| 課 | 商工振興課 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 商工業振興計画、企業立地の方針、再生可能エネルギー関連の計画 |
| 既存エントリとの関係 | 該当なし。**すべて新規。1課のみなので「なし」で終わる可能性もある** |
| コミットメッセージ | `産業推進部を巡回し、所管の計画を追加` |

---

## Task 17: 建設部を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 市長部局 建設部 |
| 課 | 建設課・上下水道課 |
| 起点となる規程 | [行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html) 第3条・第4条 |
| 想定される計画 | 都市計画マスタープラン・景観計画・住宅マスタープラン・橋梁長寿命化修繕計画（建設課）、水道ビジョン・経営戦略・下水道の事業計画（上下水道課） |
| 既存エントリとの関係 | `keikan` は投入済み（`status: unknown`、`todo:` あり）。**上下水道課は市長部局なので `agency` は書かない**（設計 3.5） |
| コミットメッセージ | `建設部を巡回し、所管の計画を追加` |

---

## Task 18: 教育委員会を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 教育委員会事務局 |
| 課 | 教育総務課・学校教育課・社会教育課 |
| 起点となる規程 | [教育委員会事務局組織規則](https://www.city.iki.nagasaki.jp/reiki/reiki_honbun/r014RG00000190.html) |
| 想定される計画 | 教育振興基本計画（教育総務課）、学校施設長寿命化計画・学校再編の計画（学校教育課）、子ども読書活動推進計画・文化財保存活用地域計画・生涯学習推進計画（社会教育課） |
| 既存エントリとの関係 | `kodomo-dokusho-2` は投入済み（Task 7 で `agency: education` を付与済み） |
| コミットメッセージ | `教育委員会を巡回し、所管の計画を追加` |

- [ ] **追加のステップ: すべてのエントリに `agency: education` を付ける**

教育委員会の所管はすべて `agency: education` です。省略すると市長部局と誤認されます。

```yaml
  - id: kyouiku-shinkou
    name: <正式名称>
    level: municipal
    agency: education
    domain: kyouiku
    category: <categories のキー>
    tier: bumon
    status: current
    period: { start: <年度>, end: <年度> }
    department: 教育委員会 <課> <班>
    url: <掲載ページ>
    todo: 根拠法と法定性を条文で確認する
```

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
```

期待: exit 0。`agency: education` が enum に無ければここで落ちる（Task 6 で追加済みのはず）

---

## Task 19: 消防・行政委員会・議会を巡回する

- [ ] **手順 A を、次の引数で実施する**

| 項目 | 値 |
|---|---|
| 対象組織 | 消防本部、農業委員会事務局、議会事務局、選挙管理委員会事務局、監査委員事務局 |
| 課 | 各事務局（規程で確認する） |
| 起点となる規程 | [例規集](https://www.city.iki.nagasaki.jp/section/reiki/reiki_menu.html)で各機関の組織規程を探す。**規程が見つからない機関は、その旨を台帳に記録する** |
| 想定される計画 | 消防力整備計画（消防本部）、農地利用最適化の指針（農業委員会）、議会基本条例に基づく取り組み（議会）。**多くは「なし」で終わる見込み** |
| `agency` | 見つかったものに `fire` / `agri` / `assembly` / `election` / `audit` を付ける |
| コミットメッセージ | `消防・農業委員会・議会・選管・監査を巡回` |

- [ ] **追加のステップ: 「なし」を台帳に明記する**

**計画を持たない機関こそ、記録が要ります。** 設計 10章の完了条件1が求めているのはこれです。

```markdown
| 選挙管理委員会 | 事務局 | 2026-08-12 | なし（計画の掲載を確認できず） |
| 監査委員 | 事務局 | 2026-08-12 | なし（計画の掲載を確認できず） |
```

---

## Task 20: 交差検証で漏れを検出する

**Files:**
- Modify: `data/plans.yml`
- Modify: `sources/POLICY.md`

**Interfaces:**
- Consumes: Task 19 までの巡回結果
- Produces: 3つの情報源で突き合わせた結果と、そこで見つかった漏れ

**このタスクの価値は「漏れが見つかること」だけでなく「見つからなかったこと」を記録に残すことです。**

- [ ] **Step 1: パブリックコメント実施状況の一覧と突き合わせる**

市のパブリックコメントのページから、過去の実施結果・実施予定を洗い出し、
`plans.yml` に無い計画名が出ないか確かめます。

- [ ] **Step 2: 第4次総合計画本体の関連計画一覧と突き合わせる**

`sougou-4` の `pdf`（`dai4jiikishisougoukeikaku_main.pdf`）に関連計画の一覧や体系図があれば、
そこに載っていて `plans.yml` に無いものを拾います。

- [ ] **Step 3: 例規集の附属機関設置条例と突き合わせる**

「○○審議会」「○○協議会」の設置条例から、対応する計画の存在を逆引きします。

- [ ] **Step 4: 見つかった漏れを投入する**

Task 11 Step 3 と同じ形式でエントリを足します。**どの情報源で見つかったかを `sources:` に残します。**

- [ ] **Step 5: 突き合わせの結果を台帳に記録する**

```markdown
### 交差検証の記録

| 情報源 | 実施日 | 突き合わせた件数 | 新たに見つかった計画 |
|---|---|---|---|
| パブリックコメント実施状況 | 2026-08-12 | ○件 | ○○計画、○○計画 |
| 第4次総合計画の関連計画一覧 | 2026-08-12 | ○件 | なし |
| 附属機関の設置条例 | 2026-08-12 | ○件 | ○○計画 |
```

- [ ] **Step 6: 検証してコミット**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
node tools/linkcheck.mjs 2>&1 | tail -20
node tools/expiring.mjs --today 2026-08-12
```

```bash
git add data/plans.yml sources/POLICY.md
git commit -m "交差検証で漏れを検出し、結果を記録

パブコメ一覧・総合計画の関連計画一覧・附属機関設置条例の3つで突き合わせた。"
```

---

## Task 21: 改定期が近い計画を深掘りする

**Files:**
- Modify: `data/plans.yml`

**Interfaces:**
- Consumes: Task 20 までに投入された全計画
- Produces: 優先度の高い計画について `laws`・`statutory`・`department`・関係が埋まった状態

設計 6.3 の第2段階です。**全件を埋めきることは完了条件ではありません**（設計 10章）。
優先順に埋め、残りは `todo:` のまま次回に送ります。

優先順位は設計 6.3 のとおり:

1. **改定期が近い計画**（`tools/expiring.mjs` が拾うもの）
2. **`tier: sougou` と `tier: bumon`**（体系図の骨格になる）
3. その他

- [ ] **Step 1: 深掘りの対象を機械的に出す**

```bash
node tools/expiring.mjs --today 2026-08-12
```

「満了が近い計画」「パブリックコメントが近い計画」「未調査の項目」の3つの一覧が出ます。
**この一覧の上から順に処理します。**

- [ ] **Step 2: 根拠法を条文で確認して `laws` と `statutory` を書く**

e-Gov 法令検索で条文の文言を確認し、`data/schema.md`「laws と statutory」の表に照らして
`obligation` を決めます。義務の強さが混在する計画は対応表の形にします。

```yaml
    laws:
      - { law: <法令名と条項>, obligation: <mandatory / effort / request / voluntary> }
    statutory: <最も強い義務>
```

**条文を確認できなかったものは書きません。** `todo:` に「根拠法を条文で確認する」を残します。

- [ ] **Step 3: `department` を組織規程で確認して書く**

対象の組織規程（手順 A の Step 1 と同じ）で分掌事務を確認します。
**根拠法が複数ある計画は、所管も複数である可能性を疑ってください**（`sources/POLICY.md`）。
複数課にまたがる場合は全角スラッシュ `／` で区切り、担当部分を括弧で示します。

```yaml
    department: 保険課 介護保険班（介護保険事業計画）／長寿支援課 長寿福祉班（高齢者福祉計画）
```

- [ ] **Step 4: 関係を張る**

| 関係 | 書くもの |
|---|---|
| `parent` | 位置づけ上の上位計画（原則 `sougou-4`） |
| `includes` / `embedded_in` | 一体策定の包含。**両方に書く** |
| `conforms_to` | 法令上、整合・調和が求められる国・県計画。**条文を確認してから** |
| `related` | 上記以外の連携。**片側にだけ書く** |

- [ ] **Step 5: 埋まった項目の `todo:` を消す**

**`todo:` に書いた内容がすべて埋まったら、`todo:` の行を削除します。**
一部だけ埋まった場合は、残りの内容だけを `todo:` に書き直します。

- [ ] **Step 6: 検証**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "exit code = $?"
node tools/expiring.mjs --today 2026-08-12
```

期待: `validate` は exit 0。`expiring` の「未調査の項目」が Step 1 のときより減っている

- [ ] **Step 7: コミット**

```bash
git add data/plans.yml
git commit -m "改定期が近い計画の根拠法・所管・関係を埋める

条文を確認できたものだけ statutory を書き、確認できなかったものは todo に残した。"
```

---

# Phase D — 仕上げ

## Task 22: `domains` を確定させ、配色を検証する

**Files:**
- Modify: `data/plans.yml`
- Modify: `data/schema.md`

**Interfaces:**
- Consumes: Task 21 までの状態（全計画が投入され、優先度の高いものは深掘り済み）
- Produces: 実在する計画から導いた `domains` と、検証済みの `slot` 並び

**確定のルール（設計 3.2）:**

1. **1件しか入らない `domain` は作らない。** 近い分野に寄せる
2. **8つ以下に収める。** 配色で識別できる上限
3. 第4次総合計画の基本目標と対応が取れるものは、**その名称と粒度を優先する**

- [ ] **Step 1: 現在の分布を数える**

```bash
node -e "
import('./tools/yaml.mjs').then(async ({ parseYaml }) => {
  const { readFileSync } = await import('node:fs')
  const d = parseYaml(readFileSync('data/plans.yml', 'utf8'))
  const count = {}
  for (const p of d.plans) if (p.domain) count[p.domain] = (count[p.domain] ?? 0) + 1
  console.log(Object.entries(count).sort((a, b) => b[1] - a[1]))
})"
```

- [ ] **Step 2: ルールに照らして `domains` を確定する**

1件しかない `domain` を近い分野へ寄せ、8つ以下に収めます。
第4次総合計画の基本目標（`sougou-4` の `pdf`）と対応が取れる粒度に寄せます。

- [ ] **Step 3: `slot` を振り直し、根拠のある配色順に対応させる**

`slot` は 1 から連番で振ります。**独自に色を選んで検証するのではなく、
色覚特性に配慮して設計・検証済みの定性配色セットの並びに `slot` を対応させます。**
`domains` を8つ以下に収めるルールは、この配色セットが8色であることと対応しています。

採用するのは **岡部・伊藤による Color Universal Design 推奨配色セット（8色）** です。
自分で配色を組んで色覚シミュレーションにかけるより、**すでに検証を経た並びをそのまま使うほうが確実**で、
他自治体がフォークしたときも同じ根拠を引き継げます。

**このタスクでは色の実装をしません**（設計 9章「配色の実装は図表を作る回に行う」）。
`slot` の番号と配色セットの並びの対応、および出典を `data/schema.md` に記すところまでです。

`data/schema.md` の `domains と categories` の節に追記:

```markdown
`slot` の 1〜8 は、岡部・伊藤による Color Universal Design 推奨配色セット（8色）の並びに対応します。
色覚特性に配慮して設計・検証された配色なので、**番号を入れ替えると検証済みの隣接関係が崩れます。**
分野を増やす場合は、既存の slot を動かさずに末尾へ足してください。8色を超える場合は、
配色セットごと選び直す必要があります（`domains` を8つ以下に収めているのはこのためです）。

実際の色の値は図表を作る段階で `assets/` 側に置きます。ここでは並び順だけを固定します。
```

- [ ] **Step 4: `categories` の `domain` を更新する**

確定した `domains` に合わせて、各小分類の `domain` を付け替えます。

- [ ] **Step 5: 検証**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "exit code = $?"
```

期待: exit 0。`domain` と `category` の食い違いはここで落ちる

- [ ] **Step 6: コミット**

```bash
git add data/plans.yml data/schema.md
git commit -m "実在する計画から domains を確定し、配色を検証

1件しか入らない分野を寄せ、8つ以下に収めた。slot を振り直して
隣接ペアの識別を検証した。"
```

---

## Task 23: 手順書とツール一覧を更新する

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Task 22 までの全成果
- Produces: 外部の協力者が同じ手順を踏める状態

- [ ] **Step 1: `CONTRIBUTING.md` の「変更前に流すもの」を更新**

```markdown
### 変更前に流すもの

```bash
node tools/validate.mjs --fail-on-error   # 参照整合・enum・骨格の検査
node tools/linkcheck.mjs                  # 追加・変更したURLが生きているか
node tools/expiring.mjs                   # 期間の入力ミスがないか（変な年度が出ないか）
node --test                               # ツール自身の単体テスト（リポジトリ直下で実行）
```

`validate.mjs` の **error は必ず 0 にしてください。** 未調査の項目は `todo:` を書けば warn になります。
```

- [ ] **Step 2: `CONTRIBUTING.md` の「守ってほしいこと」に1項目追加**

既存の7項目の後ろに追加:

```markdown
8. **未調査は `todo:` で宣言する。** フィールドを空欄や `null` にして誤魔化さない。
   `null` は「調査した結果、値が存在しない」の意味
```

- [ ] **Step 3: `README.md` のリポジトリ構成とツール一覧を更新**

`tools/` の説明に追加:

```markdown
├── tools/
│   ├── validate.mjs        plans.yml の整合性チェック
│   ├── yaml.mjs            依存なしの最小YAMLパーサ
│   ├── linkcheck.mjs       出典URLの死活チェック
│   ├── expiring.mjs        満了・パブコメが近い計画の検出
│   └── og/                 OGP画像の生成（cards.html + build.mjs）
```

`data/plans.yml が中心` の節に追加:

```bash
node tools/validate.mjs --fail-on-error   # 整合性チェック
```

「これから増やすもの」の節を、達成済みの内容に合わせて書き換えます。
**フェーズ2の第1段階（すべての計画を入れる）が完了した旨**と、
残る第2段階（YAMLから図表を生成する）を明記します。

- [ ] **Step 4: `CHANGELOG.md` に追記**

```markdown
- **全計画の洗い出しと分類・関係の整理**（設計: [`docs/design/2026-08-12-zenkeikaku-bunrui.md`](docs/design/2026-08-12-zenkeikaku-bunrui.md)）
  - 分野を2階層に。`domains`（大分類・配色の単位）を新設し、`slot` を `categories` から移した
  - `statutory`（法定性）・`tier`（計画の階層）・`agency`（実施機関）を追加
  - `conforms_to` を新設し、市計画から県計画への整合関係をデータに載せた
  - `parent` を位置づけ上の上位計画に限定し、包含は `embedded_in` に一本化
  - `laws` を根拠法と義務の対応表に拡張。一体策定で義務が混在する計画に対応
  - `tools/validate.mjs` と `tools/yaml.mjs` を新設（外部依存なし）
  - 洗い出しは組織ごと巡回。行政組織規則は市長部局のみが対象のため、教育委員会・消防・
    行政委員会・議会は別の規程を起点にした。巡回の記録は `sources/POLICY.md`
  - 収録件数 31件 → ○件
```

- [ ] **Step 5: 最終確認**

```bash
node tools/validate.mjs --fail-on-error --today 2026-08-12
echo "validate exit code = $?"
node tools/linkcheck.mjs --fail-on-dead 2>&1 | tail -5
node tools/expiring.mjs --today 2026-08-12
node --test
```

期待: `validate` exit 0、`linkcheck` に失効なし、`expiring` に異常な年度なし、テスト緑

- [ ] **Step 6: warn の件数と内訳を報告する**

```bash
node tools/validate.mjs --json --today 2026-08-12 | node -e "
let s = ''
process.stdin.on('data', (c) => (s += c)).on('end', () => {
  const r = JSON.parse(s)
  console.log('計画', r.plans, '件 / error', r.errors, '/ warn', r.warns)
  const byId = {}
  for (const f of r.findings.filter((x) => x.severity === 'warn')) (byId[f.id] ??= []).push(f.message)
  for (const [id, ms] of Object.entries(byId)) console.log('-', id, ':', ms.join('、'))
})"
```

設計 10章の完了条件3が「warn の件数と内訳を完了報告に書く」を求めています。この出力を報告に貼ります。

- [ ] **Step 7: コミット**

```bash
git add CONTRIBUTING.md README.md CHANGELOG.md
git commit -m "全計画の収録に合わせて手順書とツール一覧を更新"
```

---

## 完了の判定（設計 10章）

すべてのタスクが終わったら、次を確認します。

1. 5.1 の対象機関をすべて巡回し、機関ごとの組織一覧に対して巡回済みかが `sources/POLICY.md` に記録されている。計画を持たない組織は「なし」と明記されている
2. 3つの交差検証を実施し、見つかった漏れが `plans.yml` に反映されている
3. `node tools/validate.mjs --fail-on-error` が exit 0。warn の件数と内訳を報告に書いた
4. `node tools/linkcheck.mjs` で新規追加したURLがすべて生きている
5. `node tools/expiring.mjs` が異常な年度を出さず、`todo:` の残件が一覧できる
6. `domains` が確定し、`data/schema.md` に反映されている
