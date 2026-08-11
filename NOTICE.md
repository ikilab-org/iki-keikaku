# ライセンスの適用範囲

このリポジトリは、対象によって2つのライセンスを使い分けています。
**選んだ理由とクレジットの記載例は [`about/license/`](about/license/) を参照してください。**

| 対象 | ライセンス | ファイル |
|---|---|---|
| 文章・図表・データ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja) | [`LICENSE`](LICENSE) |
| コード | [MIT](https://opensource.org/licenses/MIT) | [`LICENSE-CODE`](LICENSE-CODE) |

© 2026 ikilab

## どのファイルがどちらか

**CC BY 4.0（文章・図表・データ）**

- `index.html`、`plans/*/index.html`、`about/*/index.html` に含まれる**記述内容**（本文、見出し、表の中身、図表に載せた数値と説明）
- `data/` 以下のデータ
- `README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`DISCLAIMER.md`、`NOTICE.md`
- `sources/` 以下のドキュメント
- `docs/` 以下のドキュメント

**MIT（コード）**

- 上記HTMLファイルに含まれる**マークアップ・スタイル・スクリプト**
- `tools/` 以下のスクリプト
- `.github/workflows/` 以下のワークフロー定義
- `.github/ISSUE_TEMPLATE/` 以下のテンプレート

同じHTMLファイルの中に両方が含まれます。**「何が書いてあるか」が CC BY 4.0、「どう表示しているか」が MIT** と考えてください。

## このライセンスが及ばないもの

### 1. 引用元の公表資料そのもの

壱岐市、長崎県、厚生労働省その他の機関が公表している計画書、議案書、会議録、統計等の著作権は、**各機関に帰属します。**
このリポジトリのライセンスは、それらを引用・参照したうえで独自に作成した図表・文章・コードにのみ適用されます。

壱岐市のウェブサイトには二次利用ルールの明示がないため（[著作権・免責事項](https://www.city.iki.nagasaki.jp/3313.html)）、
原本（PDF等）の再公開は行っていません。出典のURL・取得日・参照箇所を記録し、引用の範囲での掲載にとどめています。
詳細は [`sources/POLICY.md`](sources/POLICY.md) を参照。

### 2. 数値・事実そのもの

人口、認定者数、給付費といった数値や、計画期間・根拠法といった事実は、そもそも著作物ではないため、
ライセンスの対象外です。出典を確認したうえで自由にお使いください。

## クレジットの記載例

資料・スライドに図表を使う場合:

```
出典：壱岐市 計画マップ（ikilab）CC BY 4.0
https://keikaku.ikilab.org/plans/fukushi/
```

内容を変えて使う場合は「改変して作成」の一言を足してください。
他のパターン（ウェブ掲載、フォーク、引用の範囲での利用）は [`about/license/`](about/license/) にあります。

## メンテナンス上の注記

`LICENSE` には CC BY 4.0 の法的条文を **creativecommons.org の正典からそのまま**入れています。
編集しないでください。更新が必要になった場合は、次で取り直します。

```bash
curl -sL -o LICENSE https://creativecommons.org/licenses/by/4.0/legalcode.txt
```

日本語の公式訳（参考）: https://creativecommons.org/licenses/by/4.0/legalcode.ja

著作者名を `ikilab` 以外にする場合は、`LICENSE-CODE`、`NOTICE.md`、
`about/license/index.html`、各ページのフッタを書き換えてください
（`LICENSE` は CC の条文そのものなので、著作者名は含まれません）。
