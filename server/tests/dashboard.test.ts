import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelResponse } from "@vercel/node";
import handler from "../api/dashboard.js";
import { makeReq, makeRes } from "./_helpers.js";

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
import { neon } from "@neondatabase/serverless";
const mockNeon = vi.mocked(neon);

const totals = {
  inits: 50,
  users: 10,
  new_1d: 1,
  new_7d: 3,
  new_30d: 8,
  dau: 2,
  wau: 5,
  mau: 8,
  prev_wau: 4,
  retained: 2,
};
const other = {
  phones: 1,
  favoriters: 1,
  favorites: 2,
  pending_reports: 0,
  validated_reports: 0,
  sms_7d: 0,
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ["DASHBOARD_ENABLED", "POSTGRES_URL"]) savedEnv[k] = process.env[k];
  process.env.DASHBOARD_ENABLED = "true";
  process.env.POSTGRES_URL = "postgres://localhost/test";
  const sqlFn = vi
    .fn()
    .mockResolvedValueOnce([totals])
    .mockResolvedValueOnce([{ label: "userscript", users: 4, wau: 2 }])
    .mockResolvedValueOnce([{ label: "<script>alert(1)</script>", users: 1, wau: 1 }])
    .mockResolvedValueOnce([{ day: "2026-10-23", active: 2, new_users: 1 }])
    .mockResolvedValueOnce([other]);
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

async function call(reqOpts: Parameters<typeof makeReq>[0] = {}) {
  const res = makeRes();
  await handler(makeReq({ method: "GET", ...reqOpts }), res as unknown as VercelResponse);
  return res;
}

describe("dashboard", () => {
  it("returns 405 for POST", async () => {
    expect((await call({ method: "POST" }))._status).toBe(405);
  });

  it("returns 404 when DASHBOARD_ENABLED is not true", async () => {
    delete process.env.DASHBOARD_ENABLED;
    expect((await call())._status).toBe(404);
    process.env.DASHBOARD_ENABLED = "1";
    expect((await call())._status).toBe(404);
  });

  it("renders metrics and escapes user-supplied labels", async () => {
    const res = await call();
    expect(res._status).toBe(200);
    expect(res._text).toContain("Total unique users");
    expect(res._text).toContain("25.0%"); // DAU/MAU 2/8
    expect(res._text).not.toContain("<script>alert(1)");
  });

  it("returns 500 on db failure", async () => {
    mockNeon.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("x")) as unknown as ReturnType<typeof neon>,
    );
    expect((await call())._body.error).toBe("db_error");
  });
});
