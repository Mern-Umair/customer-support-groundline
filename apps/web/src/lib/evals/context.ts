import "server-only";
import type { CurrentContext } from "../auth/dal";
import { getDb } from "../db";
import { env } from "../env";
import { getEmbedder } from "../ingest/embedder";
import { GeminiProvider } from "../llm/gemini";
import { GroqProvider } from "../llm/groq";
import { getChatProvider } from "../llm/provider";
import { FakeJudge, LLMJudge, type Judge } from "./judge";
import type { EvalContext } from "./runner";

let judgeCache: Judge | undefined;

/**
 * Judge selection: prefer a different model family from the one under test (reduces
 * self-preference bias): Groq judges Gemini and vice versa when both keys exist.
 * Without any key, the offline overlap judge is used and labelled as such.
 */
export function getJudge(): Judge {
  if (judgeCache) return judgeCache;
  const e = env();
  const chat = getChatProvider();
  if (chat.provider === "gemini" && e.GROQ_API_KEY) judgeCache = new LLMJudge(new GroqProvider({ apiKey: e.GROQ_API_KEY, model: process.env.GROQ_JUDGE_MODEL || undefined }));
  else if (chat.provider === "groq" && e.GEMINI_API_KEY) judgeCache = new LLMJudge(new GeminiProvider({ apiKey: e.GEMINI_API_KEY, model: process.env.GEMINI_JUDGE_MODEL || undefined }));
  else if (chat.provider === "gemini" || chat.provider === "groq") judgeCache = new LLMJudge(chat);
  else judgeCache = new FakeJudge();
  return judgeCache;
}

export async function evalContextFrom(ctx: CurrentContext): Promise<EvalContext> {
  return {
    db: await getDb(),
    workspaceId: ctx.workspace._id,
    workspaceName: ctx.workspace.name,
    userId: ctx.user._id,
    embedder: getEmbedder(),
    llm: getChatProvider(),
    judge: getJudge(),
  };
}
