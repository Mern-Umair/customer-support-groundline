import { describe, expect, it } from "vitest";
import { parseSse } from "./sse";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: string[] = [];
  for await (const d of parseSse(stream)) out.push(d);
  return out;
}

describe("parseSse", () => {
  it("yields data payloads split across chunks and with CRLF", async () => {
    const out = await collect(streamOf(['data: {"a":1}\r\n\r\ndata: {"b":', '2}\n\n', "data: [DONE]\n\n"]));
    expect(out).toEqual(['{"a":1}', '{"b":2}', "[DONE]"]);
  });

  it("joins multi-line data fields and ignores comments and event names", async () => {
    const out = await collect(streamOf([": keepalive\nevent: message\ndata: line1\ndata: line2\n\n"]));
    expect(out).toEqual(["line1\nline2"]);
  });

  it("flushes a final event without a trailing blank line", async () => {
    expect(await collect(streamOf(["data: last"]))).toEqual(["last"]);
  });
});
