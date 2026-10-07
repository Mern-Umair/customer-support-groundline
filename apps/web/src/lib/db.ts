import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";
import { ensureIndexes } from "./db/indexes";

declare global {
  // Cached across hot reloads in development so we do not open a new pool per file change.
  var __groundlineMongo: Promise<Db> | undefined;
}

async function connect(): Promise<Db> {
  const client = new MongoClient(env().MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15_000,
  });
  await client.connect();
  const db = client.db();
  await ensureIndexes(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalThis.__groundlineMongo) {
    globalThis.__groundlineMongo = connect().catch((err) => {
      globalThis.__groundlineMongo = undefined;
      throw err;
    });
  }
  return globalThis.__groundlineMongo;
}
