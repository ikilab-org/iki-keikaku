# コンテンツを「マップ」と「ノート」に分け、サイト名を改める（実装計画）

> **エージェントで実行する場合:** 1タスクずつ、`superpowers:subagent-driven-development`
> または `superpowers:executing-plans` で進めてください。手順は `- [ ]` で追えるようにしてあります。

**ゴール:** サイト名を「壱岐市 計画マップ」から「壱岐市 計画資料集」に改め、公開ページを
「マップ」（`plans/all/` の1枚）と「ノート」（残り全部）の2種に呼び分ける。

**進め方:** コードとデータには手を入れない。呼び名と、それを表示している箇所だけを変える。
`tools/pages.test.mjs` がサイト名を検査しているので、**テストを先に新名へ変えて赤にし、
それを緑にする形で置換を進める**。ハブの2節化にも検査を1つ足して、以後カードが
どちらの節にも属さない状態にならないようにする。

**設計:** [`2026-09-08-map-note-bunrui.md`](2026-09-08-map-note-bunrui.md)

**ベースライン（着手前に確認済み）:** `node --test` は 133 tests / 0 fail、
`node tools/build.mjs --check` は exit 0。

## 全体の制約

- **新しいサイト名は `壱岐市 計画資料集`。** 「壱岐市」と「計画資料集」のあいだは**半角スペース1つ**。
  既存の `壱岐市 計画マップ` と同じ区切りで、詰めない
- **URL とドメインは変えない。** `keikaku.ikilab.org`、`/plans/<slug>/` のまま。
  ディレクトリ名（`all` `fukushi` `kaigo-7-9` `koutsuu`）も変えない
- **記録は書き換えない。** `CHANGELOG.md` の既存エントリ、`docs/design/` の 2026-08-12・2026-08-13 の
  4ファイルはそのまま。`CHANGELOG.md` には**先頭に新しい節を足すだけ**
- **別語の「マップ」は触らない。** `tools/yaml.mjs` / `tools/yaml.test.mjs`（YAMLのデータ構造）、
  `sources/POLICY.md`（市の「大規模盛土造成マップ」）、`DISCLAIMER.md`（市の「医療介護資源マップ」）
- **依存を増やさない。** `package.json` と `node_modules/` は `.gitignore` 済み。
  playwright は OGP 生成時にローカルで入れるもので、コミットしない
- **定義文はこの2つを一字一句このまま使う**（設計 3.1 / 3.2）

  マップ:
  ```
  壱岐市に関わる計画を全件並べ、階層と計画期間で俯瞰します。構造化データから生成しているので、データを直せば図も表も追随します。そのぶん記述は薄く、個々の中身には踏み込みません。
  ```

  ノート:
  ```
  範囲を絞って書いたものです。計画どうしの関係を整理したり、計画書の見込値を決算や統計と突き合わせたりします。何を扱うかはページごとに違います。
  ```

- **各タスクの最後に必ず `node --test` と `node tools/build.mjs --check` を通してからコミットする**

---

### Task 1: サイト名を、テストを赤にしてから差し替える

**ファイル:**
- 変更: `tools/pages.test.mjs`（17行・60行・66行・96行）
- 変更: `index.html`（6・10・11・18・87行）
- 変更: `about/license/index.html`（6・7・10・18・104・270行）
- 変更: `plans/fukushi/index.html`（6・10・185行）
- 変更: `plans/kaigo-7-9/index.html`（6・10・155行）
- 変更: `plans/koutsuu/index.html`（6・10・157行）
- 変更: `tools/build.mjs`（329・333・342・371行）
- 再生成: `plans/all/index.html`

**このタスクが後続に渡すもの:** 新しいサイト名 `壱岐市 計画資料集` と、
`tools/pages.test.mjs` の `SUFFIX = ' | 壱岐市 計画資料集'`。以降のタスクはこれを前提にする。

- [ ] **Step 1: テストを新しい名前に変える（赤にする）**

`tools/pages.test.mjs` の4か所を変える。

17行:
```js
const SUFFIX = ' | 壱岐市 計画資料集'
```

60行（テスト名）:
```js
test('title はハブが「壱岐市 計画資料集」、ほかは「… | 壱岐市 計画資料集」', () => {
```

66行:
```js
      assert.equal(t, '壱岐市 計画資料集')
```

96行:
```js
    assert.equal(meta(src, 'og:site_name'), '壱岐市 計画資料集', `${file}: og:site_name`)
```

- [ ] **Step 2: 落ちることを確認する**

```bash
node --test 2>&1 | grep -E "^ℹ (tests|fail)"
```

期待: `fail` が 0 でなくなる（`title` と `og:site_name` の2テストが、6ページ分のメッセージ付きで落ちる）。
**ここで緑のままなら、テストがサイト名を見ていないということなので、先に進まず原因を調べる。**

- [ ] **Step 3: 手書きの5ページを直す**

`index.html`:

| 行 | 変更後 |
|---|---|
| 6 | `<title>壱岐市 計画資料集</title>` |
| 10 | `<meta property="og:site_name" content="壱岐市 計画資料集">` |
| 11 | `<meta property="og:title" content="壱岐市 計画資料集">` |
| 18 | `<meta property="og:image:alt" content="壱岐市 計画資料集。国・長崎県・市の階層と、地域福祉計画を軸にした分野別計画の関係図">` |
| 87 | `    <h1>壱岐市 計画資料集</h1>` |

`about/license/index.html`:

| 行 | 変更後 |
|---|---|
| 6 | `<title>ライセンスと、その選択理由 | 壱岐市 計画資料集</title>` |
| 7 | `description` の冒頭を `壱岐市 計画資料集は、文章・図表・データを CC BY 4.0、…` に（以降はそのまま） |
| 10 | `<meta property="og:site_name" content="壱岐市 計画資料集">` |
| 18 | `og:image:alt` を `壱岐市 計画資料集。国・長崎県・市の階層と、地域福祉計画を軸にした分野別計画の関係図` に |
| 104 | `    <a href="../../" class="badge">← 壱岐市 計画資料集</a><span class="badge">ライセンス</span>` |
| 270 | `  <a href="../../">壱岐市 計画資料集</a>　／` |

**237・241・245行のクレジット例はここでは触らない**（Task 4 で扱う）。

`plans/fukushi/index.html`・`plans/kaigo-7-9/index.html`・`plans/koutsuu/index.html`:

- 6行: `<title>` 末尾の ` | 壱岐市 計画マップ` を ` | 壱岐市 計画資料集` に
- 10行: `og:site_name` を `壱岐市 計画資料集` に
- 戻りバッジ（fukushi 185・kaigo-7-9 155・koutsuu 157行）の
  `← 壱岐市 計画マップ` を `← 壱岐市 計画資料集` に

**同じ行にある自称バッジ（fukushi の `計画体系マップ`）はここでは触らない**（Task 3 で扱う）。

- [ ] **Step 4: 生成側を直す**

`tools/build.mjs`:

| 行 | 変更後 |
|---|---|
| 329 | `` `<title>${esc(titleOf(m))} | 壱岐市 計画資料集</title>`, `` |
| 333 | `    '<meta property="og:site_name" content="壱岐市 計画資料集">',` |
| 342 | `    '<meta property="og:image:alt" content="壱岐市 計画資料集。国・長崎県・市の階層と、地域福祉計画を軸にした分野別計画の関係図">',` |
| 371 | `    <a class="badge" href="../../">← 計画資料集</a>` |

- [ ] **Step 5: `plans/all/index.html` を再生成する**

```bash
node tools/build.mjs && node tools/build.mjs --check
```

期待: 生成が走り、`--check` が `plans/all/index.html は data/plans.yml と一致しています` を出して exit 0。

- [ ] **Step 6: テストを緑にする**

```bash
node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

期待: `fail 0`、`pass` は 133。

- [ ] **Step 7: 残りを確認する**

```bash
grep -rn "計画マップ" index.html about/license/ plans/ tools/build.mjs tools/pages.test.mjs
```

期待: `about/license/index.html` の 237・241・245行（クレジット例、Task 4）と
`plans/fukushi/index.html` の 185行（自称バッジ、Task 3）だけが残る。

- [ ] **Step 8: コミット**

```bash
git add tools/pages.test.mjs tools/build.mjs index.html about/license/index.html plans/
git commit -m "サイト名を「壱岐市 計画資料集」に改める

公開4ページのうちマップと呼べるのは plans/all/ の1枚だけで、名前が中身を
言い当てなくなっていた。本文がすでに「資料集です」と自称していたので、
新しい語を増やさずに済む「計画資料集」を採る。

サイト名は tools/pages.test.mjs が検査しているので、テストを先に新名へ
変えて赤にし、それを緑にする形で置換した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: ハブを「マップ」と「ノート」の2節に割る

**ファイル:**
- 変更: `index.html`（98行の `<h2>` と、100〜151行の `.cards`、153〜154行）
- 変更: `tools/pages.test.mjs`（テストを1つ追加）

**このタスクが前提にするもの:** Task 1 で `SUFFIX` が新名になっていること。

**このタスクが後続に渡すもの:** ハブに `<h2>マップ</h2>` と `<h2>ノート</h2>` の2節があり、
それぞれ直後に `<p class="sub">` の定義文と `<div class="cards">` を持つ構造。

- [ ] **Step 1: 節の構造を検査するテストを書く（赤にする）**

`tools/pages.test.mjs` の末尾に足す。

```js
test('ハブはマップとノートの2節に分かれ、各節が定義文とカードを持つ', () => {
  // 「ノート」は器なので、名前だけでは中身が伝わらない。
  // 節の直後に1行の定義を置くことを、構造として守る。
  const src = html.get('index.html')
  for (const kind of ['マップ', 'ノート']) {
    const i = src.indexOf(`<h2>${kind}</h2>`)
    assert.ok(i >= 0, `ハブに「${kind}」の節がありません`)
    const head = src.slice(i, i + 600)
    assert.match(head, /<p class="sub">/, `${kind}: 節の直後に定義文がありません`)
    assert.match(head, /<div class="cards">/, `${kind}: 節にカードがありません`)
  }
})

test('ハブのカードは、すべてマップかノートの節に入っている', () => {
  // 型のラベルはカードに付けず、節が担う。節の外にカードがあると分類から漏れる。
  const src = html.get('index.html')
  const total = (src.match(/<a class="card"/g) || []).length
  const inSections = (src.slice(src.indexOf('<h2>マップ</h2>')).match(/<a class="card"/g) || []).length
  assert.ok(total > 0, 'ハブにカードがありません')
  assert.equal(inSections, total, 'マップの節より前にカードがあります')
})
```

- [ ] **Step 2: 落ちることを確認する**

```bash
node --test 2>&1 | grep -E "^ℹ (tests|fail)"
```

期待: `fail 2`（`<h2>マップ</h2>` がまだ無いので両方落ちる）。

- [ ] **Step 3: ハブの98行を2節に割る**

現在の `<h2>公開中のマップ</h2>` と、その下の1つの `<div class="cards">` … `</div>` を、
次の形に組み替える。**カードの中身（`.k`・`h3`・`p`・`.tags`）は1文字も変えない。**
`plans/all/` のカードを上の節に、残り3枚を下の節に置くだけ。

```html
<h2>マップ</h2>
<p class="sub">壱岐市に関わる計画を全件並べ、階層と計画期間で俯瞰します。構造化データから生成しているので、データを直せば図も表も追随します。そのぶん記述は薄く、個々の中身には踏み込みません。</p>
<div class="cards">

  <a class="card" href="plans/all/">
    ……（既存のまま）……
  </a>

</div>

<h2>ノート</h2>
<p class="sub">範囲を絞って書いたものです。計画どうしの関係を整理したり、計画書の見込値を決算や統計と突き合わせたりします。何を扱うかはページごとに違います。</p>
<div class="cards">

  <a class="card" href="plans/fukushi/">
    ……（既存のまま）……
  </a>

  <a class="card" href="plans/kaigo-7-9/">
    ……（既存のまま）……
  </a>

  <a class="card" href="plans/koutsuu/">
    ……（既存のまま）……
  </a>

</div>
```

- [ ] **Step 4: 154行の導入文を直す**

現在:
```html
<p class="sub">全体の俯瞰ができたので、次は分野ごとの掘り下げを増やしていきます。優先順位はこう考えています。</p>
```

変更後:
```html
<p class="sub">マップができたので、次はノートを増やしていきます。優先順位はこう考えています。</p>
```

- [ ] **Step 5: テストを緑にする**

```bash
node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

期待: `fail 0`、`pass 135`（133 + 追加した2つ）。

- [ ] **Step 6: 見た目を確認する**

```bash
grep -n "<h2>\|class=\"card\" href" index.html
```

期待: `<h2>マップ</h2>` → カード1枚 → `<h2>ノート</h2>` → カード3枚 → `<h2>これから増やすもの</h2>`
→ `<h2>データと更新について</h2>` の順に並ぶ。

- [ ] **Step 7: コミット**

```bash
git add index.html tools/pages.test.mjs
git commit -m "ハブをマップとノートの2節に割り、それぞれに定義を置く

マップは「全件・構造だけ・生成」ときつく縛り、ノートは範囲を絞ったもの
全部を受ける器にする。定義の強さをわざと非対称にしているのは、ノート側を
厳密にすると次に入れたい照会記録やパブコメが名前から弾かれるため。

型のラベルはカードに付けない。カードの .k には分野名が入っており、
そこに型を足すと情報が二重になる。節が型を担う。

節の外にカードが置かれないことをテストで守る。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 実態とズレた説明を直す

**ファイル:**
- 変更: `index.html`（7・12・88行）
- 変更: `plans/fukushi/index.html`（185行の自称バッジ）
- 変更: `README.md`（3・48・57・98〜100・213行）

**このタスクが前提にするもの:** Task 1 の新サイト名、Task 2 のマップ／ノートという語。

- [ ] **Step 1: ハブの説明文を差し替える**

「計画どうしの関係を図にして」はマップが線を引かないという判断とズレている（設計 6.1）。

`index.html` 7行:
```html
<meta name="description" content="長崎県壱岐市の行政計画について、全件を並べたマップと、分野ごとに掘り下げたノートを置いている資料集。公開情報のみを使い、出典をすべて明示しています。">
```

`index.html` 12行:
```html
<meta property="og:description" content="長崎県壱岐市の行政計画について、全件を並べたマップと、分野ごとに掘り下げたノートを置いている資料集。">
```

`index.html` 88行:
```html
    <p class="sub">壱岐市に関わる行政計画を全件並べたマップと、分野ごとに掘り下げたノートを置いています。公開情報のみを使い、出典はすべて明示しています。</p>
```

- [ ] **Step 2: fukushi の自称バッジを直す**

ノートに分類したページが自分を「マップ」と名乗っている（設計 6.2）。
他の2本が*対象＋作業*で揃っているので、それに合わせる。

`plans/fukushi/index.html` 185行:
```html
    <a href="../../" class="badge home">← 壱岐市 計画資料集</a><span class="badge">長崎県壱岐市 ／ 地域福祉計画の体系整理</span>
```

- [ ] **Step 3: README の冒頭を直す**

3行:
```markdown
長崎県壱岐市の行政計画について、**全件を並べたマップと、分野ごとに掘り下げたノート**を置いた資料集です。
```

1行目の H1 は `# 壱岐市 計画資料集` に。

- [ ] **Step 4: README の構成図と役割分担を直す**

57行:
```
├── plans/                  マップとノート（1ディレクトリ＝1ページ、単一HTML）
```

98〜100行（`plans/koutsuu/` が抜けていたのもここで直す）:
```markdown
計画の名称・期間・根拠法・所管課・出典URLは、すべてここに集約しています。
`plans/all/` のマップはこの YAML から生成しています。ノート（`plans/fukushi/` `plans/kaigo-7-9/`
`plans/koutsuu/`）は手書きのままです。生成物は全件を載せられる代わりに記述が薄くなるので、
**マップは生成、ノートは手書き**と役割を分けています。
```

- [ ] **Step 5: README の「これから」を直す**

48行:
```markdown
2. **ノートの拡充。** マップ（`plans/all/`）ができたので、次は改定期が近い計画から
   ノートを増やしていきます（詳細は [`/`](index.html) の「これから増やすもの」）
```

213行:
```markdown
- **ノートの拡充。** マップで全体が見えたので、掘り下げる分野の優先順位を決められます
```

- [ ] **Step 6: 検査を通す**

```bash
node --test 2>&1 | grep -E "^ℹ (pass|fail)" && node tools/build.mjs --check
```

期待: `fail 0`、`pass 135`、`--check` exit 0。

- [ ] **Step 7: コミット**

```bash
git add index.html plans/fukushi/index.html README.md
git commit -m "「関係を図にして」という説明と、fukushi の自称バッジを実態に合わせる

ハブと README の冒頭は「計画どうしの関係を図にし」と説明していたが、
マップには線を引かないと決めている（parent が78件中8本しかなく、引くと
調査の穴が関係の不在に見えるため）。マップとノートの2本立てを説明する
文に差し替えた。

fukushi はノートに分類したのにバッジが「計画体系マップ」で、自分を
マップと名乗っていた。他2本と同じ対象＋作業の形で「地域福祉計画の
体系整理」にした。

README の役割分担の記述から plans/koutsuu/ が抜けていたのも直した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: クレジット表記を差し替え、旧名を追える一文を残す

**ファイル:**
- 変更: `about/license/index.html`（237・241・245行、および246行の後に注記を追加）
- 変更: `NOTICE.md`（53行、およびその後に注記を追加）

**なぜ分けるか:** このサイトでは名前がそのまま CC BY の帰属表示の文字列になっている（設計 4.3）。
機械的な置換とは意味が違うので、独立して見直せるようにタスクを分ける。

- [ ] **Step 1: `about/license/` の3つのクレジット例を直す**

237行:
```html
<pre><code>出典：壱岐市 計画資料集（IKILAB）CC BY 4.0
```

241行:
```html
<pre><code>出典：&lt;a href="https://keikaku.ikilab.org/plans/fukushi/"&gt;壱岐市 計画資料集&lt;/a&gt;（IKILAB）
```

245行:
```html
<pre><code>壱岐市 計画資料集（IKILAB）CC BY 4.0 を改変して作成
```

- [ ] **Step 2: 旧名の注記を足す**

`<p class="mut">「改変して作成」の一言を足すだけです。…</p>`（247行）の直後に、次の1行を挿入する。

```html
<p class="mut">2026年9月まで「壱岐市 計画マップ」の名称で公開していました。旧名で表示済みのクレジットは、そのままで構いません。</p>
```

- [ ] **Step 3: `NOTICE.md` を直す**

53行:
```
出典：壱岐市 計画資料集（IKILAB）CC BY 4.0
```

そのコードブロックの閉じ（55行の ` ``` `）の直後に、空行をはさんで1行足す。

```markdown
2026年9月まで「壱岐市 計画マップ」の名称で公開していました。旧名で表示済みのクレジットは、そのままで構いません。
```

- [ ] **Step 4: 検査を通す**

```bash
node --test 2>&1 | grep -E "^ℹ (pass|fail)"
grep -rn "計画マップ" about/license/index.html NOTICE.md
```

期待: `fail 0`。grep は**旧名の注記2か所だけ**がヒットする（意図的に残しているもの）。

- [ ] **Step 5: コミット**

```bash
git add about/license/index.html NOTICE.md
git commit -m "クレジット表記を新名にし、旧名を追える一文を残す

このサイトでは名前がそのまま CC BY の帰属表示の文字列になっている。
改名すると旧名で引用済みのクレジットが宙に浮くので、about/license/ と
NOTICE.md に「2026年9月まで壱岐市 計画マップの名称で公開していた」と
記し、旧名のクレジットはそのままでよいと明記した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 手順書と自動化に残った語を直す

**ファイル:**
- 変更: `CONTRIBUTING.md`（74・85行）
- 変更: `SETUP.md`（25・194・195行）
- 変更: `README.md`（157行）
- 変更: `assets/palette.css`（1行）
- 変更: `.github/workflows/expiring.yml`（56行）
- 変更: `tools/og/build.mjs`（13行の docstring）

**なぜ落とせないか:** `CONTRIBUTING.md` と `SETUP.md` はページを増やすときの手順書で、
旧名のまま残すと次に作るノートに古い名前が入る。`expiring.yml` は毎回の自動 Issue に
旧語が載り続ける。

- [ ] **Step 1: `CONTRIBUTING.md` を直す**

74行:
```markdown
- `<title>` が `… | 壱岐市 計画資料集` で終わる
```

85行:
```markdown
- ページ冒頭に「← 壱岐市 計画資料集」のバッジ、`h1`、一文の要約、**調査基準日**と単位・定義の断り、
```

- [ ] **Step 2: `SETUP.md` を直す**

25行（初版コミットの例文）:
```
git commit -m "壱岐市 計画資料集 初版
```

194・195行（公開前チェックリスト）:
```markdown
- [ ] ハブページからマップ・各ノートに移動できる
- [ ] 各ページの左上「← 壱岐市 計画資料集」で戻れる
```

- [ ] **Step 3: `README.md` 157行の例文を直す**

```bash
git init -b main && git add -A && git commit -m "壱岐市 計画資料集 初版"
```

- [ ] **Step 4: `assets/palette.css` の先頭コメントを直す**

1行:
```css
/* 壱岐市 計画資料集 共通配色
```

- [ ] **Step 5: `.github/workflows/expiring.yml` の Issue 本文を直す**

56行:
```yaml
              '- [ ] 該当分野のノートの記述が古くなっていないか確認する',
```

- [ ] **Step 6: `tools/og/build.mjs` の docstring を直す**

13行を書き換え、14行の後に1行足す（`*/` の行は動かさない）。
出力一覧から `og-koutsuu.png` が漏れていたのもここで補う。

変更前（12〜15行）:
```js
 *   assets/og.png          ハブページ用
 *   assets/og-fukushi.png  福祉分野マップ用
 *   assets/og-kaigo.png    介護保険の検証用
 */
```

変更後:
```js
 *   assets/og.png          ハブページ用
 *   assets/og-fukushi.png  福祉のノート用
 *   assets/og-kaigo.png    介護保険のノート用
 *   assets/og-koutsuu.png  公共交通のノート用
 */
```

- [ ] **Step 7: ワークフローの構文を壊していないか確認する**

```bash
node -e "const s=require('fs').readFileSync('.github/workflows/expiring.yml','utf8');
if(!s.includes('該当分野のノートの記述')) throw new Error('置換できていません');
if(s.includes('マップページ')) throw new Error('旧語が残っています');
console.log('ok')"
```

期待: `ok`。

- [ ] **Step 8: 検査を通す**

```bash
node --test 2>&1 | grep -E "^ℹ (pass|fail)" && node tools/build.mjs --check
```

期待: `fail 0`、`pass 135`、`--check` exit 0。

- [ ] **Step 9: コミット**

```bash
git add CONTRIBUTING.md SETUP.md README.md assets/palette.css .github/workflows/expiring.yml tools/og/build.mjs
git commit -m "手順書と自動 Issue に残った旧名・旧語を直す

CONTRIBUTING.md と SETUP.md はページを増やすときの手順書で、旧名のまま
だと次に作るノートに古い名前が入る。expiring.yml は毎回の自動 Issue に
「該当分野のマップページ」と載り続ける。

tools/og/build.mjs の出力一覧から og-koutsuu.png が抜けていたのも足した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: OGP画像を再生成する

**ファイル:**
- 変更: `tools/og/cards.html`（81・82・103・107・135・165行）
- 再生成: `assets/og.png`・`assets/og-fukushi.png`・`assets/og-kaigo.png`・`assets/og-koutsuu.png`

**前提:** OGP生成には playwright が要る。このリポジトリに `package.json` と `node_modules/` は
なく、どちらも `.gitignore` 済み。**入れても追跡されない。**

**中断の条件:** playwright を入れられない場合、**画像を旧名のまま残さずに作業を止めて報告する。**
名前とOGPがずれた状態で公開しない。

- [ ] **Step 1: `tools/og/cards.html` の文字を直す**

81〜82行（ハブのカード）:
```html
      <div class="ttl">壱岐市<br>計画資料集</div>
      <div class="lead">全件を並べたマップと、<br>分野ごとに掘り下げたノート。<br>出典はすべて明示。</div>
```

103行（コメント）:
```html
<!-- =============== 福祉のノート =============== -->
```

107・135・165行（eyebrow）: `壱岐市 計画マップ ／` を `壱岐市 計画資料集 ／` に。
後ろの分野名（`福祉分野`・`介護保険`・`公共交通`）はそのまま。

- [ ] **Step 2: 旧語が残っていないか確認する**

```bash
grep -n "計画マップ\|分野マップ" tools/og/cards.html || echo "残りなし"
```

期待: `残りなし`。

- [ ] **Step 3: playwright を入れる**

```bash
npm i -D playwright && npx playwright install chromium
```

**失敗したらここで止める。** `git status` に `node_modules/` や `package.json` が
出ていないこと（`.gitignore` 済み）を確認してから報告する。

- [ ] **Step 4: 画像を生成する**

```bash
node tools/og/build.mjs
```

- [ ] **Step 5: 4枚が更新されたことを確認する**

```bash
git status --short assets/
```

期待: `og.png`・`og-fukushi.png`・`og-kaigo.png`・`og-koutsuu.png` の4枚が `M` で並ぶ。

新しい名前が焼き込まれたかは、画像を開いて目で確かめる。ハブの画像に
「壱岐市 計画資料集」、ノート3枚の eyebrow に「壱岐市 計画資料集 ／ …」が出ていること。

- [ ] **Step 6: 検査を通す**

```bash
node --test 2>&1 | grep -E "^ℹ (pass|fail)"
```

期待: `fail 0`（`pages.test.mjs` は `og:image` のファイルが実在することを見ている）。

- [ ] **Step 7: コミット**

```bash
git add tools/og/cards.html assets/og.png assets/og-fukushi.png assets/og-kaigo.png assets/og-koutsuu.png
git commit -m "OGP画像を新しいサイト名で作り直す

cards.html のハブカードを「壱岐市 計画資料集」にし、リード文も
マップとノートの2本立ての説明に差し替えて、4枚を再生成した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: CHANGELOG に記録し、完了を判定する

**ファイル:**
- 変更: `CHANGELOG.md`（先頭に節を追加。既存エントリは書き換えない）

- [ ] **Step 1: CHANGELOG に節を足す**

4行目の説明文と `## 2026-08-23` のあいだに、次を挿入する。

```markdown
## 2026-09-08

### 変更（サイト名とコンテンツの呼び分け）
- **サイト名を「壱岐市 計画マップ」から「壱岐市 計画資料集」に改めた。** 公開4ページのうち
  マップと呼べるのは `plans/all/` の1枚だけで、`plans/kaigo-7-9/`・`plans/koutsuu/` は
  突き合わせて結論を出すもの、`plans/fukushi/` は範囲を絞った体系整理になっており、
  名前が中身を言い当てなくなっていた。本文がすでに「資料集です」と自称していたので、
  新しい語を増やさずに済む語を採った
- **公開ページを「マップ」と「ノート」に呼び分けた。** マップは「全件・構造だけ・生成」と
  きつく縛り、ノートは範囲を絞ったもの全部を受ける器とする。定義の強さを非対称にしたのは、
  ノート側を厳密にすると、これから入れたい市への照会記録やパブリックコメントが名前から
  弾かれるため。ハブの見出しを2節に割り、それぞれに1行の定義を置いた。型のラベルは
  カードに付けていない（`.k` の分野名と情報が二重になるため）
- **ハブと README の「計画どうしの関係を図にし」という説明を差し替えた。** マップには線を
  引かないと決めており（`parent` が78件中8本で、引くと調査の穴が「関係の不在」に見える）、
  説明が実態とズレていた
- **`plans/fukushi/` のバッジ「計画体系マップ」を「地域福祉計画の体系整理」にした。**
  ノートに分類したページが自分をマップと名乗っていた。他2本と同じ*対象＋作業*の形に揃えた
- **クレジット表記を新名にし、旧名を追える一文を `about/license/` と `NOTICE.md` に残した。**
  このサイトでは名前がそのまま CC BY の帰属表示の文字列になっているため
- **手順書と自動 Issue の語も直した。** `CONTRIBUTING.md`・`SETUP.md` は旧名のままだと次に
  作るノートに古い名前が入る。`.github/workflows/expiring.yml` は毎回の自動 Issue に
  「該当分野のマップページ」と載り続ける
- OGP画像4枚を再生成した。設計は [`docs/design/2026-09-08-map-note-bunrui.md`](docs/design/2026-09-08-map-note-bunrui.md)
- **URL・ドメイン・`data/plans.yml` のスキーマは変えていない。** 「上位方針に基づく下位計画」を
  表すフィールドが無い件（施設・財産管理の5本が無向の `related` に落ちている）は、
  設計 9章に積み残しとして記録した
```

- [ ] **Step 2: 完了の判定を1つずつ通す**

```bash
echo "--- 1. 旧サイト名の残り（CHANGELOG の記録1件だけが正解）"
grep -rn "計画マップ" . --exclude-dir=.git --exclude-dir=docs --exclude-dir=node_modules

echo "--- 1a. 「マップ」単独の残り"
grep -rln "マップ" . --exclude-dir=.git --exclude-dir=docs --exclude-dir=node_modules

echo "--- 2. テスト"
node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"

echo "--- 3. 生成漏れ"
node tools/build.mjs --check

echo "--- 4. OGP"
git log --oneline -1 -- assets/og.png

echo "--- 7. その他の検証"
node tools/validate.mjs && node tools/expiring.mjs >/dev/null && node tools/manifest.mjs
```

期待:

1. **ヒットは4件だけ。** `CHANGELOG.md` に2件（過去エントリ48行と、Task 7 で足した新エントリ）、
   `about/license/index.html` に1件、`NOTICE.md` に1件。後ろ2件は Task 4 で意図的に残した
   旧名の注記。**これ以外に1件でも出たら、そのファイルが置換漏れ**
1a. **残ってよい「マップ」は、次のどれかの理由を持つものだけ。** ファイル名を1つずつ見て、
   理由を言えないものが無いことを確かめる。
   - 別語 … `tools/yaml.mjs`・`tools/yaml.test.mjs`（YAMLのデータ構造）、
     `sources/POLICY.md`（市の「大規模盛土造成マップ」）、`DISCLAIMER.md`（市の「医療介護資源マップ」）
   - 記録 … `CHANGELOG.md`
   - **新しい語としてのマップ** … `index.html`（`<h2>マップ</h2>` と説明文）、`README.md`（冒頭と構成図）、
     `SETUP.md`（チェックリスト194行）、`CONTRIBUTING.md`・`plans/all/index.html`（あれば）
2. `fail 0`、`pass 135`
3. exit 0
4. Task 6 のコミットが出る
7. **着手前と同じ出力になる**（このタスクはデータに触っていないので、`validate` の warn 件数などが
   変わっていたら別の原因を疑う）

**`linkcheck` は外部への通信が発生する。** ネットワークが使えるときだけ
`node tools/linkcheck.mjs` を回す。使えない場合はその旨を報告に書く。

- [ ] **Step 3: ブラウザで確認する**

`SETUP.md` の公開前チェックリストに沿って、ローカルで開いて見る。

```bash
python3 -m http.server 8000
```

- [ ] ハブに「マップ」（カード1枚）と「ノート」（カード3枚）の2節があり、それぞれ定義文が出ている
- [ ] ハブから4ページすべてに移動できる
- [ ] 各ページの左上「← 壱岐市 計画資料集」で戻れる
- [ ] `plans/fukushi/` のバッジが「長崎県壱岐市 ／ 地域福祉計画の体系整理」
- [ ] 表示切替（ライト／ダーク）が動く

- [ ] **Step 4: コミット**

```bash
git add CHANGELOG.md
git commit -m "改訂履歴に、サイト名の変更とマップ／ノートの呼び分けを記録する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## この計画でやらないこと

- **URL構造の変更。** `/plans/` を `/maps/` と `/notes/` に割るのはリダイレクトの手当てが要る。
  分類が固まってからで足りる
- **`data/plans.yml` のスキーマ変更。** 「上位方針に基づく下位計画」を表すフィールドが無い件は
  設計 9章の積み残し。公共施設等総合管理計画のノートに着手する前に、別の設計として扱う
- **新しいノートの追加。** 公共施設等総合管理計画の深掘りは、この計画の完了後に別途
- **ノート本文の書き換え。** 触るのは Task 3 の fukushi バッジ1か所だけ
- **`docs/design/` の過去4ファイルと `CHANGELOG.md` の既存エントリの書き換え。** 記録なので残す
