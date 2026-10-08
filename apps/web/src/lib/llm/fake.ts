import type { ChatMessage, LLMProvider, StreamEvent, StreamOptions } from "./types";

/**
 * Offline provider for tests, CI and local development without API keys.
 * It reads the numbered sources from the prompt, picks the one that shares the most
 * words with the question, and answers with its first sentences plus a citation.
 * If there are no sources it produces the refusal phrase. Deterministic.
 */
export class FakeProvider implements LLMProvider {
  readonly provider = "fake";
  readonly model = "fake-extractive-v1";

  async *stream(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<StreamEvent> {
    const prompt = messages.filter((m) => m.role !== "assistant").map((m) => m.content).join("\n");
    const question = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    const sources = [...prompt.matchAll(/^\[(\d+)\][^\n]*\n([\s\S]*?)(?=^\[\d+\]|^<\/sources>|$(?![\r\n]))/gm)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }));

    let answer: string;
    if (!sources.length) {
      answer = "I don't have that information in the available documents, so I can't answer this. I can connect you with a person who can help.";
    } else {
      const qWords = new Set(words(question));
      const best = sources
        .map((s) => ({ s, overlap: words(s.text).filter((w) => qWords.has(w)).length }))
        .sort((a, b) => b.overlap - a.overlap)[0];
      const sentences = best.s.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
      answer = `${sentences} [${best.s.n}]`;
    }

    // Stream in small pieces so the UI's streaming path is exercised.
    const pieces = answer.match(/.{1,12}/g) ?? [answer];
    for (const p of pieces) {
      if (opts.signal?.aborted) return;
      yield { type: "text", text: p };
    }
    yield { type: "done", usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(answer.length / 4) }, finishReason: "stop" };
  }
}

const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "i", "my", "can", "how", "what", "to", "of", "for", "in", "on", "and", "or", "it", "you", "your", "we", "be"]);
function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}
