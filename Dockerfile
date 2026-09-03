# syntax=docker/dockerfile:1

# ============================================================
# Next.js 用 マルチステージ Dockerfile
#   - base          : 共通ベース
#   - runtime-tools : ffmpeg + yt-dlp(pip) を持つ実行用ベース（dev / runner が継承）
#   - deps          : 依存関係のインストール（キャッシュ層）
#   - dev           : 開発用（ホットリロード, docker-compose.dev.yml から使用）
#   - builder       : 本番ビルド（standalone 出力を生成）
#   - runner        : 本番実行（軽量・非root）
# ============================================================

# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
# libc6-compat: sharp 等のネイティブモジュール用
RUN apk add --no-cache libc6-compat

# ---- Runtime tools (ffmpeg + yt-dlp) ----
# yt-dlp は apk 版だと古くなり YouTube 抽出が壊れやすいので pip(最新)で入れる。
# イメージをリビルドすれば最新の yt-dlp に更新される。
FROM base AS runtime-tools
RUN apk add --no-cache ffmpeg python3 py3-pip ca-certificates
# YTDLP_REFRESH の値を変えて --build-arg すると、この層のキャッシュを破棄して
# yt-dlp を取り直せる（例: --build-arg YTDLP_REFRESH=$(date +%s)）
ARG YTDLP_REFRESH=1
RUN python3 -m venv /opt/yt-dlp \
  && /opt/yt-dlp/bin/pip install --no-cache-dir -U "yt-dlp[default]"
ENV PATH="/opt/yt-dlp/bin:${PATH}"

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Development (hot reload) ----
FROM runtime-tools AS dev
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- Builder ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runner (production) ----
FROM runtime-tools AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# root で実行しないための専用ユーザー
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# 音声ファイルの保存先。空の名前付きボリュームをここにマウントすると
# このディレクトリの所有権(nextjs)が引き継がれ、書き込み可能になる。
RUN mkdir -p /app/media && chown nextjs:nodejs /app/media
ENV MEDIA_DIR=/app/media

# standalone 出力に含まれないものを個別にコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# standalone が壊れて server.js が出力されていない場合は、ここでビルドを失敗させる
# （実行時に "Cannot find module '/app/server.js'" で落ちるのを未然に防ぐ）
RUN test -f /app/server.js \
  || (echo "ERROR: /app/server.js missing — standalone build is broken" && ls -la /app && exit 1)

# 念のため、標準出力にトレースされ得る .env を除去（秘密はランタイム env で渡す）
RUN rm -f /app/.env /app/.next/standalone/.env

USER nextjs

EXPOSE 3000
ENV PORT=3000
# コンテナ外からアクセスできるよう 0.0.0.0 で待ち受ける
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
