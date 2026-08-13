import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { fiscalYearLabel, fiscalYearShort } from './fiscal-year.mjs'

// expiring.mjs は全体がトップレベルのスクリプトで、import すると実行されます。
// そこで CLI として動かし、出力を検証します。
const script = fileURLToPath(new URL('./expiring.mjs', import.meta.url))
const run = (...args) => execFileSync('node', [script, ...args], { encoding: 'utf8' })

const TODAY = ['--today', '2026-08-12']

test('元号の換算が負の年を出さない', () => {
  const out = run(...TODAY)
  assert.equal(/令和-\d/.test(out), false, `負の令和年が出ています:\n${out}`)
  assert.equal(/平成-\d/.test(out), false, `負の平成年が出ています:\n${out}`)
  assert.equal(/昭和-\d/.test(out), false, `負の昭和年が出ています:\n${out}`)
})

test('元号の換算が改元をまたいでも正しい', () => {
  // 令和固定だと平成以前が「令和-4年度」のような負の年になる。
  // 現在のデータには出力に現れる平成の年度が無いため、関数を直接検証する。
  assert.equal(fiscalYearLabel(2026), '令和8年度（2026年度）')
  assert.equal(fiscalYearLabel(2019), '令和1年度（2019年度）')
  assert.equal(fiscalYearLabel(2018), '平成30年度（2018年度）')
  assert.equal(fiscalYearLabel(2014), '平成26年度（2014年度）')
  assert.equal(fiscalYearLabel(1989), '平成1年度（1989年度）')
  assert.equal(fiscalYearLabel(1988), '昭和63年度（1988年度）')
})

test('満了が近い計画に、残り月数が負のものが混ざらない', () => {
  const out = run(...TODAY)
  const section = out.split('## 満了が近い計画')[1]?.split('##')[0] ?? ''
  assert.equal(/あと-\d+か月/.test(section), false, `満了済みが混ざっています:\n${section}`)
})

test('status: expired の計画は満了の追跡から外れる', () => {
  const { soon, overdue } = JSON.parse(run('--json', ...TODAY))
  const expired = [...soon, ...overdue].filter((p) => p.status === 'expired')
  assert.deepEqual(expired, [], 'expired が soon / overdue に入っています')
})

test('未調査の項目は todo のあるものだけを拾う', () => {
  const { todos } = JSON.parse(run('--json', ...TODAY))
  assert.ok(todos.length > 0, 'todo が1件も拾えていません')
  assert.equal(todos.every((p) => p.todo === true), true)
})

test('軸ラベル用の短い元号表記', () => {
  // 図の軸に「令和8年度（2026年度）」は長すぎる。年度の判定の仕方は fiscalYearLabel と同じ。
  assert.equal(fiscalYearShort(2026), '令和8')
  assert.equal(fiscalYearShort(2019), '令和1')
  assert.equal(fiscalYearShort(2018), '平成30')
  assert.equal(fiscalYearShort(1988), '昭和63')
})
