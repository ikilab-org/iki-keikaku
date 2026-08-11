# 壱岐市 計画マップ

長崎県壱岐市の行政計画について、**計画どうしの関係を図にし、個別の計画を深掘りできる**ようにした資料集です。
公開情報だけを使い、出典をすべて明示しています。

- 公開URL: https://keikaku.ikilab.org
- 運営: [ikilab](https://ikilab.org) ／ リポジトリ: [github.com/ikilab-org/iki-plans](https://github.com/ikilab-org/iki-plans)
- 調査基準日: `data/plans.yml` の `meta.survey_date` を参照

> **この資料は壱岐市の公式資料ではありません。** 公表資料をもとに独立して整理したものです。
> 誤りを見つけたら [Issue](../../issues/new/choose) か README 末尾の連絡先まで。詳細は [DISCLAIMER.md](DISCLAIMER.md)。

---

## いま公開しているもの

| ページ | 内容 |
|---|---|
| [`/`](index.html) | ハブ。分野ごとの入口 |
| [`/plans/fukushi/`](plans/fukushi/) | **福祉分野の計画体系マップ** — 国・長崎県・市の階層、計画期間タイムライン、一覧、地域福祉計画と個別計画の対応 |
| [`/plans/kaigo-7-9/`](plans/kaigo-7-9/) | **介護保険事業計画 第7期・第8期の検証** — 前提 → 計画 → 実施 → 成果。実績は第9期計画・決算・統計から取っている |
| [`/about/license/`](about/license/) | ライセンスと、その選択理由。クレジットの記載例つき |

## これから増やすもの

福祉分野に限らず、**壱岐市が持つすべての計画の関連性を図示し、個別の計画に深掘りできる**構成を目指しています。
`data/plans.yml` には未調査の計画も `todo:` 付きで入れてあり、`node tools/expiring.mjs` で残りが一覧できます。

優先順位の考え方:

1. **改定期が近い計画から**。令和8年12月〜令和9年2月に5計画がパブリックコメントにかかるため、そこに間に合うものを先に
2. **上位計画とのつながりが強いもの**（総合計画・過疎計画・公共施設等総合管理計画）
3. その他

---

## リポジトリの構成

```
.
├── index.html              ハブページ
├── plans/                  分野ごとのマップ（1ディレクトリ＝1ページ、単一HTML）
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
├── assets/                 OGP画像（1200×630）
├── tools/
│   ├── linkcheck.mjs       出典URLの死活チェック
│   ├── expiring.mjs        満了・パブコメが近い計画の検出
│   └── og/                 OGP画像の生成（cards.html + build.mjs）
├── docs/                   分析報告書など（Markdown）
├── .github/workflows/      上記2つを定期実行して Issue を立てる
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
現時点では HTML は手書きですが、**フェーズ2としてこの YAML から図表を生成する**設計にしてあります（下記）。

いま時点でも YAML が効いているのは次の2つです。

```bash
node tools/linkcheck.mjs      # 出典URLの死活を確認（週次でCIが実行）
node tools/expiring.mjs       # 満了・パブコメが近い計画を検出（月次でCIが実行）
```

`linkcheck` は Node 18 以降であれば追加の依存なしで動きます。

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
unzip iki-plans.zip && cd iki-plans
git init -b main && git add -A && git commit -m "壱岐市 計画マップ 初版"
gh repo create ikilab-org/iki-plans --public --source=. --remote=origin --push
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

## フェーズ2（予定）: YAML から図表を生成する

計画の数が増えると、HTML を手で直す方式は破綻します。次の順で移行する想定です。

1. `data/plans.yml` にすべての計画を入れる（`todo:` を消していく）
2. `tools/build.mjs` を書き、YAML から **階層体系図・タイムライン・一覧表** を生成する
3. `plans/*/index.html` は「生成された共通パーツ＋そのページ固有の分析」という構成にする
4. 共通スタイルを `assets/base.css` に切り出す

こうすると、**計画を1本追加＝YAMLを数行足すだけ**になり、他自治体がフォークして自分の市版を作ることもできます。

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
