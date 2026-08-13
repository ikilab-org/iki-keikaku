# 全計画の俯瞰ページを生成する（実装計画）

> **作業者へ:** この計画は superpowers:subagent-driven-development（推奨）または
> superpowers:executing-plans でタスク単位に実行してください。手順は `- [ ]` で管理します。

作成 2026-08-13 ／ 設計 [2026-08-13-zenkeikaku-zuhyou.md](2026-08-13-zenkeikaku-zuhyou.md)

**目的:** `data/plans.yml` の76件から `plans/all/index.html`（全市の俯瞰ページ）を生成する。

**方針:** `tools/view-model.mjs` が「どの計画がどの帯・どのグループに入るか」だけを決め、
`tools/build.mjs` がそれを HTML にする。分類の規則をタグの中を読まずに検証できるようにするためです。
生成物はリポジトリにコミットし、CI は `--check` で「`plans.yml` を変えたのに生成し忘れた」を検出します。

**技術:** Node 20 / 外部依存なし / `node:test` / 手書きの最小YAMLパーサ（`tools/yaml.mjs`）

---

## 全体の制約

これは全タスクに共通で効きます。**タスクごとの要件に暗黙に含まれると考えてください。**

- **外部依存を足さない。** CI は `npm install` を実行しません。`package.json` の devDependencies は
  OGP生成用の playwright だけです。`node:` 組み込みモジュールのみ使えます
- **Node 20 以降。** テストは `node --test`（**リポジトリ直下で実行**。`node --test tools/` は
  ディレクトリをモジュールとして解決しようとして MODULE_NOT_FOUND で失敗します）
- **CLI は直接実行のときだけ動かす。** `if (fileURLToPath(import.meta.url) === process.argv[1])` で囲む。
  テストから import したときに走らないようにするためです（`tools/validate.mjs` と同じ形）
- **生成結果は決定的にする。** `Date.now()` や `new Date()` を出力に混ぜない。日付は
  `doc.meta.updated` / `doc.meta.survey_date` から取る。混ぜると `--check` が毎回落ちます
- **コメントは日本語。** 既存の `tools/*.mjs` と同じ。「何をしているか」ではなく
  「なぜそうしているか」を書く
- **`data/plans.yml` を書き換えない。** このフェーズはデータを読むだけです
- **1件も落とさない。** 76件すべてがページに現れること。`period` の無い25件、`tier` の無い1件、
  `domain` の無い9件を、専用の帯・グループを作って必ず表示する
- **配色は8色（`--c1`〜`--c8`）だけを使う。** 値を個別に上書きしない
- 各タスクの最後にコミットする。コミットメッセージは日本語、本文で理由を書く

---

## ファイル構成

| ファイル | 責務 |
|---|---|
| `assets/palette.css` | 新規。CUD 8色を light / dark で定義する。**色の値を持つ唯一の場所** |
| `tools/palette.mjs` | 新規。`palette.css` を読んで変数を返す。`build.mjs` の事前検査とテストが使う |
| `tools/view-model.mjs` | 新規。**HTMLを書かない。** どの計画がどの帯・どのグループに入るかを決める |
| `tools/build.mjs` | 新規。view-model を HTML にする。CLI と `--check` |
| `tools/fiscal-year.mjs` | 変更。軸ラベル用に `fiscalYearShort` を足す |
| `plans/all/index.html` | 新規。生成物をコミットする |
| `index.html` | 変更。ハブに俯瞰ページへの導線。配色を `palette.css` に差し替え |
| `plans/fukushi/index.html` `plans/kaigo-7-9/index.html` | 変更。配色を `palette.css` に差し替え |
| `data/schema.md` | 変更。slot と配色の対応を実態に合わせる |
| `.github/workflows/build.yml` | 新規。`build --check` |

設計 4.2 は「テンプレートを別ファイルに切り出さない」としています。**その方針は守ります** ——
ページ固有の文章と HTML は `build.mjs` の中に文字列で持ちます。`view-model.mjs` に分けたのは
テンプレートではなく**分類の規則**です。ここを分けると、生成された HTML を文字列検索せずに
「社協の計画が部門別基本計画に紛れ込んでいないか」を検査できます。

`tools/palette.mjs` と `tools/fiscal-year.mjs` への追加も設計には書いていませんが、
前者は「配色の値を持つ場所を1か所に保つ」ための読み取り、後者は軸ラベル用の短い元号表記で、
どちらも数十行です。

---

## Task 1: 配色を1か所に定義する

**ファイル:**
- 作成: `assets/palette.css`
- 作成: `tools/palette.mjs`
- 作成: `tools/palette.test.mjs`
- 変更: `data/schema.md`（「slot と配色セットの対応」の節）

**インタフェース:**
- 提供: `cssBlocks(css) -> [{sel, vars}]` / `readPalette() -> {blocks, slots}`。
  `slots` は `{1:'#0072b2', …, 8:'#000000'}`（light の値）。Task 3の `build.mjs` が
  「`domains` の slot すべてに色があるか」を検査するのに使います

- [ ] **手順1: 失敗するテストを書く**

`tools/palette.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cssBlocks, readPalette } from './palette.mjs'

test('入れ子の @media の中の :root も1ブロックとして取れる', () => {
  const css = `
    /* コメントは無視する */
    :root{ --c1:#111; --c2:#222 }
    @media (prefers-color-scheme: dark){
      :root:not([data-theme="light"]){ --c1:#aaa; --c2:#bbb }
    }`
  const b = cssBlocks(css)
  assert.equal(b.length, 2)
  assert.deepEqual(b[0].vars, { '--c1': '#111', '--c2': '#222' })
  assert.match(b[1].sel, /@media.*:root:not/)
  assert.deepEqual(b[1].vars, { '--c1': '#aaa', '--c2': '#bbb' })
})

test('3つの状態すべてが --c1 〜 --c8 を定義している', () => {
  const { blocks } = readPalette()
  // light（素の :root）／ 明示的な dark ／ システム既定の dark の3状態。
  // どれか1つで欠けると、その状態だけ色が効かないページになる。
  assert.equal(blocks.length, 3, `想定は3ブロック: ${blocks.map((b) => b.sel).join(' / ')}`)
  for (const b of blocks) {
    for (let i = 1; i <= 8; i++) {
      assert.ok(b.vars[`--c${i}`], `${b.sel} に --c${i} がありません`)
    }
  }
})

test('どの状態でも変数の顔ぶれが同じ', () => {
  // 片方の状態にしかない変数があると、もう片方で色が解決されない。
  const { blocks } = readPalette()
  const keys = blocks.map((b) => Object.keys(b.vars).sort().join(','))
  assert.equal(new Set(keys).size, 1, `変数の顔ぶれが揃っていません:\n${keys.join('\n')}`)
})

test('同じ状態の中で8色が重複しない', () => {
  const { blocks } = readPalette()
  for (const b of blocks) {
    const vals = Array.from({ length: 8 }, (_, i) => b.vars[`--c${i + 1}`].toLowerCase())
    assert.equal(new Set(vals).size, 8, `${b.sel} に同じ色が複数あります: ${vals.join(' ')}`)
  }
})

test('dark の slot 8 は黒のままにしない', () => {
  // 黒はダークの地に沈む。設計 5.3 の「dark の slot 8 は明るいグレー」。
  const { blocks } = readPalette()
  for (const b of blocks.filter((x) => /dark|:root\[data-theme="dark"\]/.test(x.sel))) {
    assert.notEqual(b.vars['--c8'].toLowerCase(), '#000000', `${b.sel} の --c8 が黒のままです`)
  }
})

test('light の slot は CUD の推奨配色の値になっている', () => {
  const { slots } = readPalette()
  assert.deepEqual(slots, {
    1: '#0072b2', 2: '#d55e00', 3: '#009e73', 4: '#e69f00',
    5: '#cc79a7', 6: '#56b4e9', 7: '#f0e442', 8: '#000000',
  })
})

test('分野の数だけ slot がある', () => {
  // domains を9つ目に増やしたら、このテストが先に落ちて配色の再検証を促す。
  const { slots } = readPalette()
  assert.ok(Object.keys(slots).length >= 8)
})
```

- [ ] **手順2: 失敗を確かめる**

```bash
node --test 2>&1 | tail -20
```

期待: `Cannot find module` を含む失敗（`tools/palette.mjs` がまだ無い）。

- [ ] **手順3: `assets/palette.css` を書く**

```css
/* 壱岐市 計画マップ 共通配色
 *
 * 岡部正隆・伊藤啓による Color Universal Design 推奨配色セット（8色）を使います。
 * 色覚特性に配慮して検証された組み合わせなので、値を個別に差し替えないでください。
 *
 * slot と分野の対応は data/plans.yml の domains が持ちます。
 * 番号を入れ替えると凡例と図の対応が崩れます（data/schema.md「slot と配色セットの対応」）。
 *
 * 黒は CUD の並びでは先頭ですが、ここでは末尾の slot 8 に置いています。
 * slot 1 は最も件数の多い分野に当たり、黒だと本文と同じ色になって分野色に見えないためです。
 *
 * ダークの値は、色相を保ったまま明度を上げたものです。CUD の原色をそのまま暗い地に
 * 置くと沈む色があるため、既存ページ（--c1 は light #2a78d6 / dark #3987e5）と同じ考え方で調整しています。
 */
:root{
  --c1:#0072b2;  /* 青    健康・福祉 */
  --c2:#d55e00;  /* 朱    都市基盤・交通 */
  --c3:#009e73;  /* 緑    産業・雇用 */
  --c4:#e69f00;  /* 橙    市政総論 */
  --c5:#cc79a7;  /* 紫赤  行財政運営 */
  --c6:#56b4e9;  /* 空    教育・文化 */
  --c7:#f0e442;  /* 黄    防災・安全 */
  --c8:#000000;  /* 黒    生活環境 */
  --c7-ink:#0b0b0b;  /* 黄の塗りの上に置く文字。黄は明るいので黒文字にする */
  --c8-ink:#ffffff;  /* 黒の塗りの上に置く文字 */
}
:root[data-theme="dark"]{
  --c1:#3d9ee0; --c2:#f07b22; --c3:#1fbe90; --c4:#f2b33d;
  --c5:#e294bf; --c6:#8fd3f4; --c7:#efe04a; --c8:#c9c7bf;
  --c7-ink:#0b0b0b; --c8-ink:#0b0b0b;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --c1:#3d9ee0; --c2:#f07b22; --c3:#1fbe90; --c4:#f2b33d;
    --c5:#e294bf; --c6:#8fd3f4; --c7:#efe04a; --c8:#c9c7bf;
    --c7-ink:#0b0b0b; --c8-ink:#0b0b0b;
  }
}
```

- [ ] **手順4: `tools/palette.mjs` を書く**

```js
/**
 * assets/palette.css を読んで、CSS変数を取り出す。
 *
 * 色の値は palette.css の1か所にしか無い、という前提を保つための道具です。
 * ここで読めるようにしておくと、build.mjs が「domains の slot すべてに色があるか」を
 * 生成前に確かめられ、テストが「3つの表示状態で変数が揃っているか」を確かめられます。
 */

import { readFileSync } from 'node:fs'

/**
 * CSS を { セレクタ, カスタムプロパティ } の配列にする。
 * @media の入れ子は中身を再帰的に見て、セレクタを連結して返す。
 */
export function cssBlocks(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open < 0) break
    const sel = src.slice(i, open).trim().replace(/\s+/g, ' ')
    let depth = 1
    let j = open + 1
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    const body = src.slice(open + 1, j - 1)
    if (body.includes('{')) {
      out.push(...cssBlocks(body).map((b) => ({ ...b, sel: `${sel} ${b.sel}` })))
    } else {
      const vars = {}
      for (const decl of body.split(';')) {
        const c = decl.indexOf(':')
        if (c < 0) continue
        const k = decl.slice(0, c).trim()
        if (k.startsWith('--')) vars[k] = decl.slice(c + 1).trim()
      }
      if (Object.keys(vars).length) out.push({ sel, vars })
    }
    i = j
  }
  return out
}

export function readPalette(path = new URL('../assets/palette.css', import.meta.url)) {
  const blocks = cssBlocks(readFileSync(path, 'utf8'))
  // 素の :root がライト。ここが色の基準になる。
  const light = blocks.find((b) => b.sel === ':root')
  if (!light) throw new Error('assets/palette.css に :root がありません')
  const slots = {}
  for (const [k, v] of Object.entries(light.vars)) {
    const m = /^--c(\d+)$/.exec(k)
    if (m) slots[Number(m[1])] = v.toLowerCase()
  }
  return { blocks, slots }
}
```

- [ ] **手順5: テストが通ることを確かめる**

```bash
node --test 2>&1 | tail -12
```

期待: `pass 78` / `fail 0`（既存71件 + 今回7件）。

- [ ] **手順6: `data/schema.md` の配色の記述を実態に合わせる**

`data/schema.md` の「### slot と配色セットの対応」の節を、次の内容に**置き換え**ます。
（現在は「実際の色の値は図表を作る段階で `assets/` 側に置きます」で終わっていますが、
その `assets/` 側が出来たので、対応表を書きます。）

```markdown
### slot と配色セットの対応

`slot` の 1〜8 は、岡部正隆・伊藤啓による Color Universal Design 推奨配色セット（8色）に対応します。
実際の色の値は `assets/palette.css` にあります。**色の値を持つ場所はそこ1か所です。**

| slot | 分野 | 色 |
|---|---|---|
| 1 | 健康・福祉 | 青 `#0072b2` |
| 2 | 都市基盤・交通 | 朱 `#d55e00` |
| 3 | 産業・雇用 | 緑 `#009e73` |
| 4 | 市政総論 | 橙 `#e69f00` |
| 5 | 行財政運営 | 紫赤 `#cc79a7` |
| 6 | 教育・文化 | 空 `#56b4e9` |
| 7 | 防災・安全 | 黄 `#f0e442` |
| 8 | 生活環境 | 黒 `#000000` |

CUD の標準的な並びは黒から始まりますが、**黒は末尾に回しています。** `slot` は件数の多い順に
振ってあるので、先頭を黒にすると最も件数の多い分野が本文と同じ色になり、分野色に見えなくなるためです。

`slot` を入れ替えると、検証済みの隣接関係が崩れます。分野を増やす場合は、既存の `slot` を動かさずに
末尾へ足してください。**8色を超える場合は配色セットごと選び直す必要があります**
（`domains` を8つ以下に収めているのはこのためです）。`tools/palette.test.mjs` が
「分野の数だけ slot がある」を検査するので、9つ目を足すとテストが先に落ちます。
```

- [ ] **手順7: コミット**

```bash
git add assets/palette.css tools/palette.mjs tools/palette.test.mjs data/schema.md && git commit -m "配色をCUDの8色に統一し、assets/palette.css に集約する

既存3ページは7色を各ファイルに重複して持っていて、schema.md が書く
CUD 8色とも一致していなかった。値を持つ場所を1か所にする。

黒は CUD の並びでは先頭だが末尾の slot 8 に回した。slot は件数の
多い順なので、先頭を黒にすると最大の分野が本文と同じ色になる。

3つの表示状態で変数の顔ぶれが揃っているかをテストで検査する。
片方にしか無い変数があると、その状態だけ色が解決されない。"
```

---

## Task 2: 分類の規則を view-model に切り出す

**ファイル:**
- 作成: `tools/view-model.mjs`
- 作成: `tools/view-model.test.mjs`

**インタフェース:**
- 消費: `tools/yaml.mjs` の `parseYaml`（テストで実データを読むため）
- 提供: `BANDS` / `RELATIONS` / `bandOf(p)` / `bandGroups(plans)` / `periodKind(p)` /
  `yearRange(plans)` / `slotOf(p, domains)` / `domainGroups(plans, domains)` /
  `relationCounts(plans)` / `expiryByYear(plans)` / `buildModel(doc)`。
  Task 3〜6の `build.mjs` はこれだけを使い、`plans.yml` の形を直接見ません

- [ ] **手順1: 失敗するテストを書く**

`tools/view-model.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml } from './yaml.mjs'
import {
  BANDS, RELATIONS, bandOf, bandGroups, periodKind, yearRange,
  slotOf, domainGroups, relationCounts, expiryByYear, buildModel,
} from './view-model.mjs'

const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
const PLANS = doc.plans

test('帯は level を tier より先に見る', () => {
  // 社協の csw-katsudou-2 は tier: bumon を持つが level: council。
  // 順序を逆にすると部門別基本計画に紛れ込む。
  assert.equal(bandOf({ level: 'council', tier: 'bumon' }), 'council')
  assert.equal(bandOf({ level: 'prefectural', tier: 'bumon' }), 'kokupref')
  assert.equal(bandOf({ level: 'national' }), 'kokupref')
  assert.equal(bandOf({ level: 'municipal', tier: 'bumon' }), 'bumon')
})

test('tier が無い市の計画は専用の帯に入る', () => {
  // 落とすと「76件すべてが現れる」が崩れ、未調査が見えなくなる。
  assert.equal(bandOf({ level: 'municipal' }), 'tier-unknown')
})

test('帯の合計が全件と一致する', () => {
  const groups = bandGroups(PLANS)
  const sum = groups.reduce((n, g) => n + g.plans.length, 0)
  assert.equal(sum, PLANS.length, '帯から漏れた計画があります')
})

test('帯の並びは BANDS の順で、どの計画も1つの帯にしか入らない', () => {
  const groups = bandGroups(PLANS)
  assert.deepEqual(groups.map((g) => g.key), BANDS.map((b) => b.key))
  const seen = new Set()
  for (const g of groups) for (const p of g.plans) {
    assert.equal(seen.has(p.id), false, `${p.id} が複数の帯に入っています`)
    seen.add(p.id)
  }
})

test('計画期間の種類を3つに分ける', () => {
  assert.equal(periodKind({ period: { start: 2024, end: 2029 } }), 'range')
  assert.equal(periodKind({ period: { start: null, end: null } }), 'zuiji')
  assert.equal(periodKind({}), 'unknown')
  // 片側だけ null は現状0件だが、range に混ぜると軸の計算が NaN になる。
  assert.equal(periodKind({ period: { start: 2024, end: null } }), 'partial')
})

test('期間を持たない計画が実データで25件ある', () => {
  const kinds = PLANS.map(periodKind)
  const notRange = kinds.filter((k) => k !== 'range').length
  assert.equal(notRange, 25, `期間を持たない計画の件数が変わりました: ${notRange}`)
  assert.equal(kinds.filter((k) => k === 'zuiji').length, 7)
  assert.equal(kinds.filter((k) => k === 'unknown').length, 18)
})

test('年度の範囲は range の計画だけから決める', () => {
  assert.deepEqual(
    yearRange([{ period: { start: 2015, end: 2020 } }, { period: { start: null, end: null } }, {}]),
    { start: 2015, end: 2020 },
  )
  assert.equal(yearRange([{}]), null)
  assert.deepEqual(yearRange(PLANS), { start: 2010, end: 2035 })
})

test('slot は domains から引く。domain が無ければ null', () => {
  assert.equal(slotOf({ domain: 'fukushi' }, doc.domains), 1)
  assert.equal(slotOf({}, doc.domains), null)
  assert.equal(slotOf({ domain: 'nonexistent' }, doc.domains), null)
})

test('domain のグループは slot 順で、domain の無い計画は末尾にまとまる', () => {
  const groups = domainGroups(PLANS, doc.domains)
  const slots = groups.filter((g) => g.slot != null).map((g) => g.slot)
  assert.deepEqual(slots, [...slots].sort((a, b) => a - b))
  const last = groups[groups.length - 1]
  assert.equal(last.key, 'nodomain')
  assert.equal(last.plans.length, 9, '長崎県の9件が末尾に集まっていません')
  assert.equal(last.plans.every((p) => p.level === 'prefectural'), true)
  assert.equal(groups.reduce((n, g) => n + g.plans.length, 0), PLANS.length)
})

test('domain が全件に付いていれば nodomain のグループは作らない', () => {
  const groups = domainGroups([{ id: 'a', domain: 'fukushi' }], doc.domains)
  assert.equal(groups.some((g) => g.key === 'nodomain'), false)
})

test('関係の本数は「持つ計画の件数」と「延べ本数」の両方を返す', () => {
  const counts = relationCounts(PLANS)
  assert.deepEqual(counts.map((c) => c.key), RELATIONS.map((r) => r.key))
  const parent = counts.find((c) => c.key === 'parent')
  assert.equal(parent.plans, 8)
  assert.equal(parent.total, PLANS.length)
  // related は無向辺を片側だけ書く決まりなので、延べ本数のほうが多くなる
  const related = counts.find((c) => c.key === 'related')
  assert.equal(related.edges, 26)
  assert.ok(related.edges >= related.plans)
})

test('満了年度の集計から status: expired を外す', () => {
  // 履歴として意図的に残している過去の計画。tools/expiring.mjs と同じ扱い。
  const rows = expiryByYear([
    { status: 'current', period: { start: 2020, end: 2026 } },
    { status: 'expired', period: { start: 2010, end: 2014 } },
    { status: 'current', period: { start: 2021, end: 2026 } },
  ])
  assert.deepEqual(rows, [{ year: 2026, count: 2 }])
})

test('実データの満了は令和8年度と令和11年度に11件ずつ集中する', () => {
  const rows = expiryByYear(PLANS)
  assert.equal(rows.find((r) => r.year === 2026).count, 11)
  assert.equal(rows.find((r) => r.year === 2029).count, 11)
  assert.deepEqual(rows.map((r) => r.year), [...rows.map((r) => r.year)].sort((a, b) => a - b))
})

test('buildModel が図表に必要なものを一度に返す', () => {
  const m = buildModel(doc)
  assert.equal(m.plans.length, 76)
  assert.equal(m.bands.length, BANDS.length)
  assert.deepEqual(m.years, { start: 2010, end: 2035 })
  assert.equal(m.relations.length, RELATIONS.length)
  assert.equal(m.todoCount, 29)
  assert.equal(m.meta.updated, doc.meta.updated)
})
```

- [ ] **手順2: 失敗を確かめる**

```bash
node --test 2>&1 | tail -20
```

期待: `Cannot find module` を含む失敗。

- [ ] **手順3: `tools/view-model.mjs` を書く**

```js
/**
 * data/plans.yml から、図表に必要な形を作る。
 *
 * ここには HTML を書きません。「どの計画がどの帯・どのグループに入るか」だけを決めます。
 * 分けているのは、分類の規則をタグの中を読まずに検証できるようにするためです。
 * HTML の組み立ては tools/build.mjs にあります。
 */

/**
 * 体系図の帯。上から順に並べます。
 *
 * arrow は「次の帯へ降りるときの関係の名前」です。null の帯には矢印を出しません。
 * 施設・財産管理から下は階層の続きではなく、並列に置く区分なので、
 * 矢印を出すと存在しない上下関係を主張することになります。
 */
export const BANDS = [
  { key: 'kokupref', label: '国・長崎県', note: '市の計画が整合・調和を求められる相手', arrow: '整合・調和' },
  { key: 'sougou', label: '総合計画', note: '市の最上位計画', arrow: '分野の基本方針として展開' },
  { key: 'bumon', label: '部門別基本計画', note: '分野の基本方針を定めるもの', arrow: '個別の課題・事業に展開' },
  { key: 'kobetsu', label: '個別計画', note: '特定の課題・事業を扱うもの', arrow: '実施内容と目標値に展開' },
  { key: 'jisshi', label: '実施・行動計画', note: '実施内容と目標値を定めるもの', arrow: null },
  { key: 'shisetsu', label: '施設・財産管理', note: '公共施設・インフラの維持管理を定めるもの', arrow: null },
  { key: 'tier-unknown', label: '階層を確認できていない', note: '調査中。落とさずにここへ置く', arrow: null },
  { key: 'council', label: '社会福祉協議会', note: '市の計画ではないが対になるもの', arrow: null },
]

/**
 * 関係の種類。scalar は「1件しか持てないもの」。
 * 本数が薄いので線は引かず、件数だけを表にして出します（設計 3.1）。
 */
export const RELATIONS = [
  { key: 'parent', label: '位置づけ上の上位計画がある', scalar: true },
  { key: 'embedded_in', label: '他の計画に一体化して策定されている', scalar: true },
  { key: 'includes', label: '他の計画を一体化して含んでいる', scalar: false },
  { key: 'conforms_to', label: '国・県の計画との整合が法令で定められている', scalar: false },
  { key: 'related', label: '相互に参照する関係がある', scalar: false },
  { key: 'predecessors', label: '前の版が分かっている', scalar: false },
  { key: 'successor', label: '次期計画の予定が分かっている', scalar: true },
]

/**
 * level を tier より先に見ます。
 * 社協の地域福祉活動計画は tier: bumon を持ちますが市の計画ではないので、
 * 逆順にすると部門別基本計画に紛れ込みます。
 */
export function bandOf(p) {
  if (p.level === 'national' || p.level === 'prefectural') return 'kokupref'
  if (p.level === 'council') return 'council'
  return p.tier ?? 'tier-unknown'
}

export function bandGroups(plans) {
  return BANDS.map((b) => ({ ...b, plans: plans.filter((p) => bandOf(p) === b.key) }))
}

/**
 * 計画期間の種類。
 * partial（片側だけ null）は現状0件ですが、range に混ぜると軸の計算が NaN になるので分けます。
 */
export function periodKind(p) {
  if (p.period === undefined) return 'unknown'
  const { start, end } = p.period
  if (start === null && end === null) return 'zuiji'
  if (typeof start === 'number' && typeof end === 'number') return 'range'
  return 'partial'
}

export function yearRange(plans) {
  const ys = []
  for (const p of plans) {
    if (periodKind(p) !== 'range') continue
    ys.push(p.period.start, p.period.end)
  }
  return ys.length ? { start: Math.min(...ys), end: Math.max(...ys) } : null
}

export const slotOf = (p, domains) => domains?.[p.domain]?.slot ?? null

/**
 * domain ごとのグループを slot 順に並べ、domain を持たない計画を末尾にまとめます。
 *
 * domain は市と社協の計画にだけ付ける決まりなので（data/schema.md）、
 * 末尾のグループは国・県の計画です。欠落ではありません。
 * domains に無い domain が書かれていた場合もここに落ちます（消えないようにするため）。
 */
export function domainGroups(plans, domains) {
  const known = new Set(Object.keys(domains ?? {}))
  const groups = Object.entries(domains ?? {})
    .sort((a, b) => a[1].slot - b[1].slot)
    .map(([key, def]) => ({
      key, label: def.label, slot: def.slot,
      plans: plans.filter((p) => p.domain === key),
    }))
  const rest = plans.filter((p) => !known.has(p.domain))
  if (rest.length) {
    groups.push({ key: 'nodomain', label: '国・長崎県', slot: null, plans: rest })
  }
  return groups
}

export function relationCounts(plans) {
  const has = (p, r) => (r.scalar ? p[r.key] !== undefined : (p[r.key] ?? []).length > 0)
  const n = (p, r) => (r.scalar ? (p[r.key] !== undefined ? 1 : 0) : (p[r.key] ?? []).length)
  return RELATIONS.map((r) => ({
    key: r.key,
    label: r.label,
    plans: plans.filter((p) => has(p, r)).length,
    edges: plans.reduce((acc, p) => acc + n(p, r), 0),
    total: plans.length,
  }))
}

/**
 * 年度ごとの満了件数。
 * status: expired は履歴として意図的に残している過去の計画なので外します
 * （tools/expiring.mjs と同じ扱い）。
 */
export function expiryByYear(plans) {
  const m = new Map()
  for (const p of plans) {
    if (periodKind(p) !== 'range' || p.status === 'expired') continue
    m.set(p.period.end, (m.get(p.period.end) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }))
}

export function buildModel(doc) {
  const plans = doc.plans ?? []
  const domains = doc.domains ?? {}
  return {
    plans,
    domains,
    meta: doc.meta ?? {},
    bands: bandGroups(plans),
    relations: relationCounts(plans),
    years: yearRange(plans),
    expiry: expiryByYear(plans),
    todoCount: plans.filter((p) => p.todo).length,
    zuiji: plans.filter((p) => periodKind(p) === 'zuiji'),
    unclear: plans.filter((p) => ['unknown', 'partial'].includes(periodKind(p))),
  }
}
```

- [ ] **手順4: テストが通ることを確かめる**

```bash
node --test 2>&1 | tail -12
```

期待: `pass 92` / `fail 0`（前タスクまで78件 + 今回14件）。

- [ ] **手順5: 規則が本当に効いているか、壊して確かめる**

`tools/view-model.mjs` の `bandOf` で `level: 'council'` の判定行を一時的に削除し、
テストが落ちることを確認します。

```bash
node --test 2>&1 | grep -c "^not ok"
```

期待: 1 以上（「帯は level を tier より先に見る」が落ちる）。確認したら削除した行を戻し、
再度 `node --test` が全通することを確かめます。

- [ ] **手順6: コミット**

```bash
git add tools/view-model.mjs tools/view-model.test.mjs && git commit -m "図表の分類規則を view-model に切り出す

HTMLの組み立てから分類の規則を分けた。タグの中を読まずに
「どの計画がどの帯に入るか」を検証できるようにするため。

落とさない分岐を3つ明示した。level を tier より先に見る（社協が
部門別に紛れ込むのを防ぐ）、tier の無い1件に専用の帯を作る、
domain の無い9件を末尾のグループにまとめる。"
```

---

## Task 3: ページの外枠を生成する

**ファイル:**
- 作成: `tools/build.mjs`
- 作成: `tools/build.test.mjs`
- 変更: `tools/fiscal-year.mjs`（`fiscalYearShort` を追加）
- 変更: `tools/expiring.test.mjs`（`fiscalYearShort` の検査を追加）

**インタフェース:**
- 消費: Task 2の `buildModel` / `BANDS` ほか、Task 1の `readPalette`
- 提供: `esc(s)` / `colorOf(p, domains)` / `buildPage(doc)` / `PAGE_CSS` /
  `fiscalYearShort(y)` -> `'令和8'`。
  Task 4〜6が `buildPage` の中に各セクションを差し込みます。
  セクションの関数（`taikeiSection` など）は各タスクで追加します

- [ ] **手順1: 失敗するテストを書く**

`tools/build.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'
import { buildModel } from './view-model.mjs'
import { esc, buildPage } from './build.mjs'

// Task 4〜6では、この import に taikeiSection / timelineSection / listSection を足し、
// 下の定数に対応する行を1行ずつ足していきます。
const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
const model = buildModel(doc)
const html = buildPage(doc)
const script = fileURLToPath(new URL('./build.mjs', import.meta.url))

test('HTMLの特殊文字を落とす', () => {
  assert.equal(esc('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;')
  assert.equal(esc(123), '123')
})

test('ページの外枠がある', () => {
  assert.match(html, /^<!DOCTYPE html>\n<html lang="ja">/)
  assert.match(html, /<meta charset="utf-8">/)
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/assets\/palette\.css">/)
  assert.match(html, /<link rel="canonical" href="https:\/\/keikaku\.ikilab\.org\/plans\/all\/">/)
  assert.ok(html.endsWith('</html>\n'))
})

test('3つの表示状態すべてで色が定義されている', () => {
  // 素の :root（システム既定のライト）／ 明示的な dark ／ システム既定の dark。
  assert.match(html, /:root\{/)
  assert.match(html, /:root\[data-theme="dark"\]\{/)
  assert.match(html, /@media \(prefers-color-scheme: dark\)/)
  assert.match(html, /:root:not\(\[data-theme="light"\]\)/)
})

test('script はテーマ切替の1ブロックだけで、計画のデータを含まない', () => {
  // 既存2ページはタイムラインと表をJSで組み立てていて、HTMLに内容が無い。
  // 生成に移す動機の一つがこれ（設計 4.4）。
  const blocks = html.match(/<script[\s\S]*?<\/script>/g) ?? []
  assert.equal(blocks.length, 1, `script が ${blocks.length} ブロックあります`)
  const js = blocks[0]
  assert.match(js, /data-theme/)
  for (const p of doc.plans) {
    assert.equal(js.includes(p.name), false, `script に計画名が入っています: ${p.name}`)
  }
})

test('調査基準日と更新日はデータから取る', () => {
  // 生成時刻を混ぜると --check が毎回落ちる。
  assert.ok(html.includes(doc.meta.survey_date))
  assert.ok(html.includes(doc.meta.updated))
})

test('2回生成しても同じ結果になる', () => {
  assert.equal(buildPage(doc), html)
})
```

> **注:** `--check` の検査は、`plans/all/index.html` がコミットされたTask 7で書きます。
> ここで書くと、生成物がまだ無いので必ず落ちます。
> `script` 定数はTask 7で使うので、いま置いておきます。

`tools/expiring.test.mjs` の import を
`import { fiscalYearLabel, fiscalYearShort } from './fiscal-year.mjs'` に変え、末尾に足します。

```js
test('軸ラベル用の短い元号表記', () => {
  // 図の軸に「令和8年度（2026年度）」は長すぎる。年度の判定の仕方は fiscalYearLabel と同じ。
  assert.equal(fiscalYearShort(2026), '令和8')
  assert.equal(fiscalYearShort(2019), '令和1')
  assert.equal(fiscalYearShort(2018), '平成30')
  assert.equal(fiscalYearShort(1988), '昭和63')
})
```

- [ ] **手順2: 失敗を確かめる**

```bash
node --test 2>&1 | tail -20
```

期待: `Cannot find module` と `fiscalYearShort is not a function` を含む失敗。

- [ ] **手順3: `tools/fiscal-year.mjs` に短い元号表記を足す**

ファイル全体を次に差し替えます。既存の `fiscalYearLabel` の呼び出し側（`tools/expiring.mjs`）は
出力が変わらないので、そのままで動きます。

```js
/**
 * 西暦の年度を元号つきの表記にする。
 *
 * 令和固定で書くと、平成以前の計画で「令和-4年度」のような負の年が出ます。
 * 満了済みの計画を履歴として保持するようになって表面化しました。
 *
 * 年度なので、改元をまたぐ年は年度の始まりで判定します。
 * 2019年度は令和元年度（2019年4月時点で令和）、1989年度は平成元年度です。
 */
export const fiscalYearShort = (y) => {
  if (y >= 2019) return `令和${y - 2018}`
  if (y >= 1989) return `平成${y - 1988}`
  return `昭和${y - 1925}`
}

/** 図の軸には長すぎるので、軸には fiscalYearShort のほうを使います。 */
export const fiscalYearLabel = (y) => `${fiscalYearShort(y)}年度（${y}年度）`
```

- [ ] **手順4: `tools/build.mjs` を書く**

```js
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
```

- [ ] **手順5: テストが通ることを確かめる**

```bash
node --test 2>&1 | tail -12
```

期待: `pass 98` / `fail 0` / `skipped 0`（前タスクまで92件 + build 5件 + expiring 1件）。

- [ ] **手順6: 生成できることを目で確かめる**

```bash
node tools/build.mjs && node -e "const s=require('fs').readFileSync('plans/all/index.html','utf8');console.log(s.length+'バイト', s.split('\n').length+'行')"
```

期待: `plans/all/index.html を生成しました（計画 76 件）` と、ファイルの大きさが出る。
**この時点ではまだコミットしません**（図が入っていないため）。

- [ ] **手順7: コミット**

```bash
git add tools/build.mjs tools/build.test.mjs tools/fiscal-year.mjs tools/expiring.test.mjs && git commit -m "俯瞰ページの外枠を生成する

CLI・validate ゲート・--check・ページの外枠まで。図は次から。

validate の基準日を doc.meta.updated にした。現在時刻にすると
日が変わっただけで生成できたりできなくなったりして再現しない。

配色の事前検査を入れた。domains を9つ目に増やしたときに
色の無い slot でページが出るのを防ぐ。

図の軸用に fiscal-year.mjs へ短い元号表記を足した。
「令和8年度（2026年度）」は26年ぶんの目盛りには長すぎる。"
```

---

## Task 4: 体系図を生成する

**ファイル:**
- 変更: `tools/build.mjs`（`taikeiSection` を追加し、`buildPage` から呼ぶ）
- 変更: `tools/build.test.mjs`（検査を追加）

**インタフェース:**
- 消費: `buildModel(doc).bands` / `.relations`、`colorOf(p, domains)`、`esc`
- 提供: `taikeiSection(m)` -> HTML文字列

- [ ] **手順1: 失敗するテストを書く**

`tools/build.test.mjs` の冒頭を2か所だけ直します。

```js
import { esc, buildPage, taikeiSection } from './build.mjs'   // taikeiSection を足す
```

```js
const taikei = taikeiSection(model)                            // 定数に1行足す
```

そのうえで、末尾に次のテストを足します。

```js
test('体系図に76件すべてが現れる', () => {
  for (const p of doc.plans) {
    assert.ok(taikei.includes(esc(p.name)), `体系図に出ていません: ${p.id} ${p.name}`)
  }
})

test('体系図の帯の件数の合計が76件になる', () => {
  const counts = [...taikei.matchAll(/data-band-count="(\d+)"/g)].map((m) => Number(m[1]))
  assert.equal(counts.length, model.bands.length)
  assert.equal(counts.reduce((a, b) => a + b, 0), doc.plans.length)
})

test('社協の計画は部門別基本計画ではなく社協の帯にある', () => {
  const csw = doc.plans.find((p) => p.id === 'csw-katsudou-2')
  const bands = taikei.split(/<div class="tier"/).slice(1)
  const bumon = bands.find((b) => b.includes('部門別基本計画'))
  const council = bands.find((b) => b.includes('社会福祉協議会'))
  assert.equal(bumon.includes(esc(csw.name)), false)
  assert.equal(council.includes(esc(csw.name)), true)
})

test('tier を確認できていない計画に専用の帯がある', () => {
  const p = doc.plans.find((x) => x.id === 'ondanka-jimu')
  const bands = taikei.split(/<div class="tier"/).slice(1)
  const unknown = bands.find((b) => b.includes('階層を確認できていない'))
  assert.ok(unknown, '「階層を確認できていない」の帯がありません')
  assert.ok(unknown.includes(esc(p.name)), `${p.id} がその帯にありません`)
})

test('未調査の項目がある計画に印が付く', () => {
  const marks = (taikei.match(/class="todo"/g) ?? []).length
  assert.equal(marks, model.todoCount, `印の数が todo の件数と違います: ${marks} / ${model.todoCount}`)
})

test('関係の本数を表にして出し、線は引かない', () => {
  // parent は8本しかない。線を引くとほとんどの計画が孤立して見える（設計 3.1）。
  for (const r of model.relations) {
    assert.ok(taikei.includes(esc(r.label)), `関係の表に無い: ${r.label}`)
    assert.ok(taikei.includes(`${r.plans} / ${r.total}`), `件数が出ていない: ${r.label}`)
  }
  assert.equal(/<svg|<line |stroke=/.test(taikei), false, '線を描いています')
})

test('矢印は階層の続きになっている帯のあいだにだけ出る', () => {
  // 施設・財産管理から下は並列の区分。矢印を出すと存在しない上下関係を主張することになる。
  const arrows = (taikei.match(/<div class="arrow">/g) ?? []).length
  assert.equal(arrows, model.bands.filter((b) => b.arrow).length)
  assert.equal(arrows, 4)
})

test('分野色の凡例が8分野そろっている', () => {
  for (const [key, def] of Object.entries(doc.domains)) {
    assert.ok(taikei.includes(esc(def.label)), `凡例に無い分野: ${key}`)
    assert.ok(taikei.includes(`var(--c${def.slot})`), `slot ${def.slot} の色が使われていません`)
  }
})
```

- [ ] **手順2: 失敗を確かめる**

```bash
node --test 2>&1 | tail -20
```

期待: `taikeiSection is not a function` を含む失敗。

- [ ] **手順3: `tools/build.mjs` に体系図を足す**

`PAGE_CSS` の末尾（バッククォートの手前）に次の CSS を追加します。

```css
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
```

`buildPage` の配列内、`statsSection(m),` の次の行に `taikeiSection(m),` を足します。
そのうえで、`footerBlock` の手前に次を追加します。

```js
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
    <span><span class="todo">未</span>未調査の項目がある</span>
  </div>
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
```

`PAGE_CSS` に `h3` の既定が無いので、上のインラインの `style` で足りています。

- [ ] **手順4: テストが通ることを確かめる**

```bash
node --test 2>&1 | tail -12
```

期待: `pass 106` / `fail 0`。

- [ ] **手順5: コミット**

```bash
node tools/build.mjs && git add tools/build.mjs tools/build.test.mjs && git commit -m "体系図を生成する

帯は tier で、チップの色は domain。個々の計画のあいだに線は引かない。
parent は8本しかなく、線にするとほとんどの計画が孤立して見えるため。
関係は本数の表にして、分母を添えて調査の進み具合が読めるようにした。

矢印は階層の続きになっている4か所にだけ出す。施設・財産管理から下は
並列の区分で、矢印を出すと存在しない上下関係を主張することになる。"
```

---

## Task 5: タイムラインを生成する

**ファイル:**
- 変更: `tools/build.mjs`（`timelineSection` を追加）
- 変更: `tools/build.test.mjs`

**インタフェース:**
- 消費: `buildModel(doc).years` / `.zuiji` / `.unclear`、`domainGroups`、`periodKind`、
  Task 3で足した `fiscalYearShort`
- 提供: `timelineSection(m)` -> HTML文字列

- [ ] **手順1: 失敗するテストを書く**

`tools/build.test.mjs` の import に `timelineSection` を足し、定数に
`const timeline = timelineSection(model)` を1行足したうえで、末尾に次を足します。

`fiscalYearShort` もテスト側で使うので、import に足します
（`import { fiscalYearShort } from './fiscal-year.mjs'`）。

```js
test('タイムラインに76件すべてが現れる', () => {
  for (const p of doc.plans) {
    assert.ok(timeline.includes(esc(p.name)), `タイムラインに出ていません: ${p.id} ${p.name}`)
  }
})

test('期間を持たない25件が専用のグループにある', () => {
  // ここを落とすと、俯瞰したつもりで3分の1が見えていないことになる（設計 3.2）。
  const zuiji = timeline.split('随時修正')[1]?.split('<div class="grp">')[0] ?? ''
  for (const p of model.zuiji) assert.ok(zuiji.includes(esc(p.name)), `随時修正のグループに無い: ${p.id}`)
  const unclear = timeline.split('計画期間を確認できていない')[1] ?? ''
  for (const p of model.unclear) assert.ok(unclear.includes(esc(p.name)), `未確認のグループに無い: ${p.id}`)
  assert.equal(model.zuiji.length + model.unclear.length, 25)
})

test('軸の範囲がデータの実際の範囲と一致する', () => {
  // 軸を短く取ると、はみ出した計画の帯が範囲外の grid-column を指す。
  assert.ok(timeline.includes(fiscalYearShort(model.years.start)), '左端のラベルがありません')
  assert.ok(timeline.includes(fiscalYearShort(model.years.end)), '右端のラベルがありません')
  const cols = model.years.end - model.years.start + 1
  assert.ok(timeline.includes(`repeat(${cols},1fr)`), `列数が ${cols} になっていません`)
})

test('帯の grid-column が軸の範囲に収まる', () => {
  const cols = model.years.end - model.years.start + 1
  const spans = [...timeline.matchAll(/grid-column:(\d+) \/ (\d+)/g)]
  assert.ok(spans.length > 0)
  for (const [, a, b] of spans) {
    assert.ok(Number(a) >= 1, `左端が範囲外: ${a}`)
    assert.ok(Number(b) <= cols + 1, `右端が範囲外: ${b} > ${cols + 1}`)
    assert.ok(Number(a) < Number(b), `幅が0以下: ${a} / ${b}`)
  }
})

test('横に長い図はページ本体ではなく図の中でスクロールする', () => {
  assert.ok(timeline.includes('class="tlwrap"'))
})
```

- [ ] **手順2: 失敗を確かめる**

```bash
node --test 2>&1 | tail -20
```

期待: `timelineSection is not a function` を含む失敗。

- [ ] **手順3: `tools/build.mjs` にタイムラインを足す**

先頭の view-model の import に `domainGroups` と `periodKind` を足します。

```js
import { buildModel, slotOf, domainGroups, periodKind } from './view-model.mjs'
```

`PAGE_CSS` の末尾に次を追加します。

```css
.tlwrap{overflow-x:auto}
.gantt{min-width:940px}
.grow{display:grid;grid-template-columns:290px 1fr;gap:10px;align-items:center}
.glabel{display:flex;align-items:center;gap:7px;font-size:12.5px;min-width:0}
.glabel .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gaxis{display:grid;border-bottom:1px solid var(--axis)}
.gaxis div{font-size:11px;color:var(--muted);text-align:center;padding:0 0 5px;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.gaxis div.now{color:var(--ink);font-weight:650}
.gtrack{position:relative;display:grid;height:28px;align-items:center}
.gtrack::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(to right,var(--grid) 0 1px,transparent 1px 100%);
  background-size:calc(100%/var(--cols)) 100%}
.nowline{position:absolute;top:0;bottom:0;width:2px;background:var(--crit);opacity:.45;z-index:3;pointer-events:none}
.bar{height:19px;border-radius:5px;display:flex;align-items:center;justify-content:center;
  font-size:10.5px;color:#fff;position:relative;z-index:2;white-space:nowrap;overflow:hidden}
.bar.dash{background:transparent!important;border:1.5px dashed var(--muted);color:var(--ink2);
  grid-column:1 / -1;justify-content:flex-start;padding-left:8px}
.grp{font-size:11.5px;letter-spacing:.06em;color:var(--muted);margin:16px 0 6px;padding-top:10px;
  border-top:1px solid var(--grid);display:flex;align-items:center;gap:7px}
```

`buildPage` の配列で `taikeiSection(m),` の次に `timelineSection(m),` を足し、次を追加します。

```js
/** 塗りの上に置く文字色。黄と黒だけ白文字が読めないので palette.css の指定に従う。 */
const barInk = (p, domains) => {
  const s = slotOf(p, domains)
  return s === 7 || s === 8 ? `var(--c${s}-ink)` : '#fff'
}

export function timelineSection(m) {
  const { start: Y0, end: Y1 } = m.years
  const cols = Y1 - Y0 + 1
  // meta.updated は YYYY-MM-DD。年度なので4月始まりで判定する。
  const [uy, um] = m.meta.updated.split('-').map(Number)
  const nowFy = um >= 4 ? uy : uy - 1
  const nowPct = ((nowFy - Y0 + 0.5) / cols) * 100

  const axis = () => {
    const cells = []
    for (let y = Y0; y <= Y1; y++) {
      // 26年ぶんの目盛りに毎年ラベルを振ると読めないので、5年ごとと両端と現在だけ出す
      const show = (y - Y0) % 5 === 0 || y === Y1 || y === nowFy
      cells.push(`<div class="${y === nowFy ? 'now' : ''}">${show ? esc(fiscalYearShort(y)) : ''}</div>`)
    }
    return `<div class="gaxis" style="grid-template-columns:repeat(${cols},1fr)">${cells.join('')}</div>`
  }

  const row = (p) => {
    const kind = periodKind(p)
    const col = colorOf(p, m.domains)
    const label = `<div class="glabel"><span class="dot" style="background:${col}"></span>`
      + `<span class="nm">${esc(p.name)}</span>${p.todo ? '<span class="todo">未</span>' : ''}</div>`
    const track = (inner) => `<div class="gtrack" style="grid-template-columns:repeat(${cols},1fr);--cols:${cols}">`
      + `<div class="nowline" style="left:${nowPct.toFixed(2)}%"></div>${inner}</div>`
    if (kind !== 'range') {
      const text = kind === 'zuiji' ? '期間を定めず随時修正' : '計画期間を確認できていない'
      return `<div class="grow">${label}${track(`<div class="bar dash">${esc(text)}</div>`)}</div>`
    }
    const a = p.period.start - Y0 + 1
    const b = p.period.end - Y0 + 2
    const span = `${esc(fiscalYearShort(p.period.start))}〜${esc(fiscalYearShort(p.period.end))}`
    const bar = `<div class="bar" style="grid-column:${a} / ${b};background:${col};color:${barInk(p, m.domains)}"`
      + ` title="${esc(p.name)}｜${span}年度（${p.period.start}〜${p.period.end}年度）">${span}</div>`
    return `<div class="grow">${label}${track(bar)}</div>`
  }

  const ranged = m.plans.filter((p) => periodKind(p) === 'range')
  const groups = domainGroups(ranged, m.domains)
    .filter((g) => g.plans.length)
    .map((g) => `<div class="grp">${esc(g.label)}<span>${g.plans.length}件</span></div>\n${g.plans.map(row).join('\n')}`)

  const extra = [
    ['随時修正（期間を定めない）', m.zuiji],
    ['計画期間を確認できていない', m.unclear],
  ].filter(([, ps]) => ps.length)
    .map(([label, ps]) => `<div class="grp">${esc(label)}<span>${ps.length}件</span></div>\n${ps.map(row).join('\n')}`)

  return `<section>
  <div class="hd"><h2>計画期間</h2>
  <p class="sub">${esc(fiscalYearShort(Y0))}年度から${esc(fiscalYearShort(Y1))}年度まで。分野ごとに並べています。
  <strong>期間を持たない${m.zuiji.length + m.unclear.length}件も落とさず、末尾に別のグループとして置いています。</strong>
  ここを落とすと、俯瞰したつもりで3分の1が見えていないことになります。</p></div>
  <div class="tlwrap"><div class="gantt">
${axis()}
${groups.join('\n')}
${extra.join('\n')}
${axis()}
  </div></div>
</section>`
}
```

- [ ] **手順4: テストが通ることを確かめる**

```bash
node --test 2>&1 | tail -12
```

期待: `pass 111` / `fail 0`。

- [ ] **手順5: コミット**

```bash
node tools/build.mjs && git add tools/build.mjs tools/build.test.mjs && git commit -m "計画期間のタイムラインを生成する

2010〜2035年度の26列。分野ごとに並べ、期間を持たない25件は
末尾に別のグループとして置く。落とすと3分の1が見えなくなる。

軸ラベルは5年ごと・両端・現在だけに間引いた。26年ぶんに毎年
ラベルを振ると読めない。

黄と黒の塗りの上は白文字が読めないので、palette.css の
--c7-ink / --c8-ink を使う。"
```

---

## Task 6: 一覧を生成する

**ファイル:**
- 変更: `tools/build.mjs`（`listSection` とラベル定義を追加）
- 変更: `tools/build.test.mjs`

**インタフェース:**
- 消費: `domainGroups(m.plans, m.domains)`、`periodKind`
- 提供: `listSection(m)` -> HTML文字列、`LABELS`（`tier` / `statutory` / `status` / `level` の日本語）

- [ ] **手順1: 失敗するテストを書く**

`tools/build.test.mjs` の import に `listSection` と `LABELS` を足し、
`import { ENUM } from './validate.mjs'` を1行足し、定数に `const list = listSection(model)` を
足したうえで、末尾に次を足します。

```js
test('一覧に76件すべてが行として現れる', () => {
  for (const p of doc.plans) {
    assert.ok(list.includes(esc(p.name)), `一覧に出ていません: ${p.id} ${p.name}`)
  }
  const rows = (list.match(/<tr data-id="/g) ?? []).length
  assert.equal(rows, doc.plans.length, `行数が合いません: ${rows}`)
})

test('domain を持たない9件は末尾の「国・長崎県」の節にある', () => {
  const sections = list.split('<h3').slice(1)
  const last = sections[sections.length - 1]
  assert.ok(last.includes('国・長崎県'), `末尾の節が違います: ${last.slice(0, 60)}`)
  for (const p of doc.plans.filter((x) => x.domain === undefined)) {
    assert.ok(last.includes(esc(p.name)), `末尾の節に無い: ${p.id}`)
  }
})

test('enum はすべて日本語のラベルを持つ', () => {
  // enum に値を足してラベルを忘れると、画面に生の enum（mandatory など）が出る。
  for (const [field, values] of Object.entries(ENUM)) {
    if (!LABELS[field]) continue
    for (const v of values) assert.ok(LABELS[field][v], `${field}: ${v} のラベルがありません`)
  }
})

test('空欄と「調べていない」を区別して出す', () => {
  // data/schema.md「未調査の表し方」を画面にそのまま出す。
  const nodept = doc.plans.filter((p) => p.department === undefined).length
  const nostat = doc.plans.filter((p) => p.statutory === undefined).length
  assert.ok(nodept > 0 && nostat > 0)
  const unknowns = (list.match(/class="unk">未確認</g) ?? []).length
  assert.ok(unknowns >= nodept + nostat, `未確認の表示が足りません: ${unknowns}`)
})

test('url のある計画はリンクになり、無い計画は素のテキストになる', () => {
  const withUrl = doc.plans.find((p) => p.url)
  const without = doc.plans.find((p) => !p.url)
  assert.ok(list.includes(`href="${esc(withUrl.url)}"`))
  assert.ok(without, 'url の無い計画がデータにありません')
  const row = list.split(`<tr data-id="${without.id}"`)[1].split('</tr>')[0]
  assert.equal(row.includes('<a '), false, `url が無いのにリンクになっています: ${without.id}`)
})

test('横に長い表はページ本体ではなく表の中でスクロールする', () => {
  assert.equal((list.match(/class="tblwrap"/g) ?? []).length > 0, true)
})
```

- [ ] **手順2: 失敗を確かめる**

```bash
node --test 2>&1 | tail -20
```

期待: `listSection is not a function` を含む失敗。

- [ ] **手順3: `tools/build.mjs` に一覧を足す**

`PAGE_CSS` の末尾に追加します。

```css
.tblwrap{overflow-x:auto;margin-top:8px}
table.list{border-collapse:collapse;width:100%;min-width:760px;font-size:13px}
table.list th,table.list td{padding:8px 10px;border-bottom:1px solid var(--grid);
  text-align:left;vertical-align:top}
table.list th{font-size:11.5px;letter-spacing:.05em;color:var(--muted);font-weight:600;
  border-bottom:1px solid var(--axis);white-space:nowrap;position:sticky;top:0;background:var(--surface)}
table.list td.per{font-variant-numeric:tabular-nums;white-space:nowrap}
table.list .unk{color:var(--muted)}
table.list h3{margin:0}
.lsec{margin-top:26px}
.lsec h3{font-size:14px;margin:0;display:flex;align-items:center;gap:8px}
.lsec h3 b{font-weight:500;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
```

`buildPage` の配列で `timelineSection(m),` の次に `listSection(m),` を足し、次を追加します。

```js
/** enum を画面に出すときの日本語。値を足したらここも足す（テストが検査します）。 */
export const LABELS = {
  tier: { sougou: '総合計画', bumon: '部門別基本', kobetsu: '個別', jisshi: '実施・行動', shisetsu: '施設・財産' },
  statutory: { mandatory: '策定義務', effort: '努力義務', request: '要請', permissive: 'できる規定', voluntary: '任意' },
  status: { current: '計画期間中', expiring: '満了が近い', expired: '満了済み', planned: '策定予定', unknown: '不明' },
  level: { national: '国', prefectural: '長崎県', municipal: '壱岐市', council: '市社協' },
}

/** 未記載は「未確認」と書く。空欄にすると「無い」と読まれる（data/schema.md「未調査の表し方」）。 */
const cell = (v) => (v === undefined || v === null || v === '' ? '<span class="unk">未確認</span>' : esc(v))

function periodCell(p) {
  const kind = periodKind(p)
  if (kind === 'zuiji') return '随時修正'
  if (kind !== 'range') return '<span class="unk">未確認</span>'
  return `${esc(fiscalYearShort(p.period.start))}〜${esc(fiscalYearShort(p.period.end))}年度`
    + `<br><span class="unk">${p.period.start}〜${p.period.end}年度</span>`
}

export function listSection(m) {
  const row = (p) => {
    const name = p.url
      ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>`
      : esc(p.name)
    return `        <tr data-id="${esc(p.id)}">
          <td><span class="dot" style="background:${colorOf(p, m.domains)};display:inline-block;margin-right:6px"></span>${name}`
      + `${p.todo ? '<span class="todo" title="未調査の項目があります">未</span>' : ''}</td>
          <td class="per">${periodCell(p)}</td>
          <td>${cell(LABELS.tier[p.tier])}</td>
          <td>${cell(LABELS.statutory[p.statutory])}</td>
          <td>${cell(p.department)}</td>
          <td>${cell(LABELS.status[p.status])}</td>
        </tr>`
  }

  const groups = domainGroups(m.plans, m.domains)
    .filter((g) => g.plans.length)
    .map((g) => `  <div class="lsec">
    <h3>${esc(g.label)}<b>${g.plans.length}件</b></h3>
    <div class="tblwrap"><table class="list">
      <thead><tr><th>計画名</th><th>計画期間</th><th>階層</th><th>法定性</th><th>所管</th><th>状態</th></tr></thead>
      <tbody>
${g.plans.map(row).join('\n')}
      </tbody>
    </table></div>
  </div>`).join('\n')

  return `<section>
  <div class="hd"><h2>一覧</h2>
  <p class="sub">分野ごとに分けています。<strong>「未確認」は、そこに何も無いという意味ではなく、まだ調べていないという意味です。</strong>
  空欄と区別できるように書き分けています。計画名のリンク先は市・県の公表ページです。</p></div>
${groups}
</section>`
}
```

- [ ] **手順4: テストが通ることを確かめる**

```bash
node --test 2>&1 | tail -12
```

期待: `pass 117` / `fail 0`。

- [ ] **手順5: コミット**

```bash
node tools/build.mjs && git add tools/build.mjs tools/build.test.mjs && git commit -m "分野ごとの一覧を生成する

未記載は空欄ではなく「未確認」と書く。空欄にすると「無い」と
読まれる。data/schema.md の未調査の表し方を画面にそのまま出す。

enum に日本語ラベルが揃っているかをテストで検査する。
値を足してラベルを忘れると画面に生の enum が出るため。"
```

---

## Task 7: 生成物をコミットし、CI と導線をつなぐ

**ファイル:**
- 作成: `plans/all/index.html`（生成物）
- 作成: `.github/workflows/build.yml`
- 変更: `index.html`（ハブに導線）
- 変更: `tools/build.test.mjs`（`test.skip` を `test` に戻す）

**インタフェース:**
- 消費: Task 3〜6の `tools/build.mjs`
- 提供: 公開URL `https://keikaku.ikilab.org/plans/all/`

- [ ] **手順1: 生成して、目で確かめる**

```bash
node tools/build.mjs && node tools/validate.mjs --fail-on-error && node --test 2>&1 | tail -6
```

期待: 生成の成功、validate の error 0件、テスト全通。

正規表現で YAML を数えると数え漏れるので、パーサを通して確かめます。

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs'
import { parseYaml } from './tools/yaml.mjs'
const doc = parseYaml(readFileSync('data/plans.yml', 'utf8'))
const s = readFileSync('plans/all/index.html', 'utf8')
const missing = doc.plans.filter((p) => !s.includes('data-id=\"' + p.id + '\"'))
console.log('バイト数', s.length)
console.log('一覧の行', doc.plans.length - missing.length, '/', doc.plans.length, missing.map((p) => p.id).join(','))
console.log('script ブロック', (s.match(/<script/g) || []).length)
"
```

期待: `一覧の行 76 / 76`、`script ブロック 1`。

- [ ] **手順2: ブラウザで3つの表示状態を確かめる**

```bash
python3 -m http.server 8765 --directory . > /dev/null 2>&1 &
echo "http://localhost:8765/plans/all/ を開いてください"
```

次を目で確認します。確認したら `kill %1` でサーバを止めます。

- ライト（OS がライト）で、黄（防災・安全）と黒（生活環境）の帯の文字が読めること
- ダーク（OS がダーク）で、黒の分野が明るいグレーになり地に沈んでいないこと
- 「◐ 表示切替」を押すと、OS の設定と逆の表示に切り替わり、どちらでも色が破綻しないこと
- 横幅を狭めたとき、**ページ本体が横スクロールせず**、タイムラインと表だけが中でスクロールすること

- [ ] **手順3: `--check` の検査を `tools/build.test.mjs` に足す**

`plans/all/index.html` ができたので、ここで書けるようになります。末尾に次を足します。

```js
test('--check は生成物が最新なら 0、古ければ 1 を返す', () => {
  const r = execFileSync('node', [script, '--check'], { encoding: 'utf8' })
  assert.match(r, /一致しています/)
})

test('--check は生成物が古いと exit 1 で落ちる', () => {
  // plans.yml を変えたのに生成し忘れた、を CI が拾えることの確認。
  const out = fileURLToPath(new URL('../plans/all/index.html', import.meta.url))
  const saved = readFileSync(out, 'utf8')
  writeFileSync(out, saved.replace('</html>', '<!-- わざと古くする --></html>'))
  try {
    assert.throws(() => execFileSync('node', [script, '--check'], { stdio: 'pipe' }))
  } finally {
    writeFileSync(out, saved)
  }
})
```

import に `writeFileSync` を足します: `import { readFileSync, writeFileSync } from 'node:fs'`

```bash
node --test 2>&1 | tail -8
```

期待: `pass 119` / `fail 0` / `skipped 0`。

- [ ] **手順4: `.github/workflows/build.yml` を書く**

```yaml
name: 俯瞰ページの生成漏れチェック

on:
  push:
    paths:
      - 'data/plans.yml'
      - 'tools/**'
      - 'assets/palette.css'
      - 'plans/all/index.html'
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      # 依存のインストールはしない。ツールは外部依存なしで動く
      - name: 単体テスト
        run: node --test

      - name: データの検査
        run: node tools/validate.mjs --fail-on-error

      # data/plans.yml を変えたのに plans/all/index.html を生成し忘れると、ここで落ちる
      - name: 生成物が最新か検査
        run: node tools/build.mjs --check
```

- [ ] **手順5: ハブページに導線を足す**

`index.html` の `<h2>公開中のマップ</h2>` の直後、`<div class="cards">` の**最初のカードとして**
次を挿入します（`plans/fukushi/` のカードの手前）。

```html
  <a class="card" href="plans/all/">
    <div class="k">全分野</div>
    <h3>壱岐市の全計画 76件の俯瞰</h3>
    <p>市が公表している行政計画76件（市66・社会福祉協議会1・長崎県9）を、位置づけの階層・計画期間・分野別の一覧で俯瞰します。分野ごとの掘り下げは各ページに譲り、ここでは全体の構造だけを示します。構造化データから自動生成しています。</p>
    <div class="tags">
      <span class="tag"><i class="dot" style="background:var(--c1)"></i>健康・福祉 17</span>
      <span class="tag"><i class="dot" style="background:var(--c2)"></i>都市基盤・交通 13</span>
      <span class="tag"><i class="dot" style="background:var(--c3)"></i>産業・雇用 9</span>
      <span class="tag"><i class="dot" style="background:var(--c4)"></i>市政総論 8</span>
      <span class="tag">ほか4分野</span>
    </div>
  </a>

```

さらに `<h2>これから増やすもの</h2>` の直後の `<p class="sub">` を次に差し替えます。

```html
<p class="sub">全体の俯瞰ができたので、次は分野ごとの掘り下げを増やしていきます。優先順位はこう考えています。</p>
```

- [ ] **手順6: コミット**

```bash
git add plans/all/index.html .github/workflows/build.yml index.html tools/build.test.mjs && git commit -m "俯瞰ページを公開し、生成漏れをCIで検出する

plans/all/index.html をコミットする。GitHub Pages にビルド工程を
入れずに済み、計画を1本足したときに図がどう変わるかが差分で
レビューできる。

CI は --check で「plans.yml を変えたのに生成し忘れた」を拾う。
古いときに exit 1 になることをテストでも確かめている。"
```

---

## Task 8: 既存ページを共通配色に載せ替える

**ファイル:**
- 変更: `index.html` / `plans/fukushi/index.html` / `plans/kaigo-7-9/index.html`
- 変更: `README.md` / `CHANGELOG.md`

**インタフェース:**
- 消費: `assets/palette.css`（Task 1）

**注意:** 既存ページの**図と本文は手書きのまま残します。差し替えるのは配色だけです**（設計 2）。

- [ ] **手順1: 3ページの `--cN` の定義を消し、`palette.css` を読ませる**

各ファイルの `:root{…}` / `:root[data-theme="dark"]{…}` /
`@media (prefers-color-scheme: dark){ :root:not(…){…} }` の3か所から、
**`--c` で始まる変数の行だけ**を削除します（`index.html` と `plans/fukushi/` は `--c1`〜`--c7`、
`plans/kaigo-7-9/` は `--c1`〜`--c3`）。他の変数（`--page` `--ink` `--warn` など）は残します。

`plans/kaigo-7-9/index.html` の `--dpos` は、旧 `--c1`（`#2a78d6` / dark `#3987e5`）と
同じ値を書き写したものです。**両方の状態で `--dpos:var(--c1);` に差し替えてください。**
残すと、青が2種類ある状態になります。

そのうえで、各ファイルの `<style>` の**直前**に次を挿入します。

| ファイル | 挿入する行 |
|---|---|
| `index.html` | `<link rel="stylesheet" href="assets/palette.css">` |
| `plans/fukushi/index.html` | `<link rel="stylesheet" href="../../assets/palette.css">` |
| `plans/kaigo-7-9/index.html` | `<link rel="stylesheet" href="../../assets/palette.css">` |

- [ ] **手順2: 黄（`--c7`）を使っている箇所を避ける**

**既存ページは `category`（小分類）で塗り分け、俯瞰ページは `domain`（大分類）で塗り分けます。**
同じ `--cN` が別のものを指しますが、これは2階層に分けた帰結です（設計 5.4）。
**各ページの凡例がその色は何を指すかを言っているので、対応がずれることはありません。**

直すのは**黄（`--c7`）を使っている2か所だけ**です。黄は明るいので、
細い点や白抜き文字の帯に使うと見えません。

`plans/fukushi/index.html` の `CAT` を次にします（`--c7` を使わない割り当てにする）。
`n:` の文字列は変えません。

```js
const CAT={
  chiiki:{c:'var(--c1)',n:'地域福祉（総論・横断）'},
  shogai:{c:'var(--c2)',n:'障がい福祉'},
  korei :{c:'var(--c3)',n:'高齢者・介護'},
  kodomo:{c:'var(--c4)',n:'こども・子育て'},
  iryo  :{c:'var(--c5)',n:'医療保険・保健事業'},
  kenko :{c:'var(--c6)',n:'健康づくり・自殺対策'},
  other :{c:'var(--muted)',n:'上位・関連行政計画'}
};
```

同じファイルの `.tier.top2` は `var(--c7)` を枠線に使っています。枠線なら黄でも見えますが、
`CAT.other` が `--muted` になったので、**`.tier.top2` も `var(--muted)` に揃えます**
（どちらも「上位・関連行政計画」を指しているため）。

```bash
grep -n 'var(--c7)' plans/fukushi/index.html index.html
```

`index.html` のほうは福祉カードの「上位計画」タグの点です。`var(--c7)` を `var(--muted)` にします。

`plans/kaigo-7-9/index.html` は `--c1`〜`--c3` だけを使っています。**こちらは変更不要です。**

- [ ] **手順3: 3つの表示状態で確かめる**

```bash
python3 -m http.server 8765 --directory . > /dev/null 2>&1 &
echo "http://localhost:8765/ / /plans/fukushi/ / /plans/kaigo-7-9/ を開いてください"
```

- 3ページとも、凡例の点と図の色が一致していること
- ライト・ダーク・切替後のいずれでも、隣り合う分野の色が区別できること
- `plans/fukushi/` の体系図で、`--c1` を使う枠線と薄い塗り（`.tier.hub` の
  `color-mix(in srgb,var(--c1) 7%,var(--page))`）が破綻していないこと
- `plans/kaigo-7-9/` の増減グラフ（`--dpos` / `--dneg`）で、正の側が新しい青になっていること

確認したら `kill %1` でサーバを止めます。

- [ ] **手順4: `README.md` を更新する**

「リポジトリの構成」のツリーに `all/` と `palette.css` を足します。

```
├── plans/                  分野ごとのマップ（1ディレクトリ＝1ページ、単一HTML）
│   ├── all/                ★ 全計画の俯瞰（data/plans.yml から生成）
│   ├── fukushi/
│   └── kaigo-7-9/
├── assets/
│   └── palette.css         配色（CUD 8色）。色の値を持つ唯一の場所
```

「いま時点で YAML を読んでいるのは次の4つです」の段落と、その下のコマンド一覧を差し替えます。

````markdown
いま時点で YAML を読んでいるのは次の5つです。CIで回るのは `linkcheck`（週次）・`expiring`（月次）・
`build --check` と `validate`（`data/plans.yml` などへの push 時）です。
`manifest` は手動での実行です。

```bash
node tools/build.mjs                      # plans/all/index.html を生成（生成物はコミットする）
node tools/build.mjs --check              # 生成し忘れを検出（CIが実行）
node tools/linkcheck.mjs                  # 出典URLの死活を確認（週次でCIが実行）
node tools/expiring.mjs                   # 満了・パブコメが近い計画を検出（月次でCIが実行）
node tools/validate.mjs --fail-on-error   # 参照整合・enum・骨格を検査（error 0件が必須）
node tools/manifest.mjs                   # 出典台帳（sources/MANIFEST.md）の未登録を検出
```
````

「現時点では HTML は手書きですが、**フェーズ2としてこの YAML から図表を生成する**設計にしてあります」
を次に差し替えます。

```markdown
`plans/all/` はこの YAML から生成しています。分野別ページ（`plans/fukushi/` `plans/kaigo-7-9/`）は
手書きのままです。生成物は網羅的で常に最新な代わりに記述が薄くなるので、
**俯瞰は生成、掘り下げは手書き**と役割を分けています。
```

「## フェーズ2: YAML から図表を生成する」の節に、第2段階の完了を書きます。

```markdown
### 第2段階（完了）: 全計画の俯瞰ページを生成する

`tools/build.mjs` が `data/plans.yml` から `plans/all/index.html` を生成します。
設計は [`docs/design/2026-08-13-zenkeikaku-zuhyou.md`](docs/design/2026-08-13-zenkeikaku-zuhyou.md)、
実装計画は [`docs/design/2026-08-13-zenkeikaku-zuhyou-plan.md`](docs/design/2026-08-13-zenkeikaku-zuhyou-plan.md)。

生成物はリポジトリにコミットします。GitHub Pages にビルド工程を入れずに済み、
計画を1本足したときに図がどう変わるかが差分でレビューできるためです。
`data/plans.yml` を変えたのに生成し忘れると、CI の `build --check` が落ちます。
```

- [ ] **手順5: `CHANGELOG.md` に追記する**

先頭の `## 2026-08-13` の節に、次の項を足します（既存の項は消しません）。

```markdown
### 追加（全計画の俯瞰ページ）
- **`plans/all/`（全計画76件の俯瞰ページ）を新設し、`data/plans.yml` から生成するようにした。**
  `tools/build.mjs` が体系図（`tier` の帯・`domain` で塗り分け）・計画期間のタイムライン
  （2010〜2035年度）・分野別の一覧を生成する。生成物はリポジトリにコミットし、
  `node tools/build.mjs --check` で生成漏れをCIが検出する
- **期間を持たない25件（随時修正7・未確認18）と `tier` の無い1件を、専用の帯・グループに分けて表示する。**
  落とすと俯瞰したつもりで3分の1が見えなくなるため。`todo` の29件には印を付け、
  空欄と「調べていない」を読み手が区別できるようにした
- **個々の計画のあいだに線は引かず、関係の本数を表で示すことにした。** `parent` は8本、
  `conforms_to` は2本しかなく、線にするとほとんどの計画が孤立して見える。
  これは関係が無いのではなく調査が進んでいないことを表すため、分母を添えた本数で出している
- **配色を Color Universal Design の推奨配色（8色）に統一し、`assets/palette.css` に集約した。**
  既存3ページは7色を各ファイルに重複して持っていて、`data/schema.md` の記述とも一致していなかった。
  黒は CUD の並びでは先頭だが、`slot` が件数の多い順なので最大の分野が本文と同じ色になる。
  末尾の slot 8 に回している
- `tools/view-model.mjs` を新設し、分類の規則をHTMLの組み立てから分けた。
  タグの中を読まずに「どの計画がどの帯に入るか」を検証できるようにするため
- `tools/fiscal-year.mjs` に軸ラベル用の `fiscalYearShort` を足した
```

- [ ] **手順6: すべての検査を通す**

```bash
node --test 2>&1 | tail -6 && node tools/validate.mjs --fail-on-error && node tools/build.mjs --check && node tools/manifest.mjs | tail -3
```

期待: テスト全通、validate の error 0件、`--check` が「一致しています」、manifest の未登録 0件。

- [ ] **手順7: コミット**

```bash
git add index.html plans/fukushi/index.html plans/kaigo-7-9/index.html README.md CHANGELOG.md && git commit -m "既存3ページを共通配色に載せ替える

各ファイルが持っていた --c1〜--c7 の定義を消し、assets/palette.css を
読ませる。図と本文は手書きのまま残し、差し替えたのは配色だけ。

ハブの上位計画タグは黄（--c7）だった。8pxの点として白地に置くと
見えないので紫赤（--c5）にした。"
```

---

## 完了の判定

設計「9. 完了の判定」と対応します。すべてリポジトリ直下で実行します。

```bash
node tools/build.mjs && node tools/build.mjs --check   # 1
node --test                                            # 2
node tools/validate.mjs --fail-on-error                # 4
node tools/expiring.mjs > /dev/null                    # 4
node tools/manifest.mjs                                # 4
node tools/linkcheck.mjs                               # 4
```

| # | 判定 | 確かめ方 |
|---|---|---|
| 1 | 生成できて `--check` が exit 0 | 上のコマンド |
| 2 | `node --test` が通る（既存71件＋今回48件） | 上のコマンド |
| 3 | **76件すべてが現れ、期間を持たない25件も帯に表示されている** | Task 4・5・6のテスト |
| 4 | 既存4ツールが現状のまま通る | 上のコマンド。linkcheck は中小企業庁の1件が既知（HTTP 202・本文0バイト）|
| 5 | 俯瞰ページと既存3ページが同じ `assets/palette.css` を読む | `grep -rl "assets/palette.css" index.html plans/` が3ファイル＋1 |
| 6 | **`<script>` はテーマ切替だけで、計画のデータを含まない** | Task 3のテスト |
| 7 | ライト・ダーク・システム既定の3状態で色が破綻せず読める | Task 7手順2・Task 8手順3（目視）|

---

## この計画でやらないこと

設計「8. やらないこと」と同じです。

- 絞り込み・並べ替えの機能（JSが要る）
- 既存ページの図そのものの置き換え（配色だけ差し替える）
- 分野別ページの新設
- `todo` 29件の深掘り（データ側の作業）
- 俯瞰ページ用のOGP画像の生成（`assets/og.png` を流用する）
- **手書き2ページの帯の文字色の見直し。** `plans/fukushi/` と `plans/kaigo-7-9/` の `.bar` は
  塗りの上に白文字を置く作りで、中間の明るさの色（旧 `--c4:#eda100` など）では
  もともとコントラストが足りていません。CUD への差し替えでこの性質は変わりませんが、
  **良くもなりません。** 帯の中の文字は同じ内容が表にも出ている冗長な表示なので、
  これらのページの図を生成に移す段階（設計 8）でまとめて直します。
  俯瞰ページのほうは `--c7-ink` / `--c8-ink` で対処済みです
