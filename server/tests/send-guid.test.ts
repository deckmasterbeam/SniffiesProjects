import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/send-guid.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "client-secret";
const PHONE = "+15551234567";
const GUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const mockFetch = vi.fn();

const ENV: Record<string, string> = {
  CLIENT_SECRET: SECRET,
  POSTGRES_URL: "postgres://localhost/test",
  TEXTBELT_KEY: "tb_key_test",
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of [...Object.keys(ENV), "ALLOWED_ORIGINS"]) savedEnv[k] = process.env[k];
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
  delete process.env.ALLOWED_ORIGINS;

  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true }) });

  const sqlFn = vi.fn().mockResolvedValue([{ guid: GUID }]);
  mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    expect(body.detail).toContain("CLIENT_SECRET");
  });

  it("returns 500 when TEXTBELT_KEY is missing", async () => {
    const { status, body } = await call({}, { TEXTBELT_KEY: undefined });
    expect(status).toBe(500);
    expect(body.detail).toContain("TEXTBELT_KEY");
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
});

describe("phone validation", () => {
  it("returns 400 for invalid phone", async () => {
    const { status, body } = await call({ body: { phone: "not-a-phone" } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });
});

describe("phone not registered", () => {
  it("returns 404 when phone has no registration", async () => {
    const sqlFn = vi.fn().mockResolvedValue([]);
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
    const { status, body } = await call();
    expect(status).toBe(404);
    expect(body.error).toBe("phone_not_registered");
  });
});

describe("Textbelt errors", () => {
  it("returns 502 when Textbelt reports failure", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "out of quota" }),
    });
    const { status, body } = await call();
    expect(status).toBe(502);
    expect(body.error).toBe("textbelt_failed");
    expect(body.detail).toBe("out of quota");
  });

  it("returns 500 on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNRESET"));
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.error).toBe("internal_error");
  });
});

describe("happy path", () => {
  it("returns 200", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("texts the GUID to the phone", async () => {
    await call();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, string>;
    expect(sent.phone).toBe(PHONE);
    expect(sent.message).toContain(GUID);
    expect(sent.key).toBe("tb_key_test");
  });
});
