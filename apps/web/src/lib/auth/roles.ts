import { NextResponse } from "next/server";
import type { CurrentContext } from "./dal";

/**
 * Role model (week 7):
 *  - owner: everything, including sources, evals, team, billing and settings;
 *  - agent: conversations (reply, take over, approve actions), playground, read-only sources.
 */
export const forbidden = (what = "Only the workspace owner can do this") => NextResponse.json({ error: what }, { status: 403 });

export function isOwner(ctx: CurrentContext): boolean {
  return ctx.role === "owner";
}
