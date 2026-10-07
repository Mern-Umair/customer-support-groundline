import "server-only";
import { randomBytes } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "../db";
import { memberships, users, workspaces } from "../db/collections";
import { hashPassword, verifyPassword } from "./password";

export type AuthErrorCode = "email_taken" | "invalid_credentials";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}

export interface AuthResult {
  userId: string;
  workspaceId: string;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`;
}

export function generatePublicKey(): string {
  return `wk_${randomBytes(16).toString("hex")}`;
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  let userId: ObjectId;
  try {
    const res = await users(db).insertOne({
      _id: new ObjectId(),
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      createdAt: now,
    });
    userId = res.insertedId;
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new AuthError("email_taken");
    throw err;
  }

  const workspaceId = new ObjectId();
  await workspaces(db).insertOne({
    _id: workspaceId,
    name: input.workspaceName.trim(),
    slug: slugify(input.workspaceName),
    publicKey: generatePublicKey(),
    plan: "free",
    createdBy: userId,
    createdAt: now,
  });
  await memberships(db).insertOne({
    _id: new ObjectId(),
    userId,
    workspaceId,
    role: "owner",
    createdAt: now,
  });

  return { userId: userId.toHexString(), workspaceId: workspaceId.toHexString() };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const db = await getDb();
  const user = await users(db).findOne({ email: email.trim().toLowerCase() });
  // Always run the hash comparison so timing does not reveal whether the email exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) throw new AuthError("invalid_credentials");

  const membership = await memberships(db).findOne({ userId: user._id }, { sort: { createdAt: 1 } });
  if (!membership) throw new AuthError("invalid_credentials");

  return { userId: user._id.toHexString(), workspaceId: membership.workspaceId.toHexString() };
}
