import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../api/notify.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));

import { neon } from "@neondatabase/serverless";

const mockNeon = vi.mocked(neon);
const mockFetch = vi.fn();

const MSG_TEST = "Sniffies extension: test message";
const MSG_AWAKE = `Sniffies: favorited cruiser ${"a".repeat(24)} is online.`;
const PHONE = "+15551234567";
const SECRET = "s3cr3t";

const ENV_DEFAULTS: Record<string, string> = {
  SHARED_SECRET: SECRET,
  TEXTBELT_KEY: "tb_key_test",
  POSTGRES_URL: "postgres://localhost/test",
  DAILY_SMS_LIMIT: "10",
};

function makeReq(opts: {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: unknown;
} = {}): VercelRequest {
  return {
    method: opts.method ?? "POST",
    headers: { authorization: `Bearer ${SECRET}`, ...opts.headers },
    body: opts.body !== undefined ? opts.body : { phone: PHONE, message: MSG_TEST },
  } as unknown as VercelRequest;
}

function makeRes() {
  let _status = 0;
  let _body: Record<string, unknown> = {};
  const res = {
    status(s: number) {
      _status = s;
      return res as unknown as VercelResponse;
    },
    json(b: unknown) {
      _body = b as Record<string, unknown>;
    },
    setHeader() {},
    end() {},
    get _status() {
      return _status;
    },
    get _body() {
      return _body;
    },
  };
  return res;
}

function setupSqlMock(priorityRows: unknown[] = [], count = 0) {
  const sqlFn = vi
    .fn()
    .mockResolvedValueOnce(priorityRows)
    .mockResolvedValueOnce([{ count }])
    .mockResolvedValue([]);
  mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
  return sqlFn;
}

async function call(
  reqOpts: Parameters<typeof makeReq>[0] = {},
  envOpts: Partial<Record<keyof typeof ENV_DEFAULTS, string | undefined>> = {},
) {
  for (const [k, v] of Object.entries(envOpts)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  const req = makeReq(reqOpts);
  const res = makeRes();
  await handler(req, res as unknown as VercelResponse);
  return { status: res._status, body: res._body };
}

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();

  const keys = [...Object.keys(ENV_DEFAULTS), "ALLOWED_ORIGINS"];
  for (const k of keys) savedEnv[k] = process.env[k];
  for (const [k, v] of Object.entries(ENV_DEFAULTS)) process.env[k] = v;
  delete process.env.ALLOWED_ORIGINS;

  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ success: true, textId: "sid_123", quotaRemaining: 99 }),
  });
  setupSqlMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// ---------------------------------------------------------------------------

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

  it("returns 405 for PUT", async () => {
    const { status, body } = await call({ method: "PUT" });
    expect(status).toBe(405);
    expect(body.error).toBe("method_not_allowed");
  });
});

describe("server misconfiguration", () => {
  it("returns 500 when SHARED_SECRET is missing", async () => {
    const { status, body } = await call({}, { SHARED_SECRET: undefined });
    expect(status).toBe(500);
    expect(body.error).toBe("server_misconfigured");
    expect(body.detail).toContain("SHARED_SECRET");
  });

  it("returns 500 when TEXTBELT_KEY is missing", async () => {
    const { status, body } = await call({}, { TEXTBELT_KEY: undefined });
    expect(status).toBe(500);
    expect(body.error).toBe("server_misconfigured");
    expect(body.detail).toContain("TEXTBELT_KEY");
  });
});

describe("authorization", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const { status, body } = await call({ headers: { authorization: undefined } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const { status, body } = await call({ headers: { authorization: "Bearer wrong-secret" } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for a Bearer token without the right secret", async () => {
    const { status, body } = await call({ headers: { authorization: `Bearer ${SECRET}x` } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });
});

describe("phone validation", () => {
  it("returns 400 for empty phone", async () => {
    const { status, body } = await call({ body: { phone: "", message: MSG_TEST } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });

  it("returns 400 for phone without leading +", async () => {
    const { status, body } = await call({ body: { phone: "15551234567", message: MSG_TEST } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });

  it("returns 400 for phone that is too short (fewer than 7 digits after country code)", async () => {
    const { status, body } = await call({ body: { phone: "+12345", message: MSG_TEST } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_phone");
  });
});

describe("message validation", () => {
  it("returns 400 for empty message", async () => {
    const { status, body } = await call({ body: { phone: PHONE, message: "" } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_message");
  });

  it("returns 400 for arbitrary text", async () => {
    const { status, body } = await call({ body: { phone: PHONE, message: "send me money" } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_message");
  });

  it("returns 400 for awake message with wrong-length user ID", async () => {
    const shortId = "abc123";
    const { status, body } = await call({
      body: { phone: PHONE, message: `Sniffies: favorited cruiser ${shortId} is online.` },
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_message");
  });

  it("returns 400 for awake message with uppercase hex ID", async () => {
    const upperId = "A".repeat(24);
    const { status, body } = await call({
      body: { phone: PHONE, message: `Sniffies: favorited cruiser ${upperId} is online.` },
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_message");
  });
});

describe("rate limiting", () => {
  it("returns 429 when daily limit is reached", async () => {
    setupSqlMock([], 10);
    const { status, body } = await call();
    expect(status).toBe(429);
    expect(body.error).toBe("daily_limit_reached");
    expect(body.detail).toContain("10");
  });

  it("reflects DAILY_SMS_LIMIT env value in the error detail", async () => {
    process.env.DAILY_SMS_LIMIT = "3";
    setupSqlMock([], 3);
    const { status, body } = await call();
    expect(status).toBe(429);
    expect(body.detail).toContain("3");
  });

  it("bypasses rate limit for numbers in priority_numbers", async () => {
    setupSqlMock([{ 1: 1 }], 10);
    const { status } = await call();
    expect(status).toBe(200);
  });

  it("skips rate limit check when POSTGRES_URL is not set", async () => {
    const { status } = await call({}, { POSTGRES_URL: undefined });
    expect(status).toBe(200);
    expect(mockNeon).not.toHaveBeenCalled();
  });
});

describe("TextBelt errors", () => {
  it("returns 502 when TextBelt reports success: false", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "out of quota" }),
    });
    const { status, body } = await call();
    expect(status).toBe(502);
    expect(body.error).toBe("textbelt_failed");
    expect(body.detail).toBe("out of quota");
  });

  it("returns 502 when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNRESET"));
    const { status, body } = await call();
    expect(status).toBe(502);
    expect(body.error).toBe("textbelt_failed");
    expect(body.detail).toBe("ECONNRESET");
  });
});

describe("happy paths", () => {
  it("sends test message and returns ok with textId", async () => {
    const { status, body } = await call({ body: { phone: PHONE, message: MSG_TEST } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.textId).toBe("sid_123");
    expect(body.quotaRemaining).toBe(99);
  });

  it("sends awake message and returns ok", async () => {
    const { status, body } = await call({ body: { phone: PHONE, message: MSG_AWAKE } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("posts to textbelt with correct payload", async () => {
    await call({ body: { phone: PHONE, message: MSG_TEST } });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://textbelt.com/text");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(init.body as string) as Record<string, string>;
    expect(sent.phone).toBe(PHONE);
    expect(sent.message).toBe(MSG_TEST);
    expect(sent.key).toBe("tb_key_test");
  });
});
