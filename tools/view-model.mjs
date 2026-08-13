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
