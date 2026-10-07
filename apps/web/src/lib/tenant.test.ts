import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { CrossTenantQueryError, scoped, toObjectId } from "./tenant";

const tenantA = new ObjectId();
const tenantB = new ObjectId();

describe("scoped()", () => {
  it("adds workspaceId to an empty filter", () => {
    expect(scoped(tenantA)).toEqual({ workspaceId: tenantA });
  });

  it("keeps other filter fields and adds workspaceId", () => {
    const f = scoped(tenantA, { status: "open" } as never);
    expect(f).toEqual({ status: "open", workspaceId: tenantA });
  });

  it("allows an explicit workspaceId that matches", () => {
    const f = scoped(tenantA, { workspaceId: new ObjectId(tenantA.toHexString()) });
    expect(f.workspaceId).toEqual(tenantA);
  });

  it("throws when the filter targets another tenant", () => {
    expect(() => scoped(tenantA, { workspaceId: tenantB })).toThrow(CrossTenantQueryError);
  });

  it("throws when workspaceId is a string (operator injection guard)", () => {
    expect(() => scoped(tenantA, { workspaceId: { $ne: null } } as never)).toThrow(CrossTenantQueryError);
  });
});

describe("toObjectId()", () => {
  it("returns null for garbage", () => {
    expect(toObjectId("not-an-id")).toBeNull();
  });
  it("parses a valid hex id", () => {
    expect(toObjectId(tenantA.toHexString())?.equals(tenantA)).toBe(true);
  });
});
