import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/auth/api";
import { publicRealtimeUrl, signRealtimeToken } from "@/lib/realtime/server";

/** Agent token for the dashboard's socket connection. Null url means realtime is not configured. */
export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const url = publicRealtimeUrl();
  if (!url) return NextResponse.json({ url: null, token: null });
  const token = await signRealtimeToken({ role: "agent", workspaceId: ctx.workspace._id.toHexString(), userId: ctx.user._id.toHexString(), name: ctx.user.name });
  return NextResponse.json({ url, token });
}
