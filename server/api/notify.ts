import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireWatcherAuth, requireDb } from "./_shared.js";

interface NotifyBody {
  userId?: unknown;
}

const DAILY_LIMIT_DEFAULT = 10;

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!requireWatcherAuth(req, res)) return;

  const body = (req.body ?? {}) as NotifyBody;
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    json(res, 400, { error: "userId_required" });
    return;
  }

  const textbeltKey = process.env.TEXTBELT_KEY;
  if (!textbeltKey) {
    json(res, 500, { error: "server_misconfigured", detail: "TEXTBELT_KEY not set" });
    return;
  }

  const sql = requireDb(res);
  if (!sql) return;

  const dailyLimit = parseInt(process.env.DAILY_SMS_LIMIT ?? String(DAILY_LIMIT_DEFAULT), 10);
  const message = `Sniffies: a favorited cruiser is online.`;

  try {
    const subscriberRows = await sql`
      SELECT pr.phone
      FROM favorites f
      JOIN phone_registrations pr ON pr.guid = f.guid
      WHERE f.user_id = ${userId}
    `;
    const phones = (subscriberRows as { phone: string }[]).map((r) => r.phone);

    if (phones.length === 0) {
      json(res, 200, { ok: true, sent: 0, detail: "no_subscribers" });
      return;
    }

    let sent = 0;
    const errors: string[] = [];

    for (const phone of phones) {
      try {
        const [priorityRow, countRow] = await Promise.all([
          sql`SELECT 1 FROM priority_numbers WHERE phone = ${phone} LIMIT 1`,
          sql`SELECT COUNT(*)::int AS count FROM notify_log WHERE phone = ${phone} AND sent_at >= NOW() - INTERVAL '24 hours'`,
        ]);
        const isPriority = priorityRow.length > 0;
        const count = (countRow[0] as { count: number }).count;
        if (!isPriority && count >= dailyLimit) {
          errors.push(`${phone}: daily_limit`);
          continue;
        }
      } catch (err) {
        console.error("[notify] rate-limit check failed for", phone, err);
      }

      try {
        const tbRes = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message, key: textbeltKey }),
        });
        const tbJson = (await tbRes.json()) as { success: boolean; error?: string };
        if (!tbJson.success) {
          errors.push(`${phone}: ${tbJson.error}`);
          continue;
        }
        await sql`INSERT INTO notify_log (phone, message) VALUES (${phone}, ${message})`.catch(
          (e) => console.error("[notify] log failed", e),
        );
        sent++;
      } catch (err) {
        errors.push(`${phone}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    json(res, 200, {
      ok: true,
      sent,
      total: phones.length,
      ...(errors.length ? { errors } : {}),
    });
  } catch (err) {
    console.error("[notify] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
