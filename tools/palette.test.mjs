import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cssBlocks, readPalette, contrast } from './palette.mjs'
import { parseYaml } from './yaml.mjs'

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
  // palette.css の中だけを数えても domains は増えないので、plans.yml と突き合わせる。
  const { slots } = readPalette()
  const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
  for (const [key, def] of Object.entries(doc.domains)) {
    assert.ok(slots[def.slot], `domains.${key} の slot ${def.slot} に色がありません`)
  }
})

test('塗りの上の文字が、どの状態でも 4.5:1 を満たす', () => {
  // CUD の8色は、白文字を置けるものと置けないものが混ざっている。
  // slot ごとに ink を持たせているのはそのため。ここが崩れると図の中の文字が読めなくなる。
  const { blocks } = readPalette()
  for (const b of blocks) {
    for (let i = 1; i <= 8; i++) {
      const fill = b.vars[`--c${i}`]
      const ink = b.vars[`--c${i}-ink`]
      assert.ok(ink, `${b.sel} に --c${i}-ink がありません`)
      const r = contrast(fill, ink)
      assert.ok(r >= 4.5, `${b.sel} の --c${i}（${fill}）と --c${i}-ink（${ink}）は ${r.toFixed(2)}:1 しかありません`)
    }
  }
})
