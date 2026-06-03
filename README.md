# SS Music

YouTube から取り込んだ音源を、サーバーのストレージからストリーミング再生する個人用音楽プレイヤー。スマホからの利用に最適化（PWA・ロック画面操作対応）。

## 主な機能

- 🎵 サーバー保存の MP3 を **HTTP Range 対応**でストリーミング再生（シーク可・iOS Safari 対応）
- 📥 **YouTube の URL を貼るだけ**で `yt-dlp` + `ffmpeg` が MP3 化して取り込み（非同期・進捗表示）
- 🔊 **曲ごとの音量**スライダー（0〜100%・再生中も調整可・DB 保存）。音量バラつき対策
- 🔐 共有パスワード1つでログイン（jose 署名 Cookie セッション）
- 📱 モバイルファースト UI ＋ PWA（ホーム画面追加）＋ MediaSession（ロック画面操作）

## 技術スタック

Next.js 16 (App Router / TypeScript) ・ Tailwind CSS v4 ・ PostgreSQL（生 `pg`、ORM なし）・ Docker

## セットアップ

### 1. 環境変数

```bash
cp .env.example .env
# .env を編集（APP_PASSWORD と SESSION_SECRET は必ず変更）
openssl rand -base64 32   # SESSION_SECRET 用の値を生成
```

| 変数 | 説明 |
|---|---|
| `POSTGRES_USER/PASSWORD/DB` | PostgreSQL の資格情報 |
| `DATABASE_URL` | 接続文字列（compose ではホスト名 `db`）|
| `APP_PASSWORD` | ログイン用の共有パスワード（**強固な値に**）|
| `SESSION_SECRET` | セッション Cookie の署名鍵（`openssl rand -base64 32`）|
| `TRUST_PROXY` | リバースプロキシ背後でのみ `1`。直接公開時は `0`（後述）|
| `MEDIA_DIR` | MP3 保存先（compose では `/app/media`）|

### 2a. ローカル開発（WSL・ホットリロード）

```bash
docker compose -f docker-compose.dev.yml up
# → http://localhost:3000  /  DB: localhost:5432
```

### 2b. 本番（自宅サーバー）— git pull 後

```bash
cp .env.example .env   # 値を編集（パスワード・鍵を強固に）
docker compose up -d --build
docker compose logs -f app
```

## 運用メモ

- **ストレージ**: MP3 は名前付きボリューム `media`（`/app/media`）に永続化。曲のメタデータは PostgreSQL（`tracks` テーブル）。
- **DB スキーマ**は起動時 (`src/instrumentation.ts`) に自動作成され、手動マイグレーション不要。
- **yt-dlp の更新**: YouTube は仕様変更が頻繁で、古い yt-dlp は「Unable to extract」等で失敗する。本イメージは pip で最新を取得するが、ダウンロードが壊れたら **イメージを再ビルド**すれば最新化される。強制更新は `docker compose build --build-arg YTDLP_REFRESH=$(date +%s) app`。

## HTTPS で公開（本番・自宅サーバー）

`music.shirai-dev.com` を Caddy + Let's Encrypt で HTTPS 公開する手順。アプリ本体は
`127.0.0.1:3000` のみ（LAN/外部に出さない）で、外部公開は Caddy 経由の 443 のみ。

**1. DNS（バリュードメイン）** — DNS レコード欄に1行追加（`<固定IP>` は自宅の固定グローバルIP）:

```
a music <固定IP>
```

→ `music.shirai-dev.com` がサーバーを指す。反映に5〜30分。
※ CAA レコードは設定しない（設定するなら `letsencrypt.org` を許可。除外すると証明書取得に失敗）。

**2. ルーター** — TCP **80** と **443**（HTTP/3 を使うなら UDP 443 も）をサーバーへポート転送。

**3. サーバーで起動**:

```bash
cp .env.example .env
#  .env を編集:
#   DOMAIN=music.shirai-dev.com
#   TRUST_PROXY=1
#   APP_PASSWORD / SESSION_SECRET を強固な値に
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.caddy.yml logs -f caddy  # 証明書取得ログ
```

> 💡 `caddy` を含むサブコマンド（`up`/`logs`/`ps` 等）には**毎回 2つの `-f`** が必要。
> 面倒なら `.env` に `COMPOSE_FILE=docker-compose.yml:docker-compose.caddy.yml` を足すと、
> 以後は素の `docker compose up -d` / `docker compose logs -f caddy` で Caddy 込みになる。

数十秒で証明書を取得し、`https://music.shirai-dev.com` で公開される（http は自動で https にリダイレクト）。

### セキュリティ要点

1. **`TRUST_PROXY=1`**（Caddy の背後）でレート制限が実クライアント IP 単位で効く。直接公開（Caddyなし）時は `0` のまま。
2. `APP_PASSWORD` は推測されにくい十分長い値に（唯一の認証情報）。
3. YouTube からのダウンロードは個人利用の範囲で。著作権・利用規約に留意。

### 同じサーバーで複数アプリを動かす場合（将来）

今の `docker-compose.caddy.yml` は Caddy がこのアプリ専用。2つ目以降のアプリを足すときは、
Caddy を共有リバースプロキシ（外部 Docker ネットワーク `web` 上の独立スタック）に切り出し、
各アプリをその `web` に繋いで `Caddyfile` にサブドメインの site ブロックを追加する構成にする
（80/443 は1つの Caddy が一括で受ける）。必要になったら相談してください。

## 家のLANからドメインでアクセス（split DNS・任意）

外部（モバイル通信等）からは `https://music.shirai-dev.com` で見られるが、**自宅LAN内の端末**から
同じドメインで開くと、多くのルーター（SoftBank 光BB 等）が**ヘアピンNAT非対応**のため失敗する。
解決策は2つ:

**A. ルーターで「NATループバック / ヘアピンNAT」を有効化**（対応していれば設定ゼロで全端末OK）

**B. 家庭内 split DNS を立てる**（`docker-compose.dns.yml`）。LAN内だけ
`music.shirai-dev.com` → サーバーのLAN IP に解決させる（証明書は SNI で一致するので有効なまま）。

```bash
# サーバーで（.env に DOMAIN と LAN_IP を設定後）
ip route get 1.1.1.1 | grep -oP 'src \K\S+'     # ← これが LAN_IP（172.x の Docker IP は不可）
docker compose -f docker-compose.dns.yml up -d
```

次に各端末の DNS をサーバーの LAN IP に向ける（ルーターのDHCPでDNSを配れるならそこで一括、無理なら端末ごと）:
- **iPhone**: 設定 → Wi-Fi → ネットワークの (i) → DNSを構成 → 手動 → 既存を消して LAN_IP を追加
- **Android**: Wi-Fi → ネットワーク設定 → IP設定を「静的」→ DNS1 に LAN_IP（プライベートDNSはホスト名専用で不可）
- **Windows**: アダプター設定 → IPv4 → 優先DNSサーバー = LAN_IP

> 注意: サーバーの LAN IP は**固定**（DHCP予約か静的）にすること。予備DNSに `1.1.1.1` を併記しておくと、
> DNSコンテナ停止時も一般の名前解決は生きる（その間ドメイン→LAN IP の上書きは効かない）。

## ディレクトリ構成（抜粋）

```
src/
  proxy.ts                 認証ゲート（Next 16 の旧 middleware）
  instrumentation.ts       起動時: スキーマ作成・中断ジョブ後始末
  lib/                     db, session, ratelimit, tracks, ytdlp, jobs, media, types
  app/
    login/                 ログインページ
    (app)/                 認証必須エリア（ライブラリ）
    api/                   auth / tracks / stream / download
  components/              PlayerProvider, PlayerBar, Library, TrackList, AddTrackForm
db/schema.sql              スキーマの正本（参照用）
Dockerfile, docker-compose*.yml
```
