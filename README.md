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

## ⚠️ インターネット公開とセキュリティ

ポート開放で外部公開する前に必ず読むこと:

1. **TLS(HTTPS) を用意する**。未TLSの平文HTTPだとログインパスワードとセッション Cookie が盗聴され得る。ドメイン取得後に **Caddy 等のリバースプロキシ**で TLS を終端し、`docker-compose.yml` の `ports` を `127.0.0.1:3000:3000` 等に絞るのが安全。
2. プロキシ導入後は `.env` で **`TRUST_PROXY=1`** にする。これでログイン試行のレート制限が実クライアント IP 単位で効く。プロキシが無い直接公開時は `0` のまま（`X-Forwarded-For` 偽装でのレート制限回避を防ぐため、全リクエストを共通制限にまとめる）。
3. `APP_PASSWORD` は推測されにくい十分長い値にする（唯一の認証情報のため）。
4. YouTube からのダウンロードは個人利用の範囲で。著作権・利用規約に留意。

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
