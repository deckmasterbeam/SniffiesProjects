import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb } from "./_shared.js";

interface SendGuidBody {
  phone?: unknown;
}

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

  const body = (req.body ?? {}) as SendGuidBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    json(res, 400, { error: "invalid_phone" });
    return;
  }

  const textbeltKey = process.env.TEXTBELT_KEY;
  if (!textbeltKey) {
    json(res, 500, { error: "server_misconfigured", detail: "TEXTBELT_KEY not set" });
    return;
  }

  const sql = requireDb(res);
  if (!sql) {
    return;
  }

  try {
    const rows = await sql`SELECT guid FROM phone_registrations WHERE phone = ${phone}`;
    if (rows.length === 0) {
      json(res, 404, { error: "phone_not_registered" });
      return;
    }
    const guid = (rows[0] as { guid: string }).guid;
    const message = `Your Sniffies code: ${guid}`;
    const tbRes = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, key: textbeltKey }),
    });
    const tbJson = (await tbRes.json()) as { success: boolean; error?: string };
    if (!tbJson.success) {
      json(res, 502, { error: "textbelt_failed", detail: tbJson.error });
      return;
    }
    json(res, 200, { ok: true });
  } catch (err) {
    console.error("[send-guid] error", err);
    json(res, 500, { error: "internal_error" });
  }
};

export default handler;
