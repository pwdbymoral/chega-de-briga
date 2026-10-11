import { readFile } from "node:fs/promises";
import { pool } from "./db.js";

const sql = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
try {
  await pool.query("SELECT pg_advisory_lock(615721044)");
  await pool.query(sql);
} finally {
  await pool.query("SELECT pg_advisory_unlock(615721044)").catch(() => undefined);
  await pool.end();
}
