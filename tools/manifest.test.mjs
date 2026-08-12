import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findUnregistered, extractSources, extractRegisteredUrls, buildAppendedManifest } from './manifest.mjs'

/**
 * sources/MANIFEST.md の構造を模した最小フィクスチャ。
 * 実物と同じ見出し・列構成・「ベースURL:」行を持たせ、テストごとに行だけ差し替える。
 */
function buildManifestText({ iki = [], nagasaki = [], national = [], expired = [], expiredRaw = [] } = {}) {
  const ikiRows = iki.map((u) => `| 資料 | \`${u}\` | 高 | 2026-08-01 | ― | ― |`).join('\n')
  const nagasakiRows = nagasaki.map((u) => `| 資料 | \`${u}\` | 高 | 2026-08-01 |`).join('\n')
  const nationalRows = national.map((u) => `| 資料 | \`${u}\` | 高 | 2026-08-01 |`).join('\n')
  // expired: 旧URL列だけを機械的に埋める簡易版。expiredRaw: 代替欄の中身まで自分で書く行（そのまま挿入）。
  const expiredRows = [
    ...expired.map((u) => `| 資料 | \`${u}\` | 2026-08-01 | 代替なし |`),
    ...expiredRaw,
  ].join('\n')
  return `# 出典台帳

方針は [\`POLICY.md\`](POLICY.md) を参照。

最終一括確認: 2026-08-01（\`node tools/linkcheck.mjs\`）

## 壱岐市

| 資料 | URL | 残存性 | 最終確認 | 保存 | 参照箇所 |
|---|---|---|---|---|---|
${ikiRows}

ベースURL: \`https://www.city.iki.nagasaki.jp\`

## 長崎県

| 資料 | URL | 残存性 | 最終確認 |
|---|---|---|---|
${nagasakiRows}

ベースURL: \`https://www.pref.nagasaki.jp\`

## 国

| 資料 | URL | 残存性 | 最終確認 |
|---|---|---|---|
${nationalRows}

## 失効した出典（記録として保持）

| 資料 | 旧URL | 失効を確認した日 | 代替 |
|---|---|---|---|
${expiredRows}
`
}

const EMPTY_MANIFEST = buildManifestText()

// --- findUnregistered ---------------------------------------------------------

test('url / pdf / sources[].url の3種類を抽出する', () => {
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal',
    url: 'https://www.city.iki.nagasaki.jp/a.html',
    pdf: 'https://www.city.iki.nagasaki.jp/a.pdf',
    sources: [{ label: '別紙', url: 'https://www.city.iki.nagasaki.jp/besshi.pdf' }],
  }] }

  const found = findUnregistered(doc, EMPTY_MANIFEST)

  assert.deepEqual(found.map((f) => f.label).sort(), [
    '計画A（掲載ページ）',
    '計画A（本体PDF）',
    '計画A／別紙',
  ].sort())
  assert.deepEqual(found.map((f) => f.url).sort(), [
    'https://www.city.iki.nagasaki.jp/a.html',
    'https://www.city.iki.nagasaki.jp/a.pdf',
    'https://www.city.iki.nagasaki.jp/besshi.pdf',
  ].sort())
  // パスはベースURLを除いた形で保持される
  const page = found.find((f) => f.label === '計画A（掲載ページ）')
  assert.equal(page.path, '/a.html')
})

test('level によってセクションを振り分ける（municipal/council → 壱岐市, prefectural → 長崎県, national → 国）', () => {
  const doc = { plans: [
    { id: 'shi', name: '市計画', level: 'municipal', url: 'https://www.city.iki.nagasaki.jp/shi.html' },
    { id: 'ken', name: '県計画', level: 'prefectural', url: 'https://www.pref.nagasaki.jp/ken.html' },
    { id: 'kuni', name: '国計画', level: 'national', url: 'https://www.mhlw.go.jp/kuni.pdf' },
    { id: 'shakyo', name: '社協計画', level: 'council', url: 'https://www.city.iki.nagasaki.jp/shakyo.html' },
  ] }

  const found = findUnregistered(doc, EMPTY_MANIFEST)
  const sectionOf = (id) => found.find((f) => f.id === id).section

  assert.equal(sectionOf('shi'), '壱岐市')
  assert.equal(sectionOf('ken'), '長崎県')
  assert.equal(sectionOf('kuni'), '国')
  assert.equal(sectionOf('shakyo'), '壱岐市')
  // 国のURLはベースURLがないので、パスはフルURLのまま
  assert.equal(found.find((f) => f.id === 'kuni').path, 'https://www.mhlw.go.jp/kuni.pdf')
})

test('ベースURLの前方一致だけでなくホスト境界を見る（別ホストを配下と誤認しない）', () => {
  // https://www.city.iki.nagasaki.jp.example.com/... は文字列としては
  // ベースURL https://www.city.iki.nagasaki.jp で始まるが、別ホストである。
  // ベースURL配下として相対パス化してはいけない（フルURLのまま扱われるべき）。
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal',
    url: 'https://www.city.iki.nagasaki.jp.example.com/soshiki/a/1.html',
  }] }

  const found = findUnregistered(doc, EMPTY_MANIFEST)

  assert.equal(found.length, 1)
  assert.equal(found[0].path, 'https://www.city.iki.nagasaki.jp.example.com/soshiki/a/1.html')

  // 同じパスが正規のベースURL配下に MANIFEST.md 登録されていても、別ホストなので未登録のまま
  const manifestText = buildManifestText({ iki: ['/soshiki/a/1.html'] })
  assert.equal(findUnregistered(doc, manifestText).length, 1)
})

test('ベースURL自体と完全一致するURLは空パスとして扱う', () => {
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal',
    url: 'https://www.city.iki.nagasaki.jp',
  }] }
  const sources = extractSources(doc)
  assert.equal(sources[0].path, '')
})

test('MANIFEST.md のパス表記にベースURLを補って登録済みと判定する', () => {
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal',
    url: 'https://www.city.iki.nagasaki.jp/soshiki/a/1.html',
  }] }
  const manifestText = buildManifestText({ iki: ['/soshiki/a/1.html'] })

  assert.deepEqual(findUnregistered(doc, manifestText), [])
})

test('長崎県のパス表記にもベースURLを補って登録済みと判定する', () => {
  const doc = { plans: [{
    id: 'ken', name: '県計画', level: 'prefectural',
    url: 'https://www.pref.nagasaki.jp/doc/123.html',
  }] }
  const manifestText = buildManifestText({ nagasaki: ['/doc/123.html'] })

  assert.deepEqual(findUnregistered(doc, manifestText), [])
})

test('国のフルURL表記はそのまま登録済みと判定する', () => {
  const doc = { plans: [{
    id: 'kuni', name: '国資料', level: 'national',
    url: 'https://www.mhlw.go.jp/content/x.pdf',
  }] }
  const manifestText = buildManifestText({ national: ['https://www.mhlw.go.jp/content/x.pdf'] })

  assert.deepEqual(findUnregistered(doc, manifestText), [])
})

test('失効した出典の表にあるURLは未登録として報告しない', () => {
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal',
    url: 'https://www.city.iki.nagasaki.jp/old/1.html',
  }] }
  const manifestText = buildManifestText({ expired: ['/old/1.html'] })

  assert.deepEqual(findUnregistered(doc, manifestText), [])
})

test('失効した出典の表は、県のパスであっても未登録として報告しない', () => {
  // 失効表はどのベースURL配下か明示されない（実物のMANIFEST.mdでも市・県のパスが混在する）
  const doc = { plans: [{
    id: 'ken', name: '県計画', level: 'prefectural',
    url: 'https://www.pref.nagasaki.jp/bunrui/old/index.html',
  }] }
  const manifestText = buildManifestText({ expired: ['/bunrui/old/index.html'] })

  assert.deepEqual(findUnregistered(doc, manifestText), [])
})

test('失効した出典の表の「代替」欄（4列目）にだけ現れるURLは、登録済みとして扱わない', () => {
  // レビューで指摘された再現手順:
  // 代替欄に「移設先候補は `/new-plan-page.html`（未確認）」のようにURLを書くと、
  // plans.yml に同じURLを持つ「本当に未登録」の計画があっても報告されなくなってはいけない。
  const doc = { plans: [{
    id: 'shinki', name: '新計画', level: 'municipal',
    url: 'https://www.city.iki.nagasaki.jp/new-plan-page.html',
  }] }
  const manifestText = buildManifestText({
    expiredRaw: [
      '| 旧ページ | `/old/1.html` | 2026-08-11 | 移設先候補は `/new-plan-page.html`（未確認） |',
    ],
  })

  const found = findUnregistered(doc, manifestText)

  assert.equal(found.length, 1)
  assert.equal(found[0].id, 'shinki')
  assert.equal(found[0].url, 'https://www.city.iki.nagasaki.jp/new-plan-page.html')
})

test('失効した出典の表は、旧URL（2列目）は登録済みとして拾い、代替欄（4列目）は拾わない（両立の確認）', () => {
  const doc = { plans: [
    { id: 'old', name: '旧計画', level: 'municipal', url: 'https://www.city.iki.nagasaki.jp/old/1.html' },
    { id: 'shinki', name: '新計画', level: 'municipal', url: 'https://www.city.iki.nagasaki.jp/new-plan-page.html' },
  ] }
  const manifestText = buildManifestText({
    expiredRaw: [
      '| 旧ページ | `/old/1.html` | 2026-08-11 | 移設先候補は `/new-plan-page.html`（未確認） |',
    ],
  })

  const found = findUnregistered(doc, manifestText)

  // 旧計画（2列目に一致）は登録済み扱いで報告されない。新計画（4列目にしか現れない）は報告される。
  assert.deepEqual(found.map((f) => f.id), ['shinki'])
})

test('同じURLが複数の計画から参照されていても重複して報告しない', () => {
  const doc = { plans: [
    { id: 'a', name: '計画A', level: 'prefectural', url: 'https://www.pref.nagasaki.jp/shared.html' },
    { id: 'b', name: '計画B', level: 'prefectural', url: 'https://www.pref.nagasaki.jp/shared.html' },
  ] }

  const found = findUnregistered(doc, EMPTY_MANIFEST)

  assert.equal(found.length, 1)
  assert.equal(found[0].url, 'https://www.pref.nagasaki.jp/shared.html')
})

test('url も pdf も sources もない計画（embedded_in 型）は何も報告しない', () => {
  const doc = { plans: [{ id: 'ko', name: '包含計画', level: 'municipal', embedded_in: 'oya' }] }
  assert.deepEqual(findUnregistered(doc, EMPTY_MANIFEST), [])
})

test('sources[].url が複数あればそれぞれ抽出する', () => {
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal',
    sources: [
      { label: '概要版', url: 'https://www.city.iki.nagasaki.jp/gaiyo.pdf' },
      { label: '本編', url: 'https://www.city.iki.nagasaki.jp/honpen.pdf' },
    ],
  }] }

  const found = findUnregistered(doc, EMPTY_MANIFEST)
  assert.deepEqual(found.map((f) => f.label).sort(), ['計画A／概要版', '計画A／本編'].sort())
})

// --- extractSources（内部で使う抽出そのものの単体確認） -----------------------

test('extractSources は登録判定なしで全出典を返す', () => {
  const doc = { plans: [{
    id: 'a', name: '計画A', level: 'municipal', url: 'https://www.city.iki.nagasaki.jp/a.html',
  }] }
  const sources = extractSources(doc)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].section, '壱岐市')
  assert.equal(sources[0].path, '/a.html')
})

// --- extractRegisteredUrls -----------------------------------------------------

test('extractRegisteredUrls は表内の POLICY.md へのリンク表記を URL と誤認しない', () => {
  // 1行目付近の `POLICY.md`（バッククォート付きだが / や http で始まらない）を拾わないこと
  const known = extractRegisteredUrls(EMPTY_MANIFEST)
  assert.equal([...known].some((u) => u.includes('POLICY.md')), false)
})

// --- buildAppendedManifest ------------------------------------------------------

test('--append は該当セクションの表の末尾、ベースURL行より前に骨格行を追記する（壱岐市＝6列）', () => {
  const manifestText = buildManifestText({ iki: ['/existing.html'] })
  const missing = [
    { id: 'a', section: '壱岐市', label: '新計画（掲載ページ）', path: '/new.html', url: 'https://www.city.iki.nagasaki.jp/new.html' },
  ]

  const { text: updated, skipped } = buildAppendedManifest(manifestText, missing, '2026-08-12')

  assert.match(updated, /\| 新計画（掲載ページ） \|\s*`\/new\.html`\s*\|\s*要判定\s*\|\s*2026-08-12\s*\|\s*―\s*\|\s*―\s*\|/)
  const existingIdx = updated.indexOf('/existing.html')
  const newIdx = updated.indexOf('/new.html')
  const baseIdx = updated.indexOf('ベースURL:')
  assert.ok(existingIdx < newIdx, '新規行は既存行より後ろに入る')
  assert.ok(newIdx < baseIdx, '新規行はベースURL行より前に入る')
  assert.deepEqual(skipped, [])
})

test('--append は長崎県・国では4列の骨格行を追記する', () => {
  const manifestText = buildManifestText()
  const missing = [
    { id: 'ken', section: '長崎県', label: '県計画', path: '/doc/1.html', url: 'x' },
    { id: 'kuni', section: '国', label: '国資料', path: 'https://www.mhlw.go.jp/x.pdf', url: 'x' },
  ]

  const { text: updated } = buildAppendedManifest(manifestText, missing, '2026-08-12')

  assert.match(updated, /\| 県計画 \| `\/doc\/1\.html` \| 要判定 \| 2026-08-12 \|$/m)
  assert.match(updated, /\| 国資料 \| `https:\/\/www\.mhlw\.go\.jp\/x\.pdf` \| 要判定 \| 2026-08-12 \|$/m)
})

test('--append は既存の行を書き換えない', () => {
  const manifestText = buildManifestText({ iki: ['/existing.html'] })
  const missing = [{ id: 'a', section: '壱岐市', label: '新規', path: '/new.html', url: 'x' }]

  const { text: updated } = buildAppendedManifest(manifestText, missing, '2026-08-12')

  assert.ok(updated.includes('| 資料 | `/existing.html` | 高 | 2026-08-01 | ― | ― |'))
})

test('残存性は「要判定」で固定され、高・中・低を推測しない', () => {
  const manifestText = buildManifestText()
  const missing = [{ id: 'a', section: '壱岐市', label: '新規', path: '/new.html', url: 'x' }]
  const { text: updated } = buildAppendedManifest(manifestText, missing, '2026-08-12')
  const newLine = updated.split('\n').find((l) => l.includes('/new.html'))
  assert.match(newLine, /要判定/)
  assert.doesNotMatch(newLine, /\|\s*(高|中|低)\s*\|/)
})

test('セクションの見出しが MANIFEST.md に無い場合、行を黙って捨てず skipped で報告する', () => {
  // buildManifestText() が生成する固定フィクスチャには「## 国」が無い版を作れないため、
  // ここだけ生の文字列で「壱岐市」セクションを欠いた MANIFEST.md を用意する。
  const manifestTextWithoutIki = `# 出典台帳

## 長崎県

| 資料 | URL | 残存性 | 最終確認 |
|---|---|---|---|
| 資料 | \`/existing.html\` | 高 | 2026-08-01 |

ベースURL: \`https://www.pref.nagasaki.jp\`
`
  const missing = [
    { id: 'a', section: '壱岐市', label: '新規（市）', path: '/new.html', url: 'x' },
    { id: 'b', section: '長崎県', label: '新規（県）', path: '/new2.html', url: 'y' },
  ]

  const { text: updated, skipped } = buildAppendedManifest(manifestTextWithoutIki, missing, '2026-08-12')

  // 見出しのある「長崎県」には追記される
  assert.match(updated, /\| 新規（県） \| `\/new2\.html` \| 要判定 \| 2026-08-12 \|/)
  // 見出しの無い「壱岐市」分は本文に現れず、skipped として報告される
  assert.equal(updated.includes('/new.html'), false)
  assert.deepEqual(skipped, [{ section: '壱岐市', count: 1 }])
})
