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

// --- permissive（許容規定） -------------------------------------------------
// 次世代育成支援対策推進法8条1項「策定することができる」の型。Task 9 で追加。

test('statutory: permissive を enum として受け入れる', () => {
  // 未定義の値を指定したときのメッセージに、許容される値の一覧が並ぶ。
  // permissive がその一覧に含まれていることを確認する（順序も含めて具体的な値を見る）。
  const invalid = errorsOf(doc([{ id: 'a', statutory: 'kyoyou' }]))
  assert.match(invalid[0].message, /statutory: kyoyou は未定義の値です（mandatory \/ effort \/ request \/ permissive \/ voluntary）/)

  // permissive 自体を指定した場合はこのエラーが出ない
  const valid = errorsOf(doc([{ id: 'a', statutory: 'permissive' }]))
  assert.equal(valid.length, 0)
})

test('laws に request と permissive が混在すると集約値は request になる', () => {
  // statutory をわざと voluntary にして、集約結果が何であるかをエラーメッセージで確認する
  const d = doc([{ id: 'a', statutory: 'voluntary', laws: [
    { law: '介護保険法117条', obligation: 'request' },
    { law: '次世代育成支援対策推進法8条1項', obligation: 'permissive' },
  ] }])
  assert.match(errorsOf(d)[0].message, /voluntary は laws の最も強い義務（request）と一致しません/)
})

test('laws に permissive と voluntary が混在すると集約値は permissive になる', () => {
  const d = doc([{ id: 'a', statutory: 'voluntary', laws: [
    { law: '次世代育成支援対策推進法8条1項', obligation: 'permissive' },
    { law: 'X法', obligation: 'voluntary' },
  ] }])
  assert.match(errorsOf(d)[0].message, /voluntary は laws の最も強い義務（permissive）と一致しません/)
})
