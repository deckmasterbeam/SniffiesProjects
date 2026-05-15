import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

interface NotifyBody {
  phone?: unknown;
  message?: unknown;
}

const json = (
  res: VercelResponse,
  status: number,
  body: Record<string, unknown>,
): void => {
  res.status(status).json(body);
};

const isAllowedOrigin = (origin: string | undefined): boolean => {
  const allow = process.env.ALLOWED_ORIGINS?.trim();
  if (!allow) {
    return true; // dev: allow all
  }
  if (!origin) {
    return false;
  }
  return allow
    .split(",")
    .map((s) => s.trim())
    .includes(origin);
};

const applyCors = (req: VercelRequest, res: VercelResponse): void => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
};

const REQUIRED_ENV = ["SHARED_SECRET", "TEXTBELT_KEY", "POSTGRES_URL", "DAILY_SMS_LIMIT"] as const;

const handler = async (
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("[notify] missing env vars:", missing.join(", "));
  }

  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  const sharedSecret = process.env.SHARED_SECRET;
  if (!sharedSecret) {
    json(res, 500, { error: "server_misconfigured", detail: "SHARED_SECRET not set" });
    return;
  }

  const auth = req.headers.authorization;
  const expected = `Bearer ${sharedSecret}`;
  if (auth !== expected) {
    json(res, 401, { error: "unauthorized" });
    return;
  }

  const body = (req.body ?? {}) as NotifyBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    json(res, 400, { error: "invalid_phone", detail: "Use E.164, e.g. +15551234567" });
    return;
  }
  const isValidMessage =
    message === "Sniffies extension: test message" ||
    /^Sniffies: favorited cruiser [0-9a-f]{24} is online\.$/.test(message);
  if (!isValidMessage) {
    json(res, 400, { error: "invalid_message" });
    return;
  }

  const textbeltKey = process.env.TEXTBELT_KEY;
  if (!textbeltKey) {
    json(res, 500, { error: "server_misconfigured", detail: "TEXTBELT_KEY not set" });
    return;
  }

  const postgresUrl = process.env.POSTGRES_URL;
  if (postgresUrl) {
    const sql = neon(postgresUrl);
    try {
      const [priorityRow, countRow] = await Promise.all([
        sql`SELECT 1 FROM priority_numbers WHERE phone = ${phone} LIMIT 1`,
        sql`SELECT COUNT(*)::int AS count FROM notify_log WHERE phone = ${phone} AND sent_at >= NOW() - INTERVAL '24 hours'`,
      ]);
      const dailyLimit = parseInt(process.env.DAILY_SMS_LIMIT ?? "10", 10);
      const isPriority = priorityRow.length > 0;
      const count = (countRow[0] as { count: number }).count;
      if (!isPriority && count >= dailyLimit) {
        console.warn("[notify] daily limit reached for phone", phone, "count:", count, "limit:", dailyLimit);
        json(res, 429, { error: "daily_limit_reached", detail: "This number has been notified 10 times in the last 24 hours." });
        return;
      }
    } catch (err) {
      console.error("[notify] rate limit check failed", err);
    }
  }

  try {
    const tbRes = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message: message.slice(0, 1500), key: textbeltKey }),
    });
    const tbJson = (await tbRes.json()) as { success: boolean; textId?: string; error?: string; quotaRemaining?: number };
    if (!tbJson.success) {
      console.error("[notify] textbelt error", tbJson.error);
      json(res, 502, { error: "textbelt_failed", detail: tbJson.error });
      return;
    }
    if (postgresUrl) {
      const sql = neon(postgresUrl);
      try {
        await sql`INSERT INTO notify_log (phone, message) VALUES (${phone}, ${message.slice(0, 1500)})`;
      } catch (err) {
        console.error("[notify] db log failed", err);
      }
    }
    json(res, 200, { ok: true, textId: tbJson.textId, quotaRemaining: tbJson.quotaRemaining });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[notify] textbelt error", detail);
    json(res, 502, { error: "textbelt_failed", detail });
  }
};

export default handler;
