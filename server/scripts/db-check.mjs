// Prints every table in the public schema with its row count and a
// few sample rows, against whatever POSTGRES_URL is currently configured.
// Usage: yarn db:check   (reads server/.env via --env-file)

import { neon } from "@neondatabase/serverless";

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  console.error("POSTGRES_URL not set");
  process.exit(1);
}

const sql = neon(postgresUrl);

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

for (const { table_name: table } of tables) {
  const [{ count }] = await sql.query(`SELECT COUNT(*) FROM ${table}`);
  console.log(`\n=== ${table} (${count} rows) ===`);
  const rows = await sql.query(`SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 5`);
  console.log(rows);
}
