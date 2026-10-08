import type { PendingActionDoc } from "../db/types";

export interface ActionDto {
  id: string;
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  status: PendingActionDoc["status"];
  result?: PendingActionDoc["result"];
  requestedAt: string;
  decidedAt?: string;
}

export const toActionDto = (a: PendingActionDoc): ActionDto => ({
  id: a._id.toHexString(),
  conversationId: a.conversationId.toHexString(),
  tool: a.tool,
  args: a.args,
  summary: a.summary,
  status: a.status,
  result: a.result,
  requestedAt: a.requestedAt.toISOString(),
  decidedAt: a.decidedAt?.toISOString(),
});
