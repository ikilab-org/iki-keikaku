import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'
import { buildModel } from './view-model.mjs'
import { esc, buildPage, taikeiSection, timelineSection } from './build.mjs'
import { fiscalYearShort } from './fiscal-year.mjs'

// Task 4〜6では、この import に taikeiSection / timelineSection / listSection を足し、
// 下の定数に対応する行を1行ずつ足していきます。
const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
const model = buildModel(doc)
const html = buildPage(doc)
const taikei = taikeiSection(model)
const timeline = timelineSection(model)
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

test('タイムラインに76件すべてが現れる', () => {
  for (const p of doc.plans) {
    assert.ok(timeline.includes(esc(p.name)), `タイムラインに出ていません: ${p.id} ${p.name}`)
  }
})

// グループの見出しで区切り、ラベルで始まる断片をそのグループとみなす。
// 本文の言葉を検索して区間を切ると、帯の中に同じ語が出たときに区間が縮む。
const timelineGroup = (label) =>
  timeline.split('<div class="grp">').find((s) => s.startsWith(esc(label))) ?? ''

test('期間を持たない25件が専用のグループにある', () => {
  // ここを落とすと、俯瞰したつもりで3分の1が見えていないことになる（設計 3.2）。
  const zuiji = timelineGroup('随時修正（期間を定めない）')
  assert.ok(zuiji, '「随時修正」のグループが見つかりません')
  for (const p of model.zuiji) assert.ok(zuiji.includes(esc(p.name)), `随時修正のグループに無い: ${p.id}`)

  const unclear = timelineGroup('計画期間を確認できていない')
  assert.ok(unclear, '「計画期間を確認できていない」のグループが見つかりません')
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
