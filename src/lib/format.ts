// クライアント/サーバー両用の小さなフォーマッタ（server 専用 import を含めないこと）。

export function formatTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor(totalSeconds / 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** ISO 文字列を日本語の短い日時表記に整形する（クライアント表示用）。 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
