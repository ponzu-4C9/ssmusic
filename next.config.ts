import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 向けの自己完結型ビルド出力。
  // .next/standalone に server.js と必要最小限の node_modules がまとまる。
  output: "standalone",
  // standalone のトレースルートをこのプロジェクトに固定する。
  // 無指定だとビルド環境次第でルート推定がブレ、server.js が standalone の
  // サブディレクトリに入れ子化して "Cannot find module '/app/server.js'" を
  // 起こすことがある。明示固定で server.js を必ず standalone 直下に出力する。
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
