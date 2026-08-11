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
