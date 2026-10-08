import { NextResponse } from "next/server";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { loadDemoSet } from "@/lib/evals/demo/load";
import { pipelineContextFrom } from "@/lib/ingest/context";
import { SourceLimitError } from "@/lib/ingest/pipeline";

export const maxDuration = 120;

/** Loads the Ali Shoes demo documents (indexed now) and the 40-case golden set. */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  try {
    const result = await loadDemoSet(await pipelineContextFrom(ctx));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof SourceLimitError) return badRequest(err.message);
    throw err;
  }
}
