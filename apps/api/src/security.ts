import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHmac,
} from "node:crypto";

const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_BYTES = 64;

const derive = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 256 * 1024 * 1024,
    }, (error, value) => error ? reject(error) : resolve(value as Buffer));
  });

export const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase("en-US");
export const token = () => randomBytes(32).toString("base64url");
export const recoveryCodes = (count = 10) => Array.from({ length: count }, () => randomBytes(9).toString("hex").toUpperCase());
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const ADMIN_LOGIN_CHALLENGE_TTL_SECONDS = 5 * 60;
export const constantEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

function adminLoginChallengeKey() {
  return createHmac("sha256", encryptionKey()).update("cdb-admin-login-challenge:v1").digest();
}

export function createAdminLoginChallenge(adminId: string) {
  const payload = Buffer.from(JSON.stringify({
    adminId,
    expiresAt: Date.now() + ADMIN_LOGIN_CHALLENGE_TTL_SECONDS * 1000,
    nonce: randomBytes(16).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", adminLoginChallengeKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminLoginChallenge(value: string) {
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length) return null;
  const expected = createHmac("sha256", adminLoginChallengeKey()).update(payload).digest("base64url");
  if (!constantEqual(signature, expected)) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
    const { adminId, expiresAt, nonce } = claims as Record<string, unknown>;
    if (typeof adminId !== "string" || !adminId || adminId.length > 200 ||
      typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) ||
      expiresAt <= Date.now() || expiresAt > Date.now() + ADMIN_LOGIN_CHALLENGE_TTL_SECONDS * 1000 + 1000 ||
      typeof nonce !== "string" || nonce.length < 16) return null;
    return adminId;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, KEY_BYTES);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, nText, rText, pText, saltText, keyText] = stored.split("$");
  if (algorithm !== "scrypt" || !nText || !rText || !pText || !saltText || !keyText) return false;
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  const expected = Buffer.from(keyText, "base64url");
  const actual = await derive(password, Buffer.from(saltText, "base64url"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function createTotpSecret() {
  const input = randomBytes(20);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string) {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid TOTP secret");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpAt(secret: string, at: number) {
  const counter = Math.floor(at / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 15;
  const binary = ((digest[offset]! & 127) << 24) | ((digest[offset + 1]! & 255) << 16) | ((digest[offset + 2]! & 255) << 8) | (digest[offset + 3]! & 255);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, submitted: string, now = Date.now()) {
  if (!/^\d{6}$/.test(submitted)) return false;
  return [-30, 0, 30].some((offset) => constantEqual(totpAt(secret, Math.floor(now / 1000) + offset), submitted));
}

export function totpUri(secret: string, email: string) {
  const label = encodeURIComponent(`Chega de Briga:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Chega%20de%20Briga&algorithm=SHA1&digits=6&period=30`;
}

function encryptionKey() {
  const value = process.env.ENCRYPTION_KEY;
  if (!value) throw new Error("ENCRYPTION_KEY is not configured");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be a 32-byte base64 value");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
