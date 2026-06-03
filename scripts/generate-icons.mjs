// SVG から PWA 用 PNG アイコン(192/512)を生成する。
// 使い方: npm run icons
// （生成された PNG は public/ にコミットする。本番イメージでは実行しない。）

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const svg = await readFile(path.join(root, "src/app/icon.svg"));

for (const size of [192, 512]) {
  const out = path.join(root, `public/icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`generated ${out}`);
}
