import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/report.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const SECRET = "client-secret";
const REPORTED_USER_ID = "abc123def456abc123def456";
const REPORTER_USER_ID = "111111111111111111111111";

const ENV: Record<string, string> = {
  CLIENT_SECRET: SECRET,
  POSTGRES_URL: "postgres://localhost/test",
  REPORTING_ENABLED: "true",
};

const savedEnv: Record<string, string | undefined> = {};

function setupSql(blockedRows: unknown[] = [], insertRows: unknown[] = []) {
  const sqlFn = vi.fn().mockResolvedValueOnce(blockedRows).mockResolvedValue(insertRows);
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
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

async function callPost(body: unknown = {}, headers: Record<string, string | undefined> = {}) {
  const req = makeReq({
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, ...headers },
    body,
  });
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

describe("feature gate", () => {
  it("returns 404 when REPORTING_ENABLED is not set", async () => {
    delete process.env.REPORTING_ENABLED;
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("returns 404 for a disallowed method while disabled, not 405", async () => {
    delete process.env.REPORTING_ENABLED;
    const req = makeReq({ method: "GET", headers: { authorization: `Bearer ${SECRET}` } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);
    expect(res._status).toBe(404);
  });
});

describe("method not allowed", () => {
  it("returns 405 for GET", async () => {
    const req = makeReq({ method: "GET", headers: { authorization: `Bearer ${SECRET}` } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);
    expect(res._status).toBe(405);
    expect(res._body.error).toBe("method_not_allowed");
  });
});

describe("misconfiguration", () => {
  it("returns 500 when CLIENT_SECRET is missing", async () => {
    delete process.env.CLIENT_SECRET;
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(500);
    expect(body.detail).toContain("CLIENT_SECRET");
  });
});

describe("authorization", () => {
  it("returns 401 for wrong secret", async () => {
    const { status, body } = await callPost(
      {
        reportType: "bot_suspected",
        reportedUserId: REPORTED_USER_ID,
        reporterUserId: REPORTER_USER_ID,
      },
      { authorization: "Bearer wrong" },
    );
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });
});

describe("validation", () => {
  it("returns 400 for an unrecognized reportType", async () => {
    const { status, body } = await callPost({
      reportType: "something_else",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_report_type");
  });

  it("returns 400 when reportedUserId is missing", async () => {
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(400);
    expect(body.error).toBe("reportedUserId_and_reporterUserId_required");
  });

  it("returns 400 when reporterUserId is missing", async () => {
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
    });
    expect(status).toBe(400);
    expect(body.error).toBe("reportedUserId_and_reporterUserId_required");
  });

  it("returns 400 when reportedUserId is not a 24-char hex id", async () => {
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: "not-a-valid-id",
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_user_id");
  });

  it("returns 400 when reporterUserId is not a 24-char hex id", async () => {
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: "x,y",
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_user_id");
  });
});

describe("blocked reporter", () => {
  it("returns ok:true and does not insert when reporterUserId is blocked", async () => {
    const sqlFn = setupSql([{ sniffies_user_id: REPORTER_USER_ID }]);
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
      message: "should be ignored",
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sqlFn).toHaveBeenCalledOnce();
  });
});

describe("happy path", () => {
  it("upserts a pending report for an unblocked reporter", async () => {
    const sqlFn = setupSql([]);
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
      message: "seems fake",
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sqlFn).toHaveBeenCalledTimes(2);
  });

  it("trims and caps an overlong message", async () => {
    const sqlFn = setupSql([]);
    const longMessage = "x".repeat(600);
    const { status } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
      message: longMessage,
    });
    expect(status).toBe(200);
    const insertCall = sqlFn.mock.calls[1];
    const messageJsonArg = (insertCall as unknown[]).find(
      (arg): arg is string => typeof arg === "string" && arg.startsWith("["),
    );
    expect(messageJsonArg).toBeDefined();
    const parsed = JSON.parse(messageJsonArg as string) as { message: string }[];
    expect(parsed[0].message.length).toBe(500);
  });

  it("succeeds without an optional message", async () => {
    setupSql([]);
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

describe("database error", () => {
  it("returns 500 when the blocked_reporters lookup fails", async () => {
    const sqlFn = vi.fn().mockRejectedValue(new Error("query failed"));
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(500);
    expect(body.error).toBe("db_error");
  });

  it("returns 500 when the upsert fails", async () => {
    const sqlFn = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("insert failed"));
    mockNeon.mockReturnValue(sqlFn as unknown as ReturnType<typeof neon>);
    const { status, body } = await callPost({
      reportType: "bot_suspected",
      reportedUserId: REPORTED_USER_ID,
      reporterUserId: REPORTER_USER_ID,
    });
    expect(status).toBe(500);
    expect(body.error).toBe("db_error");
  });
});
