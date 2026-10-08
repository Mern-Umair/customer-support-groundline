import "server-only";
import type { CurrentContext } from "../auth/dal";
import { getDb } from "../db";
import { getEmbedder } from "../ingest/embedder";
import { getChatProvider } from "../llm/provider";
import type { AnswerContext } from "./answer";

export async function answerContextFrom(ctx: CurrentContext): Promise<AnswerContext> {
  return {
    db: await getDb(),
    workspaceId: ctx.workspace._id,
    workspaceName: ctx.workspace.name,
    embedder: getEmbedder(),
    llm: getChatProvider(),
  };
}
