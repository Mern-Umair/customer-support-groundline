import "server-only";
import type { CurrentContext } from "../auth/dal";
import { getDb } from "../db";
import { getEmbedder } from "./embedder";
import type { PipelineContext } from "./pipeline";

export async function pipelineContextFrom(ctx: CurrentContext): Promise<PipelineContext> {
  return {
    db: await getDb(),
    workspaceId: ctx.workspace._id,
    userId: ctx.user._id,
    plan: ctx.workspace.plan,
    embedder: getEmbedder(),
  };
}
