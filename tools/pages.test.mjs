/**
 * 公開しているHTMLページの骨格を検査する。
 *
 * plans/all/ 以外のページは手書きなので、head の定型（title・canonical・OGP）が
 * 崩れても CI は何も言わなかった。実際 plans/all/ は og:image の width / height / alt が
 * 抜けたまま公開されていた（他の4ページには入っていた）。
 * ページを1枚足したときに、この定型から外れていないかを機械的に見るためのテスト。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SITE = 'https://keikaku.ikilab.org'
const SUFFIX = ' | 壱岐市 計画マップ'

// 決め打ちのリストにすると、ページを足したときにテストへの追加を忘れる。
// plans/ と about/ の直下を走査して、公開しているページを取りこぼさずに拾う。
function findPages() {
  const found = [{ file: 'index.html', path: '/' }]
  for (const parent of ['plans', 'about']) {
    for (const d of readdirSync(join(ROOT, parent), { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const file = `${parent}/${d.name}/index.html`
      if (existsSync(join(ROOT, file))) found.push({ file, path: `/${parent}/${d.name}/` })
    }
  }
  return found
}

const PAGES = findPages()
const read = (f) => readFileSync(join(ROOT, f), 'utf8')
const html = new Map(PAGES.map((p) => [p.file, read(p.file)]))
const HUB = html.get('index.html')

// property / name のどちらの書き方でも引く。無ければ undefined。
const meta = (src, key) =>
  new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`).exec(src)?.[1]
const title = (src) => /<title>([^<]*)<\/title>/.exec(src)?.[1]
// 「/plans/all/」なら「../../」。palette.css への相対の深さ。
const upTo = (path) => '../'.repeat(path.split('/').filter(Boolean).length)

test('公開しているページを走査できている', () => {
  // ここが空だと、以下のループが素通りして全部通ってしまう。
  assert.ok(PAGES.length >= 5, `見つかったページが少なすぎます: ${PAGES.map((p) => p.file).join(' ')}`)
  assert.ok(PAGES.some((p) => p.file === 'plans/all/index.html'))
})

test('どのページも日本語のHTMLとして宣言されている', () => {
  for (const { file } of PAGES) {
    const src = html.get(file)
    assert.match(src, /<html lang="ja">/, `${file}: <html lang="ja"> がありません`)
    assert.match(src, /<meta charset="utf-8">/, `${file}: charset がありません`)
    assert.match(src, /<meta name="viewport"/, `${file}: viewport がありません`)
  }
})

test('title はハブが「壱岐市 計画マップ」、ほかは「… | 壱岐市 計画マップ」', () => {
  // 検索結果とタブに出る唯一の手がかり。サイト名を落とすとページ単体で迷子になる。
  for (const { file, path } of PAGES) {
    const t = title(html.get(file))
    assert.ok(t, `${file}: <title> がありません`)
    if (path === '/') {
      assert.equal(t, '壱岐市 計画マップ')
    } else {
      assert.ok(t.endsWith(SUFFIX), `${file}: title が「${SUFFIX}」で終わっていません: ${t}`)
      assert.ok(t.length > SUFFIX.length, `${file}: title がサイト名だけです`)
    }
  }
})

test('canonical と og:url が自分のパスを指している', () => {
  // コピーして作ると前のページのURLが残る。末尾スラッシュ形（index.html を書かない）でそろえる。
  for (const { file, path } of PAGES) {
    const src = html.get(file)
    const want = SITE + path
    assert.equal(/<link rel="canonical" href="([^"]*)">/.exec(src)?.[1], want, `${file}: canonical`)
    assert.equal(meta(src, 'og:url'), want, `${file}: og:url`)
  }
})

test('og:type はハブが website、ほかは article', () => {
  for (const { file, path } of PAGES) {
    assert.equal(meta(html.get(file), 'og:type'), path === '/' ? 'website' : 'article', `${file}: og:type`)
  }
})

test('説明文とOGPの定型がそろっている', () => {
  for (const { file } of PAGES) {
    const src = html.get(file)
    for (const key of ['description', 'og:title', 'og:description']) {
      assert.ok(meta(src, key), `${file}: ${key} がありません`)
    }
    assert.equal(meta(src, 'og:site_name'), '壱岐市 計画マップ', `${file}: og:site_name`)
    assert.equal(meta(src, 'og:locale'), 'ja_JP', `${file}: og:locale`)
    assert.equal(meta(src, 'twitter:card'), 'summary_large_image', `${file}: twitter:card`)
  }
})

test('og:image が実在し、寸法と代替テキストが付いている', () => {
  // 寸法が無いとSNS側が小さいカードで出すことがある。alt はリンクを読み上げたときの唯一の説明。
  for (const { file } of PAGES) {
    const src = html.get(file)
    const img = meta(src, 'og:image')
    assert.ok(img?.startsWith(SITE + '/assets/'), `${file}: og:image が絶対URLではありません: ${img}`)
    const asset = img.slice(SITE.length + 1)
    assert.ok(existsSync(join(ROOT, asset)), `${file}: og:image のファイルがありません: ${asset}`)
    assert.equal(meta(src, 'og:image:width'), '1200', `${file}: og:image:width`)
    assert.equal(meta(src, 'og:image:height'), '630', `${file}: og:image:height`)
    assert.ok(meta(src, 'og:image:alt'), `${file}: og:image:alt がありません`)
    assert.equal(meta(src, 'twitter:image'), img, `${file}: twitter:image が og:image と違います`)
  }
})

test('配色は assets/palette.css からだけ読む', () => {
  // 色の値を持つ場所は palette.css の1か所（data/schema.md）。
  // ページ側で --c1 などを定義し直すと、そこだけ配色の検証から外れる。
  for (const { file, path } of PAGES) {
    const src = html.get(file)
    assert.ok(
      src.includes(`<link rel="stylesheet" href="${upTo(path)}assets/palette.css">`),
      `${file}: palette.css を ${upTo(path)}assets/palette.css で読んでいません`,
    )
    const dup = src.match(/^\s*--c[1-8](-ink)?\s*:/gm) ?? []
    assert.equal(dup.length, 0, `${file}: ページ側で分野色を定義しています: ${dup.join(' ')}`)
  }
})

test('どのページもハブからリンクされている', () => {
  // どこからも辿れないページは、公開しても無いのと同じ。
  for (const { file, path } of PAGES) {
    if (path === '/') continue
    assert.ok(HUB.includes(`href="${path.slice(1)}"`), `${file}: index.html からリンクされていません`)
  }
})
