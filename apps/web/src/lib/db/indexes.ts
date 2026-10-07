import type { Db } from "mongodb";
import { memberships, users, workspaces } from "./collections";

/** Idempotent. Called once per process when the connection opens. */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    users(db).createIndex({ email: 1 }, { unique: true }),
    workspaces(db).createIndex({ slug: 1 }, { unique: true }),
    workspaces(db).createIndex({ publicKey: 1 }, { unique: true }),
    memberships(db).createIndex({ userId: 1, workspaceId: 1 }, { unique: true }),
    memberships(db).createIndex({ workspaceId: 1 }),
  ]);
}
