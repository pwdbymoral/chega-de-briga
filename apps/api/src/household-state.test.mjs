import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
const tokenHash = (value) => createHash("sha256").update(value).digest("hex");

test("task completion/skip persists and is readable as history", { skip: !databaseUrl, timeout: 30000 }, async () => {
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Use a disposable local database.");
  const schema = `household_state_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  const database = new pg.Pool({ connectionString: url.href });
  let server;
  try {
    const env = { ...process.env, DATABASE_URL: url.href, NODE_ENV: "test", APP_STAGE: "preview", PUBLIC_SIGNUP_ENABLED: "false", HOST: "127.0.0.1", PORT: "0", APP_ORIGIN: "http://localhost", PUBLIC_LANDING_ORIGINS: "http://localhost", WEB_DIST: "/tmp/cdb-no-web-fixture", ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"), BOOTSTRAP_ADMIN_EMAIL: "", SMTP_USER: "", SMTP_APP_PASSWORD: "", VAPID_PRIVATE_KEY: "", VAPID_PUBLIC_KEY: "" };
    await promisify(execFile)(process.execPath, ["dist/migrate.js"], { env });

    const accountId = "account-1";
    const userId = "user-1";
    await database.query("INSERT INTO accounts(id,email,password_hash,email_verified_at) VALUES($1,'ana@example.test','unused-test-hash',now())", [accountId]);
    await database.query("INSERT INTO access_grants(id,email,source) VALUES('grant-1','ana@example.test','lista')");
    await database.query("INSERT INTO users(id,account_id,name,source,access_id) VALUES($1,$2,'Ana','lista','grant-1')", [userId, accountId]);
    await database.query("INSERT INTO households(id,name,timezone,created_by_user_id) VALUES('house-1','Casa','America/Fortaleza',$1)", [userId]);
    await database.query("INSERT INTO memberships(user_id,household_id,role) VALUES($1,'house-1','responsavel')", [userId]);
    await database.query("INSERT INTO household_state(household_id,version,data) VALUES('house-1',1,'{\"members\":[],\"tasks\":[],\"items\":[],\"invites\":[]}'::jsonb)");
    const sessionToken = randomUUID();
    await database.query("INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [tokenHash(sessionToken), userId]);

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

    const task = {
      id: "task-1", title: "Lavar a louça", dueDate: "2026-10-19", repeat: "once", weeklyDays: [], anchorDay: 1,
      ownerMode: "fixed", assigneeId: userId, rotation: [], rotationIndex: 0, completionScope: "", activeTime: "",
      paused: false, ended: false, completed: true, skipped: false, nextStartDate: "2026-10-19",
    };
    const put = (body) => fetch(`${endpoint}/api/households/house-1/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost", Cookie: `cdb_resident=${sessionToken}` },
      body: JSON.stringify(body),
    });

    const completedResponse = await put({
      version: 1,
      data: { tasks: [task], items: [] },
      events: [{ id: "event-concluida", type: "tarefa_concluida", taskId: "task-1", occurrenceDate: "2026-10-19" }],
    });
    assert.equal(completedResponse.status, 200, await completedResponse.text());

    const concluded = await database.query("SELECT outcome,completed_by_user_id,assigned_user_id FROM task_occurrences WHERE task_id='task-1'");
    assert.equal(concluded.rowCount, 1);
    assert.equal(concluded.rows[0].outcome, "concluida");
    assert.equal(concluded.rows[0].completed_by_user_id, userId);
    assert.equal(concluded.rows[0].assigned_user_id, userId);

    const skippedTask = { ...task, id: "task-2", completed: false, skipped: true };
    const skippedResponse = await put({
      version: 2,
      data: { tasks: [task, skippedTask], items: [] },
      events: [{ id: "event-pulada", type: "tarefa_pulada", taskId: "task-2", occurrenceDate: "2026-10-19" }],
    });
    assert.equal(skippedResponse.status, 200, await skippedResponse.text());

    const skipped = await database.query("SELECT outcome,completed_by_user_id FROM task_occurrences WHERE task_id='task-2'");
    assert.equal(skipped.rowCount, 1);
    assert.equal(skipped.rows[0].outcome, "pulada");
    assert.equal(skipped.rows[0].completed_by_user_id, userId);

    const historyResponse = await fetch(`${endpoint}/api/households/house-1/tasks/task-1/history`, {
      headers: { Cookie: `cdb_resident=${sessionToken}` },
    });
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json();
    assert.equal(history.entries.length, 1);
    assert.equal(history.entries[0].kind, "occurrence");
    assert.equal(history.entries[0].outcome, "concluida");
    assert.equal(history.entries[0].completedByUserId, userId);
    assert.deepEqual(history.members, [{ id: userId, name: "Ana" }]);
    assert.ok(!JSON.stringify(history).match(/\d+\s*tarefas/), "history response must not contain aggregate per-person counts");

    const reviewResponse = await fetch(`${endpoint}/api/households/house-1/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost", Cookie: `cdb_resident=${sessionToken}` },
      body: JSON.stringify({ feltHeavy: "pouco", feltNoticed: "sim" }),
    });
    assert.equal(reviewResponse.status, 204);
    const membershipAfterReview = await database.query("SELECT last_reviewed_at FROM memberships WHERE user_id=$1 AND household_id='house-1'", [userId]);
    assert.ok(membershipAfterReview.rows[0].last_reviewed_at, "last_reviewed_at should be set after a review");

    const myReviewsResponse = await fetch(`${endpoint}/api/households/house-1/reviews/mine`, { headers: { Cookie: `cdb_resident=${sessionToken}` } });
    assert.equal(myReviewsResponse.status, 200);
    const myReviews = await myReviewsResponse.json();
    assert.equal(myReviews.length, 1);
    assert.deepEqual({ feltHeavy: myReviews[0].feltHeavy, feltNoticed: myReviews[0].feltNoticed }, { feltHeavy: "pouco", feltNoticed: "sim" });

    const invalidReview = await fetch(`${endpoint}/api/households/house-1/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost", Cookie: `cdb_resident=${sessionToken}` },
      body: JSON.stringify({ feltHeavy: "muito", feltNoticed: "sim" }),
    });
    assert.equal(invalidReview.status, 422);

    const renegotiatedTask = { ...task, dueDate: "2026-10-26", nextStartDate: "2026-10-26" };
    const renegotiateResponse = await put({
      version: 3,
      data: { tasks: [renegotiatedTask, skippedTask], items: [] },
      events: [{ id: "event-renegociada", type: "tarefa_renegociada", taskId: "task-1", occurrenceDate: "2026-10-26", scope: "series", note: "trocamos o dia" }],
    });
    assert.equal(renegotiateResponse.status, 200, await renegotiateResponse.text());
    const renegotiated = await database.query("SELECT scope,changed_by,snapshot->>'renegotiationNote' AS note FROM task_versions WHERE task_id='task-1' AND event_id='event-renegociada'");
    assert.equal(renegotiated.rowCount, 1);
    assert.equal(renegotiated.rows[0].scope, "series");
    assert.equal(renegotiated.rows[0].changed_by, userId);
    assert.equal(renegotiated.rows[0].note, "trocamos o dia");

    const historyAfterRenegotiation = await (await fetch(`${endpoint}/api/households/house-1/tasks/task-1/history`, { headers: { Cookie: `cdb_resident=${sessionToken}` } })).json();
    const renegotiationEntry = historyAfterRenegotiation.entries.find((entry) => entry.eventType === "tarefa_renegociada");
    assert.ok(renegotiationEntry, "history should include the renegotiation entry");
    assert.equal(renegotiationEntry.note, "trocamos o dia");
  } finally {
    if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
    await database.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
