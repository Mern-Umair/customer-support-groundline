import type { AnswerEvent } from "./answer";

/**
 * Wraps an AnswerEvent generator as a text/event-stream Response.
 * Each event is `event: <type>` + `data: <json>`. Errors become an `error` event so the
 * client can show them instead of a broken stream.
 */
export function sseResponse(events: AsyncGenerator<AnswerEvent>, signal?: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: AnswerEvent) => controller.enqueue(encoder.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
      try {
        for await (const ev of events) {
          if (signal?.aborted) break;
          send(ev);
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unexpected error" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
