import "server-only";
import type { CurrentContext } from "../auth/dal";
import { getDb } from "../db";
import { workspaces } from "../db/collections";
import { getEmbedder } from "../ingest/embedder";
import { getChatProvider } from "../llm/provider";
import type { AnswerContext } from "./answer";

export async function answerContextFrom(ctx: CurrentContext): Promise<AnswerContext> {
  const db = await getDb();
  const ws = await workspaces(db).findOne({ _id: ctx.workspace._id }, { projection: { toolsEnabled: 1 } });
  return {
    db,
    workspaceId: ctx.workspace._id,
    workspaceName: ctx.workspace.name,
    embedder: getEmbedder(),
    llm: getChatProvider(),
    toolsEnabled: Boolean(ws?.toolsEnabled),
  };
}
