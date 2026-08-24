# 公共施設等総合管理計画のページを足す（実装計画）

> **エージェントで実行する場合:** 必須サブスキル ── `superpowers:subagent-driven-development`（推奨）
> または `superpowers:executing-plans` を使い、タスク単位で実装してください。
> 手順はチェックボックス（`- [ ]`）で追跡します。

作成 2026-08-25 ／ 設計 [`2026-08-25-koukyoshisetsu-shisetsu-2036.md`](2026-08-25-koukyoshisetsu-shisetsu-2036.md)

**ゴール:** 外部で書かれた下書き `shisetsu-2036.html` を、計画本体PDFと照合したうえで
`plans/shisetsu-2036/` として公開し、`data/plans.yml` の公共施設2件の `todo` を解消する。

**進め方:** 照合を先に全部済ませ（タスク1〜3）、その結果で `data/plans.yml` を直し（タスク4）、
OGP画像とハブのカードを先に置いて `node --test` が通る土台を作り（タスク5〜6）、
本文を章ごとに直す（タスク7〜10）。最後に周辺文書と全検証（タスク11）。

**使うもの:** Node 20以降（現環境 v25.6.0）／`node:test`／`pdftotext`・`pdftoppm`（poppler、導入済み）／
`playwright` + `sharp`（OGP生成時のみ、npm で都度導入）／依存なしの自前ツール `tools/*.mjs`

---

## 全体の制約

設計文書の決定事項です。**すべてのタスクにこの節が暗黙に付きます。**

- **slug は `plans/shisetsu-2036/`。** ディレクトリ名を変えない
- **title は `壱岐市 公共施設等総合管理計画 ― 1人あたり面積とライフサイクルコスト | 壱岐市 計画マップ`**
- **canonical と `og:url` は `https://keikaku.ikilab.org/plans/shisetsu-2036/`。** 末尾スラッシュ形。`index.html` は書かない
- **分野色 `--c1`〜`--c8` をページ側で定義しない。** `assets/palette.css` を `../../assets/palette.css` で読み、
  系列色は `var(--c1)`〜`var(--c3)` を参照する。**地の色（`--ground` `--ink` `--line` など）は
  既存4枚と同じくページ内に持ってよい**（`tools/pages.test.mjs` が禁じているのは `--c1`〜`--c8` の再定義だけ）
- **外部から読むのは `assets/palette.css` だけ。** Google Fonts の `<link>` を残さない
- **PDFの原本をリポジトリにコミットしない**（`sources/POLICY.md`「4. 保存の方法」）。作業は下記の作業ディレクトリで行う
- **鉤括弧の中は原文どおり。** 全角・半角、中黒、括弧、送り仮名、句読点まで一字一句
- **推測には印をつける。** 本文は「※推定」、確認できなかったものは `未確認` タグ
- **原因を断定しない。** 差は差として書き、評価は読み手に残す（`CONTRIBUTING.md` 6）
- **照合結果を曲げない。** 原本と合わなければ原本に合わせ、直せない箇所は落とす
- **コミットメッセージは日本語。** 何をどう変えたかが分かれば十分

**作業ディレクトリ**（リポジトリ外。以下 `$WORK` と書くが、シェルの状態は跨がないので毎回フルパスで打つ）

```
/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
```

---

## 触るファイル

| ファイル | 役割 | タスク |
|---|---|---|
| `docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md` | 設計。**照合の記録をここに追記する** | 1・2・3 |
| `data/plans.yml` | 計画の真実。`kokyoshisetsu-sougou` / `kokyoshisetsu-kobetsu` | 4 |
| `plans/all/index.html` | 生成物。`build.mjs` が出す。**手で編集しない** | 4 |
| `tools/og/cards.html` | OGPカードのテンプレート | 5 |
| `tools/og/build.mjs` | `CARDS` に1行 | 5 |
| `assets/og-shisetsu-2036.png` | 新規。1200×630 | 5 |
| `index.html` | ハブ。カード1枚 | 6 |
| `plans/shisetsu-2036/index.html` | 新規。ページ本体 | 6〜10 |
| `sources/MANIFEST.md` | 出典台帳 | 11 |
| `README.md` | 公開一覧の表、`todo` 件数3か所 | 4・11 |
| `CHANGELOG.md` | 1節 | 11 |

---

## タスク1: 計画本体PDFの取得と記録

**受け取るもの:** なし
**次に渡すもの:** 作業ディレクトリに `sougou.pdf` / `kobetsu.pdf` / それぞれの `.txt`、
設計文書の「11. 照合の記録」節に取得日・SHA-256・ページ数

**ファイル**
- 変更: `docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md`（末尾に節を追加）

- [ ] **手順1: 下書きとPDFを作業ディレクトリに置く**

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
mkdir -p "$W/shisetsu"
cp /Users/yet2come/Downloads/shisetsu-2036.html "$W/shisetsu/draft.html"
curl -sS -L --max-time 120 -o "$W/shisetsu/sougou.pdf" \
  https://www.city.iki.nagasaki.jp/material/files/group/5/sougoukannrikeikakukaitei.pdf
curl -sS -L --max-time 120 -o "$W/shisetsu/kobetsu.pdf" \
  https://www.city.iki.nagasaki.jp/material/files/group/5/kobetusisetukeikakukaitei.pdf
ls -l "$W/shisetsu"
```

期待: `sougou.pdf` が約4.5MB、`kobetsu.pdf` が約2.7MB、`draft.html` が約31KB。

- [ ] **手順2: SHA-256・ページ数・PDF作成日を採る**

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
for f in sougou kobetsu; do
  echo "=== $f ==="
  shasum -a 256 "$W/shisetsu/$f.pdf"
  pdfinfo "$W/shisetsu/$f.pdf" 2>/dev/null | grep -E "^(Pages|CreationDate|ModDate|Title)" \
    || pdftotext -l 1 "$W/shisetsu/$f.pdf" - | head -5
done
date +%F
```

`pdfinfo` が無ければ `pdftotext` の出力で代替し、ページ数は次の手順の抽出結果から数えます。

- [ ] **手順3: 全文を抽出する**

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
for f in sougou kobetsu; do
  pdftotext -layout "$W/shisetsu/$f.pdf" "$W/shisetsu/$f.txt"
  printf '%s: ' "$f"; grep -c $'\f' "$W/shisetsu/$f.txt"   # 改ページ数＝ページ数−1
done
wc -c "$W/shisetsu/"*.txt
```

期待: どちらも本文が取れている（0バイトなら画像PDFなので、手順4で `pdftoppm` に切り替える）。

- [ ] **手順4: 抽出できなかった場合だけ、ページを画像化して読む**

`*.txt` が空か極端に短い場合のみ実行します。**取れている場合は飛ばしてください。**

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
pdftoppm -r 150 -png -f 1 -l 20 "$W/shisetsu/sougou.pdf" "$W/shisetsu/sougou-p"
ls "$W/shisetsu/" | head
```

出力したPNGは画像として読み、数値を目視で拾います。この場合は照合記録に
**「テキスト層が無く画像から読み取った」ことを明記**してください。

- [ ] **手順5: 設計文書に「11. 照合の記録」を起こす**

`docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md` の末尾に、実際に採った値で追記します。
`YYYY-MM-DD` と `xxxx` は手順2の出力に置き換えてください。

```markdown

---

## 11. 照合の記録

取得日 YYYY-MM-DD。原本はリポジトリに置いていません（`sources/POLICY.md`「4. 保存の方法」）。

| 資料 | URL | ページ数 | SHA-256 |
|---|---|---|---|
| 壱岐市公共施設等総合管理計画（令和4年3月改訂） | `/material/files/group/5/sougoukannrikeikakukaitei.pdf` | ― | `xxxx…` |
| 壱岐市公共施設個別施設計画（令和4年3月改訂） | `/material/files/group/5/kobetusisetukeikakukaitei.pdf` | ― | `xxxx…` |

### 11.1 数値と引用

（タスク2で埋める）

### 11.2 第Ⅵ章の制度の裏づけ

（タスク3で埋める）
```

- [ ] **手順6: コミット**

```bash
git add docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md
git commit -m "計画本体PDFを取得し、取得日とSHA-256を照合記録に残す"
```

---

## タスク2: 数値と引用の照合

**受け取るもの:** タスク1の `sougou.txt` / `kobetsu.txt`
**次に渡すもの:** 設計文書 11.1 に全項目の照合結果。**タスク4の `period` と、タスク7〜10 の本文の正しい値**

**ファイル**
- 変更: `docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md`（11.1）

- [ ] **手順1: 主要な数値を抽出テキストから引く**

設計 3.2 の表の順に、1件ずつ確認します。ページ番号は `\f`（改ページ）を数えて求めます。

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
S="$W/shisetsu/sougou.txt"
# ページ番号つきで grep する（1ページ目を1とする）
pg() { awk -v pat="$1" 'BEGIN{p=1} {if($0 ~ pat) printf "p.%d: %s\n", p, $0} /\f/{p++}' "$S"; }
pg '292,058|292058'
pg '11\.7'
pg '24,974'
pg '28,900'
pg '18,151'
pg '212,367'
pg '48\.5|27\.5|21\.0|23\.6|38\.1'
pg '8\.3億|19\.2|25億4'
pg '10,795'
pg '408'
```

- [ ] **手順2: 計画期間を確定する**

`todo: 計画期間を確認する` を解くための項目です。**両方の計画について**確認します。

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
for f in sougou kobetsu; do
  echo "=== $f ==="
  grep -nE '計画期間|対象期間|計画の期間|令和[0-9]+年度?から|〜令和[0-9]+年度' "$W/shisetsu/$f.txt" | head -20
done
```

期待: 「令和◯年度から令和◯年度まで」の形の記述。**年度は西暦に直して記録します**
（`data/schema.md`「年度は西暦（2022 = 令和4年度）」、令和n年 = 2018 + n）。

見つからない場合は `period` を書かず `todo` を残し、**その事実を 11.1 に「原本に計画期間の明記なし」と記録**します。

- [ ] **手順3: 鉤括弧の引用を一字一句照合する**

下書きが引用している3か所です。**抽出テキストからコピーして本文に貼り、目で打ち直さないでください。**

1. 用語集のLCC定義（下書き第Ⅵ章）
2. 老朽化の集中時期（下書き第Ⅶ章、「昭和43年」「平成42年」を含む一文）
3. 削減目標の算定式（下書き第Ⅲ章の `.quote`。ここは下書き側が式に組み直しているので、**原文の文言と一致するかを確認し、一致しないなら鉤括弧を外して自分の記述にする**）

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
grep -nE 'ライフサイクルコスト' "$W/shisetsu/sougou.txt" | head
grep -nE '昭和43年|平成7年|平成28年|平成42年' "$W/shisetsu/sougou.txt" | head
```

- [ ] **手順4: 個別施設計画の費用単価の出所を確認する**

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
grep -nE '建築物のライフサイクルコスト|国土交通省' "$W/shisetsu/kobetsu.txt" | head
```

- [ ] **手順5: IKILAB計算を、確定した原本値で再計算する**

設計 3.3 の9件を、手順1で確定した値で計算し直します。**設計時の検算値と一致するかを確認してください。**

```bash
node -e '
const A=292058, P=[22245,19910,18815], U=11.7;
const a36=A*0.8875;
console.log("2036年の面積", a36, "→", Math.round(a36));
console.log("削減面積", A-Math.round(a36));
console.log("解体費", (A-Math.round(a36))*28900, "円 /15年", Math.round((A-Math.round(a36))*28900/15));
console.log("単価検算", 88000*28900);
for(const p of P) console.log(p, "→ 1人あたり", (Math.round(a36)/p).toFixed(2),
  "／必要面積", Math.round(p*U), "／削減率", ((A-Math.round(p*U))/A*100).toFixed(1)+"%");
for(const r of [11.25,15,30]) console.log(r+"%: 更新費", (27.5-8.3*(r/30)).toFixed(1),
  "合計", (27.5-8.3*(r/30)+21.0).toFixed(1), "差", (27.5-8.3*(r/30)+21.0-38.1).toFixed(1));
'
```

期待（設計時の検算値）:

```
2036年の面積 259201.475 → 259201
削減面積 32857
解体費 949567300 円 /15年 63304487
単価検算 2543200000
22245 → 1人あたり 11.65 ／必要面積 260267 ／削減率 10.9%
19910 → 1人あたり 13.02 ／必要面積 232947 ／削減率 20.2%
18815 → 1人あたり 13.78 ／必要面積 220136 ／削減率 24.6%
11.25%: 更新費 24.4 合計 45.4 差 7.3
15%: 更新費 23.4 合計 44.4 差 6.3
30%: 更新費 19.2 合計 40.2 差 2.1
```

**原本の値が下書きと違っていたら、上の入力値を差し替えて計算し直し、その結果を 11.1 に記録します。**

- [ ] **手順6: 11.1 を埋める**

設計 3.2 の15項目すべてについて、次の形で書きます。**「確認していない」を空欄で誤魔化さないでください。**

```markdown
### 11.1 数値と引用

| 確認した値 | 結果 | 原本の位置 |
|---|---|---|
| 延床面積 292,058㎡ | 一致 | p.◯ |
| 1人あたり 11.7㎡ | 一致 | p.◯ |
| … | 相違（原本は◯◯） | p.◯ |
| … | 原本に見当たらず | ― |

**計画期間** ── 総合管理計画 令和◯年度〜令和◯年度（西暦 ◯◯◯◯〜◯◯◯◯、p.◯）／
個別施設計画 …

**下書きと原本が違った点** ──（無ければ「なし」と書く）

**IKILAB計算の再計算** ── 手順5の出力と一致／不一致（不一致なら差し替えた値を書く）
```

- [ ] **手順7: コミット**

```bash
git add docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md
git commit -m "計画本体と個別施設計画の数値・引用・計画期間を照合する"
```

---

## タスク3: 第Ⅵ章の制度の裏づけ

**受け取るもの:** なし（タスク1・2と独立）
**次に渡すもの:** 設計文書 11.2 に、起債・交付税措置の一次資料のURLと、
**「残す／落とす」の判断。タスク9がこれに従う**

**ファイル**
- 変更: `docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md`（11.2）

- [ ] **手順1: 一次資料を探す**

`WebSearch` / `WebFetch` で次を探します。**総務省・財務省など発出元のドメインの資料に限ります。**
解説記事やコンサルの資料は根拠にしません。

| 確認したいこと | 探す資料 |
|---|---|
| 公共施設等適正管理推進事業債の対象事業・充当率・交付税措置率 | 総務省「公共施設等の適正管理の推進」／地方債同意等基準 |
| 除却（解体）に単独で交付税措置があるか | 同上。**「公共施設等適正管理推進事業債（除却）は充当率90%・交付税措置なし」という理解が正しいか** |
| 建設事業に対する起債と交付税措置 | 過疎対策事業債・合併特例債など、壱岐市が使える区分 |
| 運用費（光熱水費・委託料・人件費）が起債の対象外であること | 地方財政法5条（適債事業の限定列挙） |

- [ ] **手順2: 判断する**

- **一次資料でURLまで取れたもの** → 残す。出典表に `label` と URL を書く
- **取れなかったもの** → **その記述を落とす。** 下書きの第Ⅵ章「この2つが表に出ないと、
  次のような判断が起きやすくなります」以下の箇条書きは、裏が取れた項目だけ残す
- **全部落ちた場合** → 第Ⅵ章は前半（48.5億円の範囲と用語集の定義のずれ、範囲が違うと判断が変わる）
  だけで成立します。章は残ります

- [ ] **手順3: 11.2 を埋める**

```markdown
### 11.2 第Ⅵ章の制度の裏づけ

| 確認したいこと | 結果 | 出典 |
|---|---|---|
| 適正管理推進事業債の充当率・交付税措置率 | 確認できた／できなかった | URL |
| 除却に対する交付税措置の有無 | | |
| 運用費が起債の対象外であること | | |

**判断** ── 残す項目：… ／ 落とす項目：…
```

- [ ] **手順4: コミット**

```bash
git add docs/design/2026-08-25-koukyoshisetsu-shisetsu-2036.md
git commit -m "第Ⅵ章の起債・交付税措置の一次資料を確認する"
```

---

## タスク4: `data/plans.yml` の更新と `plans/all/` の再生成

**受け取るもの:** タスク2の計画期間、両PDFのURL
**次に渡すもの:** `todo` 2件の解消、`plans/all/index.html` の再生成、`README.md` の `todo` 件数

**ファイル**
- 変更: `data/plans.yml:1038-1065` 付近（`kokyoshisetsu-sougou` / `kokyoshisetsu-kobetsu`）
- 変更: `plans/all/index.html`（生成物）
- 変更: `README.md`（`todo` 件数3か所）

- [ ] **手順1: いまの状態を確認する**

```bash
node tools/validate.mjs --fail-on-error; echo "exit=$?"
node tools/expiring.mjs | sed -n '/未調査の項目/p'
```

期待: `exit=0`、`## 未調査の項目（31件）`。

- [ ] **手順2: 2件を書き換える**

`data/plans.yml` の該当箇所を、タスク2で確定した計画期間で書き換えます。
**`period` の年度は西暦です**（`data/schema.md`）。`todo` の行は削除します。

```yaml
  - id: kokyoshisetsu-sougou
    name: 壱岐市公共施設等総合管理計画
    level: municipal
    domain: gyouzaisei
    category: koukyoshisetsu
    tier: shisetsu
    status: current
    period: { start: 2021, end: 2061 }   # ← タスク2で確定した値に置き換える
    adopted: 2022-03
    statutory: request
    department: 財政課 契約管財班
    url: https://www.city.iki.nagasaki.jp/shisei/machidukuri/keikaku/3750.html
    pdf: https://www.city.iki.nagasaki.jp/material/files/group/5/sougoukannrikeikakukaitei.pdf
    notes: >-
      平成26年4月の総務省要請に基づき策定。令和4年3月に改訂。延床面積292,058㎡・408施設を対象に、
      令和23年度（2041年度）までに15%、令和43年度（2061年度）までに30%の縮減を目標とする。
      30%は「将来人口18,151人 × 現在の1人あたり11.7㎡」から導いた値で、直接の変数は人口。
      掘り下げは plans/shisetsu-2036/ を参照。

  - id: kokyoshisetsu-kobetsu
    name: 壱岐市公共施設個別施設計画
    level: municipal
    domain: gyouzaisei
    category: koukyoshisetsu
    tier: shisetsu
    status: current
    period: { start: 2021, end: 2030 }   # ← タスク2で確定した値に置き換える
    adopted: 2022-03
    statutory: request
    department: 財政課 契約管財班
    url: https://www.city.iki.nagasaki.jp/shisei/machidukuri/keikaku/8574.html
    pdf: https://www.city.iki.nagasaki.jp/material/files/group/5/kobetusisetukeikakukaitei.pdf
    related: [kokyoshisetsu-sougou]     # 無向。相手側には書かない（data/schema.md）
    notes: >-
      平成29年3月策定、令和4年3月に内容を改訂。公共施設等総合管理計画の基本方針に基づき、
      施設ごとの方向性・実施事項を定める。費用単価の出所は国土交通省『建築物のライフサイクルコスト』
      （第4章1）。
```

**計画期間が原本で確認できなかった場合は、`period` を書かず `todo` を残します。**
その場合は手順5の README の件数も変わりません（該当分だけ減らす）。

- [ ] **手順3: 検査と再生成**

```bash
node tools/validate.mjs --fail-on-error; echo "validate exit=$?"
node tools/build.mjs
git diff --stat plans/all/index.html
```

期待: `validate exit=0`。`plans/all/index.html` に差分が出る（タイムラインに2件が並ぶため）。

- [ ] **手順4: `build --check` と既存テスト**

```bash
node tools/build.mjs --check; echo "check exit=$?"
node --test 2>&1 | tail -5
```

期待: どちらも成功。この時点ではまだ新ページが無いので `pages.test.mjs` は5ページを見ます。

- [ ] **手順5: `todo` の件数を数え直して README を直す**

```bash
node tools/expiring.mjs | sed -n '/未調査の項目/p'
```

期待: `## 未調査の項目（29件）`（2件解消した場合）。

`README.md` の**3か所**を、この見出しの数字に合わせます。

| 行 | いまの文 |
|---|---|
| 41 | ``data/plans.yml` には未調査の項目が `todo:`（31件）付きで残っており` |
| 195 | `- 残る `todo:`（31件）の解消は継続中` |
| 211 | `- **`todo:` 31件の深掘り。**` |

**32行目と192行目の「31件から78件」「31件から76件」は触らないでください。**
これは収録件数の推移の記録で、`todo` の件数ではありません。

```bash
grep -n "31件" README.md
```

期待: 直したあとに残るのは32行目と192行目の2件だけ。

- [ ] **手順6: 台帳の未登録を確認する**

```bash
node tools/manifest.mjs
```

新しい `pdf` 2本が未登録として出ます。**登録はタスク11でまとめて行うので、ここでは出力を確認するだけです。**

- [ ] **手順7: コミット**

```bash
git add data/plans.yml plans/all/index.html README.md
git commit -m "公共施設2計画の計画期間を確定し、俯瞰ページを生成し直す"
```

---

## タスク5: OGP画像

**受け取るもの:** なし
**次に渡すもの:** `assets/og-shisetsu-2036.png`（1200×630）。
**タスク6の `node --test` はこのファイルが実在しないと落ちます**

**ファイル**
- 変更: `tools/og/cards.html`（末尾の `</body>` の直前）
- 変更: `tools/og/build.mjs:26-31`（`CARDS`）
- 作成: `assets/og-shisetsu-2036.png`

- [ ] **手順1: 生成に要るものを入れる**

`package.json` と `node_modules/` は `.gitignore` 対象です。**コミットしません。**

```bash
npm i -D playwright sharp
npx playwright install chromium
```

- [ ] **手順2: カードを足す**

`tools/og/cards.html` の `</body>` の直前に入れます。既存の `#og-koutsuu` と同じ体裁
（`.L` に eyebrow / ttl / lead / foot、`.R` に `.mini`）です。**`--c5` は行財政運営の色です。**

```html
<!-- =============== 公共施設 =============== -->
<div class="card" id="og-shisetsu-2036">
  <div class="L">
    <div>
      <div class="eyebrow">壱岐市 計画マップ ／ 公共施設</div>
      <div class="ttl sm">公共施設等<br>総合管理計画<br>2036年で切る</div>
      <div class="lead">面積を計画どおり減らしても、<br>1人あたりの床面積は<br>11.7㎡ → 13.78㎡。</div>
    </div>
    <div class="foot"><span class="dom">keikaku.ikilab.org</span><span class="by">CC BY 4.0</span></div>
  </div>
  <div class="R">
    <div class="mini">
      <div class="cap">1人あたり公共施設面積（㎡・推計）</div>
      <svg class="ln" viewBox="0 0 560 200" role="img" aria-label="1人あたり面積が2021年の11.86平方メートルから2036年の13.78平方メートルへ上昇">
        <polyline points="0,164 140,120 280,78 420,40 560,10" fill="none" stroke="var(--c5)" stroke-width="5"
          stroke-linejoin="round" stroke-linecap="round"/>
        <line x1="0" y1="176" x2="560" y2="176" stroke="var(--axis)" stroke-width="3" stroke-dasharray="10 8"/>
        <circle cx="0" cy="164" r="5" fill="var(--c5)"/><circle cx="560" cy="10" r="5" fill="var(--c5)"/>
      </svg>
      <div class="yrs"><div>21</div><div>25</div><div>29</div><div>33</div><div>36</div></div>
      <div class="lg">
        <span><b class="big">11.7㎡</b>（2020年）</span>
        <span><b class="big up">13.78㎡</b>（2036年）</span>
      </div>
    </div>
  </div>
</div>
```

**`tools/og/cards.html` は独自に `--c1`〜`--c7` を持っており、値は `assets/palette.css` と違います**
（OGP生成専用のテンプレートで、公開ページではないためです。既存4枚もこの配色で作られています）。
`cards.html` の `:root` には `--c5:#e87ba4` があります。`.big.up` は `--c2` を指すので、
**`--c5` に見せたい場合は `<b class="big" style="color:var(--c5)">` に変えてください。**

- [ ] **手順3: `CARDS` に足す**

`tools/og/build.mjs:26-31` を次にします。

```javascript
const CARDS = [
  { id: 'og', out: 'og.png' },
  { id: 'og-fukushi', out: 'og-fukushi.png' },
  { id: 'og-kaigo', out: 'og-kaigo.png' },
  { id: 'og-koutsuu', out: 'og-koutsuu.png' },
  { id: 'og-shisetsu-2036', out: 'og-shisetsu-2036.png' },
]
```

- [ ] **手順4: 生成する**

```bash
node tools/og/build.mjs
```

期待: `生成: assets/og.png` 〜 `生成: assets/og-shisetsu-2036.png` の5行。

- [ ] **手順5: 既存4枚を戻す**

同じ入力でも Chromium の版と再サンプリングで15%程度の画素が変わり、見た目が同じまま
差分だけが出ます（2026-08-23 の記録）。**新しい1枚だけを残します。**

```bash
git checkout -- assets/og.png assets/og-fukushi.png assets/og-kaigo.png assets/og-koutsuu.png
git status --short assets/
```

期待: `?? assets/og-shisetsu-2036.png` の1行だけ。

- [ ] **手順6: 寸法を確かめる**

```bash
node -e '
const b=require("fs").readFileSync("assets/og-shisetsu-2036.png");
console.log("size", b.length, "w", b.readUInt32BE(16), "h", b.readUInt32BE(20));
'
```

期待: `w 1200 h 630`。

- [ ] **手順7: コミット**

```bash
git add assets/og-shisetsu-2036.png tools/og/cards.html tools/og/build.mjs
git commit -m "公共施設のページのOGP画像を足す"
```

`package.json` / `package-lock.json` / `node_modules/` が `git status` に出ていないことを確認してください
（`.gitignore` 対象です）。

---

## タスク6: ページの骨格とハブのカード

**受け取るもの:** タスク5の `assets/og-shisetsu-2036.png`、タスク1の `draft.html`
**次に渡すもの:** `node --test` が通る `plans/shisetsu-2036/index.html`。
**本文は下書きのままで、数値の修正はタスク7以降**

**ファイル**
- 作成: `plans/shisetsu-2036/index.html`
- 変更: `index.html`（`plans/koutsuu/` のカードの直後）

- [ ] **手順1: 下書きをコピーする**

```bash
W=/private/tmp/claude-501/-Users-yet2come-Projects-iki-keikaku--claude-worktrees-content-addition-policy-2dabc6/7ca2579c-0572-4374-9dbe-41a55692548e/scratchpad
mkdir -p plans/shisetsu-2036
cp "$W/shisetsu/draft.html" plans/shisetsu-2036/index.html
```

- [ ] **手順2: head を差し替える**

`<!doctype html>` から `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` までを、
次に置き換えます。**`og:description` は120字以内に収めてください。**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>壱岐市 公共施設等総合管理計画 ― 1人あたり面積とライフサイクルコスト | 壱岐市 計画マップ</title>
<meta name="description" content="長崎県壱岐市の公共施設等総合管理計画について、15%削減目標を長期の2061年ではなく10年後の2036年で切って検算。計画自身の算定式に計画自身が併記する人口3系列を代入すると、面積を計画どおり減らしても1人あたりの床面積は現在より増える。あわせて費用推計に何が入っていないかを確認した。">
<link rel="canonical" href="https://keikaku.ikilab.org/plans/shisetsu-2036/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="壱岐市 計画マップ">
<meta property="og:title" content="壱岐市 公共施設等総合管理計画 ― 1人あたり面積とライフサイクルコスト">
<meta property="og:description" content="面積を計画どおり11.25%減らしても、1人あたりは11.7㎡から13.78㎡へ。目標人口が達成された場合にのみ現状維持になる。">
<meta property="og:url" content="https://keikaku.ikilab.org/plans/shisetsu-2036/">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="https://keikaku.ikilab.org/assets/og-shisetsu-2036.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="1人あたり公共施設面積が2021年の11.86平方メートルから2036年の13.78平方メートルへ上昇することを示す折れ線グラフ">
<meta name="twitter:image" content="https://keikaku.ikilab.org/assets/og-shisetsu-2036.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../../assets/palette.css">
<style>
```

- [ ] **手順3: 色トークンを既存4枚にそろえる**

`<style>` の直後の `:root{ … }` 3ブロック（`:root` / `@media (prefers-color-scheme: dark)` /
`:root[data-theme="dark"]`）を、次に置き換えます。**`--s1`〜`--s3` を `--c1`〜`--c3` にし、
値はページ側に持ちません。**

```css
:root{
  color-scheme: light;
  --ground:#f9f9f7; --surface:#fcfcfb; --sunken:#f1f0ec;
  --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781;
  --line:#c3c2b7; --line-soft:#e1e0d9;
  --accent:var(--c1); --accent-soft:rgba(11,11,11,0.05);
  --flag:#b0561a; --flag-bg:rgba(11,11,11,0.035);
  --shadow:0 1px 2px rgba(11,11,11,.06), 0 8px 24px -18px rgba(11,11,11,.35);
}
:root[data-theme="dark"]{
  color-scheme: dark;
  --ground:#0d0d0d; --surface:#1a1a19; --sunken:#22221f;
  --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
  --line:#383835; --line-soft:#2c2c2a;
  --accent:var(--c1); --accent-soft:rgba(255,255,255,0.06);
  --flag:#f07b22; --flag-bg:rgba(255,255,255,0.05);
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -18px rgba(0,0,0,.8);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    color-scheme: dark;
    --ground:#0d0d0d; --surface:#1a1a19; --sunken:#22221f;
    --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
    --line:#383835; --line-soft:#2c2c2a;
    --accent:var(--c1); --accent-soft:rgba(255,255,255,0.06);
    --flag:#f07b22; --flag-bg:rgba(255,255,255,0.05);
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -18px rgba(0,0,0,.8);
  }
}
```

そのうえで、本文中の `var(--s1)` `var(--s2)` `var(--s3)` を
`var(--c1)` `var(--c2)` `var(--c3)` に一括で置き換えます。

```bash
sed -i '' 's/var(--s1)/var(--c1)/g; s/var(--s2)/var(--c2)/g; s/var(--s3)/var(--c3)/g' plans/shisetsu-2036/index.html
grep -c -- '--s[123]' plans/shisetsu-2036/index.html
```

期待: `0`。

- [ ] **手順4: 書体を system-ui にする**

`body` の `font-family` を次にします。見出しの `h1,h2,h3` と `.eyebrow` `.card .k` `.card .v`
`td.n` などに書いてある `"Zen Old Mincho"` / `"Zen Kaku Gothic New"` / `"IBM Plex Mono"` も
すべて置き換えます。

```css
body{
  font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif;
}
```

数字を並べていた `"IBM Plex Mono",monospace` は `ui-monospace,SFMono-Regular,Menlo,monospace` にします。
見出しの明朝は `font-family` の指定ごと外し、`body` から継承させます。

```bash
grep -n "Zen Old Mincho\|Zen Kaku Gothic\|IBM Plex Mono\|fonts.googleapis\|fonts.gstatic" plans/shisetsu-2036/index.html
```

期待: 0件。

- [ ] **手順5: バッジ・表示切替ボタン・印刷指定を足す**

`<style>` の末尾（`</style>` の直前）に足します。

```css
.badge{display:inline-block;font-size:11.5px;letter-spacing:.06em;padding:3px 9px;
  border:1px solid var(--line);border-radius:999px;color:var(--ink-2);background:var(--surface);
  margin:0 6px 14px 0;text-decoration:none}
.badge.home:hover{border-color:var(--accent);color:var(--accent)}
button.tg{font:inherit;font-size:12.5px;padding:6px 12px;border:1px solid var(--line);
  border-radius:8px;background:var(--surface);color:var(--ink-2);cursor:pointer}
button.tg:hover{background:var(--accent-soft)}
@media print{body{background:#fff}section{break-inside:avoid}button.tg{display:none}}
```

`<header>` の中身を次にします（下書きの `.kicker` は `.badge` 2つに置き換え）。

```html
<header>
  <div>
    <a href="../../" class="badge home">← 壱岐市 計画マップ</a><span class="badge">長崎県壱岐市 ／ 公共施設等総合管理計画</span>
    <h1>1人あたり面積の推移と<br>ライフサイクルコスト（LCC）</h1>
    <p class="lede">総合管理計画の削減目標を、長期目標の2061年ではなく<strong>10年後の2036年</strong>で切って検算した。計画自身の算定式に、計画自身が併記している3つの人口前提を代入すると、<em>面積を計画どおり減らしても1人あたりの床面積は現在より増える</em>という結果になる。あわせて、この計画の費用推計に何が入っていないかを確認した。</p>
  </div>
  <button class="tg" id="tg">◐ 表示切替</button>
</header>
```

`header` を横並びにする指定を `<style>` に足します。

```css
header{padding:4rem 0 0;display:flex;justify-content:space-between;align-items:flex-start;
  gap:16px;flex-wrap:wrap}
header > div{flex:1 1 460px}
header > button{flex:none}
```

- [ ] **手順6: 表示切替のスクリプトを足す**

`</div>` （`.wrap` の閉じ）と `</body>` のあいだに入れます。既存4枚と同じものです。

```html
<script>
const tg=document.getElementById('tg');
tg.addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme');
  const sysDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  const now = cur ? cur : (sysDark?'dark':'light');
  document.documentElement.setAttribute('data-theme', now==='dark'?'light':'dark');
});
</script>
```

- [ ] **手順7: ハブにカードを1枚足す**

`index.html` の `plans/koutsuu/` のカード（`</a>` で終わる）の直後、`</div>`（`.cards` の閉じ）の前に入れます。
**ドットは `--c5`（行財政運営）です。**

```html
  <a class="card" href="plans/shisetsu-2036/">
    <div class="k">公共施設</div>
    <h3>公共施設等総合管理計画 ― 1人あたり面積とLCC</h3>
    <p>15%削減目標を、長期目標の2061年ではなく10年後の2036年で切って検算しています。計画自身の算定式に、計画自身が併記する3つの人口前提を代入すると、面積を計画どおり減らしても1人あたりの床面積は現在より増えます。費用推計に運用費と解体費が入っていないことも扱います。</p>
    <div class="tags">
      <span class="tag"><i class="dot" style="background:var(--c5)"></i>行財政運営</span>
      <span class="tag">目標年次 2041／2061年度</span>
      <span class="tag">推計を含む</span>
    </div>
  </a>
```

- [ ] **手順8: 骨格の検査を通す**

```bash
node --test 2>&1 | tail -20
```

期待: すべて pass。落ちる場合は、失敗メッセージが示す項目
（`canonical` / `og:url` / `og:image` の実在 / `palette.css` の深さ / ハブからのリンク）を直します。

```bash
node -e '
const s=require("fs").readFileSync("plans/shisetsu-2036/index.html","utf8");
console.log("googlefonts", /fonts\.(googleapis|gstatic)/.test(s));
console.log("palette", s.includes(`<link rel="stylesheet" href="../../assets/palette.css">`));
console.log("cN定義", (s.match(/^\s*--c[1-8](-ink)?\s*:/gm)||[]).length);
'
```

期待: `googlefonts false` / `palette true` / `cN定義 0`。

- [ ] **手順9: コミット**

```bash
git add plans/shisetsu-2036/index.html index.html
git commit -m "公共施設のページの骨格を作り、ハブからリンクする"
```

---

## タスク7: Ⅲ・Ⅳ章の数値を直す

**受け取るもの:** タスク2の 11.1（原本の確定値）
**次に渡すもの:** 人口3系列・1人あたり面積・必要面積が原本と計算に一致した状態

**ファイル**
- 変更: `plans/shisetsu-2036/index.html`（第Ⅲ章・第Ⅳ章）

- [ ] **手順1: 第Ⅳ章の必要面積を 11.7 で計算し直す**

「同じ水準を保つなら、どれだけ減らす必要があるか」の表を次にします。**削減率は変わりません。**

```html
      <tbody>
        <tr><td>目標人口 22,245人</td><td class="n">260,267㎡</td><td class="n">10.9%</td></tr>
        <tr><td>社人研推計 19,910人</td><td class="n">232,947㎡</td><td class="n">20.2%</td></tr>
        <tr><td>社人研準拠 18,815人</td><td class="n">220,136㎡</td><td class="n"><strong>24.6%</strong></td></tr>
      </tbody>
```

下書きは 260,264／232,945／220,133 でした。**3行とも直します。**削減率は変わりません。

キャプションはそのまま（`必要面積＝2036年人口×11.7㎡。削減率＝（292,058−必要面積）÷292,058。`）で、
式と値が一致します。

- [ ] **手順2: タスク2で原本と違った値があれば直す**

11.1 の「下書きと原本が違った点」が「なし」なら、この手順は飛ばします。
違いがあれば、**下書きの値ではなく原本の値**に直し、その値に依存する計算
（第Ⅱ章の面積・解体費、第Ⅲ章の補間、第Ⅳ章の1人あたり、第Ⅴ章の按分）をすべて追随させます。

- [ ] **手順3: 第Ⅲ章の引用を確認する**

第Ⅲ章の `.quote`（`将来人口 18,151人 × 現在の 11.7㎡/人 …`）は、下書き側が式に組み直したものです。
11.1 の手順3の結果に従います。

- **原文と一致する** → `.quote` のまま
- **一致しない** → `.quote` を外し、`<p>` の地の文にして鉤括弧を使わない。
  「計画は将来人口18,151人に現在の11.7㎡/人を乗じて212,367㎡を求め、…としています」の形

- [ ] **手順4: 検算する**

```bash
node -e '
const s=require("fs").readFileSync("plans/shisetsu-2036/index.html","utf8");
for(const v of ["259,201","32,857","260,267","232,947","220,136","11.65","13.02","13.78","22,245","19,910","18,815"])
  console.log(v, s.includes(v) ? "ok" : "MISSING");
for(const v of ["260,264","232,945","220,133"])
  console.log(v, s.includes(v) ? "OLD VALUE LEFT" : "ok");
'
```

期待: 前半が全部 `ok`、後半が全部 `ok`（古い値が残っていない）。

- [ ] **手順5: コミット**

```bash
git add plans/shisetsu-2036/index.html
git commit -m "第Ⅳ章の必要面積を11.7㎡で計算し直し、キャプションの式と合わせる"
```

---

## タスク8: 第Ⅵ章を書き換える

**受け取るもの:** タスク3の 11.2（「残す／落とす」の判断）
**次に渡すもの:** 裏づけのある記述だけになった第Ⅵ章

**ファイル**
- 変更: `plans/shisetsu-2036/index.html`（第Ⅵ章）

- [ ] **手順1: 用語集の引用を原本に合わせる**

`.quote` の中身を、11.1 の手順3で抽出テキストからコピーした文字列に置き換えます。
**目で打ち直さないでください。**

- [ ] **手順2: 3つの箇条書きを書き換える**

いまの下書きは「この2つが表に出ないと、次のような判断が起きやすくなります」として3項目を挙げています。
これは制度から予測した行動で、`CONTRIBUTING.md` 6（原因を断定しない）に触れます。

**11.2 で裏が取れた項目だけを残し、制度の記述に変えます。** 例（実際の充当率・措置率は 11.2 の値を使う）:

```html
    <p>更新費だけを見ると、<strong>「まだ改修時期が来ていない施設」は費用がゼロに見えます。</strong>しかし実際には、その施設は今日も光熱水費と委託料を消費しています。逆に、<strong>解体すれば維持費は止まりますが、解体費は更新費の表には現れません。</strong></p>
    <p>費用の出どころにも差があります。</p>
    <ul>
      <li><strong>建設は起債の対象になります。</strong>地方財政法5条は起債できる事業を限定列挙しており、公共施設の建設・改良はそこに含まれます</li>
      <li><strong>運用費は起債の対象外です。</strong>光熱水費・委託料・人件費・日常修繕費は同条の列挙に当たらず、一般財源から支出することになります</li>
      <li><strong>解体は◯◯です。</strong>（11.2 で確認した内容を、確認できた範囲でそのまま書く）</li>
    </ul>
    <p>この差は、施設ごとの判断のときに効きます。<strong>どの案がいくらかかるかを比べるには、建設費でも更新費でもなく、建てて・使って・直して・壊すまでの費用総額が要ります。</strong></p>
```

**裏が取れなかった項目は書きません。** 全部落ちた場合は `<ul>` ごと削除し、
その前後の段落（更新費だけを見るとゼロに見える／だからこそLCCが要る）でつなぎます。

- [ ] **手順3: 出典表に一次資料を足す**

`<tbody>` の5行目（`総務省「公共施設等の適正管理の推進」ほか`）を、11.2 で確定したURL付きの資料に置き換えます。
**確認できなかった場合はこの行を削除し、本文の該当記述も落ちていることを確認します。**

- [ ] **手順4: 評価語が残っていないか見る**

`CONTRIBUTING.md`「言い換えの例」に照らします。

```bash
grep -n "計画倒れ\|大幅未達\|悪化\|見通しを外\|機能していない\|低調\|作れなかった" plans/shisetsu-2036/index.html
```

期待: 0件。

- [ ] **手順5: コミット**

```bash
git add plans/shisetsu-2036/index.html
git commit -m "第Ⅵ章の起債・交付税措置を、一次資料で確認した制度の記述に書き換える"
```

---

## タスク9: 第Ⅷ章に5分類タグを付ける

**受け取るもの:** タスク8までの本文
**次に渡すもの:** `plans/koutsuu/` の第Ⅵ章と意味がそろったタグ

**ファイル**
- 変更: `plans/shisetsu-2036/index.html`（第Ⅷ章、`.tag` の CSS）

- [ ] **手順1: 分類を決める**

`plans/koutsuu/` の第Ⅵ章と同じ5分類です。**指摘の性質による分類で、確認の強さではありません。**

| タグ | 意味 | 第Ⅷ章の該当 |
|---|---|---|
| `数値` | 元データの確認が要るもの | 2（削減の年次配分・進捗）、3（投資的経費の平均）、4（運用費） |
| `定義` | 指標や範囲の書き換えが要るもの | 1（総量目標が前提とする人口） |
| `表記` | 用語の統一で済むもの | （該当なければ使わない） |
| `記録` | 資料が参照できない・残っていないもの | 7（進捗の公表）、8（公共施設修繕等基金） |
| `未公開` | 公開されれば議論が進むもの | 5（解体費の財源）、6（施設ごとの複数案比較） |

**割り当ては上の案です。本文を読み直して合わないものは変えてください。**
どれにも当てはまらない項目にタグを付けないでください。

- [ ] **手順2: CSS を足す**

いまの `.tag.calc` / `.tag.unk` はそのまま使い、性質の5分類は**すべて中立色**にします。
赤（`--crit`）は介護保険ページで「再発」に使っている注意喚起の色なので、性質の分類には使いません。

```css
.tag.kind{color:var(--ink-2); border-color:var(--line); background:var(--surface);}
```

- [ ] **手順3: 各項目にタグを付け、凡例を書く**

第Ⅷ章の `<ol>` の各 `<li>` の先頭に入れます。

```html
<li><span class="tag kind">定義</span> <strong>総量目標が前提とする人口。</strong>目標人口と社人研準拠の再推計のどちらに立つのか。…</li>
```

`<ol>` の直前に凡例を1文で置きます。**koutsuu で「凡例が無く、無印の項目が未裏取りに読めていた」という
指摘があったので、必ず入れてください。**

```html
<p class="mut" style="font-size:.85rem;color:var(--muted)">タグは指摘の性質による分類です。<b>数値</b>＝元データの確認、<b>定義</b>＝指標や範囲の書き換え、<b>記録</b>＝資料が参照できない、<b>未公開</b>＝公開されれば議論が進むもの。確認の強さを表すものではありません。</p>
```

- [ ] **手順4: 確認する**

```bash
node -e '
const s=require("fs").readFileSync("plans/shisetsu-2036/index.html","utf8");
const m=s.match(/<span class="tag kind">([^<]+)<\/span>/g)||[];
console.log("タグ数", m.length, m.join(" "));
console.log("凡例", s.includes("タグは指摘の性質による分類です"));
console.log("crit", s.includes("--crit"));
'
```

期待: タグ数が第Ⅷ章の項目数と一致、`凡例 true`、`crit false`。

- [ ] **手順5: コミット**

```bash
git add plans/shisetsu-2036/index.html
git commit -m "第Ⅷ章のタグを、koutsuu と同じ指摘の性質による5分類にそろえる"
```

---

## タスク10: 出典表とフッタを確定する

**受け取るもの:** タスク1のSHA-256と取得日、タスク3の一次資料
**次に渡すもの:** 未処理の `◆` が残っていない出典表と、既存4枚と同じ形のフッタ

**ファイル**
- 変更: `plans/shisetsu-2036/index.html`（出典セクション、`<footer>`）

- [ ] **手順1: 出典表のキャプションを埋める**

`◆掲載時：各PDFの取得日とSHA-256を付記する。` を削除し、タスク1の値を書きます。

```html
      <caption>計画本体PDF（◯◯頁、SHA-256 <code>xxxxxxxx…</code>）と個別施設計画PDF（◯◯頁、SHA-256 <code>xxxxxxxx…</code>）は、いずれも YYYY年M月D日 に取得したものです。</caption>
```

```bash
grep -n "◆" plans/shisetsu-2036/index.html
```

期待: 0件。

- [ ] **手順2: フッタを既存4枚の形にする**

いまの下書きのフッタ（`調査基準日` / `分析の性格` / `「IKILAB計算」の範囲` / `「未確認」の意味` /
`ライセンス` / `© 2026 IKILAB`）は内容として残し、**先頭に「主な出典（YYYY年M月D日確認）」の行を足します。**

```html
<footer>
  <b>主な出典</b>（YYYY年M月D日確認）<br>
  壱岐市：<a href="https://www.city.iki.nagasaki.jp/shisei/machidukuri/keikaku/3750.html" target="_blank" rel="noopener">公共施設等総合管理計画</a>（<a href="https://www.city.iki.nagasaki.jp/material/files/group/5/sougoukannrikeikakukaitei.pdf" target="_blank" rel="noopener">計画本文PDF</a>）／<a href="https://www.city.iki.nagasaki.jp/shisei/machidukuri/keikaku/8574.html" target="_blank" rel="noopener">公共施設個別施設計画</a>（<a href="https://www.city.iki.nagasaki.jp/material/files/group/5/kobetusisetukeikakukaitei.pdf" target="_blank" rel="noopener">計画本文PDF</a>）／<a href="https://www.city.iki.nagasaki.jp/material/files/group/46/dai4jiikishisougoukeikaku_main.pdf" target="_blank" rel="noopener">第4次壱岐市総合計画 本編</a><br>
  国：（タスク3で確定した一次資料。無ければこの行ごと削除）
  <br><br>
  <p><b>調査基準日</b>　YYYY年M月D日</p>
  <p><b>分析の性格</b>　公開資料のみを用いたIKILABの独立分析です。壱岐市の見解ではありません。</p>
  <p><b>「IKILAB計算」の範囲</b>　①2041年15%の直線按分による2036年の面積　②計画掲載の人口3系列の線形補間　③その2つを割った1人あたり面積　④計画記載の「8.8万㎡＝8.3億円」を按分した更新費　⑤計画記載の解体単価による解体費。<b>いずれも計画自身の数値と算定式を使っており、独自の将来推計や単価の置き直しは行っていません。</b></p>
  <p><b>「未確認」の意味</b>　公開資料の範囲で確認できなかったという意味であり、「存在しない」ことの証明ではありません。</p>
  本ページの文章・図表・データは <a href="../../about/license/">CC BY 4.0</a>、コードは MIT。引用元の公表資料の権利は各機関に帰属します。 © 2026 IKILAB
</footer>
```

**下書きの `ライセンス` の行は、既存4枚と同じ1行の形に置き換えます**（`about/license/` へのリンク付き）。

- [ ] **手順3: 調査基準日を3か所そろえる**

下書きの `2026年8月24日` を、実際に照合した日に直します。

```bash
grep -n "2026年8月24日\|調査基準日" plans/shisetsu-2036/index.html
```

冒頭の `.notice`（免責）にも基準日の記述があるので、そこも合わせます。

- [ ] **手順4: 検査**

```bash
node --test 2>&1 | tail -5
```

期待: すべて pass。

- [ ] **手順5: コミット**

```bash
git add plans/shisetsu-2036/index.html
git commit -m "出典表のSHA-256と取得日を埋め、フッタを既存ページの形にそろえる"
```

---

## タスク11: 周辺文書と全検証

**受け取るもの:** タスク1〜10のすべて
**次に渡すもの:** マージできる状態

**ファイル**
- 変更: `sources/MANIFEST.md`
- 変更: `README.md`（「いま公開しているもの」の表）
- 変更: `CHANGELOG.md`
- 変更: `data/plans.yml`（`meta.updated` / `meta.survey_date`）

- [ ] **手順1: 出典台帳に登録する**

```bash
node tools/manifest.mjs
```

出た未登録を `sources/MANIFEST.md` の「壱岐市」の表に足します。**PDFは `保存` 列を `○` にし、
`参照箇所` にページ番号と SHA-256 を書きます**（地域公共交通計画の行が見本です）。

```markdown
| 壱岐市公共施設等総合管理計画（掲載ページ） | `/shisei/machidukuri/keikaku/3750.html` | 中 | YYYY-MM-DD | ― | ― |
| 同 本体PDF | `/material/files/group/5/sougoukannrikeikakukaitei.pdf` | 高 | YYYY-MM-DD | ○ | ◯◯頁・SHA-256 `xxxx…`。§1-1-3、§1-2、§1-3、§2-1、§2-5-1、§2-6-1、§2-7-1、用語集 |
| 壱岐市公共施設個別施設計画（掲載ページ） | `/shisei/machidukuri/keikaku/8574.html` | 中 | YYYY-MM-DD | ― | ― |
| 同 本体PDF | `/material/files/group/5/kobetusisetukeikakukaitei.pdf` | 高 | YYYY-MM-DD | ○ | ◯◯頁・SHA-256 `xxxx…`。第4章1（費用単価の出所） |
```

タスク3で一次資料が取れていれば、**国の資料の節にも足します。**

```bash
node tools/manifest.mjs
```

期待: 未登録が0件。

- [ ] **手順2: README の公開一覧に1行足す**

「いま公開しているもの」の表の `/about/license/` の行の**前**に入れます。

```markdown
| [`/plans/shisetsu-2036/`](plans/shisetsu-2036/) | **公共施設等総合管理計画 ― 1人あたり面積とLCC** — 15%削減目標を10年後の2036年で切って検算。面積を計画どおり減らしても1人あたりは増える。費用推計に運用費・解体費が入っていないことも扱う。**推計を含む** |
```

**収録件数（78件・市68・社協1・県9）は触りません。** 計画は増えていません。

- [ ] **手順3: `meta` を更新する**

`data/plans.yml` の先頭を、照合した日に合わせます。

```yaml
meta:
  updated: YYYY-MM-DD
  survey_date: YYYY-MM-DD
```

- [ ] **手順4: CHANGELOG に1節足す**

先頭の `# 改訂履歴` の説明文の直後、既存の最新節の**前**に入れます。

```markdown
## YYYY-MM-DD

### 追加（公共施設のページ）
- **`plans/shisetsu-2036/`（公共施設等総合管理計画 ― 1人あたり面積とLCC）を公開した。**
  15%削減目標を、長期目標の2061年ではなく10年後の2036年で切って検算している。
  **2036年は計画の目標年次ではない**ので、第Ⅰ章でその旨を断っている
- **公開前に、計画本体PDFと個別施設計画PDFを突き合わせた。**（照合の結果を書く。
  合わなかった点があれば必ず書く）
- **第Ⅳ章の必要面積を 11.7㎡ で計算し直した。** 受け取った時点では 11.6999 で計算されており、
  キャプションに書いた式と表の値が2〜2.5㎡ずれていた。削減率（10.9%／20.2%／24.6%）は変わらない
- **第Ⅵ章の起債・交付税措置を、一次資料で確認した制度の記述に書き換えた。**（確認できた範囲を書く）
- **第Ⅷ章のタグを、`plans/koutsuu/` と同じ5分類にそろえた。** 凡例も付けた
- **`assets/palette.css` に載せ替えた。** 受け取った時点では Google Fonts 3書体と
  独自の `--s1`〜`--s3` を持っており、「外部から読むのは `palette.css` だけ」という規約から外れていた
- `data/plans.yml` の `kokyoshisetsu-sougou` / `kokyoshisetsu-kobetsu` に計画期間と本体PDFを入れ、
  `todo` を解消した。`plans/all/` を生成し直し、README の `todo` 件数を31件から◯件に直した
- ハブと README に1件ずつ追加。OGP画像を `tools/og/cards.html` から生成した
  （**既存4枚は生成し直さずに戻している**）。`meta.updated` / `meta.survey_date` を YYYY-MM-DD にした
```

- [ ] **手順5: 全部流す**

```bash
node tools/validate.mjs --fail-on-error; echo "validate=$?"
node tools/build.mjs --check; echo "build-check=$?"
node --test 2>&1 | tail -5
node tools/expiring.mjs | sed -n '/未調査の項目/p'
node tools/manifest.mjs
node tools/linkcheck.mjs 2>&1 | tail -15
```

期待: `validate=0` / `build-check=0` / テスト全 pass / `manifest` の未登録0件 /
`linkcheck` で追加した4つのURLが生存。

- [ ] **手順6: 件数の食い違いがないか見る**

```bash
grep -n "78件\|31件\|29件" README.md index.html
```

期待: 収録件数78件はそのまま、`todo` の件数が `expiring.mjs` の見出しと一致。

- [ ] **手順7: 差分の全体を見る**

```bash
git status --short
git diff --stat main...HEAD
```

`package.json` / `package-lock.json` / `node_modules/` / PDF が入っていないことを確認します。

- [ ] **手順8: コミット**

```bash
git add sources/MANIFEST.md README.md CHANGELOG.md data/plans.yml
git commit -m "出典台帳・README・CHANGELOG を更新し、調査基準日をそろえる"
```

---

## 完了の判定

設計 10章のチェックリストです。**すべて満たしてからマージします。**

- [ ] 両PDFの取得日・SHA-256・ページ数が出典表と `sources/MANIFEST.md` に載っている
- [ ] 設計 3.2 の全項目について、原本のページ番号つきで照合の結果が 11.1 に記録されている
- [ ] 鉤括弧の引用が原文と一字一句一致している
- [ ] 第Ⅳ章の必要面積が 11.7 で計算し直され、キャプションの式と合っている（260,267／232,947／220,136）
- [ ] 第Ⅵ章の起債・交付税措置に一次資料のURLが付いている、または該当箇所が落ちている
- [ ] 第Ⅷ章に5分類タグと凡例が付いている
- [ ] 出典表に未処理の `◆` が残っていない
- [ ] `kokyoshisetsu-sougou` / `kokyoshisetsu-kobetsu` の `todo` が解消され、`period` が入っている
      （原本に記載が無ければ `todo` を残し、その旨が 11.1 に記録されている）
- [ ] `node tools/validate.mjs --fail-on-error` が error 0件
- [ ] `node --test` が通る
- [ ] `node tools/build.mjs --check` が通る
- [ ] `node tools/linkcheck.mjs` で追加したURLが生きている
- [ ] `node tools/manifest.mjs` で未登録がない
- [ ] ハブ・README・CHANGELOG・`todo` 件数・`meta` が更新されている
- [ ] 設計 3.5「変えないもの」が残っている ── 第Ⅰ章の断り／各章の〔仮定〕〔留保〕〔検算〕／
      第Ⅳ章末の留保／免責の3行／フッタの「IKILAB計算」の範囲5項目と「未確認」の意味
- [ ] Google Fonts の読み込みと `--s1`〜`--s3` が残っていない
- [ ] `package.json` / `node_modules/` / PDF がコミットされていない
