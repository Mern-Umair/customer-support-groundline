import "server-only";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../db";
import { memberships, users, workspaces } from "../db/collections";
import type { CurrentContext } from "./dal";
import { readSession } from "./session";

/** Like getCurrentContext, but returns null instead of redirecting. For route handlers. */
export async function getApiContext(): Promise<CurrentContext | null> {
  const payload = await readSession();
  if (!payload || !ObjectId.isValid(payload.userId) || !ObjectId.isValid(payload.workspaceId)) return null;
  const userId = new ObjectId(payload.userId);
  const workspaceId = new ObjectId(payload.workspaceId);
  const db = await getDb();
  const [user, workspace, membership] = await Promise.all([
    users(db).findOne({ _id: userId }, { projection: { _id: 1, email: 1, name: 1 } }),
    workspaces(db).findOne({ _id: workspaceId }, { projection: { _id: 1, name: 1, slug: 1, publicKey: 1, plan: 1, createdAt: 1 } }),
    memberships(db).findOne({ userId, workspaceId }),
  ]);
  if (!user || !workspace || !membership) return null;
  return { user, workspace, role: membership.role };
}

export const unauthorized = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
