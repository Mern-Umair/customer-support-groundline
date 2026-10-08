import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { toObjectId } from "@/lib/tenant";
import { ActionError, decideAction } from "@/lib/tools/actions";
import { toActionDto } from "@/lib/tools/dto";

const Body = z.object({ decision: z.enum(["approve", "reject"]) });

/** Owner/agent approves or rejects a proposed side-effecting tool call. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const actionId = toObjectId(id);
  if (!actionId) return notFound();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("decision must be approve or reject");
  try {
    const action = await decideAction(await getDb(), ctx.workspace._id, actionId, parsed.data.decision, { id: ctx.user._id, name: ctx.user.name });
    return NextResponse.json({ action: toActionDto(action) });
  } catch (err) {
    if (err instanceof ActionError) return err.message.includes("not found") ? notFound() : badRequest(err.message);
    throw err;
  }
}
