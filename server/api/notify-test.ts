import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb } from "./_shared.js";

interface NotifyTestBody {
  phone?: unknown;
}

const TEST_MESSAGE = "Sniffies extension: test message";

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res, "POST, OPTIONS", true);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!requireClientAuth(req, res)) {
    return;
  }

  const textbeltKey = process.env.TEXTBELT_KEY;
  if (!textbeltKey) {
    json(res, 500, { error: "server_misconfigured", detail: "TEXTBELT_KEY not set" });
    return;
  }

  const body = (req.body ?? {}) as NotifyTestBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    json(res, 400, { error: "invalid_phone", detail: "Use E.164, e.g. +15551234567" });
    return;
  }

  const sql = requireDb(res);
  if (!sql) {
    return;
  }

  try {
    await sql`
      INSERT INTO phone_registrations (phone)
      VALUES (${phone})
      ON CONFLICT (phone) DO NOTHING
    `;
  } catch (err) {
    console.error("[notify-test] db upsert error", err);
    json(res, 500, { error: "db_error" });
    return;
  }

  let tbJson: { success: boolean; textId?: string; error?: string; quotaRemaining?: number };
  try {
    const tbRes = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message: TEST_MESSAGE, key: textbeltKey }),
    });
    tbJson = (await tbRes.json()) as typeof tbJson;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[notify-test] textbelt error", detail);
    json(res, 502, { error: "textbelt_failed", detail });
    return;
  }

  if (!tbJson.success) {
    console.error("[notify-test] textbelt error", tbJson.error);
    json(res, 502, { error: "textbelt_failed", detail: tbJson.error });
    return;
  }

  try {
    await sql`UPDATE phone_registrations SET tested = TRUE, updated_at = NOW() WHERE phone = ${phone}`;
  } catch (err) {
    console.error("[notify-test] db update tested error", err);
  }

  json(res, 200, { ok: true, textId: tbJson.textId, quotaRemaining: tbJson.quotaRemaining });
};

export default handler;
