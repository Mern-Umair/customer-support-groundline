import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { evalCases } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const caseId = toObjectId(id);
  if (!caseId) return notFound();
  const res = await evalCases(await getDb()).deleteOne(scoped(ctx.workspace._id, { _id: caseId }));
  return res.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
