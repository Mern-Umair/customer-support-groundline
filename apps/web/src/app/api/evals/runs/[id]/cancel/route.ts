import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { evalContextFrom } from "@/lib/evals/context";
import { cancelRun } from "@/lib/evals/runner";
import { toObjectId } from "@/lib/tenant";

/** Stops a running eval run (kept with its finished cases, marked failed/cancelled). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  const { id } = await params;
  const runId = toObjectId(id);
  if (!runId) return notFound();
  const ok = await cancelRun(await evalContextFrom(ctx), runId);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
