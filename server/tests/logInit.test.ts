import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/logInit.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "client-secret";
const USER_ID = "694abfeb1cf11f4a71d32027";
const CLIENT_TYPE = "chrome-client";
const VERSION = "0.1.0";

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
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}` },
    body: { userId: USER_ID, clientType: CLIENT_TYPE, version: VERSION },
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
  it("returns 405 for GET", async () => {
    const { status, body } = await call({ method: "GET" });
    expect(status).toBe(405);
    expect(body.error).toBe("method_not_allowed");
  });
});

describe("misconfiguration", () => {
  it("returns 500 when CLIENT_SECRET is missing", async () => {
    const { status, body } = await call({}, { CLIENT_SECRET: undefined });
    expect(status).toBe(500);
    expect(body.error).toBe("server_misconfigured");
    expect(body.detail).toContain("CLIENT_SECRET");
  });

  it("returns 500 when POSTGRES_URL is missing", async () => {
    const { status, body } = await call({}, { POSTGRES_URL: undefined });
    expect(status).toBe(500);
    expect(body.error).toBe("server_misconfigured");
    expect(body.detail).toContain("POSTGRES_URL");
  });
});

describe("authorization", () => {
  it("returns 401 when Authorization is absent", async () => {
    const { status, body } = await call({ headers: { authorization: undefined } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for wrong secret", async () => {
    const { status, body } = await call({ headers: { authorization: "Bearer wrong" } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });
});

describe("validation", () => {
  it("returns 400 when userId is missing", async () => {
    const { status, body } = await call({ body: { clientType: CLIENT_TYPE, version: VERSION } });
    expect(status).toBe(400);
    expect(body.error).toBe("userId_and_version_required");
  });

  it("returns 400 when version is missing", async () => {
    const { status, body } = await call({ body: { userId: USER_ID, clientType: CLIENT_TYPE } });
    expect(status).toBe(400);
    expect(body.error).toBe("userId_and_version_required");
  });

  it("returns 400 for an unrecognized clientType", async () => {
    const { status, body } = await call({
      body: { userId: USER_ID, clientType: "userscript", version: VERSION },
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_client_type");
  });
});

describe("happy path", () => {
  it("returns 200 for chrome-client", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns 200 for bookmarklet", async () => {
    const { status, body } = await call({
      body: { userId: USER_ID, clientType: "bookmarklet", version: VERSION },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("inserts a row into client_init_log", async () => {
    await call();
    expect(mockNeon).toHaveBeenCalledOnce();
    const sqlFn = mockNeon.mock.results[0].value as ReturnType<typeof vi.fn>;
    expect(sqlFn).toHaveBeenCalledOnce();
  });
});

describe("database error", () => {
  it("returns 500 when the insert fails", async () => {
    const sqlFn = vi.fn().mockRejectedValue(new Error("insert failed"));
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);

    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.error).toBe("db_error");
  });
});
