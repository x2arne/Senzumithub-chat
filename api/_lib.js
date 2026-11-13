// Helper bersama (file berawalan "_" tidak jadi endpoint di Vercel)
const crypto = require("crypto");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.CHAT_SECRET || "";

const MAX_BYTES = 280;     // batas pesan (byte)
const KEEP = 100;          // pesan disimpan per room
const RETURN_LAST = 50;    // pesan dikirim ke client

// Jalankan beberapa perintah Redis sekaligus (Upstash REST pipeline)
async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Redis belum di-setup (KV_REST_API_URL / KV_REST_API_TOKEN)");
  const r = await fetch(REDIS_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

function hmac(body) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + hmac(body);
}
function verifyToken(token) {
  if (!SECRET || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}
function bearer(req) {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

function idSet(name) {
  return new Set((process.env[name] || "").split(",").map((s) => s.trim()).filter(Boolean));
}
// Owner hanya lewat OWNER_SECRET (userId mudah dipalsukan dari client).
// Reseller/Premium dari daftar ID = kosmetik saja.
function tierOf(userId, ownerSecret) {
  const os = process.env.OWNER_SECRET;
  if (os && typeof ownerSecret === "string") {
    const a = Buffer.from(ownerSecret), b = Buffer.from(os);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return "Owner";
  }
  const id = String(userId);
  if (idSet("RESELLER_IDS").has(id)) return "Reseller";
  if (idSet("PREMIUM_IDS").has(id)) return "Premium";
  return "Free";
}
function isBanned(userId) { return idSet("BANNED_IDS").has(String(userId)); }

function clean(s, maxLen) {
  s = String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return maxLen ? s.slice(0, maxLen) : s;
}
function validRoom(r) { return typeof r === "string" && /^[\w-]{1,40}$/.test(r); }
function ip(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}
function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
function parseBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === "object" ? b : {};
}

module.exports = { redis, signToken, verifyToken, bearer, tierOf, isBanned, clean, validRoom, ip, json, parseBody, MAX_BYTES, KEEP, RETURN_LAST };
