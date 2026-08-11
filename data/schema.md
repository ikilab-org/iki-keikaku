# data/plans.yml のスキーマ

年度はすべて**西暦の年度**で書きます（`2022` = 令和4年度 = 2022年4月〜2023年3月）。
令和への換算は `meta.era_base`（= 2018）を足し引きします。令和n年 = 2018 + n。

## トップレベル

```yaml
meta:
  updated: 2026-08-11      # このファイルの最終更新日
  survey_date: 2026-08-10  # 記載内容の調査基準日
  era_base: 2018

plans: [ ... ]             # 計画の配列
categories: { ... }        # 分野の定義（色分け・グルーピング用）
```

## plans[] の各フィールド

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | ○ | string | 一意のID。英小文字・数字・ハイフン。他の計画から参照される |
| `name` | ○ | string | 正式名称 |
| `short` | | string | 図表用の短縮名 |
| `level` | ○ | enum | `national` / `prefectural` / `municipal` / `council`（社協） |
| `category` | ○ | string | `categories` のキー |
| `status` | ○ | enum | `current` 現行 / `expiring` 期間中だが満了が近い / `expired` 満了済み（履歴として保持） / `planned` 策定予定 / `unknown` 未調査 |
| `period` | | object | `{ start: 年度, end: 年度 }`。随時修正の計画は `null` |
| `adopted` | | string | 策定年月（`2024-03`） |
| `laws` | | string[] | 根拠法。条項まで書く |
| `department` | | string | 所管課・班。根拠は行政組織規則（[下記](#department)） |
| `parent` | | id | 上位計画のID |
| `includes` | | id[] | この計画に包含されている法定計画のID |
| `embedded_in` | | id | 自身が包含されている親計画のID（`includes` の逆） |
| `related` | | id[] | 整合・連携する計画のID |
| `predecessors` | | id[] | 前期計画のID（新しい順） |
| `successor` | | object | 次期計画。`name` / `status` / `period` / `public_comment` |
| `url` | | string | 主となる掲載ページ |
| `pdf` | | string | 計画本体のPDF |
| `sources` | | object[] | 補助的な出典。`{ label, url, note }` |
| `notes` | | string | 内容の要点、注意事項 |
| `todo` | | string | 未調査の内容。書いてあるものは `tools/expiring.mjs` が一覧に出す |

### department

所管課・班を書きます。**掲載ページの「このページに関するお問い合わせ」を根拠にしないでください。**
組織改編があっても更新されないことがあり、計画本文の課名は策定時点で固定されます。
[壱岐市行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html)
第3条（部の内部組織）・第4条（所掌事務）を根拠にします。詳しくは
[`sources/POLICY.md`](../sources/POLICY.md)「所管課は例規集で確認する」を参照。

**一体策定された計画は、所管が複数の課にまたがることがあります。** その場合は全角スラッシュ `／` で区切り、
どの部分の所管かを括弧で示します。

```yaml
# 1課のとき
department: 市民福祉課 地域福祉班

# 複数課にまたがるとき
department: 保険課 介護保険班（介護保険事業計画）／長寿支援課 長寿福祉班（高齢者福祉計画）
```

区切りに中黒 `・` は使わないでください。`保険課 国保・後期・年金班` のように、**班名そのものに中黒を含む**
ものがあり、区切りと区別できなくなります。

**`laws` が複数ある計画は、所管も複数である可能性を疑ってください。** 上の例では
`laws: [老人福祉法20条の8, 介護保険法117条]` の2本が、そのまま2課の分担に対応しています。
老人福祉法に基づく部分（＝高齢者福祉計画）が長寿支援課、介護保険法に基づく部分（＝介護保険事業計画）が保険課です。

### successor

```yaml
successor:
  name: 壱岐市高齢者福祉計画・第10期介護保険事業計画
  status: planned
  period: { start: 2027, end: 2029 }
  public_comment: { start: 2026-12, end: 2027-01 }   # YYYY-MM
```

`public_comment` があると `tools/expiring.mjs` が「パブコメが近い計画」として拾います。

### sources

消えやすい出典や、参照箇所が特殊な出典に使います。

```yaml
sources:
  - label: 議案書収録版（平成30年3月会議 議案第22号／179ページ）
    url: https://...
    note: 認定者数推計は PDF 107ページ・144ページ（計画本体 p.12・p.49）
```

## categories

```yaml
categories:
  fukushi: { label: 地域福祉（総論・横断）, slot: 1 }
```

`slot` は色の割り当て番号です。データ可視化の配色は、色覚特性を考慮して検証した並び順に依存するため、
**slot の番号は勝手に入れ替えないでください**（1→2→3… の隣接ペアで検証済みの並びになっています）。
分野を増やす場合は、既存の slot を動かさずに末尾へ足すか、配色の再検証を行ってください。

## バリデーション

現時点で厳密なスキーマ検証はしていません。追加・変更したら次を流してください。

```bash
node tools/linkcheck.mjs   # URLが生きているか
node tools/expiring.mjs    # 期間の入力ミスで変な年度が出ていないか
```

## フェーズ2に向けて

将来、このファイルから階層体系図・タイムライン・一覧表を生成する予定です（README 参照）。
そのため、**表示のための情報（色・並び順・レイアウト）はここに書かず**、
事実（期間・根拠法・所管・関係）だけを持たせてください。
