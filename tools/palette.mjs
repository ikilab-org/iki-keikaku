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

/**
 * WCAG の相対輝度・対比比。
 * palette.test.mjs（分野色）と build.test.mjs（--muted）の両方が
 * コントラスト検査に使うので、色の値と同じくここに1か所だけ置く。
 */
export const luminance = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
