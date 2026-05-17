import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/save-number.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "client-secret";
const PHONE = "+15551234567";
const GUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

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

  const sqlFn = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ guid: GUID }]);
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
    body: { phone: PHONE },
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

describe("phone validation", () => {
  it("returns 400 for missing +", async () => {
    const { status, body } = await call({ body: { phone: "15551234567" } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });

  it("returns 400 for too short", async () => {
    const { status, body } = await call({ body: { phone: "+12345" } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });

  it("returns 400 for non-string", async () => {
    const { status, body } = await call({ body: { phone: 15551234567 } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });
});

describe("happy path", () => {
  it("returns 200 with guid", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.guid).toBe(GUID);
  });

  it("inserts phone then selects guid", async () => {
    await call();
    expect(mockNeon).toHaveBeenCalledOnce();
    const sqlFn = mockNeon.mock.results[0].value as ReturnType<typeof vi.fn>;
    expect(sqlFn).toHaveBeenCalledTimes(2);
  });
});
