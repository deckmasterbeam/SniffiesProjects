import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/blocked-bots.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "client-secret";

const ENV: Record<string, string> = {
  CLIENT_SECRET: SECRET,
  POSTGRES_URL: "postgres://localhost/test",
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of [...Object.keys(ENV), "ALLOWED_ORIGINS"]) savedEnv[k] = process.env[k];
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
  delete process.env.ALLOWED_ORIGINS;

  const sqlFn = vi.fn().mockResolvedValue([]);
  mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

async function call(
  reqOpts: Parameters<typeof makeReq>[0] = {},
  envOpts: Record<string, string | undefined> = {},
) {
  for (const [k, v] of Object.entries(envOpts)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  const req = makeReq({
    method: "GET",
    headers: { authorization: `Bearer ${SECRET}` },
    ...reqOpts,
  });
  const res = makeRes();
  await handler(req, res as unknown as VercelResponse);
  return { status: res._status, body: res._body };
}

describe("CORS preflight", () => {
  it("returns 204 for OPTIONS", async () => {
    const { status } = await call({ method: "OPTIONS" });
    expect(status).toBe(204);
  });
});

describe("method not allowed", () => {
  it("returns 405 for POST", async () => {
    const { status, body } = await call({ method: "POST" });
    expect(status).toBe(405);
    expect(body.error).toBe("method_not_allowed");
  });
});

describe("misconfiguration", () => {
  it("returns 500 when CLIENT_SECRET is missing", async () => {
    const { status, body } = await call({}, { CLIENT_SECRET: undefined });
    expect(status).toBe(500);
    expect(body.detail).toContain("CLIENT_SECRET");
  });

  it("returns 500 when POSTGRES_URL is missing", async () => {
    const { status, body } = await call({}, { POSTGRES_URL: undefined });
    expect(status).toBe(500);
    expect(body.detail).toContain("POSTGRES_URL");
  });
});

describe("authorization", () => {
  it("returns 401 for wrong secret", async () => {
    const { status, body } = await call({ headers: { authorization: "Bearer wrong" } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 when Authorization is absent", async () => {
    const { status, body } = await call({ headers: { authorization: undefined } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("rejects a WATCHER_SECRET used against this client endpoint", async () => {
    process.env.WATCHER_SECRET = "watcher-only-secret";
    const { status } = await call({ headers: { authorization: "Bearer watcher-only-secret" } });
    expect(status).toBe(401);
  });
});

describe("happy path", () => {
  it("returns empty userIds when no validated reports exist", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userIds).toEqual([]);
  });

  it("returns reported user ids from validated_reports", async () => {
    const sqlFn = vi.fn().mockResolvedValue([{ reported_user_id: "abc" }, { reported_user_id: "def" }]);
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.userIds).toEqual(["abc", "def"]);
  });
});

describe("database error", () => {
  it("returns 500 when the query fails", async () => {
    const sqlFn = vi.fn().mockRejectedValue(new Error("query failed"));
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.error).toBe("db_error");
  });
});
