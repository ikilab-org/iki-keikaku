# 「長崎県の離島3市の地域福祉計画」の照合記録

作成 2026-09-15 ／ 対象 `plans/chiiki-fukushi-3shi/`（新規ノート）

3市の計画本体（PDF）だけを一次資料にして白紙から書いたノートの、数値・引用・付表の照合記録。
**この記録が終わるまで push しない。** 未リンクでも、push すれば公開ドメインで誰でも読める。

設計は [`docs/design/2026-09-15-chiiki-fukushi-3shi.md`](../design/2026-09-15-chiiki-fukushi-3shi.md)。
既存記録 [`2026-09-08-shougou.md`](2026-09-08-shougou.md) の五島市の保留4件・要確認1件は、この記録の「五島市」の節で閉じる。

## 突き合わせた原本

| 記号 | 資料 | 公開URL | 頁数 | PDF作成日（JST） | SHA-256 | 取得日 |
|---|---|---|---|---|---|---|
| I | 第3次壱岐市地域福祉計画（令和4年3月） | 掲載ページ `https://www.city.iki.nagasaki.jp/soshiki/shimin/ippan/10381.html` | 98 | 2022-03-17 | `f56748ffbd78c3f06fae56c236d52683fb6a682361248ba24da8181a428e6170` | 2026-09-08（既存記録と同一ファイル） |
| G | 第3期（令和4年度〜令和8年度）五島市地域福祉計画（令和4年3月） | `https://www.city.goto.nagasaki.jp/s028/010/030/010/fukusikeikaku2.pdf` | 94 | 2022-03-17（ModDate 2024-03-25） | `c063ca70ceb367a82cee68b7f7b2dea65a99e2619a38388925e29124c9fa6abe` | 2026-09-15（公開URLと一致） |
| T | 第4期対馬市地域福祉計画・地域福祉活動計画（令和5年3月） | `https://www.city.tsushima.nagasaki.jp/material/files/group/16/dai4kitiikifukushikeikakukoukaibann.pdf`（掲載ページ `/gyousei/soshiki/fukushi/fukushika/keikaku/tiikifukusikeikaku/5004.html`、更新日 2023-04-12） | 96 | 2023-04-06 | `5a49a7ec74fad49d57377cb6199f61c2c7099d838f25fa5c2100d9f62d531530` | 2026-09-15（公開URLと一致） |

ページ番号は**印字ページ**で書く。通し番号との差：I ＋8、G ＋6（p.62-2〜62-10 の挿入後の資料編は ＋16）、T ＋8。
Task 1 Step 3 で通し44→印字36（I）、通し32→印字26・通し72「62-4」（G本編）、通し80→印字64（G資料編）、通し10→印字2・通し92→印字84（T）を抽出テキストの印字ページ行で確認し、上記の差を確定した。

`pdftotext -layout` で全文を抽出し、数値は抽出テキストで、鉤括弧と空白の字種は画像で確認した。

## 確定値

（Task 2〜4・14 で埋める）

| 記号 | 値 | 根拠 |
|---|---|---|
| A_TABLES | | 付表A |
| A_ROWS | | 付表A |
| A_DOWN | | 付表A「向き」＝減 |
| A_RATE | | 付表A 指標名が率・割合・満足度・全国比 |
| A_CITY / A_SHAKYO | | 付表A 主体区分 |
| B_ROWS | | 付表B |
| B_NUM | | 付表B R9目標に数値 |
| B_KEEP | | 付表B 継続のみ |
| I_KENIKI_P | | 壱岐の節 |
| I_KEIKA | | 壱岐の節 |
| I_CHAIR | | 壱岐の節 |

## 付表A ― 五島市 第4章の指標 全件

（Task 2）

## 付表B ― 対馬市 第7章 社協実施計画の指標 全件

（Task 3）

## 付表C ― 壱岐市が毎年集計している系列と、五島・対馬の同種の指標

（Task 4）

## 照合結果 ― 壱岐市（I）

（Task 4）

## 照合結果 ― 五島市（G）

（Task 5）

## 照合結果 ― 対馬市（T）

（Task 6）

## 見つかった相違・記載なし

（Task 4〜6 で通し番号を振って追記する）
