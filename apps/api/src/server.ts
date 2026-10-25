import { existsSync } from "node:fs";
import path from "node:path";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import webPush from "web-push";
import { calculateAnalytics, isAcquisitionSource, isTaskEventType, type AnalyticsDataSet, type AnalyticsFilter } from "@chega-de-briga/domain";
import { pool, id } from "./db.js";
import { sendMail } from "./mail.js";
import {
  ADMIN_LOGIN_CHALLENGE_TTL_SECONDS,
  createTotpSecret,
  decryptSecret,
  encryptSecret,
  hashPassword,
  normalizeEmail,
  recoveryCodes,
  token,
  tokenHash,
  totpUri,
  verifyPassword,
  verifyTotp,
} from "./security.js";
import { campaignTag, normalizeWaitlistContact, waitlistConsentVersion } from "./waitlist.js";
import { allowedLandingApiMethod } from "./public-origin.js";
import { parseLandingEvent, readAcquisitionAnalytics } from "./landing-metrics.js";

type UserRow = { id: string; name: string; email: string };
type AdminRow = { id: string; email: string };
type Body = Record<string, unknown>;

const appOrigin = new URL(process.env.APP_ORIGIN ?? "http://localhost:5173").origin;
const appOrigins = new Set([appOrigin, ...(process.env.APP_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean)]);
const publicLandingOrigins = new Set((process.env.PUBLIC_LANDING_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const appStage = process.env.APP_STAGE ?? "production";
const publicSignupEnabled = process.env.PUBLIC_SIGNUP_ENABLED === "true";
if (!["production", "preview"].includes(appStage)) throw new Error("APP_STAGE must be production or preview");
if (process.env.NODE_ENV === "production") {
  const required = ["APP_ORIGIN", "DATABASE_URL", "ENCRYPTION_KEY", ...(appStage === "production" ? ["SMTP_USER", "SMTP_APP_PASSWORD", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] : [])];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  if (!appOrigin.startsWith("https://")) throw new Error("APP_ORIGIN must use HTTPS in production");
  if (Buffer.from(process.env.ENCRYPTION_KEY!, "base64").length !== 32) throw new Error("ENCRYPTION_KEY must be a 32-byte base64 value");
}
const secureCookie = appOrigin.startsWith("https://");
const webRoot = path.resolve(process.env.WEB_DIST ?? "apps/web/dist");
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
if (vapidPublicKey && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:forjacorp@gmail.com", vapidPublicKey, process.env.VAPID_PRIVATE_KEY);
}
const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 1_048_576,
  genReqId: () => id("req"),
});

declare module "fastify" {
  interface FastifyRequest {
    resident: UserRow | null;
    admin: AdminRow | null;
  }
}

app.decorateRequest("resident", null);
app.decorateRequest("admin", null);
await app.register(cookie);
await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

app.addHook("onRequest", async (request, reply) => {
  if (!request.url.startsWith("/api/")) return;
  reply.header("Cache-Control", "no-store, private");
  const origin = request.headers.origin;
  const landingMethod = allowedLandingApiMethod(
    origin,
    request.method,
    request.url,
    request.headers["access-control-request-method"],
    publicLandingOrigins,
  );
  if (landingMethod) {
    reply.header("Access-Control-Allow-Origin", origin!);
    reply.header("Vary", "Origin");
    if (request.method === "OPTIONS") {
      reply.header("Access-Control-Allow-Methods", landingMethod);
      reply.header("Access-Control-Allow-Headers", "content-type");
      return reply.code(204).send();
    }
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    if (!origin || (!appOrigins.has(origin) && !landingMethod)) {
      return reply.code(403).send({ code: "origin", message: "Origem inválida.", request_id: request.id });
    }
  }
});

app.setErrorHandler((error, request, reply) => {
  const status = Number((error as { statusCode?: number }).statusCode ?? 500);
  const code = (error as { appCode?: string }).appCode ?? (status >= 500 ? "internal" : status === 429 ? "rate_limited" : status === 409 ? "invalid_state" : "validation");
  if (status >= 500) request.log.error({ err: error }, "request failed");
  reply.code(status).send({
    code,
    message: status >= 500 ? "Não foi possível concluir a solicitação." : error instanceof Error ? error.message : "Solicitação inválida.",
    request_id: request.id,
  });
});

const bad = (reply: FastifyReply, status: number, code: string, message: string) =>
  reply.code(status).send({ code, message, request_id: reply.request.id });
const bodyOf = (request: FastifyRequest) => (request.body && typeof request.body === "object" ? request.body as Body : {});
const text = (body: Body, key: string) => typeof body[key] === "string" ? body[key] as string : "";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function taskInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const task = value as Body;
  const string = (key: string, max: number, optional = false) => task[key] === undefined && optional || typeof task[key] === "string" && (task[key] as string).length <= max;
  const date = (key: string) => task[key] === undefined || typeof task[key] === "string" && datePattern.test(task[key] as string);
  if (!string("title", 160) || !(task.title as string).trim() || !string("completionScope", 500) || !string("activeTime", 30) || !string("assigneeId", 100, true) || !date("dueDate")) return null;
  if (!["once", "daily", "weekly", "fortnightly", "monthly"].includes(String(task.repeat)) || !["fixed", "rotation", "agree"].includes(String(task.ownerMode))) return null;
  if (!Array.isArray(task.weeklyDays) || task.weeklyDays.length > 7 || task.weeklyDays.some((day) => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)) return null;
  if (!Array.isArray(task.rotation) || task.rotation.length > 100 || task.rotation.some((member) => typeof member !== "string" || member.length > 100)) return null;
  if (!Number.isInteger(task.anchorDay) || Number(task.anchorDay) < 1 || Number(task.anchorDay) > 31 || !Number.isInteger(task.rotationIndex) || Number(task.rotationIndex) < 0) return null;
  return { title: (task.title as string).trim(), dueDate: task.dueDate, repeat: task.repeat, weeklyDays: task.weeklyDays, anchorDay: task.anchorDay, ownerMode: task.ownerMode, assigneeId: task.assigneeId, rotation: task.rotation, rotationIndex: task.rotationIndex, completionScope: task.completionScope, activeTime: task.activeTime };
}
function houseState(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as { tasks?: unknown; items?: unknown };
  if (!Array.isArray(data.tasks) || !Array.isArray(data.items) || data.tasks.length > 500 || data.items.length > 500) return null;
  const tasks = [];
  const taskIds = new Set<string>();
  for (const value of data.tasks) {
    if (!value || typeof value !== "object") return null;
    const task = value as Body;
    const input = taskInput(task);
    if (!input || typeof task.id !== "string" || !task.id.trim() || task.id.length > 100 || taskIds.has(task.id) || !datePattern.test(String(task.nextStartDate ?? "2000-01-01")) || ["paused", "ended", "completed", "skipped"].some((key) => typeof task[key] !== "boolean")) return null;
    const seriesBase = task.seriesBase === undefined ? undefined : taskInput(task.seriesBase);
    if (task.seriesBase !== undefined && !seriesBase) return null;
    const occurrenceKey = task.occurrenceKey;
    if (occurrenceKey !== undefined && (typeof occurrenceKey !== "string" || !datePattern.test(occurrenceKey))) return null;
    taskIds.add(task.id as string);
    tasks.push({ id: task.id, ...input, paused: task.paused, ended: task.ended, completed: task.completed, skipped: task.skipped, nextStartDate: task.nextStartDate, occurrenceKey, seriesBase });
  }
  const items = [];
  const itemIds = new Set<string>();
  for (const value of data.items) {
    if (!value || typeof value !== "object") return null;
    const item = value as Body;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 100 || itemIds.has(item.id) || typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 120 || typeof item.quantity !== "string" || item.quantity.length > 50 || !["next", "before"].includes(String(item.priority))) return null;
    itemIds.add(item.id);
    items.push({ id: item.id, name: item.name.trim(), quantity: item.quantity.trim(), priority: item.priority });
  }
  return { tasks, items };
}
const setCookie = (reply: FastifyReply, name: string, value: string, maxAge: number) =>
  reply.setCookie(name, value, { httpOnly: true, secure: secureCookie, sameSite: "lax", path: "/", maxAge });
const clearAdminLoginChallenge = (reply: FastifyReply) =>
  reply.clearCookie("cdb_admin_challenge", { path: "/api/admin/session", secure: secureCookie, sameSite: "lax" });

async function withTransaction<T>(work: (client: import("pg").PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function residentSession(request: FastifyRequest, reply: FastifyReply) {
  const session = request.cookies.cdb_resident;
  if (!session) return bad(reply, 401, "unauthenticated", "Entre novamente.");
  const result = await pool.query<UserRow>(
    `SELECT u.id, u.name, a.email FROM user_sessions s JOIN users u ON u.id = s.user_id
     JOIN accounts a ON a.id=u.account_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'ativo' AND a.email_verified_at IS NOT NULL`,
    [tokenHash(session)],
  );
  if (!result.rowCount) return bad(reply, 401, "unauthenticated", "Entre novamente.");
  request.resident = result.rows[0]!;
}

async function adminSession(request: FastifyRequest, reply: FastifyReply) {
  const session = request.cookies.cdb_admin;
  if (!session) return bad(reply, 401, "unauthenticated", "Entre novamente.");
  const result = await pool.query<AdminRow>(
    `SELECT p.id, a.email FROM admin_sessions s JOIN platform_admins p ON p.id = s.admin_id
     JOIN accounts a ON a.id=p.account_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(session)],
  );
  if (!result.rowCount) return bad(reply, 401, "unauthenticated", "Entre novamente.");
  request.admin = result.rows[0]!;
}

async function sessionPayload(userId: string) {
  const result = await pool.query(
    `SELECT u.id, u.name, a.email, u.source,
      h.id AS household_id, h.name AS household_name, m.role
     FROM users u JOIN accounts a ON a.id=u.account_id
     LEFT JOIN memberships m ON m.user_id = u.id
     LEFT JOIN households h ON h.id = m.household_id
     WHERE u.id = $1 ORDER BY h.created_at`,
    [userId],
  );
  if (!result.rowCount) return null;
  const first = result.rows[0]!;
  return {
    user: { id: first.id as string, name: first.name as string, email: first.email as string },
    memberships: result.rows.filter((row) => row.household_id).map((row) => ({
      householdId: row.household_id as string,
      householdName: row.household_name as string,
      role: row.role as "responsavel" | "morador",
    })),
    canCreateHouse: first.source === "lista" || first.source === "convite_admin" || first.source === "publico",
  };
}

async function startResidentSession(reply: FastifyReply, userId: string) {
  const raw = token();
  await pool.query("INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", [tokenHash(raw), userId]);
  setCookie(reply, "cdb_resident", raw, 30 * 24 * 60 * 60);
  await pool.query("UPDATE users SET last_seen_at=now() WHERE id=$1", [userId]);
  await pool.query("INSERT INTO activity_events(id,event_type,user_id) VALUES($1,'acesso',$2)", [id("event"), userId]);
  return sessionPayload(userId);
}

async function requireHousehold(request: FastifyRequest, reply: FastifyReply, householdId: string) {
  if (!request.resident) return bad(reply, 401, "unauthenticated", "Entre novamente.");
  const membership = await pool.query(
    "SELECT role FROM memberships WHERE user_id=$1 AND household_id=$2",
    [request.resident.id, householdId],
  );
  if (!membership.rowCount) {
    bad(reply, 404, "not_found", "Casa não encontrada.");
    return null;
  }
  return membership.rows[0] as { role: "responsavel" | "morador" };
}

async function removeMemberFromHouseState(client: import("pg").PoolClient, householdId: string, userId: string) {
  const result = await client.query("SELECT data FROM household_state WHERE household_id=$1 FOR UPDATE", [householdId]);
  if (!result.rowCount) return;
  const data = result.rows[0]!.data as { tasks?: Array<Record<string, unknown>>; items?: unknown[] };
  const tasks = (data.tasks ?? []).map((task) => {
    const fields = (value: Record<string, unknown>) => ({
      title: value.title,
      dueDate: value.dueDate,
      repeat: value.repeat,
      weeklyDays: value.weeklyDays,
      anchorDay: value.anchorDay,
      ownerMode: value.ownerMode,
      assigneeId: value.assigneeId,
      rotation: value.rotation,
      rotationIndex: value.rotationIndex,
      completionScope: value.completionScope,
      activeTime: value.activeTime,
    });
    const base = task.seriesBase && typeof task.seriesBase === "object" ? task.seriesBase as Record<string, unknown> : task;
    let nextBase = fields(base);
    if (base.ownerMode === "rotation") {
      const original = Array.isArray(base.rotation) ? base.rotation as string[] : [];
      const rotation = original.filter((value) => value !== userId);
      const index = Number(base.rotationIndex ?? 0) % Math.max(original.length, 1);
      const current = original[index];
      const next = original.length ? original[(index + 1) % original.length] : undefined;
      if (!rotation.length) nextBase = { ...nextBase, ownerMode: "agree", assigneeId: undefined, rotation: [], rotationIndex: 0 };
      else {
        const nextIndex = rotation.indexOf(current === userId ? next ?? "" : current ?? "");
        nextBase = { ...nextBase, rotation, rotationIndex: Math.max(0, nextIndex), assigneeId: undefined };
      }
    } else if (base.ownerMode === "fixed" && base.assigneeId === userId) {
      nextBase = { ...nextBase, ownerMode: "agree", assigneeId: undefined };
    }

    let currentTask = { ...task };
    let currentWasRemoved = false;
    if (task.ownerMode === "fixed" && task.assigneeId === userId) {
      currentTask = { ...currentTask, ownerMode: "agree", assigneeId: undefined };
      currentWasRemoved = true;
    } else if (task.ownerMode === "rotation") {
      const original = Array.isArray(task.rotation) ? task.rotation as string[] : [];
      const rotation = original.filter((value) => value !== userId);
      const index = Number(task.rotationIndex ?? 0) % Math.max(original.length, 1);
      const current = original[index];
      if (!rotation.length) currentTask = { ...currentTask, ownerMode: "agree", assigneeId: undefined, rotation: [], rotationIndex: 0 };
      else if (current === userId) {
        currentTask = { ...currentTask, ownerMode: "agree", assigneeId: undefined, rotation, rotationIndex: Number(nextBase.rotationIndex ?? 0) };
        currentWasRemoved = true;
      } else {
        currentTask = { ...currentTask, rotation, rotationIndex: Math.max(0, rotation.indexOf(current ?? "")), assigneeId: undefined };
      }
    }
    const keepBase = Boolean(task.seriesBase) || currentWasRemoved && nextBase.ownerMode === "rotation";
    return { ...currentTask, seriesBase: keepBase ? nextBase : undefined };
  });
  await client.query(
    "UPDATE household_state SET data=jsonb_set(data,'{tasks}',$2::jsonb,true),version=version+1,updated_at=now() WHERE household_id=$1",
    [householdId, JSON.stringify(tasks)],
  );
}

function audit(adminId: string, action: string, targetType: string, targetId: string, requestId: string, db: import("pg").Pool | import("pg").PoolClient = pool) {
  return db.query(
    "INSERT INTO admin_audit_events(id,actor_admin_id,action,target_type,target_id,request_id) VALUES($1,$2,$3,$4,$5,$6)",
    [id("audit"), adminId, action, targetType, targetId, requestId],
  );
}

async function sendToken(to: string, subject: string, link: string, expires: string, db: import("pg").Pool | import("pg").PoolClient = pool) {
  const body = `Use este link: ${link}\n\nEle expira ${expires}. Se você não pediu esta ação, ignore esta mensagem.`;
  await db.query(
    "INSERT INTO mail_outbox(id,recipient,subject,body_encrypted) VALUES($1,$2,$3,$4)",
    [id("mail"), to, subject, encryptSecret(body)],
  );
}

async function deliverMail() {
  const message = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id,recipient,subject,body_encrypted,attempts FROM mail_outbox
       WHERE next_attempt_at<=now() AND attempts<10 ORDER BY created_at
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    if (!result.rowCount) return null;
    const row = result.rows[0]!;
    await client.query("UPDATE mail_outbox SET next_attempt_at=now()+interval '5 minutes' WHERE id=$1", [row.id]);
    return row;
  });
  if (!message) return;
  try {
    await sendMail(message.recipient as string, message.subject as string, decryptSecret(message.body_encrypted as string));
    await pool.query("DELETE FROM mail_outbox WHERE id=$1", [message.id]);
  } catch (error) {
    const attempts = Number(message.attempts) + 1;
    await pool.query(
      "UPDATE mail_outbox SET attempts=$2,next_attempt_at=now()+($3::text || ' seconds')::interval WHERE id=$1",
      [message.id, attempts, Math.min(60 * 2 ** attempts, 3600)],
    );
    app.log.error({ outbox_id: message.id, attempts, error_name: error instanceof Error ? error.name : "unknown" }, "mail delivery failed");
  }
}

const localDate = (timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

async function sendPushToUser(userId: string, payload: { title: string; body: string; url: string; tag: string }) {
  if (!vapidPublicKey || !process.env.VAPID_PRIVATE_KEY) return false;
  const subscriptions = await pool.query("SELECT id,subscription_encrypted FROM push_subscriptions WHERE user_id=$1 AND invalid_at IS NULL", [userId]);
  let delivered = false;
  for (const subscription of subscriptions.rows) {
    try {
      const value = JSON.parse(decryptSecret(subscription.subscription_encrypted as string));
      await webPush.sendNotification(value, JSON.stringify(payload));
      delivered = true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await pool.query("UPDATE push_subscriptions SET invalid_at=now() WHERE id=$1", [subscription.id]);
      else app.log.error({ subscription_id: subscription.id, error_name: error instanceof Error ? error.name : "unknown" }, "push delivery failed");
    }
  }
  return delivered;
}

let reminderWorkerBusy = false;
async function deliverReminders() {
  if (!vapidPublicKey || !process.env.VAPID_PRIVATE_KEY || reminderWorkerBusy) return;
  reminderWorkerBusy = true;
  try {
    const candidates = await pool.query(
      `SELECT u.id AS user_id,h.id AS household_id,h.timezone,s.data
       FROM users u JOIN memberships m ON m.user_id=u.id
       JOIN households h ON h.id=m.household_id JOIN household_state s ON s.household_id=h.id
       JOIN user_preferences p ON p.user_id=u.id
       JOIN accounts a ON a.id=u.account_id
       WHERE u.status='ativo' AND a.email_verified_at IS NOT NULL AND p.reminder_enabled=true
       AND p.reminder_time <= (now() AT TIME ZONE h.timezone)::time`,
    );
    for (const candidate of candidates.rows) {
      const timezone = candidate.timezone as string;
      const today = localDate(timezone);
      const sent = await pool.query("SELECT 1 FROM reminder_deliveries WHERE user_id=$1 AND timezone=$2 AND local_date=$3", [candidate.user_id, timezone, today]);
      if (sent.rowCount) continue;
      const snapshot = candidate.data as { tasks?: Array<Record<string, unknown>> };
      const tasks = (snapshot.tasks ?? []).filter((task) => {
        if (typeof task.dueDate !== "string" || task.dueDate > today || task.paused || task.ended || task.completed || task.skipped) return false;
        const rotation = Array.isArray(task.rotation) ? task.rotation as string[] : [];
        const assignee = task.ownerMode === "rotation" && rotation.length
          ? rotation[Number(task.rotationIndex ?? 0) % rotation.length]
          : task.assigneeId;
        return assignee === candidate.user_id;
      });
      if (!tasks.length) continue;
      const delivered = await sendPushToUser(candidate.user_id, {
        title: "Tarefas da sua casa",
        body: tasks.slice(0, 4).map((task) => String(task.title ?? "Tarefa")).join(" · "),
        url: "/casa",
        tag: `cdb-task-reminder-${today}`,
      });
      if (delivered) await pool.query("INSERT INTO reminder_deliveries(user_id,timezone,local_date) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [candidate.user_id, timezone, today]);
    }
  } finally {
    reminderWorkerBusy = false;
  }
}

let reviewReminderWorkerBusy = false;
async function deliverReviewReminders() {
  if (!vapidPublicKey || !process.env.VAPID_PRIVATE_KEY || reviewReminderWorkerBusy) return;
  reviewReminderWorkerBusy = true;
  try {
    const candidates = await pool.query(
      `SELECT u.id AS user_id,m.household_id,h.timezone
       FROM users u JOIN memberships m ON m.user_id=u.id
       JOIN households h ON h.id=m.household_id
       JOIN user_preferences p ON p.user_id=u.id
       JOIN accounts a ON a.id=u.account_id
       WHERE u.status='ativo' AND a.email_verified_at IS NOT NULL AND p.review_reminder_enabled=true
       AND p.reminder_time <= (now() AT TIME ZONE h.timezone)::time
       AND coalesce(m.last_reviewed_at, m.joined_at) < now() - interval '7 days'`,
    );
    for (const candidate of candidates.rows) {
      const timezone = candidate.timezone as string;
      const today = localDate(timezone);
      const sent = await pool.query(
        "SELECT 1 FROM review_reminder_deliveries WHERE user_id=$1 AND household_id=$2 AND timezone=$3 AND local_date=$4",
        [candidate.user_id, candidate.household_id, timezone, today],
      );
      if (sent.rowCount) continue;
      const delivered = await sendPushToUser(candidate.user_id, {
        title: "Como foi a semana em casa?",
        body: "Dá pra dar uma olhada rápida em como foi.",
        url: "/casa/revisao",
        tag: `cdb-weekly-review-${today}`,
      });
      if (delivered) await pool.query(
        "INSERT INTO review_reminder_deliveries(user_id,household_id,timezone,local_date) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [candidate.user_id, candidate.household_id, timezone, today],
      );
    }
  } finally {
    reviewReminderWorkerBusy = false;
  }
}

app.get("/healthz", async (_request, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ok" };
  } catch {
    return bad(reply, 503, "unavailable", "Serviço temporariamente indisponível.");
  }
});

app.get("/api/admin/bootstrap/status", async (_request, reply) => {
  const count = await pool.query<{ count: string }>("SELECT count(*) FROM platform_admins");
  return { enabled: Boolean(process.env.BOOTSTRAP_ADMIN_EMAIL) && Number(count.rows[0]?.count) === 0 };
});

app.post("/api/admin/bootstrap/request", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (_request, reply) => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const count = await pool.query<{ count: string }>("SELECT count(*) FROM platform_admins");
  if (!email) return bad(reply, 503, "unavailable", "O primeiro acesso administrativo não está configurado neste servidor.");
  if (Number(count.rows[0]?.count) > 0) return bad(reply, 409, "bootstrap_already_completed", "A configuração inicial já foi concluída. Volte à tela de entrada e use a conta administrativa.");
  const secret = createTotpSecret();
  const raw = token();
  const link = `${appOrigin}/admin/setup#token=${encodeURIComponent(raw)}`;
  await withTransaction(async (client) => {
    await client.query("DELETE FROM admin_bootstrap_tokens WHERE expires_at < now() OR used_at IS NOT NULL");
    await client.query(
      `INSERT INTO admin_bootstrap_tokens(id,email,token_hash,totp_secret,expires_at)
       VALUES($1,$2,$3,$4,now()+interval '30 minutes')`,
      [id("bootstrap"), normalizeEmail(email), tokenHash(raw), encryptSecret(secret)],
    );
    await sendToken(email, "Configuração do Chega de Briga", link, "em 30 minutos", client);
  });
  return reply.code(202).send({ status: "queued" });
});

app.post("/api/admin/bootstrap/challenge", async (request, reply) => {
  const raw = text(bodyOf(request), "token");
  if (!raw) return bad(reply, 400, "bootstrap_setup_invalid", "Link inválido ou expirado.");
  const result = await pool.query(
    `SELECT email,totp_secret FROM admin_bootstrap_tokens
     WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL`,
    [tokenHash(raw)],
  );
  if (!result.rowCount) return bad(reply, 410, "bootstrap_link_expired", "Link inválido ou expirado.");
  const { email, totp_secret: encrypted } = result.rows[0]!;
  const secret = decryptSecret(encrypted as string);
  return { email, totpSecret: secret, totpUri: totpUri(secret, email as string) };
});

app.post("/api/admin/bootstrap/complete", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const body = bodyOf(request);
  const raw = text(body, "token");
  const password = text(body, "password");
  const code = text(body, "totp");
  if (password.length < 12 || password.length > 200 || !/^\d{6}$/.test(code)) return bad(reply, 422, "validation", "Use uma senha com pelo menos 12 caracteres e o código atual do autenticador.");
  const result = await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(615721045)");
    const bootstrap = await client.query(
      `SELECT * FROM admin_bootstrap_tokens WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL FOR UPDATE`,
      [tokenHash(raw)],
    );
    if (!bootstrap.rowCount) return null;
    const row = bootstrap.rows[0]!;
    const secret = decryptSecret(row.totp_secret as string);
    if (!verifyTotp(secret, code)) return null;
    const existing = await client.query("SELECT 1 FROM platform_admins LIMIT 1");
    if (existing.rowCount) return null;
    const linkedAccount = await client.query("SELECT id,password_hash FROM accounts WHERE email=$1 FOR UPDATE", [row.email]);
    if (linkedAccount.rowCount && !(await verifyPassword(password, linkedAccount.rows[0]!.password_hash as string))) return null;
    const accountId = linkedAccount.rows[0]?.id as string | undefined ?? id("account");
    if (!linkedAccount.rowCount) {
      await client.query(
        "INSERT INTO accounts(id,email,password_hash,email_verified_at) VALUES($1,$2,$3,now())",
        [accountId, row.email, await hashPassword(password)],
      );
    } else {
      await client.query("UPDATE accounts SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=$1", [accountId]);
    }
    const adminId = id("admin");
    const codes = recoveryCodes();
    await client.query(
      "INSERT INTO platform_admins(id,account_id,totp_secret) VALUES($1,$2,$3)",
      [adminId, accountId, row.totp_secret],
    );
    for (const codeValue of codes) {
      await client.query("INSERT INTO admin_recovery_codes(id,admin_id,code_hash) VALUES($1,$2,$3)", [id("recovery"), adminId, tokenHash(codeValue)]);
    }
    await client.query("UPDATE admin_bootstrap_tokens SET used_at=now() WHERE id=$1", [row.id]);
    return { adminId, codes };
  });
  if (!result) return bad(reply, 422, "bootstrap_setup_invalid", "Link ou código inválido. Confira o horário do autenticador e tente novamente.");
  await audit(result.adminId, "bootstrap_completed", "platform_admin", result.adminId, request.id);
  return { ok: true, recoveryCodes: result.codes };
});

app.post("/api/admin/session/challenge", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const body = bodyOf(request);
  const email = normalizeEmail(text(body, "email"));
  const result = await pool.query(
    `SELECT p.id,a.password_hash FROM platform_admins p
     JOIN accounts a ON a.id=p.account_id WHERE a.email=$1`,
    [email],
  );
  const admin = result.rows[0];
  const passwordOk = admin ? await verifyPassword(text(body, "password"), admin.password_hash as string) : false;
  if (!admin || !passwordOk) {
    clearAdminLoginChallenge(reply);
    return bad(reply, 401, "admin_login_failed", "E-mail ou senha incorretos.");
  }
  const challenge = token();
  await pool.query(
    "INSERT INTO admin_login_challenges(token_hash,admin_id,expires_at) VALUES($1,$2,now()+($3::int * interval '1 second'))",
    [tokenHash(challenge), admin.id, ADMIN_LOGIN_CHALLENGE_TTL_SECONDS],
  );
  reply.setCookie("cdb_admin_challenge", challenge, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/api/admin/session",
    maxAge: ADMIN_LOGIN_CHALLENGE_TTL_SECONDS,
  });
  return { requiresTotp: true };
});

app.post("/api/admin/session/verify", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const challenge = request.cookies.cdb_admin_challenge ?? "";
  if (!challenge) {
    clearAdminLoginChallenge(reply);
    return bad(reply, 401, "admin_challenge_expired", "A verificação expirou. Entre novamente.");
  }
  const code = text(bodyOf(request), "totp").trim();
  const rawSession = token();
  const result = await withTransaction(async (client) => {
    const challengeResult = await client.query(
      `SELECT p.id,p.totp_secret FROM admin_login_challenges c
       JOIN platform_admins p ON p.id=c.admin_id
       WHERE c.token_hash=$1 AND c.expires_at>now() FOR UPDATE OF c`,
      [tokenHash(challenge)],
    );
    const admin = challengeResult.rows[0];
    if (!admin) return "expired" as const;
    let totpOk = verifyTotp(decryptSecret(admin.totp_secret as string), code);
    if (!totpOk) {
      const recovery = code.toUpperCase().replace(/[^A-F0-9]/g, "");
      if (recovery.length === 18) {
        const match = await client.query("SELECT id FROM admin_recovery_codes WHERE admin_id=$1 AND code_hash=$2 AND used_at IS NULL FOR UPDATE", [admin.id, tokenHash(recovery)]);
        if (match.rowCount) {
          await client.query("UPDATE admin_recovery_codes SET used_at=now() WHERE id=$1", [match.rows[0]!.id]);
          totpOk = true;
        }
      }
    }
    if (!totpOk) return "invalid_totp" as const;
    await client.query("DELETE FROM admin_login_challenges WHERE token_hash=$1", [tokenHash(challenge)]);
    await client.query("INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [tokenHash(rawSession), admin.id]);
    await client.query("UPDATE platform_admins SET last_seen_at=now() WHERE id=$1", [admin.id]);
    return "authenticated" as const;
  });
  if (result === "expired") {
    clearAdminLoginChallenge(reply);
    return bad(reply, 401, "admin_challenge_expired", "A verificação expirou. Entre novamente.");
  }
  if (result === "invalid_totp") return bad(reply, 401, "invalid_totp", "Código incorreto. Confira o autenticador ou use um código de recuperação.");
  setCookie(reply, "cdb_admin", rawSession, 8 * 60 * 60);
  clearAdminLoginChallenge(reply);
  return { ok: true };
});

app.get("/api/admin/session", { preHandler: adminSession }, async (request) => ({ email: request.admin!.email }));
app.delete("/api/admin/session", { preHandler: adminSession }, async (request, reply) => {
  await pool.query("DELETE FROM admin_sessions WHERE admin_id=$1", [request.admin!.id]);
  reply.clearCookie("cdb_admin", { path: "/", secure: secureCookie, sameSite: "lax" });
  clearAdminLoginChallenge(reply);
  return { ok: true };
});

function campaignColumns(body: Body) {
  return [campaignTag(body.utm_source), campaignTag(body.utm_medium), campaignTag(body.utm_campaign)];
}

app.get("/api/public/config", async () => ({ signupEnabled: publicSignupEnabled }));

app.post("/api/public/landing-events", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
  const body = bodyOf(request);
  const event = parseLandingEvent(body);
  if (!event) {
    return bad(reply, 422, "validation", "Evento da página inválido.");
  }
  await pool.query(
    "INSERT INTO public_landing_events(id,event_type,channel,utm_source,utm_medium,utm_campaign,acquisition_source,page_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [id("landing"), event.event, body.channel ?? null, ...campaignColumns(body), event.source, event.page],
  );
  return reply.code(202).send({ ok: true });
});

app.post("/api/waitlist", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
  const body = bodyOf(request);
  if (text(body, "companyWebsite").trim()) return reply.code(202).send({ ok: true });
  if (publicSignupEnabled) return bad(reply, 409, "signup_open", "O cadastro público já está aberto.");
  const channel = body.channel;
  const rawContact = text(body, "contact").trim();
  if (channel !== "email" && channel !== "whatsapp") {
    return bad(reply, 422, "validation", "Escolha e-mail ou WhatsApp.");
  }
  const contact = normalizeWaitlistContact(channel, rawContact);
  if (!contact) return bad(reply, 422, "validation", channel === "email" ? "Informe um e-mail válido." : "Informe um WhatsApp com DDD e código do país, quando necessário.");
  if (body.consent !== true || body.consentVersion !== waitlistConsentVersion) return bad(reply, 422, "validation", "Autorize o aviso pelo canal escolhido para continuar.");
  const source = body.source === undefined ? "unknown" : body.source;
  if (!isAcquisitionSource(source)) return bad(reply, 422, "validation", "Origem inválida.");
  const tags = campaignColumns(body);
  await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO waitlist_contacts(id,channel,contact,consent_at,consent_version,utm_source,utm_medium,utm_campaign)
       VALUES($1,$2,$3,now(),$4,$5,$6,$7) ON CONFLICT(channel,contact) DO NOTHING RETURNING id`,
      [id("waitlist"), channel, contact, waitlistConsentVersion, ...tags],
    );
    if (inserted.rowCount) {
      await client.query(
        "INSERT INTO public_landing_events(id,event_type,channel,utm_source,utm_medium,utm_campaign,acquisition_source) VALUES($1,'waitlist_signup',$2,$3,$4,$5,$6)",
        [id("landing"), channel, ...tags, source],
      );
    }
  });
  return reply.code(202).send({ ok: true });
});

app.get("/api/admin/waitlist/analytics", { preHandler: adminSession }, async (request, reply) => {
  const query = request.query as { period?: string };
  const period = [7, 30, 90].includes(Number(query.period)) ? Number(query.period) : 30;
  const [summary, channels, campaigns, grouped, acquisition] = await Promise.all([
    pool.query(
      `SELECT count(*) FILTER (WHERE event_type='landing_view')::int AS page_loads,
        count(*) FILTER (WHERE event_type='form_start')::int AS form_starts,
        count(*) FILTER (WHERE event_type='waitlist_signup')::int AS signups
       FROM public_landing_events WHERE occurred_at>=now()-($1::int*interval '1 day')`, [period],
    ),
    pool.query(
      `SELECT channel,count(*)::int AS count FROM public_landing_events
       WHERE event_type='waitlist_signup' AND occurred_at>=now()-($1::int*interval '1 day') AND channel IS NOT NULL
       GROUP BY channel ORDER BY channel`, [period],
    ),
    pool.query(
      `SELECT coalesce(utm_campaign,'') AS campaign,
        count(*) FILTER (WHERE event_type='landing_view')::int AS page_loads,
        count(*) FILTER (WHERE event_type='form_start')::int AS form_starts,
        count(*) FILTER (WHERE event_type='waitlist_signup')::int AS signups
       FROM public_landing_events WHERE occurred_at>=now()-($1::int*interval '1 day')
       GROUP BY utm_campaign ORDER BY signups DESC,page_loads DESC,campaign LIMIT 50`, [period],
    ),
    pool.query(
      `SELECT date_trunc('day',occurred_at AT TIME ZONE 'UTC')::date::text AS date,
        count(*) FILTER (WHERE event_type='landing_view')::int AS page_loads,
        count(*) FILTER (WHERE event_type='form_start')::int AS form_starts,
        count(*) FILTER (WHERE event_type='waitlist_signup')::int AS signups
       FROM public_landing_events WHERE occurred_at>=now()-($1::int*interval '1 day')
       GROUP BY 1 ORDER BY 1`, [period],
    ),
    readAcquisitionAnalytics(pool, period),
  ]);
  const totals = summary.rows[0]!;
  const publicRows = publicSignupEnabled ? await pool.query(
    `WITH bounds AS (
      SELECT greatest(now()-(($1::int+7)*interval '1 day'), coalesce((SELECT value::timestamptz FROM app_settings WHERE key='public_signup_launched_at'),now())) AS from_at,
        now()-interval '7 days' AS mature_to
     ), public_accounts AS (
      SELECT u.id FROM users u,bounds b WHERE u.source='publico' AND u.created_at>=b.from_at AND u.created_at<=b.mature_to
     ), public_houses AS (
      SELECT h.id,
        (h.first_value_at>=h.created_at AND h.first_value_at<=h.created_at+interval '7 days') AS activated
      FROM households h JOIN public_accounts u ON u.id=h.created_by_user_id,bounds b
      WHERE h.created_at>=b.from_at AND h.created_at<=b.mature_to
     )
     SELECT
      (SELECT count(*)::int FROM public_landing_events e,bounds b WHERE e.event_type='landing_view' AND e.occurred_at>=b.from_at AND e.occurred_at<=b.mature_to) AS page_loads,
      (SELECT count(*)::int FROM public_accounts) AS accounts,
      (SELECT count(*)::int FROM public_houses) AS houses,
      (SELECT count(*)::int FROM public_houses WHERE activated) AS first_value`, [period],
  ) : undefined;
  const dailyByDate = new Map(grouped.rows.map((row) => [row.date as string, row]));
  const daily = Array.from({ length: period + 1 }, (_, index) => {
    const date = new Date(Date.now() - (period - index) * 86_400_000).toISOString().slice(0, 10);
    const row = dailyByDate.get(date);
    return { date, pageLoads: row?.page_loads ?? 0, formStarts: row?.form_starts ?? 0, signups: row?.signups ?? 0 };
  });
  const pageLoads = Number(totals.page_loads ?? 0);
  const signups = Number(totals.signups ?? 0);
  return reply.send({
    period,
    signupEnabled: publicSignupEnabled,
    from: new Date(Date.now() - period * 86_400_000).toISOString(),
    to: new Date().toISOString(),
    pageLoads,
    formStarts: Number(totals.form_starts ?? 0),
    signups,
    conversion: pageLoads ? signups / pageLoads : 0,
    byChannel: channels.rows.map((row) => ({ channel: row.channel, count: row.count })),
    byCampaign: campaigns.rows.map((row) => ({ campaign: row.campaign || "Sem campanha", pageLoads: row.page_loads, formStarts: row.form_starts, signups: row.signups })),
    ...acquisition,
    daily,
    publicFunnel: publicRows ? [
      { label: "Landing carregada", count: Number(publicRows.rows[0]?.page_loads ?? 0), denominator: Number(publicRows.rows[0]?.page_loads ?? 0) },
      { label: "Conta pública criada", count: Number(publicRows.rows[0]?.accounts ?? 0), denominator: Number(publicRows.rows[0]?.page_loads ?? 0) },
      { label: "Casa criada", count: Number(publicRows.rows[0]?.houses ?? 0), denominator: Number(publicRows.rows[0]?.accounts ?? 0) },
      { label: "Primeiro valor em 7 dias", count: Number(publicRows.rows[0]?.first_value ?? 0), denominator: Number(publicRows.rows[0]?.houses ?? 0) },
    ] : [],
  });
});

app.get("/api/admin/waitlist", { preHandler: adminSession }, async (request, reply) => {
  const query = request.query as { search?: string; channel?: string; campaign?: string; page?: string; page_size?: string };
  const page = Math.min(1_000_000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.page_size ?? "20", 10) || 20));
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (query.channel && query.channel !== "todos") {
    if (!["email", "whatsapp"].includes(query.channel)) return bad(reply, 422, "validation", "Canal inválido.");
    conditions.push(`channel=${add(query.channel)}`);
  }
  if (query.campaign?.trim()) {
    const campaign = campaignTag(query.campaign);
    if (!campaign) return bad(reply, 422, "validation", "Campanha inválida.");
    conditions.push(`utm_campaign=${add(campaign)}`);
  }
  if (query.search?.trim()) {
    const term = `%${query.search.trim().replace(/[\\%_]/g, "\\$&").slice(0, 120)}%`;
    const parameter = add(term);
    conditions.push(`(contact ILIKE ${parameter} OR coalesce(utm_source,'') ILIKE ${parameter} OR coalesce(utm_medium,'') ILIKE ${parameter} OR coalesce(utm_campaign,'') ILIKE ${parameter})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [count, entries] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM waitlist_contacts ${where}`, values),
    pool.query(
      `SELECT id,channel,contact,created_at,utm_source,utm_medium,utm_campaign FROM waitlist_contacts ${where}
       ORDER BY created_at DESC,id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      values,
    ),
  ]);
  const total = Number(count.rows[0]?.total ?? 0);
  return {
    items: entries.rows.map((row) => ({ id: row.id, channel: row.channel, contact: row.contact, createdAt: new Date(row.created_at).toISOString(), utmSource: row.utm_source ?? undefined, utmMedium: row.utm_medium ?? undefined, utmCampaign: row.utm_campaign ?? undefined })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
});

app.delete("/api/admin/waitlist/:id", { preHandler: adminSession }, async (request, reply) => {
  const { id: contactId } = request.params as { id: string };
  const removed = await withTransaction(async (client) => {
    const result = await client.query("DELETE FROM waitlist_contacts WHERE id=$1 RETURNING id", [contactId]);
    if (!result.rowCount) return false;
    await client.query(
      "INSERT INTO admin_audit_events(id,actor_admin_id,action,target_type,target_id,request_id) VALUES($1,$2,'waitlist.contact_deleted','waitlist_contact',$3,$4)",
      [id("audit"), request.admin!.id, contactId, request.id],
    );
    return true;
  });
  if (!removed) return bad(reply, 404, "not_found", "Contato não encontrado.");
  return { ok: true };
});

app.post("/api/auth/registrations", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
  const body = bodyOf(request);
  const name = text(body, "name").trim();
  const email = normalizeEmail(text(body, "email"));
  const password = text(body, "password");
  const inviteToken = text(body, "invitationId");
  if (name.length < 2 || name.length > 100 || !emailPattern.test(email) || password.length < 12 || password.length > 200) {
    return bad(reply, 422, "validation", "Confira nome, e-mail e senha. A senha precisa ter pelo menos 12 caracteres.");
  }
  const rawVerification = token();
  const registration = await withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT 1 FROM users u JOIN accounts a ON a.id=u.account_id WHERE a.email=$1",
      [email],
    );
    if (existing.rowCount) return null;
    let grant: { id: string; source: string; household_id: string | null } | undefined;
    if (inviteToken) {
      const invitation = await client.query(
        `SELECT g.id,g.source,i.household_id,i.id AS invitation_id FROM invitations i
         JOIN access_grants g ON g.id=i.access_id
         WHERE i.token_hash=$1 AND g.email=$2 AND i.status='pendente' AND i.expires_at>now() FOR UPDATE`,
        [tokenHash(inviteToken), email],
      );
      grant = invitation.rows[0] as typeof grant;
      if (!grant) return null;
    } else if (publicSignupEnabled) {
      const accessId = id("access");
      await client.query("INSERT INTO access_grants(id,email,source) VALUES($1,$2,'publico')", [accessId, email]);
      grant = { id: accessId, source: "publico", household_id: null };
    } else {
      const allowed = await client.query(
        `SELECT g.id,'lista' AS source,NULL::text AS household_id FROM access_grants g
         JOIN allow_entries a ON a.access_id=g.id
         WHERE g.email=$1 AND a.revoked_at IS NULL LIMIT 1`,
        [email],
      );
      grant = allowed.rows[0] as typeof grant;
      if (!grant) return null;
    }
    const account = await client.query("SELECT id,password_hash,email_verified_at FROM accounts WHERE email=$1 FOR UPDATE", [email]);
    let accountId: string;
    const emailVerified = Boolean(account.rows[0]?.email_verified_at);
    if (account.rowCount) {
      if (!(await verifyPassword(password, account.rows[0]!.password_hash as string))) return null;
      accountId = account.rows[0]!.id as string;
    } else {
      accountId = id("account");
      await client.query(
        "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)",
        [accountId, email, await hashPassword(password)],
      );
    }
    const userId = id("user");
    await client.query(
      `INSERT INTO users(id,account_id,name,source,access_id)
       VALUES($1,$2,$3,$4,$5)`,
      [userId, accountId, name, grant.source, grant.id],
    );
    if (grant.household_id) {
      await client.query(
        "INSERT INTO memberships(user_id,household_id,role) VALUES($1,$2,'morador')",
        [userId, grant.household_id],
      );
      await client.query("UPDATE invitations SET status='aceito',accepted_at=now() WHERE access_id=$1", [grant.id]);
      await client.query("INSERT INTO activity_events(id,event_type,user_id,household_id) VALUES($1,'entrada_casa',$2,$3)", [id("event"), userId, grant.household_id]);
    }
    await client.query("INSERT INTO activity_events(id,event_type,user_id) VALUES($1,'conta_criada',$2)", [id("event"), userId]);
    if (!emailVerified) {
      await client.query(
        "INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'verification',now()+interval '24 hours')",
        [tokenHash(rawVerification), userId],
      );
      await sendToken(email, "Confirme seu e-mail no Chega de Briga", `${appOrigin}/confirmar-email#token=${encodeURIComponent(rawVerification)}`, "em 24 horas", client);
    }
    return { userId, emailVerified };
  });
  if (registration?.emailVerified) return { session: await startResidentSession(reply, registration.userId) };
  return reply.code(202).send({ pendingVerification: true });
});

app.post("/api/auth/invitations/preview", async (request, reply) => {
  const raw = text(bodyOf(request), "token");
  const result = await pool.query(
    `SELECT i.id,g.email,g.source,h.name AS household_name,i.status,i.expires_at
     FROM invitations i JOIN access_grants g ON g.id=i.access_id LEFT JOIN households h ON h.id=i.household_id
     WHERE i.token_hash=$1`,
    [tokenHash(raw)],
  );
  if (!result.rowCount) return bad(reply, 404, "invitation_not_found", "Convite não encontrado.");
  const row = result.rows[0]!;
  const expired = new Date(row.expires_at as string) <= new Date();
  return {
    id: raw,
    email: row.email,
    source: row.source,
    householdName: row.household_name ?? undefined,
    status: expired && row.status === "pendente" ? "expirado" : row.status,
    expiresAt: new Date(row.expires_at as string).toISOString(),
  };
});

app.post("/api/auth/email-verifications", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const raw = text(bodyOf(request), "token");
  const userId = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT user_id FROM email_tokens WHERE token_hash=$1 AND purpose='verification'
       AND expires_at>now() AND used_at IS NULL FOR UPDATE`,
      [tokenHash(raw)],
    );
    if (!result.rowCount) return null;
    const value = result.rows[0]!.user_id as string;
    await client.query("UPDATE email_tokens SET used_at=now() WHERE token_hash=$1", [tokenHash(raw)]);
    await client.query(
      "UPDATE accounts SET email_verified_at=now() WHERE id=(SELECT account_id FROM users WHERE id=$1)",
      [value],
    );
    return value;
  });
  if (!userId) return bad(reply, 410, "email_confirmation_expired", "Link de confirmação inválido ou expirado.");
  return { session: await startResidentSession(reply, userId) };
});

app.post("/api/auth/session", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const body = bodyOf(request);
  const email = normalizeEmail(text(body, "email"));
  const result = await pool.query(
    `SELECT u.id,a.password_hash,a.email_verified_at,u.status FROM users u
     JOIN accounts a ON a.id=u.account_id WHERE a.email=$1`,
    [email],
  );
  const row = result.rows[0];
  if (!row || row.status !== "ativo" || !row.email_verified_at || !(await verifyPassword(text(body, "password"), row.password_hash as string))) {
    return bad(reply, 401, "resident_login_failed", "E-mail ou senha incorretos, perfil residencial indisponível ou e-mail ainda não confirmado.");
  }
  return { session: await startResidentSession(reply, row.id as string) };
});

app.get("/api/auth/session", { preHandler: residentSession }, async (request) => ({ session: await sessionPayload(request.resident!.id) }));
app.delete("/api/auth/session", { preHandler: residentSession }, async (request, reply) => {
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [request.resident!.id]);
  reply.clearCookie("cdb_resident", { path: "/", secure: secureCookie, sameSite: "lax" });
  return { ok: true };
});

app.post("/api/auth/password-resets", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
  const email = normalizeEmail(text(bodyOf(request), "email"));
  const result = await pool.query(
    `SELECT u.id FROM users u JOIN accounts a ON a.id=u.account_id
     WHERE a.email=$1 AND u.status='ativo'`,
    [email],
  );
  if (result.rowCount) {
    const raw = token();
    await withTransaction(async (client) => {
      await client.query("DELETE FROM email_tokens WHERE user_id=$1 AND purpose='password_reset'", [result.rows[0]!.id]);
      await client.query("INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'password_reset',now()+interval '1 hour')", [tokenHash(raw), result.rows[0]!.id]);
      await sendToken(email, "Redefina sua senha do Chega de Briga", `${appOrigin}/redefinir-senha#token=${encodeURIComponent(raw)}`, "em 1 hora", client);
    });
  }
  return reply.code(202).send({ ok: true });
});

app.post("/api/auth/password-resets/confirm", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const body = bodyOf(request);
  const raw = text(body, "token");
  const password = text(body, "password");
  if (password.length < 12 || password.length > 200) return bad(reply, 422, "validation", "A senha precisa ter pelo menos 12 caracteres.");
  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT user_id FROM email_tokens WHERE token_hash=$1 AND purpose='password_reset'
       AND expires_at>now() AND used_at IS NULL FOR UPDATE`,
      [tokenHash(raw)],
    );
    if (!result.rowCount) return null;
    const userId = result.rows[0]!.user_id as string;
    await client.query(
      "UPDATE accounts SET password_hash=$2 WHERE id=(SELECT account_id FROM users WHERE id=$1)",
      [userId, await hashPassword(password)],
    );
    await client.query("DELETE FROM user_sessions WHERE user_id=$1", [userId]);
    await client.query(
      "DELETE FROM admin_sessions WHERE admin_id IN (SELECT id FROM platform_admins WHERE account_id=(SELECT account_id FROM users WHERE id=$1))",
      [userId],
    );
    await client.query("UPDATE email_tokens SET used_at=now() WHERE token_hash=$1", [tokenHash(raw)]);
    return true;
  });
  if (!updated) return bad(reply, 410, "password_reset_expired", "Link inválido ou expirado.");
  return { ok: true };
});

app.get("/api/me", { preHandler: residentSession }, async (request) => ({ session: await sessionPayload(request.resident!.id) }));

app.get("/api/me/reminder", { preHandler: residentSession }, async (request) => {
  const result = await pool.query("SELECT reminder_enabled,reminder_time FROM user_preferences WHERE user_id=$1", [request.resident!.id]);
  const row = result.rows[0];
  return { enabled: Boolean(row?.reminder_enabled), time: row ? String(row.reminder_time).slice(0, 5) : "08:00" };
});

app.patch("/api/me/reminder", { preHandler: residentSession }, async (request, reply) => {
  const body = bodyOf(request);
  const enabled = body.enabled === true;
  const time = text(body, "time");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return bad(reply, 422, "validation", "Horário inválido.");
  await pool.query(
    `INSERT INTO user_preferences(user_id,reminder_enabled,reminder_time) VALUES($1,$2,$3)
     ON CONFLICT(user_id) DO UPDATE SET reminder_enabled=EXCLUDED.reminder_enabled,reminder_time=EXCLUDED.reminder_time`,
    [request.resident!.id, enabled, time],
  );
  return { enabled, time };
});

app.get("/api/me/review-reminder", { preHandler: residentSession }, async (request) => {
  const result = await pool.query("SELECT review_reminder_enabled FROM user_preferences WHERE user_id=$1", [request.resident!.id]);
  return { enabled: Boolean(result.rows[0]?.review_reminder_enabled) };
});

app.patch("/api/me/review-reminder", { preHandler: residentSession }, async (request, reply) => {
  const body = bodyOf(request);
  const enabled = body.enabled === true;
  await pool.query(
    `INSERT INTO user_preferences(user_id,review_reminder_enabled) VALUES($1,$2)
     ON CONFLICT(user_id) DO UPDATE SET review_reminder_enabled=EXCLUDED.review_reminder_enabled`,
    [request.resident!.id, enabled],
  );
  return { enabled };
});

app.get("/api/push/vapid-public-key", async (_request, reply) => {
  if (!vapidPublicKey) return bad(reply, 503, "unavailable", "Notificações não estão configuradas.");
  return { key: vapidPublicKey };
});

app.post("/api/push/subscriptions", { preHandler: residentSession }, async (request, reply) => {
  const subscription = bodyOf(request).subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://") || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
    return bad(reply, 422, "validation", "Assinatura de notificações inválida.");
  }
  await pool.query(
    `INSERT INTO push_subscriptions(id,user_id,endpoint_hash,subscription_encrypted)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=EXCLUDED.user_id,subscription_encrypted=EXCLUDED.subscription_encrypted,invalid_at=NULL`,
    [id("push"), request.resident!.id, tokenHash(subscription.endpoint), encryptSecret(JSON.stringify(subscription))],
  );
  return reply.code(201).send({ ok: true });
});

app.delete("/api/push/subscriptions", { preHandler: residentSession }, async (request) => {
  const endpoint = text(bodyOf(request), "endpoint");
  if (endpoint) await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2", [request.resident!.id, tokenHash(endpoint)]);
  else await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1", [request.resident!.id]);
  return { ok: true };
});

app.patch("/api/me", { preHandler: residentSession }, async (request, reply) => {
  const name = text(bodyOf(request), "name").trim();
  if (name.length < 2 || name.length > 100) return bad(reply, 422, "validation", "O nome deve ter de 2 a 100 caracteres.");
  await pool.query("UPDATE users SET name=$2 WHERE id=$1", [request.resident!.id, name]);
  return { session: await sessionPayload(request.resident!.id) };
});

app.get("/api/me/export", { preHandler: residentSession }, async (request) => {
  const userId = request.resident!.id;
  const [user, houses] = await Promise.all([
    pool.query("SELECT u.id,u.name,a.email,u.created_at FROM users u JOIN accounts a ON a.id=u.account_id WHERE u.id=$1", [userId]),
    pool.query(
      `SELECT h.id,h.name,h.timezone,h.created_at,s.data,m.role,m.joined_at
       FROM memberships m JOIN households h ON h.id=m.household_id
       JOIN household_state s ON s.household_id=h.id WHERE m.user_id=$1`,
      [userId],
    ),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    account: { ...user.rows[0], created_at: new Date(user.rows[0]!.created_at).toISOString() },
    households: houses.rows.map((row) => {
      const data = row.data as { members?: Array<Record<string, unknown>>; invites?: Array<Record<string, unknown>> };
      return {
        id: row.id,
        name: row.name,
        timezone: row.timezone,
        createdAt: new Date(row.created_at).toISOString(),
        role: row.role,
        joinedAt: new Date(row.joined_at).toISOString(),
        sharedData: { ...data, members: (data.members ?? []).map(({ email: _email, ...member }) => member), invites: (data.invites ?? []).map(({ email: _email, ...invite }) => invite) },
      };
    }),
  };
});

app.delete("/api/me", { preHandler: residentSession }, async (request, reply) => {
  const userId = request.resident!.id;
  const deleted = await withTransaction(async (client) => {
    const identity = await client.query("SELECT account_id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const adminRole = await client.query("SELECT 1 FROM platform_admins WHERE account_id=$1", [identity.rows[0]!.account_id]);
    if (adminRole.rowCount) return "shared_admin";
    const blockingHouse = await client.query(
      `SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.role='responsavel'
       AND (SELECT count(*) FROM memberships x WHERE x.household_id=m.household_id AND x.user_id<>$1)>0
       AND (SELECT count(*) FROM memberships x WHERE x.household_id=m.household_id AND x.role='responsavel')<2 LIMIT 1`,
      [userId],
    );
    if (blockingHouse.rowCount) return false;
    const memberships = await client.query(
      "SELECT household_id,role FROM memberships WHERE user_id=$1 FOR UPDATE",
      [userId],
    );
    for (const membership of memberships.rows) {
      const others = await client.query("SELECT count(*) FROM memberships WHERE household_id=$1 AND user_id<>$2", [membership.household_id, userId]);
      if (Number(others.rows[0]!.count) === 0) {
        await client.query("DELETE FROM households WHERE id=$1", [membership.household_id]);
      } else {
        await removeMemberFromHouseState(client, membership.household_id as string, userId);
        await client.query("DELETE FROM memberships WHERE user_id=$1 AND household_id=$2", [userId, membership.household_id]);
      }
    }
    const anonymizedEmail = `deleted-${id("account")}@invalid.local`;
    await client.query("UPDATE activity_events SET user_id=NULL WHERE user_id=$1", [userId]);
    await client.query("UPDATE users SET name='Conta excluída',status='excluido' WHERE id=$1", [userId]);
    await client.query("UPDATE task_versions SET changed_by=NULL WHERE changed_by=$1", [userId]);
    await client.query("UPDATE task_occurrences SET assigned_user_id=NULL WHERE assigned_user_id=$1", [userId]);
    await client.query("UPDATE task_occurrences SET completed_by_user_id=NULL WHERE completed_by_user_id=$1", [userId]);
    await client.query("UPDATE invitations SET inviter_user_id=NULL WHERE inviter_user_id=$1", [userId]);
    await client.query("UPDATE accounts SET email=$2,password_hash=$3,email_verified_at=NULL WHERE id=$1", [identity.rows[0]!.account_id, anonymizedEmail, token()]);
    await client.query("UPDATE access_grants SET email=$2 WHERE id=(SELECT access_id FROM users WHERE id=$1)", [userId, anonymizedEmail]);
    await client.query("DELETE FROM user_sessions WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM email_tokens WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM user_preferences WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM push_subscriptions WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM reminder_deliveries WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM review_reminder_deliveries WHERE user_id=$1", [userId]);
    return "deleted";
  });
  if (deleted === false) return bad(reply, 409, "sole_owner", "Transfira a responsabilidade da casa antes de excluir a conta.");
  if (deleted === "shared_admin") return bad(reply, 409, "shared_admin", "Esta identidade também é administradora. Remova primeiro o acesso administrativo para excluir a conta completa.");
  reply.clearCookie("cdb_resident", { path: "/", secure: secureCookie, sameSite: "lax" });
  return { ok: true };
});

app.delete("/api/households/:id", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  if (membership.role !== "responsavel") return bad(reply, 403, "forbidden", "Somente um responsável pode excluir a casa.");
  await pool.query("DELETE FROM households WHERE id=$1", [householdId]);
  return { ok: true };
});

app.delete("/api/households/:id/members/me", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  const result = await withTransaction(async (client) => {
    const owners = await client.query("SELECT count(*) FROM memberships WHERE household_id=$1 AND role='responsavel'", [householdId]);
    if (membership.role === "responsavel" && Number(owners.rows[0]!.count) < 2) return false;
    await removeMemberFromHouseState(client, householdId, request.resident!.id);
    await client.query("DELETE FROM memberships WHERE household_id=$1 AND user_id=$2", [householdId, request.resident!.id]);
    return true;
  });
  if (!result) return bad(reply, 409, "sole_owner", "Transfira a responsabilidade para sair desta casa.");
  return { session: await sessionPayload(request.resident!.id) };
});

app.delete("/api/households/:id/members/:userId", { preHandler: residentSession }, async (request, reply) => {
  const { id: householdId, userId } = request.params as { id: string; userId: string };
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  if (membership.role !== "responsavel" || request.resident!.id === userId) return bad(reply, 403, "forbidden", "Somente um responsável pode remover outro morador.");
  const result = await withTransaction(async (client) => {
    const target = await client.query("SELECT role FROM memberships WHERE household_id=$1 AND user_id=$2 FOR UPDATE", [householdId, userId]);
    if (!target.rowCount) return null;
    if (target.rows[0]!.role === "responsavel") {
      const owners = await client.query("SELECT count(*) FROM memberships WHERE household_id=$1 AND role='responsavel'", [householdId]);
      if (Number(owners.rows[0]!.count) < 2) return false;
    }
    await removeMemberFromHouseState(client, householdId, userId);
    await client.query("DELETE FROM memberships WHERE household_id=$1 AND user_id=$2", [householdId, userId]);
    return true;
  });
  if (result === null) return bad(reply, 404, "not_found", "Morador não encontrado.");
  if (!result) return bad(reply, 409, "sole_owner", "Transfira a responsabilidade antes de remover esta pessoa.");
  return { ok: true };
});

app.patch("/api/households/:id/members/:userId", { preHandler: residentSession }, async (request, reply) => {
  const { id: householdId, userId } = request.params as { id: string; userId: string };
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  if (membership.role !== "responsavel") return bad(reply, 403, "forbidden", "Somente um responsável pode transferir a responsabilidade.");
  const result = await withTransaction(async (client) => {
    const target = await client.query("SELECT 1 FROM memberships WHERE household_id=$1 AND user_id=$2 FOR UPDATE", [householdId, userId]);
    if (!target.rowCount) return false;
    await client.query("UPDATE memberships SET role='morador' WHERE household_id=$1 AND user_id=$2", [householdId, request.resident!.id]);
    await client.query("UPDATE memberships SET role='responsavel' WHERE household_id=$1 AND user_id=$2", [householdId, userId]);
    return true;
  });
  if (!result) return bad(reply, 404, "not_found", "Morador não encontrado.");
  return { session: await sessionPayload(request.resident!.id) };
});

app.post("/api/households", { preHandler: residentSession }, async (request, reply) => {
  const body = bodyOf(request);
  const name = text(body, "name").trim();
  const timezone = text(body, "timezone") || "America/Fortaleza";
  if (name.length < 2 || name.length > 80) return bad(reply, 422, "validation", "O nome da casa deve ter de 2 a 80 caracteres.");
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }); } catch { return bad(reply, 422, "validation", "Fuso horário inválido."); }
  const user = request.resident!;
  const permission = await pool.query("SELECT source FROM users WHERE id=$1", [user.id]);
  if (!permission.rowCount || !["lista", "convite_admin", "publico"].includes(permission.rows[0]!.source as string)) return bad(reply, 403, "forbidden", "Esta conta não pode criar uma casa.");
  const householdId = id("house");
  await withTransaction(async (client) => {
    await client.query("INSERT INTO households(id,name,timezone,created_by_user_id) VALUES($1,$2,$3,$4)", [householdId, name, timezone, user.id]);
    await client.query("INSERT INTO memberships(user_id,household_id,role) VALUES($1,$2,'responsavel')", [user.id, householdId]);
    await client.query("INSERT INTO household_state(household_id) VALUES($1)", [householdId]);
    await client.query("INSERT INTO activity_events(id,event_type,user_id,household_id) VALUES($1,'entrada_casa',$2,$3)", [id("event"), user.id, householdId]);
  });
  return { session: await sessionPayload(user.id) };
});

app.get("/api/households/:id/state", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  if (!(await requireHousehold(request, reply, householdId))) return;
  const result = await pool.query(
    `SELECT s.version,s.data,h.name AS household_name,h.first_value_at,
      (SELECT last_reviewed_at FROM memberships WHERE household_id=h.id AND user_id=$2) AS last_reviewed_at,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',a.email,'role',m.role))
        FROM memberships m JOIN users u ON u.id=m.user_id JOIN accounts a ON a.id=u.account_id WHERE m.household_id=h.id),'[]'::jsonb) AS members,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'email',g.email))
        FROM invitations i JOIN access_grants g ON g.id=i.access_id
        WHERE i.household_id=h.id AND i.status='pendente' AND i.expires_at>now()),'[]'::jsonb) AS invites
     FROM households h JOIN household_state s ON s.household_id=h.id WHERE h.id=$1`,
    [householdId, request.resident!.id],
  );
  if (!result.rowCount) return bad(reply, 404, "not_found", "Casa não encontrada.");
  const row = result.rows[0]!;
  return { version: row.version, name: row.household_name, data: { ...(row.data as object), members: row.members, invites: row.invites, firstValueAt: row.first_value_at ? new Date(row.first_value_at).toISOString() : undefined, lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : undefined } };
});

app.get("/api/households/:id/tasks/:taskId/history", { preHandler: residentSession }, async (request, reply) => {
  const { id: householdId, taskId } = request.params as { id: string; taskId: string };
  if (!(await requireHousehold(request, reply, householdId))) return;
  const [entries, members] = await Promise.all([
    pool.query(
      `WITH occ AS (
        SELECT 'occurrence' AS kind, o.occurred_at, o.outcome, o.assigned_user_id, o.completed_by_user_id,
          NULL::text AS scope, NULL::text AS changed_by, NULL::text AS event_type, NULL::text AS note
        FROM task_occurrences o WHERE o.household_id=$1 AND o.task_id=$2
        ORDER BY o.occurred_at DESC LIMIT 50
      ), ver AS (
        SELECT 'version' AS kind, v.created_at AS occurred_at, NULL::text AS outcome, NULL::text AS assigned_user_id, NULL::text AS completed_by_user_id,
          v.scope, v.changed_by, e.event_type, v.snapshot->>'renegotiationNote' AS note
        FROM task_versions v LEFT JOIN activity_events e ON e.id = v.event_id
        WHERE v.household_id=$1 AND v.task_id=$2
        ORDER BY v.created_at DESC LIMIT 50
      )
      SELECT * FROM occ UNION ALL SELECT * FROM ver ORDER BY occurred_at DESC LIMIT 50`,
      [householdId, taskId],
    ),
    pool.query("SELECT u.id,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.household_id=$1", [householdId]),
  ]);
  return {
    entries: entries.rows.map((row) => ({
      kind: row.kind as "occurrence" | "version",
      occurredAt: new Date(row.occurred_at).toISOString(),
      outcome: row.outcome as "concluida" | "pulada" | null,
      assignedUserId: row.assigned_user_id as string | null,
      completedByUserId: row.completed_by_user_id as string | null,
      scope: row.scope as "occurrence" | "series" | null,
      changedBy: row.changed_by as string | null,
      eventType: row.event_type as string | null,
      note: row.note as string | null,
    })),
    members: members.rows.map((row) => ({ id: row.id as string, name: row.name as string })),
  };
});

const feltHeavyValues = ["nao", "pouco", "bastante"];
const feltNoticedValues = ["sim", "nao_muito", "nao"];
app.post("/api/households/:id/review", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  if (!(await requireHousehold(request, reply, householdId))) return;
  const body = bodyOf(request);
  const feltHeavy = text(body, "feltHeavy");
  const feltNoticed = text(body, "feltNoticed");
  if (!feltHeavyValues.includes(feltHeavy) || !feltNoticedValues.includes(feltNoticed)) return bad(reply, 422, "validation", "Resposta inválida.");
  await withTransaction(async (client) => {
    await client.query(
      "INSERT INTO weekly_reviews(id,household_id,user_id,felt_heavy,felt_noticed) VALUES($1,$2,$3,$4,$5)",
      [id("review"), householdId, request.resident!.id, feltHeavy, feltNoticed],
    );
    await client.query("UPDATE memberships SET last_reviewed_at=now() WHERE user_id=$1 AND household_id=$2", [request.resident!.id, householdId]);
  });
  return reply.code(204).send();
});

app.get("/api/households/:id/reviews/mine", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  if (!(await requireHousehold(request, reply, householdId))) return;
  const result = await pool.query(
    "SELECT felt_heavy,felt_noticed,reviewed_at FROM weekly_reviews WHERE household_id=$1 AND user_id=$2 ORDER BY reviewed_at DESC LIMIT 20",
    [householdId, request.resident!.id],
  );
  return result.rows.map((row) => ({ feltHeavy: row.felt_heavy, feltNoticed: row.felt_noticed, reviewedAt: new Date(row.reviewed_at).toISOString() }));
});

app.put("/api/households/:id/state", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  if (!(await requireHousehold(request, reply, householdId))) return;
  const body = bodyOf(request);
  const version = Number(body.version);
  const data = houseState(body.data);
  const events = body.events === undefined ? [] : body.events;
  if (!Number.isInteger(version) || version < 1 || !data || !Array.isArray(events) || events.length > 500 || events.some((event) => {
    if (!event || typeof event !== "object") return true;
    const item = event as Body;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 100) return true;
    if (item.type === "item_compra_adicionado") return typeof item.itemId !== "string" || !item.itemId.trim() || item.itemId.length > 100;
    const validDate = item.occurrenceDate === undefined || typeof item.occurrenceDate === "string" && datePattern.test(item.occurrenceDate);
    const validScope = !["tarefa_editada", "tarefa_renegociada"].includes(String(item.type)) || ["occurrence", "series"].includes(String(item.scope));
    const validNote = item.note === undefined || typeof item.note === "string" && item.note.length <= 280;
    return typeof item.taskId !== "string" || !item.taskId.trim() || item.taskId.length > 100 || !isTaskEventType(item.type) || !validDate || !validScope || !validNote;
  })) {
    return bad(reply, 422, "validation", "Estado da casa inválido.");
  }
  const renegotiatedTasks: { taskId: string; title: string }[] = [];
  const result = await withTransaction(async (client) => {
    const current = await client.query("SELECT version,data FROM household_state WHERE household_id=$1 FOR UPDATE", [householdId]);
    if (!current.rowCount) return { conflict: undefined };
    if (Number(current.rows[0]!.version) !== version) return { conflict: current.rows[0] };
    const oldData = current.rows[0]!.data as { tasks?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> };
    const oldTasks = new Set((oldData.tasks ?? []).map((task) => String(task.id)));
    const oldItems = new Set((oldData.items ?? []).map((item) => String(item.id)));
    const oldTaskById = new Map((oldData.tasks ?? []).map((task) => [String(task.id), task]));
    const taskById = new Map(data.tasks.map((task) => [task.id, task]));
    const taskEvents = (events as Body[]).filter((event) => event.type !== "item_compra_adicionado");
    if (taskById.size !== data.tasks.length || taskEvents.some((event) => !taskById.has(String(event.taskId)))) return { invalid: true };
    const foreignTask = await client.query("SELECT 1 FROM task_metadata WHERE id=ANY($1::text[]) AND household_id<>$2 LIMIT 1", [[...taskById.keys()], householdId]);
    if (foreignTask.rowCount) return { invalid: true };
    const activeMembers = await client.query("SELECT user_id FROM memberships WHERE household_id=$1", [householdId]);
    const memberIds = new Set(activeMembers.rows.map((row) => row.user_id as string));
    const referencesKnownMembers = (task: Body | Record<string, unknown>) => {
      const value = task as Body;
      const assigned = typeof value.assigneeId === "string" ? [value.assigneeId] : [];
      const rotation = Array.isArray(value.rotation) ? value.rotation as unknown[] : [];
      return [...assigned, ...rotation].every((member) => typeof member === "string" && memberIds.has(member));
    };
    if (data.tasks.some((task) => !referencesKnownMembers(task) || task.seriesBase !== undefined && !referencesKnownMembers(task.seriesBase as Body))) return { invalid: true };
    const updated = await client.query(
      `UPDATE household_state SET data=jsonb_build_object('tasks',$2::jsonb,'items',$3::jsonb),version=version+1,updated_at=now()
       WHERE household_id=$1 RETURNING version`,
      [householdId, JSON.stringify(data.tasks), JSON.stringify(data.items)],
    );
    const eventTypes = new Map<string, string>();
    const createdEvents = new Set<string>();
    const trackedItemIds = new Set<string>();
    for (const event of events as Array<{ id: string; type: string; taskId?: string; itemId?: string; occurrenceDate?: string; scope?: "occurrence" | "series"; note?: string }>) {
      if (event.type === "item_compra_adicionado") {
        trackedItemIds.add(event.itemId!);
        const saved = await client.query(
          "INSERT INTO activity_events(id,event_type,user_id,household_id) VALUES($1,'item_compra_adicionado',$2,$3) ON CONFLICT(id) DO NOTHING",
          [event.id, request.resident!.id, householdId],
        );
        if (saved.rowCount) await client.query("UPDATE households SET first_value_at=now(),first_value_type='compra' WHERE id=$1 AND first_value_at IS NULL", [householdId]);
        continue;
      }
      const taskId = event.taskId!;
      eventTypes.set(taskId, event.type);
      if (event.type === "tarefa_criada") createdEvents.add(taskId);
      const saved = await client.query(
        "INSERT INTO activity_events(id,event_type,user_id,household_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
        [event.id, event.type, request.resident!.id, householdId],
      );
      if (event.type === "tarefa_criada" && saved.rowCount) await client.query("UPDATE households SET first_value_at=now(),first_value_type='tarefa' WHERE id=$1 AND first_value_at IS NULL", [householdId]);
      const prior = oldTaskById.get(taskId);
      const occurrenceDate = event.occurrenceDate ?? (typeof prior?.dueDate === "string" ? prior.dueDate : null);
      if (event.type === "tarefa_concluida" || event.type === "tarefa_pulada") {
        const source = (prior ?? taskById.get(taskId)) as Record<string, unknown> | undefined;
        const rotation = Array.isArray(source?.rotation) ? source.rotation as string[] : [];
        const owner = source?.ownerMode === "rotation" && rotation.length
          ? rotation[Number(source.rotationIndex ?? 0) % rotation.length]
          : source?.ownerMode === "fixed" ? source.assigneeId : undefined;
        await client.query(
          `INSERT INTO task_occurrences(id,event_id,household_id,task_id,occurrence_key,scheduled_for,outcome,assigned_user_id,completed_by_user_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT(household_id,task_id,occurrence_key) DO NOTHING`,
          [id("occurrence"), event.id, householdId, taskId, occurrenceDate ?? "sem-data", occurrenceDate, event.type === "tarefa_concluida" ? "concluida" : "pulada", owner ?? null, request.resident!.id],
        );
      } else if (event.type === "tarefa_criada" || event.type === "tarefa_editada" || event.type === "tarefa_renegociada") {
        const snapshot = taskById.get(taskId) as Record<string, unknown> | undefined;
        const effectiveDate = occurrenceDate ?? (typeof snapshot?.dueDate === "string" ? snapshot.dueDate : null);
        const withNote = event.note ? { ...snapshot, renegotiationNote: event.note } : snapshot;
        const savedVersion = await client.query(
          "INSERT INTO task_versions(id,event_id,household_id,task_id,effective_from,scope,snapshot,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT(event_id) DO NOTHING",
          [id("task-version"), event.id, householdId, taskId, effectiveDate, event.type === "tarefa_criada" ? "series" : event.scope, JSON.stringify(withNote), request.resident!.id],
        );
        if (event.type === "tarefa_renegociada" && savedVersion.rowCount) renegotiatedTasks.push({ taskId, title: String(snapshot?.title ?? "Tarefa") });
      }
    }
    for (const task of data.tasks) {
      const taskId = String(task.id);
      const created = !oldTasks.has(taskId);
      if (created && !createdEvents.has(taskId)) {
        await client.query("INSERT INTO activity_events(id,event_type,user_id,household_id) VALUES($1,'tarefa_criada',$2,$3)", [id("event"), request.resident!.id, householdId]);
        await client.query("UPDATE households SET first_value_at=now(),first_value_type='tarefa' WHERE id=$1 AND first_value_at IS NULL", [householdId]);
      }
      const due = typeof task.dueDate === "string" ? `${task.dueDate}T12:00:00Z` : null;
      const completed = eventTypes.get(taskId) === "tarefa_concluida" || task.completed === true ? new Date().toISOString() : null;
      const savedMeta = await client.query(
        `INSERT INTO task_metadata(id,household_id,created_at,due_at,completed_at,is_open) VALUES($1,$2,now(),$3,$4,$5)
         ON CONFLICT(id) DO UPDATE SET due_at=EXCLUDED.due_at,is_open=EXCLUDED.is_open,completed_at=COALESCE(task_metadata.completed_at,EXCLUDED.completed_at)
         WHERE task_metadata.household_id=EXCLUDED.household_id RETURNING id`,
        [taskId, householdId, due, completed, task.completed !== true && task.skipped !== true],
      );
      if (!savedMeta.rowCount) throw Object.assign(new Error("A tarefa não pertence a esta casa."), { statusCode: 422, appCode: "validation" });
    }
    for (const item of data.items) {
      if (!oldItems.has(item.id) && !trackedItemIds.has(item.id)) {
        await client.query("INSERT INTO activity_events(id,event_type,user_id,household_id) VALUES($1,'item_compra_adicionado',$2,$3)", [id("event"), request.resident!.id, householdId]);
        await client.query("UPDATE households SET first_value_at=now(),first_value_type='compra' WHERE id=$1 AND first_value_at IS NULL", [householdId]);
      }
    }
    const firstValue = await client.query("SELECT first_value_at FROM households WHERE id=$1", [householdId]);
    return { version: updated.rows[0]!.version, firstValueAt: firstValue.rows[0]!.first_value_at ? new Date(firstValue.rows[0]!.first_value_at as string).toISOString() : undefined };
  });
  if ("invalid" in result) return bad(reply, 422, "validation", "A tarefa informada não pertence a esta casa.");
  if ("conflict" in result && !result.conflict) return bad(reply, 404, "not_found", "Casa não encontrada.");
  if ("conflict" in result) return reply.code(409).send({ code: "conflict", message: "A lista mudou em outro dispositivo. Atualize para ver a versão compartilhada.", request_id: request.id, current: result.conflict });
  if (renegotiatedTasks.length) {
    const others = await pool.query("SELECT user_id FROM memberships WHERE household_id=$1 AND user_id<>$2", [householdId, request.resident!.id]);
    for (const task of renegotiatedTasks) {
      for (const member of others.rows) {
        sendPushToUser(member.user_id, {
          title: "Combinado ajustado",
          body: `${task.title} mudou — toque pra ver o que foi combinado.`,
          url: `/casa/tarefas/${task.taskId}`,
          tag: `cdb-renegotiation-${task.taskId}`,
        }).catch((error) => app.log.error({ err: error, task_id: task.taskId }, "renegotiation push failed"));
      }
    }
  }
  return result;
});

app.patch("/api/households/:id", { preHandler: residentSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  if (membership.role !== "responsavel") return bad(reply, 403, "forbidden", "Somente um responsável pode alterar os dados da casa.");
  const name = text(bodyOf(request), "name").trim();
  if (name.length < 2 || name.length > 80) return bad(reply, 422, "validation", "O nome da casa deve ter de 2 a 80 caracteres.");
  await pool.query("UPDATE households SET name=$2 WHERE id=$1", [householdId, name]);
  return { ok: true };
});

app.post("/api/households/:id/invitations", { preHandler: residentSession, config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  if (membership.role !== "responsavel") return bad(reply, 403, "forbidden", "Somente um responsável pode convidar moradores.");
  const email = normalizeEmail(text(bodyOf(request), "email"));
  if (!emailPattern.test(email)) return bad(reply, 422, "validation", "Informe um e-mail válido.");
  const invitationId = id("invite");
  const accessId = id("grant");
  const raw = token();
  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext(coalesce($2,'')))", [email, householdId]);
    const pending = await client.query(
      "SELECT 1 FROM invitations i JOIN access_grants g ON g.id=i.access_id WHERE i.household_id=$1 AND g.email=$2 AND i.status='pendente' AND i.expires_at>now()",
      [householdId, email],
    );
    if (pending.rowCount) throw Object.assign(new Error("Já existe um convite pendente para este e-mail."), { statusCode: 409, appCode: "invitation_pending" });
    await client.query("INSERT INTO access_grants(id,email,source) VALUES($1,$2,'convite_morador')", [accessId, email]);
    await client.query("INSERT INTO invitations(id,access_id,token_hash,household_id,inviter_user_id,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')", [invitationId, accessId, tokenHash(raw), householdId, request.resident!.id]);
    await sendToken(email, "Convite para uma casa no Chega de Briga", `${appOrigin}/criar-conta#convite=${encodeURIComponent(raw)}&email=${encodeURIComponent(email)}`, "em 7 dias", client);
  });
  return reply.code(201).send({ id: invitationId });
});

app.delete("/api/households/:id/invitations/:invitationId", { preHandler: residentSession }, async (request, reply) => {
  const { id: householdId, invitationId } = request.params as { id: string; invitationId: string };
  const membership = await requireHousehold(request, reply, householdId);
  if (!membership) return;
  if (membership.role !== "responsavel") return bad(reply, 403, "forbidden", "Somente um responsável pode revogar convites.");
  const result = await pool.query("UPDATE invitations SET status='revogado',revoked_at=now() WHERE id=$1 AND household_id=$2 AND status='pendente'", [invitationId, householdId]);
  if (!result.rowCount) return bad(reply, 404, "not_found", "Convite não encontrado.");
  return { ok: true };
});

app.get("/api/admin/users", { preHandler: adminSession }, async (request) => {
  const query = request.query as { search?: string; status?: string; page?: string; page_size?: string };
  const page = Math.max(1, Math.min(500, Number(query.page ?? 1) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(query.page_size ?? 10) || 10));
  const search = `%${String(query.search ?? "").trim().replace(/[\\%_]/g, "\\$&")}%`;
  const status = ["ativo", "suspenso", "excluido"].includes(query.status ?? "") ? query.status : null;
  const count = await pool.query(
    `SELECT count(*) FROM users u JOIN accounts a ON a.id=u.account_id
     WHERE ($1::text IS NULL OR u.status=$1) AND ($2='' OR u.name ILIKE $3 OR a.email ILIKE $3)`,
    [status, String(query.search ?? "").trim(), search],
  );
  const rows = await pool.query(
    `SELECT u.id,u.name,a.email,u.status,u.source,u.access_id,u.created_at,u.last_seen_at
     FROM users u JOIN accounts a ON a.id=u.account_id
     WHERE ($1::text IS NULL OR u.status=$1) AND ($2='' OR u.name ILIKE $3 OR a.email ILIKE $3)
     ORDER BY u.created_at DESC,u.id LIMIT $4 OFFSET $5`,
    [status, String(query.search ?? "").trim(), search, pageSize, (page - 1) * pageSize],
  );
  const total = Number(count.rows[0]!.count);
  return { items: rows.rows.map((row) => ({
    id: row.id, name: row.name, email: row.email, status: row.status,
    source: row.source, accessId: row.access_id,
    createdAt: new Date(row.created_at).toISOString(),
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : undefined,
  })), total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
});

app.get("/api/admin/users/:id", { preHandler: adminSession }, async (request, reply) => {
  const userId = (request.params as { id: string }).id;
  const userResult = await pool.query(
    `SELECT u.id,u.name,a.email,u.status,u.source,u.access_id,u.created_at,u.last_seen_at
     FROM users u JOIN accounts a ON a.id=u.account_id WHERE u.id=$1`,
    [userId],
  );
  if (!userResult.rowCount) return bad(reply, 404, "not_found", "Conta não encontrada.");
  const [memberships, activity, audits] = await Promise.all([
    pool.query(`SELECT m.user_id,m.household_id,m.role,m.joined_at FROM memberships m WHERE m.user_id=$1 ORDER BY m.joined_at`, [userId]),
    pool.query(`SELECT id,user_id,household_id,event_type,occurred_at FROM activity_events WHERE user_id=$1 ORDER BY occurred_at DESC LIMIT 100`, [userId]),
    pool.query(`SELECT id,action,target_id,occurred_at FROM admin_audit_events WHERE target_id=$1 ORDER BY occurred_at DESC LIMIT 100`, [userId]),
  ]);
  const row = userResult.rows[0]!;
  return {
    user: { id: row.id, name: row.name, email: row.email, status: row.status, source: row.source, accessId: row.access_id, createdAt: new Date(row.created_at).toISOString(), lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : undefined },
    memberships: memberships.rows.map((item) => ({ userId: item.user_id, householdId: item.household_id, role: item.role, joinedAt: new Date(item.joined_at).toISOString() })),
    activity: activity.rows.map((item) => ({ id: item.id, userId: item.user_id, householdId: item.household_id, type: item.event_type, at: new Date(item.occurred_at).toISOString() })),
    audit: audits.rows.map((item) => ({ id: item.id, action: item.action, targetId: item.target_id, at: new Date(item.occurred_at).toISOString() })),
  };
});

app.patch("/api/admin/users/:id", { preHandler: adminSession }, async (request, reply) => {
  const userId = (request.params as { id: string }).id;
  const body = bodyOf(request);
  const name = text(body, "name").trim();
  const email = normalizeEmail(text(body, "email"));
  if (name.length < 2 || name.length > 100 || !emailPattern.test(email)) return bad(reply, 422, "validation", "Confira nome e e-mail.");
  const verification = token();
  const result = await withTransaction(async (client) => {
    const target = await client.query(
      `SELECT u.account_id,u.access_id,a.email FROM users u JOIN accounts a ON a.id=u.account_id
       WHERE u.id=$1 FOR UPDATE OF u,a`,
      [userId],
    );
    if (!target.rowCount) return "missing";
    const accountId = target.rows[0]!.account_id as string;
    const currentEmail = target.rows[0]!.email as string;
    if (email !== currentEmail) {
      const sharedAdmin = await client.query("SELECT 1 FROM platform_admins WHERE account_id=$1", [accountId]);
      if (sharedAdmin.rowCount) return "shared_admin";
      const duplicate = await client.query("SELECT 1 FROM accounts WHERE lower(email)=lower($1) AND id<>$2", [email, accountId]);
      if (duplicate.rowCount) return "duplicate";
      await client.query("UPDATE accounts SET email=$2,email_verified_at=NULL WHERE id=$1", [accountId, email]);
      await client.query("UPDATE access_grants SET email=$2 WHERE id=$1", [target.rows[0]!.access_id, email]);
      await client.query("DELETE FROM email_tokens WHERE user_id=$1", [userId]);
      await client.query("DELETE FROM user_sessions WHERE user_id=$1", [userId]);
      await client.query(
        "INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'verification',now()+interval '24 hours')",
        [tokenHash(verification), userId],
      );
      await sendToken(email, "Confirme seu novo e-mail no Chega de Briga", `${appOrigin}/confirmar-email#token=${encodeURIComponent(verification)}`, "em 24 horas", client);
    }
    await client.query("UPDATE users SET name=$2 WHERE id=$1", [userId, name]);
    return "updated";
  });
  if (result === "missing") return bad(reply, 404, "not_found", "Conta não encontrada.");
  if (result === "shared_admin") return bad(reply, 409, "shared_admin", "Este e-mail também é usado no acesso administrativo e não pode ser alterado aqui.");
  if (result === "duplicate") return bad(reply, 409, "duplicate_email", "Este e-mail já pertence a outra conta.");
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [userId]);
  await audit(request.admin!.id, "user_updated", "user", userId, request.id);
  return { ok: true };
});

app.patch("/api/admin/users/:id/status", { preHandler: adminSession }, async (request, reply) => {
  const userId = (request.params as { id: string }).id;
  const status = text(bodyOf(request), "status");
  if (!["ativo", "suspenso"].includes(status)) return bad(reply, 422, "validation", "Estado inválido.");
  const result = await withTransaction(async (client) => {
    const owners = await client.query(
      `SELECT m.household_id FROM memberships m WHERE m.user_id=$1 AND m.role='responsavel'
       AND (SELECT count(*) FROM memberships x WHERE x.household_id=m.household_id AND x.role='responsavel')=1`,
      [userId],
    );
    if (status === "suspenso" && owners.rowCount) return false;
    const update = await client.query("UPDATE users SET status=$2 WHERE id=$1 RETURNING id", [userId, status]);
    if (!update.rowCount) return null;
    if (status === "suspenso") await client.query("DELETE FROM user_sessions WHERE user_id=$1", [userId]);
    return true;
  });
  if (result === null) return bad(reply, 404, "not_found", "Conta não encontrada.");
  if (!result) return bad(reply, 409, "sole_owner", "Transfira a responsabilidade da casa antes de suspender esta conta.");
  await audit(request.admin!.id, `user_${status}`, "user", userId, request.id);
  return { ok: true };
});

app.patch("/api/admin/households/:id/members/:userId", { preHandler: adminSession }, async (request, reply) => {
  const { id: householdId, userId } = request.params as { id: string; userId: string };
  const role = text(bodyOf(request), "role");
  if (!["responsavel", "morador"].includes(role)) return bad(reply, 422, "validation", "Papel inválido.");
  const result = await withTransaction(async (client) => {
    const member = await client.query("SELECT role FROM memberships WHERE user_id=$1 AND household_id=$2 FOR UPDATE", [userId, householdId]);
    if (!member.rowCount) return null;
    if (role === "morador" && member.rows[0]!.role === "responsavel") {
      const owners = await client.query("SELECT count(*) FROM memberships WHERE household_id=$1 AND role='responsavel'", [householdId]);
      if (Number(owners.rows[0]!.count) < 2) return false;
    }
    await client.query("UPDATE memberships SET role=$3 WHERE user_id=$1 AND household_id=$2", [userId, householdId, role]);
    return true;
  });
  if (result === null) return bad(reply, 404, "not_found", "Vínculo não encontrado.");
  if (!result) return bad(reply, 409, "sole_owner", "A casa precisa manter ao menos um responsável.");
  await audit(request.admin!.id, "membership_role_changed", "membership", `${householdId}:${userId}`, request.id);
  return { ok: true };
});

app.post("/api/admin/allow-entries", { preHandler: adminSession }, async (request, reply) => {
  const email = normalizeEmail(text(bodyOf(request), "email"));
  if (!emailPattern.test(email)) return bad(reply, 422, "validation", "Informe um e-mail válido.");
  await withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT 1 FROM allow_entries a JOIN access_grants g ON g.id=a.access_id WHERE g.email=$1 AND a.revoked_at IS NULL",
      [email],
    );
    if (existing.rowCount) throw Object.assign(new Error("Este e-mail já está autorizado."), { statusCode: 409, appCode: "duplicate_email" });
    const grantId = id("grant");
    await client.query("INSERT INTO access_grants(id,email,source) VALUES($1,$2,'lista')", [grantId, email]);
    await client.query("INSERT INTO allow_entries(id,access_id,created_by) VALUES($1,$2,$3)", [id("allow"), grantId, request.admin!.id]);
  });
  await audit(request.admin!.id, "allow_entry_created", "email", email, request.id);
  return reply.code(201).send({ ok: true });
});

app.delete("/api/admin/allow-entries/:id", { preHandler: adminSession }, async (request, reply) => {
  const entryId = (request.params as { id: string }).id;
  const result = await pool.query("UPDATE allow_entries SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL", [entryId]);
  if (!result.rowCount) return bad(reply, 404, "not_found", "Autorização não encontrada.");
  await audit(request.admin!.id, "allow_entry_revoked", "allow_entry", entryId, request.id);
  return { ok: true };
});

app.post("/api/admin/invitations", { preHandler: adminSession }, async (request, reply) => {
  const body = bodyOf(request);
  const email = normalizeEmail(text(body, "email"));
  const householdId = text(body, "householdId") || null;
  if (!emailPattern.test(email)) return bad(reply, 422, "validation", "Informe um e-mail válido.");
  if (householdId && !(await pool.query("SELECT 1 FROM households WHERE id=$1", [householdId])).rowCount) return bad(reply, 404, "not_found", "Casa não encontrada.");
  const invitationId = id("invite");
  const accessId = id("grant");
  const raw = token();
  const source = householdId ? "convite_morador" : "convite_admin";
  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext(coalesce($2,'')))", [email, householdId]);
    const duplicate = await client.query(
      `SELECT 1 FROM invitations i JOIN access_grants g ON g.id=i.access_id
       WHERE g.email=$1 AND i.household_id IS NOT DISTINCT FROM $2::text AND i.status='pendente' AND i.expires_at>now()`,
      [email, householdId],
    );
    if (duplicate.rowCount) throw Object.assign(new Error("Já existe um convite pendente para este e-mail e destino."), { statusCode: 409, appCode: "invitation_pending" });
    await client.query("INSERT INTO access_grants(id,email,source) VALUES($1,$2,$3)", [accessId, email, source]);
    await client.query("INSERT INTO invitations(id,access_id,token_hash,household_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')", [invitationId, accessId, tokenHash(raw), householdId]);
    await sendToken(email, "Convite para o Chega de Briga", `${appOrigin}/criar-conta#convite=${encodeURIComponent(raw)}&email=${encodeURIComponent(email)}`, "em 7 dias", client);
    await audit(request.admin!.id, "invitation_created", "invitation", invitationId, request.id, client);
  });
  return reply.code(201).send({ ok: true });
});

app.delete("/api/admin/invitations/:id", { preHandler: adminSession }, async (request, reply) => {
  const invitationId = (request.params as { id: string }).id;
  const result = await pool.query("UPDATE invitations SET status='revogado',revoked_at=now() WHERE id=$1 AND status='pendente'", [invitationId]);
  if (!result.rowCount) return bad(reply, 404, "not_found", "Convite pendente não encontrado.");
  await audit(request.admin!.id, "invitation_revoked", "invitation", invitationId, request.id);
  return { ok: true };
});

app.post("/api/admin/invitations/:id/resend", { preHandler: adminSession }, async (request, reply) => {
  const invitationId = (request.params as { id: string }).id;
  const raw = token();
  const email = await withTransaction(async (client) => {
    const invitation = await client.query(
      `SELECT g.email FROM invitations i JOIN access_grants g ON g.id=i.access_id
       WHERE i.id=$1 AND i.status IN ('pendente','expirado') FOR UPDATE`,
      [invitationId],
    );
    if (!invitation.rowCount) return null;
    const recipient = invitation.rows[0]!.email as string;
    await client.query(
      `UPDATE invitations SET status='pendente',token_hash=$2,created_at=now(),expires_at=now()+interval '7 days',accepted_at=NULL,revoked_at=NULL
       WHERE id=$1`,
      [invitationId, tokenHash(raw)],
    );
    await sendToken(recipient, "Seu convite para o Chega de Briga", `${appOrigin}/criar-conta#convite=${encodeURIComponent(raw)}&email=${encodeURIComponent(recipient)}`, "em 7 dias", client);
    await audit(request.admin!.id, "invitation_resent", "invitation", invitationId, request.id, client);
    return recipient;
  });
  if (!email) return bad(reply, 409, "invitation_not_resendable", "Este convite não pode ser reenviado.");
  return { ok: true };
});

app.get("/api/admin/households", { preHandler: adminSession }, async () => {
  const result = await pool.query("SELECT id,name,created_at FROM households ORDER BY created_at DESC,id");
  return result.rows.map((row) => ({ id: row.id, name: row.name, createdAt: new Date(row.created_at).toISOString() }));
});

app.get("/api/admin/households/:id", { preHandler: adminSession }, async (request, reply) => {
  const householdId = (request.params as { id: string }).id;
  const result = await pool.query("SELECT id,name,created_at FROM households WHERE id=$1", [householdId]);
  if (!result.rowCount) return bad(reply, 404, "not_found", "Casa não encontrada.");
  const [members, tasks, activity] = await Promise.all([
    pool.query(`SELECT m.user_id,m.household_id,m.role,m.joined_at,u.id,u.name,a.email,u.status,u.source,u.access_id,u.created_at,u.last_seen_at
      FROM memberships m JOIN users u ON u.id=m.user_id JOIN accounts a ON a.id=u.account_id
      WHERE m.household_id=$1 ORDER BY m.joined_at`, [householdId]),
    pool.query("SELECT id,household_id,created_at,due_at,completed_at,is_open FROM task_metadata WHERE household_id=$1 ORDER BY created_at DESC", [householdId]),
    pool.query("SELECT id,user_id,household_id,event_type,occurred_at FROM activity_events WHERE household_id=$1 ORDER BY occurred_at DESC LIMIT 100", [householdId]),
  ]);
  const household = result.rows[0]!;
  return {
    household: { id: household.id, name: household.name, createdAt: new Date(household.created_at).toISOString() },
    memberships: members.rows.map((row) => ({ userId: row.user_id, householdId: row.household_id, role: row.role, joinedAt: new Date(row.joined_at).toISOString() })),
    members: members.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, status: row.status, source: row.source, accessId: row.access_id, createdAt: new Date(row.created_at).toISOString(), lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : undefined })),
    tasks: tasks.rows.map((row) => ({ id: row.id, householdId: row.household_id, createdAt: new Date(row.created_at).toISOString(), dueAt: row.due_at ? new Date(row.due_at).toISOString() : new Date(row.created_at).toISOString(), completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined, isOpen: row.is_open as boolean })),
    activity: activity.rows.map((row) => ({ id: row.id, userId: row.user_id, householdId: row.household_id, type: row.event_type, at: new Date(row.occurred_at).toISOString() })),
  };
});

app.get("/api/admin/analytics", { preHandler: adminSession }, async (request) => {
  const query = request.query as { period?: string; source?: string; size?: string };
  const period = [7, 30, 90].includes(Number(query.period)) ? Number(query.period) as AnalyticsFilter["period"] : 30;
  const source = ["lista", "convite_admin", "convite_morador", "publico"].includes(query.source ?? "") ? query.source as AnalyticsFilter["source"] : "todos";
  const size = ["1", "2", "3+"].includes(query.size ?? "") ? query.size as AnalyticsFilter["size"] : "todos";
  const [users, households, memberships, allowlist, invitations, tasks, activity] = await Promise.all([
    pool.query("SELECT u.id,a.email,u.status,u.source,u.access_id,u.created_at FROM users u JOIN accounts a ON a.id=u.account_id"),
    pool.query("SELECT id,name,created_at,first_value_at FROM households"),
    pool.query("SELECT user_id,household_id,joined_at FROM memberships"),
    pool.query("SELECT a.id,g.email,g.created_at FROM allow_entries a JOIN access_grants g ON g.id=a.access_id"),
    pool.query("SELECT i.id,g.email,g.source,i.created_at FROM invitations i JOIN access_grants g ON g.id=i.access_id"),
    pool.query("SELECT id,household_id,created_at,due_at,completed_at,is_open FROM task_metadata"),
    pool.query("SELECT id,household_id,event_type,occurred_at FROM activity_events WHERE occurred_at>now()-interval '125 days'"),
  ]);
  const iso = (value: Date | string) => new Date(value).toISOString();
  const data: AnalyticsDataSet = {
    users: users.rows.map((row) => ({ id: row.id, email: row.email, status: row.status, source: row.source, accessId: row.access_id, createdAt: iso(row.created_at) })),
    households: households.rows.map((row) => ({ id: row.id, name: row.name, createdAt: iso(row.created_at), firstValueAt: row.first_value_at ? iso(row.first_value_at) : undefined })),
    memberships: memberships.rows.map((row) => ({ userId: row.user_id, householdId: row.household_id, joinedAt: iso(row.joined_at) })),
    allowlist: allowlist.rows.map((row) => ({ id: row.id, email: row.email, addedAt: iso(row.created_at) })),
    invitations: invitations.rows.map((row) => ({ id: row.id, email: row.email, source: row.source, createdAt: iso(row.created_at) })),
    tasks: tasks.rows.map((row) => ({ id: row.id, householdId: row.household_id, createdAt: iso(row.created_at), dueAt: iso(row.due_at ?? row.created_at), completedAt: row.completed_at ? iso(row.completed_at) : undefined, isOpen: row.is_open as boolean })),
    activity: activity.rows.map((row) => ({ id: row.id, householdId: row.household_id ?? undefined, type: row.event_type, at: iso(row.occurred_at) })),
  };
  return calculateAnalytics(data, { period, source, size });
});

app.get("/api/admin/access", { preHandler: adminSession }, async () => {
  const [allow, invites] = await Promise.all([
    pool.query(`SELECT a.id,g.email,g.created_at,a.revoked_at FROM allow_entries a JOIN access_grants g ON g.id=a.access_id ORDER BY g.created_at DESC`),
    pool.query(`SELECT i.id,g.email,g.source,i.household_id,i.inviter_user_id,
        CASE WHEN i.status='pendente' AND i.expires_at<=now() THEN 'expirado' ELSE i.status END AS status,
        i.created_at,i.expires_at,i.accepted_at
      FROM invitations i JOIN access_grants g ON g.id=i.access_id ORDER BY i.created_at DESC`),
  ]);
  return {
    allowlist: allow.rows.map((row) => ({ id: row.id, email: row.email, addedAt: new Date(row.created_at).toISOString(), revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : undefined })),
    invitations: invites.rows.map((row) => ({ id: row.id, email: row.email, source: row.source, householdId: row.household_id ?? undefined, inviterId: row.inviter_user_id ?? undefined, status: row.status, createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(), acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : undefined })),
  };
});

if (existsSync(path.join(webRoot, "index.html"))) {
  await app.register(fastifyStatic, { root: webRoot, prefix: "/", decorateReply: true });
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/")) return reply.sendFile("index.html");
    return bad(reply, 404, "not_found", "Rota não encontrada.");
  });
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
if (publicSignupEnabled) {
  await pool.query("INSERT INTO app_settings(key,value) VALUES('public_signup_launched_at',now()::text) ON CONFLICT(key) DO NOTHING");
}
await app.listen({ host, port });
app.log.info({ port }, "Chega de Briga API ready");

const cleanup = setInterval(() => {
  void Promise.all([
    pool.query("DELETE FROM user_sessions WHERE expires_at<now()"),
    pool.query("DELETE FROM admin_sessions WHERE expires_at<now()"),
    pool.query("DELETE FROM admin_login_challenges WHERE expires_at<now()"),
    pool.query("DELETE FROM email_tokens WHERE expires_at<now() OR used_at<now()-interval '1 day'"),
    pool.query("DELETE FROM activity_events WHERE occurred_at<now()-interval '90 days'"),
    pool.query("DELETE FROM public_landing_events WHERE occurred_at<now()-interval '90 days'"),
    pool.query("DELETE FROM admin_audit_events WHERE occurred_at<now()-interval '12 months'"),
    pool.query("DELETE FROM waitlist_contacts WHERE EXISTS (SELECT 1 FROM app_settings WHERE key='public_signup_launched_at' AND now()>=value::timestamptz+interval '90 days')"),
    pool.query("DELETE FROM mail_outbox WHERE attempts>=10 AND created_at<now()-interval '7 days'"),
  ]).catch((error) => app.log.error({ err: error }, "retention cleanup failed"));
}, 60 * 60 * 1000);
cleanup.unref();
const mailWorker = setInterval(() => { void deliverMail().catch((error) => app.log.error({ err: error }, "mail worker failed")); }, 10_000);
mailWorker.unref();
const reminderWorker = setInterval(() => { void deliverReminders().catch((error) => app.log.error({ err: error }, "reminder worker failed")); }, 60_000);
reminderWorker.unref();
const reviewReminderWorker = setInterval(() => { void deliverReviewReminders().catch((error) => app.log.error({ err: error }, "review reminder worker failed")); }, 60_000);
reviewReminderWorker.unref();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    clearInterval(cleanup);
    clearInterval(mailWorker);
    clearInterval(reminderWorker);
    clearInterval(reviewReminderWorker);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
