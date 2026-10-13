import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("migration and public acquisition API with an isolated PostgreSQL schema", { skip: !databaseUrl, timeout: 30000 }, async () => {
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Use a disposable local database.");
  const schema = `seo_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  const database = new pg.Pool({ connectionString: url.href });
  let server;
  try {
    await database.query("CREATE TABLE schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())");
    for (const file of ["001_initial.sql", "002_admin_login_challenges.sql", "003_waitlist_landing_first_value.sql"]) {
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
      await database.query(sql);
      await database.query("INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)", [file, createHash("sha256").update(sql).digest("hex")]);
    }
    await database.query("INSERT INTO public_landing_events(id,event_type) VALUES('legacy','landing_view')");
    const env = { ...process.env, DATABASE_URL: url.href, NODE_ENV: "test", APP_STAGE: "preview", PUBLIC_SIGNUP_ENABLED: "false", HOST: "127.0.0.1", PORT: "0", APP_ORIGIN: "http://localhost", PUBLIC_LANDING_ORIGINS: "http://localhost", WEB_DIST: "/tmp/cdb-no-web-fixture", ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"), BOOTSTRAP_ADMIN_EMAIL: "", SMTP_USER: "", SMTP_APP_PASSWORD: "", VAPID_PRIVATE_KEY: "", VAPID_PUBLIC_KEY: "" };
    await promisify(execFile)(process.execPath, ["dist/migrate.js"], { env });
    await promisify(execFile)(process.execPath, ["dist/migrate.js"], { env });
    const legacy = await database.query("SELECT acquisition_source,page_key FROM public_landing_events WHERE id='legacy'");
    assert.deepEqual(legacy.rows[0], { acquisition_source: "unknown", page_key: "landing" });

    server = spawn(process.execPath, ["dist/server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`API startup timed out: ${logs}`)), 10000);
      server.on("error", (error) => { clearTimeout(timer); reject(error); });
      server.on("exit", () => { clearTimeout(timer); reject(new Error(`API exited: ${logs}`)); });
      server.stderr.on("data", (data) => { logs += data; });
      server.stdout.on("data", (data) => {
        logs += data;
        const address = logs.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
        if (address) { clearTimeout(timer); resolve(address); }
      });
    });
    const post = (path, body) => fetch(`${endpoint}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body) });
    assert.equal((await post("/api/public/landing-events", { event: "view" })).status, 202);
    assert.equal((await post("/api/public/landing-events", { event: "view", page: "tasks_guide", source: "chatgpt" })).status, 202);
    assert.equal((await post("/api/public/landing-events", { event: "view", source: "chatgpt" })).status, 202);
    assert.equal((await post("/api/public/landing-events", { event: "form_start", source: "chatgpt", channel: "email" })).status, 202);
    assert.equal((await post("/api/public/landing-events", { event: "form_start", page: "tasks_guide" })).status, 422);
    assert.equal((await post("/api/public/landing-events", { event: "view", source: "private-url" })).status, 422);
    const lead = { channel: "email", contact: "ana@example.test", consent: true, consentVersion: "lista-espera-2026-10", source: "chatgpt" };
    assert.equal((await post("/api/waitlist", { ...lead, consent: false })).status, 422);
    assert.equal((await post("/api/waitlist", lead)).status, 202);
    assert.equal((await post("/api/waitlist", lead)).status, 202);
    assert.equal((await post("/api/waitlist", { ...lead, source: "private-url" })).status, 422);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM waitlist_contacts")).rows[0].count, 1);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM public_landing_events WHERE event_type='waitlist_signup'")).rows[0].count, 1);
    assert.equal((await database.query("SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name='waitlist_contacts' AND column_name='acquisition_source'", [schema])).rowCount, 0);

    assert.equal((await fetch(`${endpoint}/api/admin/waitlist/analytics`)).status, 401);
    const session = randomUUID();
    await database.query("INSERT INTO accounts(id,email,password_hash) VALUES('admin-account','admin@example.test','unused-test-hash')");
    await database.query("INSERT INTO platform_admins(id,account_id,totp_secret) VALUES('admin','admin-account','unused-test-secret')");
    await database.query("INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,'admin',now()+interval '1 hour')", [createHash("sha256").update(session).digest("hex")]);
    const analyticsResponse = await fetch(`${endpoint}/api/admin/waitlist/analytics?period=7`, { headers: { Cookie: `cdb_admin=${session}` } });
    assert.equal(analyticsResponse.status, 200);
    const analytics = await analyticsResponse.json();
    assert.equal(analytics.pageLoads, 3);
    assert.equal(analytics.signups, 1);
    assert.equal(analytics.conversion, 1 / 3);
    assert.deepEqual(analytics.byGuide, [{ page: "tasks_guide", views: 1 }]);
    assert.deepEqual(analytics.bySource.find((row) => row.source === "chatgpt"), { source: "chatgpt", pageLoads: 1, guideViews: 1, formStarts: 1, signups: 1, conversion: 1 });
    assert.equal(analytics.bySource.find((row) => row.source === "unknown").pageLoads, 2);
  } finally {
    if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
    await database.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
