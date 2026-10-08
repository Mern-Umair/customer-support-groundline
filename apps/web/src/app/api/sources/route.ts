import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { sources } from "@/lib/db/collections";
import { pipelineContextFrom } from "@/lib/ingest/context";
import { toSourceDto } from "@/lib/ingest/dto";
import { createPdfSource, createTextSource, createWebsiteSource, SourceLimitError } from "@/lib/ingest/pipeline";
import { scoped } from "@/lib/tenant";

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const pc = await pipelineContextFrom(ctx);
  const list = await sources(pc.db).find(scoped(pc.workspaceId)).sort({ createdAt: -1 }).toArray();
  return NextResponse.json({ sources: list.map(toSourceDto) });
}

const JsonBody = z.union([
  z.object({ kind: z.literal("website"), url: z.string().trim().min(4).max(2000) }),
  z.object({ kind: z.literal("text"), name: z.string().trim().min(1).max(120), text: z.string().min(1).max(200_000) }),
]);

export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  const pc = await pipelineContextFrom(ctx);

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return badRequest("Attach a PDF file");
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return badRequest("Only PDF files are supported right now");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = await createPdfSource(pc, file.name, bytes);
      return NextResponse.json({ source: toSourceDto(source) }, { status: 201 });
    }

    const parsed = JsonBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return badRequest("Provide a website URL or a name and text");
    const body = parsed.data;
    const source = body.kind === "website" ? await createWebsiteSource(pc, body.url) : await createTextSource(pc, body.name, body.text);
    return NextResponse.json({ source: toSourceDto(source) }, { status: 201 });
  } catch (err) {
    if (err instanceof SourceLimitError) return badRequest(err.message);
    throw err;
  }
}
