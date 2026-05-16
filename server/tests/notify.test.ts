import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/notify.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "watcher-secret";
const PHONE = "+15551234567";
const USER_ID = "abc123def456";
const mockFetch = vi.fn();

const ENV: Record<string, string> = {
  WATCHER_SECRET: SECRET,
  TEXTBELT_KEY: "tb_key_test",
  POSTGRES_URL: "postgres://localhost/test",
  DAILY_SMS_LIMIT: "10",
};

const savedEnv: Record<string, string | undefined> = {};

// Sequence: subscriber rows, then per-phone: priority, count, log insert.
function setupSql(subscribers: { phone: string }[], priorityRows: unknown[] = [], count = 0) {
  const sqlFn = vi
    .fn()
    .mockResolvedValueOnce(subscribers)       // SELECT subscribers JOIN
    .mockResolvedValueOnce(priorityRows)      // SELECT priority_numbers
    .mockResolvedValueOnce([{ count }])       // SELECT COUNT notify_log
    .mockResolvedValue([]);                   // INSERT notify_log (+ any extras)
  mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
  return sqlFn;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of [...Object.keys(ENV), "ALLOWED_ORIGINS"]) savedEnv[k] = process.env[k];
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
  delete process.env.ALLOWED_ORIGINS;

  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ success: true, textId: "sid_123", quotaRemaining: 99 }),
  });
  setupSql([{ phone: PHONE }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function call(
  reqOpts: Parameters<typeof makeReq>[0] = {},
  envOpts: Record<string, string | undefined> = {},
) {
  for (const [k, v] of Object.entries(envOpts)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const req = makeReq({ method: "POST", headers: { authorization: `Bearer ${SECRET}` }, body: { userId: USER_ID }, ...reqOpts });
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
  it("returns 500 when WATCHER_SECRET is missing", async () => {
    const { status, body } = await call({}, { WATCHER_SECRET: undefined });
    expect(status).toBe(500);
    expect(body.detail).toContain("WATCHER_SECRET");
  });

  it("returns 500 when TEXTBELT_KEY is missing", async () => {
    const { status, body } = await call({}, { TEXTBELT_KEY: undefined });
    expect(status).toBe(500);
    expect(body.detail).toContain("TEXTBELT_KEY");
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

  it("rejects a CLIENT_SECRET used against a watcher endpoint", async () => {
    process.env.CLIENT_SECRET = "client-only-secret";
    const { status } = await call({ headers: { authorization: "Bearer client-only-secret" } });
    expect(status).toBe(401);
  });
});

describe("body validation", () => {
  it("returns 400 when userId is missing", async () => {
    const { status, body } = await call({ body: {} });
    expect(status).toBe(400);
    expect(body.error).toBe("userId_required");
  });

  it("returns 400 when userId is not a string", async () => {
    const { status, body } = await call({ body: { userId: 42 } });
    expect(status).toBe(400);
    expect(body.error).toBe("userId_required");
  });
});

describe("no subscribers", () => {
  it("returns 200 with sent:0 when no one has favorited the user", async () => {
    setupSql([]);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.detail).toBe("no_subscribers");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  it("skips a phone that has hit the daily limit", async () => {
    setupSql([{ phone: PHONE }], [], 10);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(0);
    expect((body.errors as string[]).length).toBeGreaterThan(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("bypasses the limit for priority numbers", async () => {
    setupSql([{ phone: PHONE }], [{ 1: 1 }], 10);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(1);
  });

  it("respects DAILY_SMS_LIMIT env value", async () => {
    process.env.DAILY_SMS_LIMIT = "3";
    setupSql([{ phone: PHONE }], [], 3);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(0);
  });
});

describe("Textbelt errors", () => {
  it("records error and continues when Textbelt reports failure for one phone", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "out of quota" }),
    });
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.errors).toBeDefined();
  });

  it("records error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNRESET"));
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.errors).toBeDefined();
  });
});

describe("happy path", () => {
  it("sends SMS and returns sent:1 for one subscriber", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(1);
    expect(body.total).toBe(1);
    expect(body.errors).toBeUndefined();
  });

  it("posts to Textbelt with correct phone and key", async () => {
    await call();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://textbelt.com/text");
    const sent = JSON.parse(init.body as string) as Record<string, string>;
    expect(sent.phone).toBe(PHONE);
    expect(sent.key).toBe("tb_key_test");
  });

  it("fans out to multiple subscribers", async () => {
    const PHONE_2 = "+15559876543";
    const sqlFn = vi
      .fn()
      .mockResolvedValueOnce([{ phone: PHONE }, { phone: PHONE_2 }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]).mockResolvedValue([]);
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);

    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.sent).toBe(2);
    expect(body.total).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
