# 壱岐市 計画マップ

長崎県壱岐市の行政計画について、**計画どうしの関係を図にし、個別の計画を深掘りできる**ようにした資料集です。
公開情報だけを使い、出典をすべて明示しています。

- 公開URL: https://keikaku.ikilab.org
- 運営: [IKILAB](https://ikilab.org) ／ リポジトリ: [github.com/ikilab-org/iki-keikaku](https://github.com/ikilab-org/iki-keikaku)
- 調査基準日: `data/plans.yml` の `meta.survey_date` を参照

> **この資料は壱岐市の公式資料ではありません。** 公表資料をもとに独立して整理したものです。
> 誤りを見つけたら [Issue](../../issues/new/choose) か README 末尾の連絡先まで。詳細は [DISCLAIMER.md](DISCLAIMER.md)。

---

## いま公開しているもの

| ページ | 内容 |
|---|---|
| [`/`](index.html) | ハブ。分野ごとの入口 |
| [`/plans/all/`](plans/all/) | **全計画78件の俯瞰**（市68・社協1・県9） — 位置づけの階層・計画期間・分野別の一覧。`data/plans.yml` から生成 |
| [`/plans/fukushi/`](plans/fukushi/) | **地域福祉計画と関連計画の体系整理** — 国・長崎県・市の階層、計画期間タイムライン、一覧、地域福祉計画と個別計画の対応 |
| [`/plans/kaigo-7-9/`](plans/kaigo-7-9/) | **介護保険事業計画 第7期・第8期の検証** — 前提 → 計画 → 実施 → 成果。実績は第9期計画・決算・統計から取っている |
| [`/plans/koutsuu/`](plans/koutsuu/) | **地域公共交通計画の読み直し** — 路線バスと公共ライドシェアの公費を1乗車あたりに換算。系統別の開き、75歳以上の利用、実証事業との比較。**推計を含む**（仮定と誤差の向きは各章に明記） |
| [`/about/license/`](about/license/) | ライセンスと、その選択理由。クレジットの記載例つき |

## これから増やすもの

福祉分野に限らず、**壱岐市が持つすべての計画の関連性を図示し、個別の計画に深掘りできる**構成を目指しています。
分野の分類は、福祉に偏っていた6小分類から、`domain`（大分類）8つ・`category`（小分類）という2階層に広げ、
確定しました。

**組織ごとの巡回で市の全機関を巡り終え、収録件数は31件から78件（市68・社協1・県9）に増えました。**
市長部局7部（総務部・地域振興部・市民部・保健環境部・農林水産部・産業推進部・建設部）に加え、
教育委員会・消防本部・農業委員会・議会・選挙管理委員会・監査委員のすべてを巡回し、計画を持たない
組織は「なし」と記録しています。パブリックコメント実施状況・第4次総合計画の関連計画一覧・附属機関の
設置条例の3系統でも交差検証し、洗い出しの漏れを確認しました。巡回・交差検証の記録は
[`sources/POLICY.md`](sources/POLICY.md) の巡回台帳を参照してください。
なお、巡回を終えたあとに旧課パス配下の漏れが2件見つかり、追加しています（76件 → 78件。
経緯は `CHANGELOG.md` 2026-08-13 と [`sources/POLICY.md`](sources/POLICY.md)「旧課パスの扱い」）。

`data/plans.yml` には未調査の項目が `todo:`（31件）付きで残っており、`node tools/expiring.mjs` や
`node tools/validate.mjs` で一覧できます。

これからの優先順位:

1. **残る `todo:` の解消。** 計画期間・所管課など、巡回時点では確認しきれなかった項目です
2. **分野別ページの拡充。** 全計画の俯瞰（`plans/all/`）ができたので、次は改定期が近い計画から
   分野ごとの掘り下げページを増やしていきます（詳細は [`/`](index.html) の「これから増やすもの」）

---

## リポジトリの構成

```
.
├── index.html              ハブページ
├── plans/                  分野ごとのマップ（1ディレクトリ＝1ページ、単一HTML）
│   ├── all/                ★ 全計画の俯瞰（data/plans.yml から生成）
│   ├── fukushi/
│   └── kaigo-7-9/
├── about/
│   └── license/            ライセンスと、その選択理由
├── data/
│   ├── plans.yml           ★ 全計画の構造化データ（単一の真実）
│   └── schema.md           plans.yml のスキーマ
├── sources/
│   ├── POLICY.md           出典URLの寿命管理・スナップショットの方針
│   └── MANIFEST.md         出典台帳
├── assets/
│   ├── palette.css         配色（CUD 8色）。色の値を持つ唯一の場所
│   └── og*.png             OGP画像（1200×630）
├── tools/
│   ├── build.mjs           plans/all/index.html を生成（--check で生成漏れを検出）
│   ├── view-model.mjs      図表の分類規則（どの計画がどの帯・グループに入るか）
│   ├── palette.mjs         assets/palette.css を読む（build.mjs の事前検査とテストが使用）
│   ├── fiscal-year.mjs     年度の元号表記
│   ├── linkcheck.mjs       出典URLの死活チェック
│   ├── expiring.mjs        満了・パブコメが近い計画の検出
│   ├── validate.mjs        参照整合・enum・骨格の検査（error/warn の2段階）
│   ├── yaml.mjs            plans.yml が使う構文だけを解釈する最小YAMLパーサ（validate.mjs・manifest.mjs が使用）
│   ├── manifest.mjs        出典台帳（sources/MANIFEST.md）の未登録を検出・骨格行を追記
│   └── og/                 OGP画像の生成（cards.html + build.mjs）
├── docs/                   分析報告書など（Markdown）
│   └── design/             設計文書・実装計画
├── .github/workflows/      linkcheck・expiring の定期実行（Issue を立てる）と、生成漏れの検査
├── SETUP.md                公開までの手順（詳細）
├── LICENSE                 CC BY 4.0 の条文（文章・図表・データ）
├── LICENSE-CODE            MIT の条文（コード）
├── NOTICE.md               ライセンスの適用範囲・及ばないもの
├── CHANGELOG.md            改訂履歴
├── DISCLAIMER.md           この資料の性格と留意事項
└── CONTRIBUTING.md         誤りの指摘・追加提案の手順
```

### data/plans.yml が中心

計画の名称・期間・根拠法・所管課・出典URLは、すべてここに集約しています。
`plans/all/` はこの YAML から生成しています。分野別ページ（`plans/fukushi/` `plans/kaigo-7-9/`）は
手書きのままです。生成物は網羅的で常に最新な代わりに記述が薄くなるので、
**俯瞰は生成、掘り下げは手書き**と役割を分けています。

いま時点で YAML を読んでいるのは次の5つです。CIで回るのは `linkcheck`（週次と、
`data/plans.yml`・`tools/linkcheck.mjs` への push 時）・`expiring`（月次）・
`build --check` と `validate`（`data/plans.yml`・`tools/`・`assets/palette.css`・`plans/all/index.html`
への push 時と、すべての pull request）です。`manifest` は手動での実行です。

```bash
node tools/build.mjs                      # plans/all/index.html を生成（生成物はコミットする）
node tools/build.mjs --check              # 生成し忘れを検出（CIが実行）
node tools/linkcheck.mjs                  # 出典URLの死活を確認（週次でCIが実行）
node tools/expiring.mjs                   # 満了・パブコメが近い計画を検出（月次でCIが実行）
node tools/validate.mjs --fail-on-error   # 参照整合・enum・骨格を検査（error 0件が必須）
node tools/manifest.mjs                   # 出典台帳（sources/MANIFEST.md）の未登録を検出
```

ツール本体（上記5つ）は追加の依存なしで動き、**Node 18 以降**で動作します。
単体テスト（`node --test`、リポジトリ直下で実行）は Node 標準の `node:test` を使います。
`node --test` は Node 18.1 以降で動きますが、Node 20 で安定版になりました。18系では experimental の警告が出ます。
CI（`.github/workflows/`）も `actions/setup-node@v4` で `node-version: '20'` を指定しています。
開発環境は Node 20 以降を用意してください。

---

## 運用

### 1. 出典URLの寿命管理

自治体サイトでは、**入札公告・委員募集・実施中のパブリックコメントが掲載期間終了後に削除**されます。
実際、この資料の作成過程で「計画作成委員募集」と「策定業務入札公告」の2ページが数か月で失効しました。

対策は [`sources/POLICY.md`](sources/POLICY.md) にまとめています。要点だけ:

- 全出典に**最終確認日**を記す
- **消えやすい資料**（募集告示・入札公告・実施中パブコメ）は取得時に保存し、台帳に記録する
- **残りやすい一次資料**（議案書、議会会議録、決算審査意見書、施政方針、パブコメ実施予定一覧）を優先する
  - 実例: 介護保険事業計画は第7期・第8期・第9期とも、計画ページ側の単独PDFは削除されているのに、**議案書PDF内には全文が現存**しています
- 週次の `linkcheck` で失効を検知し、Issue で追う

### 2. 改訂

- 内容を変えたら `CHANGELOG.md` に追記する
- `data/plans.yml` の `meta.updated` と `meta.survey_date` を更新する
- HTML 側のヘッダにある調査基準日も揃える

### 3. 誤りの指摘

[CONTRIBUTING.md](CONTRIBUTING.md) を参照。Issue テンプレートを用意しています。

---

## セットアップ（GitHub Pages + 独自ドメイン）

**詳細な手順は [`SETUP.md`](SETUP.md) にあります。** ここでは要点だけ。

```bash
unzip iki-keikaku.zip && cd iki-keikaku
git init -b main && git add -A && git commit -m "壱岐市 計画マップ 初版"
gh repo create ikilab-org/iki-keikaku --public --source=. --remote=origin --push
```

1. **GitHub**: Settings → Pages → Source `Deploy from a branch`、Branch `main` / `/ (root)`
2. **DNS**: ikilab.org の DNS に CNAME を1件追加 — 名前 `keikaku` / 値 `ikilab-org.github.io.`
   （サブドメインなので A レコード不要。既存の ikilab.org には影響しません）
3. **GitHub**: Settings → Pages → Custom domain に `keikaku.ikilab.org` → 証明書の発行を待って **Enforce HTTPS**
4. **Actions**: Actions タブから `linkcheck` を手動実行して動作確認。Issue が作れず失敗する場合は
   Settings → Actions → General → Workflow permissions を `Read and write permissions` に

`.nojekyll` を置いてあるので、Jekyll のビルドは走らず、HTML がそのまま配信されます。

```bash
dig +short keikaku.ikilab.org        # ikilab-org.github.io. を返せばOK
curl -I https://keikaku.ikilab.org   # 200 と HTTPS を確認
```

DNSが引けるようになる前にカスタムドメインを設定するとエラーになります。**順序に注意してください。**
つまずいたときは [`SETUP.md`](SETUP.md) の「トラブルシューティング」を参照。

---

## フェーズ2: YAML から図表を生成する

計画の数が増えると、HTML を手で直す方式は破綻します。2段階で移行する想定です。
設計は [`docs/design/2026-08-12-zenkeikaku-bunrui.md`](docs/design/2026-08-12-zenkeikaku-bunrui.md)、
実装計画は [`docs/design/2026-08-12-zenkeikaku-bunrui-plan.md`](docs/design/2026-08-12-zenkeikaku-bunrui-plan.md) を参照してください。

### 第1段階（完了）: `data/plans.yml` にすべての計画を入れる

- 分野を `domain`（大分類）／`category`（小分類）の2階層にし、`statutory`（法定性）・`tier`（計画の階層）・
  `agency`（実施機関）・`conforms_to`（法令上の整合が求められる国・県計画）を追加
- 検査の土台として `tools/validate.mjs`（参照整合・enum・骨格）・`tools/yaml.mjs`（依存なしの最小YAMLパーサ）・
  `tools/manifest.mjs`（出典台帳の未登録検出）を新設
- **組織ごとの巡回で市の全機関を巡り終え、収録件数は31件から76件になった。** `domains`（大分類）8つを
  確定し、鉤括弧の中の引用も原本と照合した（詳細は「これから増やすもの」・`CHANGELOG.md` を参照）。
  その後、巡回で漏れていた2件を追加し、現在は78件
- 残る `todo:`（31件）の解消は継続中

### 第2段階（完了）: 全計画の俯瞰ページを生成する

`tools/build.mjs` が `data/plans.yml` から `plans/all/index.html` を生成します。
設計は [`docs/design/2026-08-13-zenkeikaku-zuhyou.md`](docs/design/2026-08-13-zenkeikaku-zuhyou.md)、
実装計画は [`docs/design/2026-08-13-zenkeikaku-zuhyou-plan.md`](docs/design/2026-08-13-zenkeikaku-zuhyou-plan.md)。

生成物はリポジトリにコミットします。GitHub Pages にビルド工程を入れずに済み、
計画を1本足したときに図がどう変わるかが差分でレビューできるためです。
`data/plans.yml` を変えたのに生成し忘れると、CI の `build --check` が落ちます。

こうすると、**計画を1本追加＝YAMLを数行足すだけ**になり、他自治体がフォークして自分の市版を作ることもできます。

### これから

- **`todo:` 31件の深掘り。** 令和8年12月〜令和9年2月に主要5計画のパブリックコメントが集中するので、
  そこに間に合わせることを優先します
- **分野別ページの拡充。** 俯瞰で全体が見えたので、掘り下げる分野の優先順位を決められます
- そのほか、レビューで挙がって未着手のものは [Issues](../../issues) にあります

---

## ライセンス

| 対象 | ライセンス | 全文 |
|---|---|---|
| 文章・図表・データ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja) | [`LICENSE`](LICENSE) |
| コード（HTML/CSS/JS、`tools/`、`.github/`） | [MIT](https://opensource.org/licenses/MIT) | [`LICENSE-CODE`](LICENSE-CODE) |

`LICENSE` / `LICENSE-CODE` はライセンス条文そのものです。**適用範囲の詳細は [`NOTICE.md`](NOTICE.md)、
選んだ理由とクレジットの記載例は [`about/license/`](about/license/) にあります。**

同じHTMLファイルに両方が含まれます。「何が書いてあるか」が CC BY 4.0、「どう表示しているか」が MIT です。

選択理由の要点:

- この資料は**使われなければ意味がない**ので、摩擦が最小のライセンスを選んだ
- CC BY 4.0 は政府標準利用規約（第2.0版）と互換で、**行政の法規担当が判断に迷わない**
- CC BY-SA は、市が自らの計画書に取り込む際にライセンスの波及範囲の判断が必要になり、実務上使われにくくなるため見送った
- CC0 は、解釈や「※推定」を含む資料で**出所が辿れなくなる**と数値だけが独り歩きするため見送った
- コードは**他自治体がフォークして自分の市版を作る**ことを想定しているので、帰属表示の置き場所で迷わない MIT にした

**引用元である壱岐市・長崎県・国の公表資料そのものの権利は各機関に帰属**します。
また、数値・事実そのものは著作物ではないため、ライセンスの対象外です。

## 連絡先

- Issue: このリポジトリの [Issues](../../issues)
- その他: ikilab.org の連絡先まで
