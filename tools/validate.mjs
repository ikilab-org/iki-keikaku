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
