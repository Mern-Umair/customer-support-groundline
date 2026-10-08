import { MongoClient, type ObjectId } from "mongodb";

/**
 * Deletes everything created by e2e runs (users whose email starts with "e2e-") so the test
 * database and its vector index stay small. Runs after every Playwright run.
 */
export default async function globalTeardown() {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri) return;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const users = await db.collection<{ _id: ObjectId; email: string }>("users").find({ email: /^e2e-/ }).project({ _id: 1 }).toArray();
    const userIds = users.map((u) => u._id);
    if (!userIds.length) return;
    const memberships = await db.collection<{ workspaceId: ObjectId; userId: ObjectId }>("memberships").find({ userId: { $in: userIds } }).toArray();
    const workspaceIds = memberships.map((m) => m.workspaceId);
    for (const col of ["sources", "pages", "chunks", "conversations", "messages"]) {
      await db.collection(col).deleteMany({ workspaceId: { $in: workspaceIds } });
    }
    await db.collection("workspaces").deleteMany({ _id: { $in: workspaceIds } });
    await db.collection("memberships").deleteMany({ userId: { $in: userIds } });
    await db.collection("users").deleteMany({ _id: { $in: userIds } });
    console.log(`[e2e teardown] removed ${userIds.length} e2e users and ${workspaceIds.length} workspaces`);
  } finally {
    await client.close();
  }
}
