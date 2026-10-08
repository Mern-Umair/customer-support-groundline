import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { evalCases } from "@/lib/db/collections";
import { insertCases } from "@/lib/evals/demo/load";
import { toCaseDto } from "@/lib/evals/dto";
import { scoped } from "@/lib/tenant";

const CaseInput = z.object({
  kind: z.enum(["answerable", "unanswerable"]),
  question: z.string().trim().min(3).max(500),
  expectedAnswer: z.string().trim().max(2000).optional(),
  expectedSource: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});
const Body = z.union([CaseInput, z.array(CaseInput).min(1).max(500)]);

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const db = await getDb();
  const list = await evalCases(db).find(scoped(ctx.workspace._id)).sort({ createdAt: 1 }).toArray();
  return NextResponse.json({ cases: list.map(toCaseDto) });
}

/** Create one case or import many (JSON array). Duplicate questions are skipped. */
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Each case needs a kind and a question");
  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const clean = items.map((c) => ({ ...c, expectedAnswer: c.expectedAnswer || undefined, expectedSource: c.expectedSource || undefined }));
  const db = await getDb();
  const created = await insertCases(db, ctx.workspace._id, clean);
  return NextResponse.json({ created, skipped: items.length - created }, { status: 201 });
}
