import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml } from './yaml.mjs'
import {
  BANDS, RELATIONS, bandOf, bandGroups, periodKind, yearRange, overrunPlans, AXIS_MIN_PLANS,
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
  // 落とすと「全件が現れる」が崩れ、未調査が見えなくなる。
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

test('期間を持たない計画が実データで24件ある', () => {
  const kinds = PLANS.map(periodKind)
  const notRange = kinds.filter((k) => k !== 'range').length
  assert.equal(notRange, 24, `期間を持たない計画の件数が変わりました: ${notRange}`)
  assert.equal(kinds.filter((k) => k === 'zuiji').length, 7)
  assert.equal(kinds.filter((k) => k === 'unknown').length, 17)
})

test('年度の範囲は range の計画だけから決める', () => {
  assert.equal(yearRange([{}]), null)
  assert.equal(yearRange([{ period: { start: null, end: null } }, {}]), null)
})

test('軸の終端は、2件以上が及ぶ最後の年度で切る', () => {
  // 長期の計画が1本あるだけで軸が倍に伸び、他の帯が潰れるのを避ける。
  // 実データ: 2035年度は3件、2036年度以降は公共施設等総合管理計画の1件だけ。
  assert.equal(AXIS_MIN_PLANS, 2)
  assert.deepEqual(yearRange(PLANS), { start: 2010, end: 2035 })

  // 重なっているうちは切らない。
  assert.deepEqual(
    yearRange([{ period: { start: 2015, end: 2020 } }, { period: { start: 2016, end: 2020 } }]),
    { start: 2015, end: 2020 },
  )
  // 1本だけ突き出しているときは、そこで切る。
  assert.deepEqual(
    yearRange([{ period: { start: 2015, end: 2020 } }, { period: { start: 2016, end: 2050 } }]),
    { start: 2015, end: 2020 },
  )
  // 重なりがどこにも無いデータでは切らない。切ると軸が1列に潰れる。
  assert.deepEqual(
    yearRange([{ period: { start: 2010, end: 2012 } }, { period: { start: 2050, end: 2052 } }]),
    { start: 2010, end: 2052 },
  )
  assert.deepEqual(yearRange([{ period: { start: 2015, end: 2020 } }]), { start: 2015, end: 2020 })
})

test('軸の先まで続く計画は overrun に拾う。落とさない', () => {
  const years = yearRange(PLANS)
  const over = overrunPlans(PLANS, years)
  assert.equal(over.length, 1)
  assert.equal(over[0].id, 'kokyoshisetsu-sougou')
  assert.ok(over[0].period.end > years.end)
  // 軸に収まる計画は拾わない。
  assert.equal(overrunPlans([{ period: { start: 2015, end: 2020 } }], years).length, 0)
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
  assert.equal(related.edges, 28)
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
  assert.equal(m.plans.length, PLANS.length)
  assert.equal(m.bands.length, BANDS.length)
  assert.deepEqual(m.years, { start: 2010, end: 2035 })
  assert.equal(m.overrun.length, 1)
  assert.equal(m.relations.length, RELATIONS.length)
  assert.equal(m.todoCount, 29)
  assert.equal(m.meta.updated, doc.meta.updated)
})
