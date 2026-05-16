import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/favorites.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "client-secret";
const GUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const USER_ID = "abc123def456abc123def456";

const ENV: Record<string, string> = {
  CLIENT_SECRET: SECRET,
  POSTGRES_URL: "postgres://localhost/test",
};

const savedEnv: Record<string, string | undefined> = {};

function setupSql(rows: unknown[] = []) {
  const sqlFn = vi.fn().mockResolvedValue(rows);
  mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
  return sqlFn;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of [...Object.keys(ENV), "ALLOWED_ORIGINS"]) savedEnv[k] = process.env[k];
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
  delete process.env.ALLOWED_ORIGINS;
  setupSql([]);
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function callGet(query: Record<string, string> = {}, headers: Record<string, string | undefined> = {}) {
  const req = makeReq({ method: "GET", headers: { authorization: `Bearer ${SECRET}`, ...headers }, query });
  const res = makeRes();
  await handler(req, res as unknown as VercelResponse);
  return { status: res._status, body: res._body };
}

async function callPost(body: unknown = {}, headers: Record<string, string | undefined> = {}) {
  const req = makeReq({ method: "POST", headers: { authorization: `Bearer ${SECRET}`, ...headers }, body });
  const res = makeRes();
  await handler(req, res as unknown as VercelResponse);
  return { status: res._status, body: res._body };
}

describe("CORS preflight", () => {
  it("returns 204 for OPTIONS", async () => {
    const req = makeReq({ method: "OPTIONS", headers: { authorization: `Bearer ${SECRET}` } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);
    expect(res._status).toBe(204);
  });
});

describe("misconfiguration", () => {
  it("returns 500 when CLIENT_SECRET is missing (GET)", async () => {
    delete process.env.CLIENT_SECRET;
    const { status, body } = await callGet({ guid: GUID });
    expect(status).toBe(500);
    expect(body.detail).toContain("CLIENT_SECRET");
  });
});

describe("authorization", () => {
  it("returns 401 for wrong secret (GET)", async () => {
    const { status, body } = await callGet({ guid: GUID }, { authorization: "Bearer wrong" });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for wrong secret (POST)", async () => {
    const { status, body } = await callPost({ guid: GUID, userId: USER_ID, favorite: true }, { authorization: "Bearer wrong" });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });
});

describe("GET /api/favorites", () => {
  it("returns 400 when guid is missing", async () => {
    const { status, body } = await callGet({});
    expect(status).toBe(400);
    expect(body.error).toBe("guid_required");
  });

  it("returns empty favorites array when none exist", async () => {
    setupSql([]);
    const { status, body } = await callGet({ guid: GUID });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.favorites).toEqual([]);
  });

  it("returns favorites rows for the guid", async () => {
    const row = { user_id: USER_ID, profile_pic_url: null, favorited_at: "2026-01-01T00:00:00Z" };
    setupSql([row]);
    const { status, body } = await callGet({ guid: GUID });
    expect(status).toBe(200);
    expect((body.favorites as unknown[]).length).toBe(1);
    expect((body.favorites as typeof row[])[0].user_id).toBe(USER_ID);
  });
});

describe("POST /api/favorites", () => {
  it("returns 400 when guid or userId is missing", async () => {
    const { status, body } = await callPost({ guid: GUID });
    expect(status).toBe(400);
    expect(body.error).toBe("guid_and_userId_required");
  });

  it("upserts when favorite is true", async () => {
    const { status, body } = await callPost({ guid: GUID, userId: USER_ID, favorite: true });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const sqlFn = mockNeon.mock.results[0].value as ReturnType<typeof vi.fn>;
    expect(sqlFn).toHaveBeenCalledOnce();
  });

  it("deletes when favorite is false", async () => {
    const { status, body } = await callPost({ guid: GUID, userId: USER_ID, favorite: false });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns 405 for unsupported method", async () => {
    const req = makeReq({ method: "PUT", headers: { authorization: `Bearer ${SECRET}` } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);
    expect(res._status).toBe(405);
  });
});
