import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb } from "./_shared.js";

interface FavoriteRow {
  user_id: string;
  profile_pic_url: string | null;
  favorited_at: string;
}

interface FavoritesPostBody {
  guid?: unknown;
  userId?: unknown;
  profilePicUrl?: unknown;
  favorite?: unknown;
}

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res, "GET, POST, OPTIONS", true);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!requireClientAuth(req, res)) {
    return;
  }

  const sql = requireDb(res);
  if (!sql) {
    return;
  }

  if (req.method === "GET") {
    const guid = typeof req.query.guid === "string" ? req.query.guid.trim() : "";
    if (!guid) {
      json(res, 400, { error: "guid_required" });
      return;
    }
    try {
      const rows = (await sql`
        SELECT user_id, profile_pic_url, favorited_at
        FROM favorites
        WHERE guid = ${guid}
        ORDER BY favorited_at DESC
      `) as FavoriteRow[];
      json(res, 200, { ok: true, favorites: rows });
    } catch (err) {
      console.error("[favorites] db error", err);
      json(res, 500, { error: "db_error" });
    }
    return;
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as FavoritesPostBody;
    const guid = typeof body.guid === "string" ? body.guid.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const profilePicUrl = typeof body.profilePicUrl === "string" ? body.profilePicUrl : null;
    const favorite = body.favorite === true || body.favorite === "true";

    if (!guid || !userId) {
      json(res, 400, { error: "guid_and_userId_required" });
      return;
    }

    try {
      if (favorite) {
        await sql`
          INSERT INTO favorites (guid, user_id, profile_pic_url)
          VALUES (${guid}, ${userId}, ${profilePicUrl})
          ON CONFLICT (guid, user_id)
          DO UPDATE SET profile_pic_url = EXCLUDED.profile_pic_url, favorited_at = NOW()
        `;
      } else {
        await sql`DELETE FROM favorites WHERE guid = ${guid} AND user_id = ${userId}`;
      }
      json(res, 200, { ok: true });
    } catch (err) {
      console.error("[favorites] db error", err);
      json(res, 500, { error: "db_error" });
    }
    return;
  }

  json(res, 405, { error: "method_not_allowed" });
};

export default handler;
