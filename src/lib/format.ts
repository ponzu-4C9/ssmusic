// クライアント/サーバー両用の小さなフォーマッタ（server 専用 import を含めないこと）。

export function formatTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor(totalSeconds / 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
