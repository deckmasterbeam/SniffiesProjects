// Applies schema.sql against POSTGRES_URL. All statements are
// `CREATE TABLE IF NOT EXISTS`, so this is safe to run on every deploy.
// Runs automatically as the Vercel build step (see package.json's "build").

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  console.error("[migrate] POSTGRES_URL not set");
  process.exit(1);
}

const sql = neon(postgresUrl);
const statements = readFileSync(new URL("../schema.sql", import.meta.url), "utf8")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`[migrate] applied ${statements.length} statements from schema.sql`);
