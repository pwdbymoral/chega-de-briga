import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { pool } from "./db.js";

const files = (await readdir(new URL("../migrations/", import.meta.url)))
  .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
  .sort();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(615721044)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = await client.query<{ version: string; checksum: string }>("SELECT version,checksum FROM schema_migrations");
  if (applied.rows.some(({ version }) => !files.includes(version))) throw new Error("An applied migration is missing from the migrations directory");
  const versions = new Map(applied.rows.map(({ version, checksum }) => [version, checksum]));

  for (const file of files) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previousChecksum = versions.get(file);
    if (previousChecksum) {
      if (previousChecksum !== checksum) throw new Error(`Migration changed after being applied: ${file}`);
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)", [file, checksum]);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
