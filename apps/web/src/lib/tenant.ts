import { ObjectId, type Filter } from "mongodb";
import type { TenantOwned } from "./db/types";

export class CrossTenantQueryError extends Error {
  constructor() {
    super("Cross-tenant query blocked: filter workspaceId does not match the current workspace");
    this.name = "CrossTenantQueryError";
  }
}

/**
 * Forces `workspaceId` into a query filter so a tenant-owned collection can never be
 * read across tenants by accident. Use this for every query on tenant-owned data.
 */
export function scoped<T extends TenantOwned>(
  workspaceId: ObjectId,
  filter: Filter<T> = {} as Filter<T>,
): Filter<T> {
  const existing = (filter as { workspaceId?: unknown }).workspaceId;
  if (existing !== undefined && !(existing instanceof ObjectId && existing.equals(workspaceId))) {
    throw new CrossTenantQueryError();
  }
  return { ...filter, workspaceId } as Filter<T>;
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
