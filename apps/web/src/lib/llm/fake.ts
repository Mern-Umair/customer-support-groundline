import type { ChatMessage, LLMProvider, StreamEvent, StreamOptions } from "./types";

/**
 * Offline provider for tests, CI and local development without API keys.
 * Text answers: picks the numbered source sharing the most words with the question and
 * answers with its first sentences plus a citation; refuses without sources.
 * Tools: when tools are offered, recognisable requests (order numbers, tickets, bookings)
 * become tool calls, and a tool result turn becomes a short final answer. Deterministic.
 */
export class FakeProvider implements LLMProvider {
  readonly provider = "fake";
  readonly model = "fake-extractive-v1";

  async *stream(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<StreamEvent> {
    const prompt = messages.filter((m) => m.role === "system" || m.role === "user").map((m) => m.content).join("\n");
    const question = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    const toolResults = messages.filter((m) => m.role === "tool");
    const toolNames = new Set((opts.tools ?? []).map((t) => t.name));

    let answer: string | null = null;
    if (toolResults.length) {
      answer = answerFromToolResult(toolResults[toolResults.length - 1]);
    } else if (toolNames.size) {
      const call = detectToolCall(question, toolNames);
      if (call) {
        yield { type: "tool_call", call };
        yield { type: "done", usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: 20 }, finishReason: "tool_calls" };
        return;
      }
    }

    if (answer === null) {
      const sources = [...prompt.matchAll(/^\[(\d+)\][^\n]*\n([\s\S]*?)(?=^\[\d+\]|^<\/sources>|$(?![\r\n]))/gm)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
      if (!sources.length) {
        answer = "I don't have that information in the available documents, so I can't answer this. I can connect you with a person who can help.";
      } else {
        const qWords = new Set(words(question));
        const best = sources.map((s) => ({ s, overlap: words(s.text).filter((w) => qWords.has(w)).length })).sort((a, b) => b.overlap - a.overlap)[0];
        const sentences = best.s.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
        answer = `${sentences} [${best.s.n}]`;
      }
    }

    const pieces = answer.match(/[\s\S]{1,12}/g) ?? [answer];
    for (const p of pieces) {
      if (opts.signal?.aborted) return;
      yield { type: "text", text: p };
    }
    yield { type: "done", usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(answer.length / 4) }, finishReason: "stop" };
  }
}

function detectToolCall(question: string, available: Set<string>): { id: string; name: string; args: Record<string, unknown> } | null {
  const order = question.match(/order\s*(?:number|no\.?|#)?\s*#?\s*(\d{4,})/i);
  if (order && available.has("lookupOrder")) {
    const email = question.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
    return { id: "call_1", name: "lookupOrder", args: { orderNumber: order[1], ...(email ? { email } : {}) } };
  }
  const booking = question.match(/\b(book|appointment|fitting)\b/i) && question.match(/(\d{4}-\d{2}-\d{2})/);
  if (booking && available.has("bookAppointment")) {
    const time = question.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? "10:00";
    return { id: "call_1", name: "bookAppointment", args: { date: booking[1], time, name: "Visitor", purpose: question.slice(0, 120) } };
  }
  if (/\b(ticket|complain|complaint|faulty|broken|defect|file a)\b/i.test(question) && available.has("createTicket")) {
    const email = question.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
    return { id: "call_1", name: "createTicket", args: { subject: question.slice(0, 60), details: question, ...(email ? { email } : {}) } };
  }
  return null;
}

function answerFromToolResult(m: ChatMessage): string {
  try {
    const r = JSON.parse(m.content) as { status?: string; summary?: string; ok?: boolean; data?: Record<string, unknown> };
    if (r.status === "pending_approval") return `I've asked the team to approve this: ${r.summary ?? "your request"}. You'll see the confirmation here once it's done.`;
    if (r.ok === false) return `I couldn't complete that: ${r.summary ?? "the lookup failed"}. A teammate can help if you share more details.`;
    if (r.summary) return `${r.summary}.`;
  } catch {
    /* fall through */
  }
  return `Done: ${m.content.slice(0, 200)}`;
}

const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "i", "my", "can", "how", "what", "to", "of", "for", "in", "on", "and", "or", "it", "you", "your", "we", "be"]);
function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}
