// 音声ストリーミング。HTTP Range リクエストに対応する。
// ※ Range 対応は必須：これが無いとシークができず、iOS Safari では再生自体が
//   失敗することがある。

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";

import { resolveMediaPath } from "@/lib/media";
import { isAuthenticated } from "@/lib/session";
import { getTrackById } from "@/lib/tracks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function nodeToWeb(stream: Readable): ReadableStream<Uint8Array> {
  // 配信中にファイルが消える等で error が出た場合に確実に破棄する
  stream.on("error", () => stream.destroy());
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = Number((await ctx.params).id);
  const track = await getTrackById(id);
  if (!track || track.status !== "ready" || !track.filePath) {
    return new Response("Not found", { status: 404 });
  }

  let filePath: string;
  try {
    filePath = resolveMediaPath(track.filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  const range = req.headers.get("range");
  // multi-range（カンマ区切り）は未対応。Range を無視して全体を 200 で返す（RFC 準拠）。
  if (range && !range.includes(",")) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const startStr = match[1];
    const endStr = match[2];
    let start: number;
    let end: number;

    if (startStr === "" && endStr === "") {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    } else if (startStr === "") {
      // suffix range: 末尾 N バイト
      const n = parseInt(endStr, 10);
      if (Number.isNaN(n) || n <= 0) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      start = Math.max(0, size - n);
      end = size - 1;
    } else {
      start = parseInt(startStr, 10);
      end = endStr === "" ? size - 1 : parseInt(endStr, 10);
    }

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start >= size
    ) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    if (end >= size) end = size - 1;

    const chunkSize = end - start + 1;
    const webStream = nodeToWeb(createReadStream(filePath, { start, end }));
    return new Response(webStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const webStream = nodeToWeb(createReadStream(filePath));
  return new Response(webStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
