// MP3 ファイルの保存先（MEDIA_DIR）とパス解決。
// file_path は DB が持つ相対パスだが、念のためパストラバーサルを防ぐ。

import path from "node:path";

export function getMediaDir(): string {
  // process.cwd() を静的トレースに含めると standalone 出力が肥大化するため避ける。
  // 相対値 "media" は resolveMediaPath() / 各処理で実行時に cwd 基準へ解決される。
  return process.env.MEDIA_DIR || "media";
}

/**
 * MEDIA_DIR 配下の相対パスを絶対パスへ解決する。
 * MEDIA_DIR の外を指していた場合は例外を投げる。
 */
export function resolveMediaPath(relative: string): string {
  const dir = path.resolve(getMediaDir());
  const resolved = path.resolve(dir, relative);
  if (resolved !== dir && !resolved.startsWith(dir + path.sep)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}
