# セットアップ手順

GitHub Pages ＋ 独自ドメイン（`keikaku.ikilab.org`）で公開するまでの手順です。

**所要時間の目安**: 作業そのものは15〜20分。DNSの反映とHTTPS証明書の発行を待つ時間が別に10分〜1時間ほど。

**必要なもの**
- GitHub アカウント
- `git`（`git --version` で確認）
- ikilab.org の DNS を編集できる権限
- （任意）[GitHub CLI](https://cli.github.com/) — あると Step 2〜3 が1コマンドで済みます

---

## Step 1. ローカルの準備

配布した zip を展開し、Git リポジトリとして初期化します。

```bash
unzip iki-plans.zip
cd iki-plans

git init -b main
git add -A
git commit -m "壱岐市 計画マップ 初版

- 福祉分野の計画体系マップ、介護保険 第7〜9期の検証
- data/plans.yml に計画の構造化データ
- 出典URLの死活チェックと改定期の検出をCI化
- CC BY 4.0（文章・図表・データ）＋ MIT（コード）"
```

コミット前に、次の3点を自分の環境に合わせて確認しておくと後戻りがありません。

| 確認すること | ファイル | 既定値 |
|---|---|---|
| 公開するドメイン | `CNAME` | `keikaku.ikilab.org` |
| 著作者名 | `LICENSE-CODE`、`NOTICE.md`、`about/license/index.html`、各ページのフッタ | `ikilab` |
| 各ページのURL（`canonical` と `og:url`） | `index.html`、`plans/*/index.html`、`about/license/index.html` | `https://keikaku.ikilab.org/…` |

ドメインを変える場合は、`CNAME` の1行に加えて、上記HTMLの `canonical` / `og:url` も置換してください。

```bash
# 例: keikaku → plans に変える場合
grep -rl 'keikaku\.ikilab\.org' . | xargs sed -i '' 's/keikaku\.ikilab\.org/plans.ikilab.org/g'   # macOS
echo 'plans.ikilab.org' > CNAME
```

---

## Step 2. Organization とリポジトリを作る

このサイトは Organization **`ikilab-org`**（https://github.com/ikilab-org）の下に置きます。
個人アカウント（yet2come）が所有する無料の Organization です。

### 2-1. Organization の Profile を整える

作成直後に、Organization の **Settings → Profile** で次を設定しておきます。
GitHub で見つけた人が「何者が作っているのか」を辿れるようにするためです。

| 項目 | 値 |
|---|---|
| Name | `ikilab` |
| Description | `長崎県壱岐市のシビックテックラボ` |
| URL | `https://ikilab.org` |
| Location | `長崎県壱岐市` |
| Email | 公開してよい連絡先（誤りの指摘を受ける窓口になります） |

あわせて、Organization の **People** タブで自分の表示を **Public** に切り替えてください。
個人プロフィールに ikilab のバッジが出て、個人の実績としても見えるようになります。

### 2-2. リポジトリを作る

**GitHub Pages を無料で使うにはリポジトリを public にする必要があります。**
このリポジトリには公開資料しか入っていないので問題ありません。

**GitHub CLI を使う場合**

```bash
gh auth login          # 初回のみ
gh repo create ikilab-org/iki-plans --public --source=. --remote=origin --push \
  --description "長崎県壱岐市の行政計画の関係を図にし、個別の計画を深掘りできる資料集。CC BY 4.0 + MIT"
```

作成・リモート登録・push までまとめて終わります。Step 3 は飛ばして Step 4 へ。

**ブラウザで作る場合**

1. https://github.com/new を開く
2. **Owner**: `ikilab-org` を選択（**個人アカウントのままにしないよう注意**）
3. **Repository name**: `iki-plans`
4. **Description**: `長崎県壱岐市の行政計画の関係を図にし、個別の計画を深掘りできる資料集`
5. **Public** を選択
6. **「Add a README file」「Add .gitignore」「Choose a license」はすべてチェックしない**
   （すでにリポジトリ内にあるため、チェックすると次のpushで衝突します）
7. **Create repository**

---

## Step 3. push する

Step 2 でブラウザから作った場合のみ必要です。

```bash
git remote add origin https://github.com/ikilab-org/iki-plans.git
git push -u origin main
```

push 後、GitHub のリポジトリ画面の右側に **`CC-BY-4.0`** のバッジが出ていれば、
ライセンスの自動判定が効いています。

---

## Step 4. GitHub Pages を有効にする

1. リポジトリの **Settings** → 左メニューの **Pages**
2. **Build and deployment**
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `/ (root)` → **Save**
3. 1〜2分待つと、ページ上部に `Your site is live at https://ikilab-org.github.io/iki-plans/` と表示されます

この時点で、まず `github.io` のURLで表示を確認しておいてください。
**ここで表示されていれば、以降のトラブルはすべてDNSかドメイン設定の問題**と切り分けられます。

`.nojekyll` を置いてあるので Jekyll のビルドは走らず、HTML がそのまま配信されます。

---

## Step 5. DNS に CNAME レコードを1件追加する

ikilab.org を管理しているDNSに、次の**1レコードだけ**追加します。

| 種別 | 名前（ホスト） | 値（あて先） | TTL |
|---|---|---|---|
| CNAME | `keikaku` | `ikilab-org.github.io.` | 3600（既定のままで可） |

- **サブドメインなので、A レコードは不要です。** Apex（`ikilab.org` 自体）にGitHub PagesのIPを設定する必要はありません
- **既存の ikilab.org には一切影響しません。** `keikaku` という名前のレコードを1件足すだけです
- 値の末尾のドット（`.github.io.`）は、DNS事業者によって「付ける」「付けない」「自動で付く」が分かれます。管理画面の他のレコードの書き方に合わせてください

### 事業者ごとの注意点

**Cloudflare を使っている場合**
プロキシ（オレンジの雲）を **オフ（DNS only / グレーの雲）** にしてください。
プロキシが有効だと GitHub 側の証明書発行が失敗します。証明書が発行され `Enforce HTTPS` が有効になった後で、
必要ならプロキシを検討してください（その際は SSL/TLS モードを Full (strict) に）。

**お名前.com / Value Domain / Xserver など**
「DNSレコード設定」からタイプ `CNAME`、ホスト名 `keikaku`、VALUE に `ikilab-org.github.io` を追加します。
ホスト名欄にフルドメイン（`keikaku.ikilab.org`）を入れる方式の事業者もあるので、画面の説明に従ってください。

### 反映の確認

```bash
dig +short keikaku.ikilab.org
# → ikilab-org.github.io. が返れば OK
```

数分〜30分ほどかかることがあります。**返ってくるまで Step 6 に進まないでください。**
DNSが引けない状態でカスタムドメインを設定すると、GitHub側でエラーになり、やり直しが必要になります。

---

## Step 6. カスタムドメインと HTTPS

1. **Settings** → **Pages** → **Custom domain** に `keikaku.ikilab.org` を入力 → **Save**
2. GitHub が DNS を検証します。成功すると緑のチェックが付きます
   - このとき、リポジトリの `CNAME` ファイルが自動で更新されます（すでに同じ値なので変化なし）
3. **Enforce HTTPS** のチェックボックスが有効になるまで待ちます
   - Let's Encrypt の証明書発行に**10分〜1時間**かかります。長いときは数時間かかることもあります
   - 「Certificate not yet created」と出ているあいだは、そのまま待ってください
4. 有効になったら **Enforce HTTPS にチェック**を入れます

---

## Step 7. 動作確認

```bash
# DNS
dig +short keikaku.ikilab.org

# HTTPS と HTTP→HTTPS リダイレクト
curl -I https://keikaku.ikilab.org/
curl -I http://keikaku.ikilab.org/     # 301 で https に飛べばOK

# 各ページ
curl -sI https://keikaku.ikilab.org/plans/fukushi/      | head -1
curl -sI https://keikaku.ikilab.org/plans/kaigo-7-9/    | head -1
curl -sI https://keikaku.ikilab.org/about/license/      | head -1
```

ブラウザでも次を確認してください。

- [ ] ハブページから各マップに移動できる
- [ ] 各マップの左上「← 壱岐市 計画マップ」で戻れる
- [ ] 表示切替（ライト／ダーク）が動く
- [ ] スマートフォンで横スクロールが破綻していない（タイムラインは横スクロールします）
- [ ] SNSでURLを共有したときのプレビュー（下記「あとでやること」参照）

---

## Step 8. GitHub Actions を動かす

`.github/workflows/` に2つのワークフローが入っています。

| ファイル | 実行タイミング | 役割 |
|---|---|---|
| `linkcheck.yml` | 毎週月曜 6:00 JST ＋ `data/plans.yml` 更新時 | 出典URLの死活を確認し、失効を検知したら Issue を立てる |
| `expiring.yml` | 毎月1日 6:00 JST | 満了・パブコメが近い計画を検出して Issue を立てる |

### 8-1. 手動で1回動かして確認する

**Actions** タブ → 左のワークフロー名を選択 → **Run workflow** → **Run workflow**

`linkcheck` を動かすと、いまの状態では**失効 0 件**（確認 33 件）で終わり、Issue は立ちません。
ログに `確認 33 件 / 失効 0 件` と出れば動作確認になります。

> 初版では健康ながさき21の県の個別ページが1件失効していました（[Issue #1](https://github.com/ikilab-org/iki-plans/issues/1)）。
> 県サイトのカテゴリ移設が原因で、移設先へ差し替え済みです。

### 8-2. Issue が作れずに失敗した場合

`Resource not accessible by integration` というエラーで失敗したら、権限設定です。

**Settings** → **Actions** → **General** → **Workflow permissions**
→ **Read and write permissions** を選択 → **Save**

ワークフロー側では必要最小限（`contents: read` と `issues: write`）だけを宣言してあるので、
この設定を変えても実際に使われる権限は増えません。

### 8-3. ラベルを用意しておく（任意）

ワークフローは `linkcheck` `出典` `schedule` `計画` というラベルを付けます。
存在しなければ自動で作られますが、色と説明を整えておくと一覧が見やすくなります。

```bash
gh label create linkcheck   --color 0E8A16 --description "出典URLの死活チェック"
gh label create 出典        --color 1D76DB --description "出典・引用に関するもの"
gh label create schedule    --color FBCA04 --description "計画の改定期・パブコメ"
gh label create 計画        --color 5319E7 --description "計画データの追加・修正"
gh label create correction  --color D93F0B --description "内容の誤りの指摘"
gh label create new-plan    --color 0052CC --description "計画の追加提案"
```

### 8-4. 通知の受け取り

Issue が立ったときに気づけるよう、リポジトリの **Watch** を **All Activity** にしておいてください。
リポジトリ画面右上の **Watch** → **All Activity**。

---

## Step 9. リポジトリの見た目を整える

リポジトリ画面右上の **About** の歯車から設定します（Organization の Profile は Step 2-1 で設定済み）。

- **Description**: `長崎県壱岐市の行政計画の関係を図にし、個別の計画を深掘りできる資料集`
- **Website**: `https://keikaku.ikilab.org`
- **Topics**: `civic-tech` `open-data` `japan` `nagasaki` `iki` `local-government` `welfare` `long-term-care`
  - トピックは、他自治体の担当者や研究者がGitHub上で見つける導線になります

---

## あとでやること

### OGP画像（SNSでの見え方）

**生成済みです。** `assets/og.png`（ハブ・ライセンス）、`assets/og-fukushi.png`（福祉分野）、
`assets/og-kaigo.png`（介護保険）の3枚が入っており、各ページの `<head>` から参照済みです。
SlackやSNSにURLを貼ると、体系図のサムネイル入りのカードが表示されます。

文言やレイアウトを変えたくなったら、`tools/og/cards.html` を編集して作り直します。

```bash
npm i -D playwright sharp     # 初回のみ
node tools/og/build.mjs
```

`tools/og/cards.html` はブラウザで直接開いて確認できます（3枚が縦に並びます）。
`sharp` が無い場合は等倍で撮影されます（2倍で撮って縮小したほうが文字が滑らかになるので、
入れておくことをおすすめします）。

新しいページを追加したときは、`cards.html` にカードを1つ足し、`build.mjs` の `CARDS` に
`{ id: 'og-xxx', out: 'og-xxx.png' }` を追加してください。

**注意**: `og:image` は絶対URLで書く必要があります。ドメインを変えた場合は
各HTMLの `og:image` と `twitter:image` も置換してください。

**キャッシュ**: 一度共有したURLの画像はSNS側にキャッシュされます。差し替えたのに古い画像が出る場合は、
[Facebook のシェアデバッガー](https://developers.facebook.com/tools/debug/) や
X のカードバリデータでキャッシュを更新してください。

### 分析報告書を docs/ に置く

調査・分析報告書、市への確認事項チェックリスト、進行管理章の文案は `docs/` に置けます。
公開前に [`docs/README.md`](docs/README.md) の「公開の判断」を確認してください。

### 検索エンジンへの登録

急ぐ必要はありませんが、[Google Search Console](https://search.google.com/search-console) に
`keikaku.ikilab.org` を登録しておくと、どんな検索語で見つかっているかが分かります。
「壱岐市 地域福祉計画」のような語で市の職員や他自治体が辿り着けているかを確認できます。

### 市への連絡

公開したことを市の担当課（保険課・市民福祉課）に一報しておくと、
誤りがあれば指摘してもらえますし、計画策定の参考にしてもらえる可能性も上がります。
`about/license/` に「許諾を取らずに使える」旨を書いてあるので、そのURLを添えると伝わりやすいはずです。

---

## トラブルシューティング

### `github.io` のURLでも 404 になる

- Settings → Pages で Branch が `main` / `/ (root)` になっているか
- ルートに `index.html` があるか（`iki-plans/index.html` ではなく、リポジトリ直下）
- 初回は数分かかります。Actions タブの `pages build and deployment` が成功しているか確認

### カスタムドメインで「Domain's DNS record could not be retrieved」

DNSがまだ引けていません。`dig +short keikaku.ikilab.org` が `ikilab-org.github.io.` を返すまで待ってから、
Custom domain を入力し直してください。

### 「Enforce HTTPS」がグレーのまま

証明書の発行待ちです。通常10分〜1時間。数時間経っても変わらない場合は、
Custom domain をいったん空にして Save → 再度入力して Save で再試行できます。
Cloudflare のプロキシが有効になっていないかも確認してください。

### ページは出るがCSSが崩れる / 一部が表示されない

このサイトは各ページが単一HTML（CSS・JSを内包）なので、外部ファイルの読み込み失敗は起きにくい構成です。
崩れる場合はブラウザのキャッシュを疑ってください（スーパーリロード）。

### Actions が `Resource not accessible by integration` で失敗

Step 8-2 の権限設定を確認してください。

### `linkcheck` が誤検知する

自治体サイトはHEADリクエストやbotのUser-Agentを拒否することがあります。
**Issue が立ったら、まずブラウザで手動確認**してください。開けるなら誤検知です。
対応手順は [`sources/POLICY.md`](sources/POLICY.md) の「誤検知の扱い」にあります。

---

## 日々の更新の流れ

```bash
# 1. 内容を直す
#    計画のメタデータ → data/plans.yml
#    ページ本文・図表 → plans/<分野>/index.html

# 2. 確認する
node tools/linkcheck.mjs      # 追加・変更したURLが生きているか
node tools/expiring.mjs       # 期間の入力ミスがないか

# 3. 記録する
#    CHANGELOG.md に1行
#    data/plans.yml の meta.updated と meta.survey_date
#    HTMLヘッダの調査基準日

# 4. 反映する
git add -A
git commit -m "第10期のパブコメ期間を追記"
git push
```

push から1〜2分でサイトに反映されます。反映状況は **Actions** タブの
`pages build and deployment` で確認できます。
