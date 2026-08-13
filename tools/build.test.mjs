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
