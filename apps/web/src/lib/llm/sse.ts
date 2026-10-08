/**
 * Parses a text/event-stream body into `data:` payload strings.
 * Handles multi-line data fields, CRLF, and chunks split mid-event.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const data = eventData(raw);
        if (data !== null) yield data;
      }
    }
    buffer += decoder.decode();
    const tail = eventData(buffer);
    if (tail !== null) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function eventData(block: string): string | null {
  const lines = block.split("\n");
  const data: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length ? data.join("\n") : null;
}
