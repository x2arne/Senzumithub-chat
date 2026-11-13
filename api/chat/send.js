// POST /api/chat/send  body: { username, displayName, userId, message, room, replyToId, keyTier }
const { redis, verifyToken, bearer, tierOf, isBanned, clean, validRoom, json, parseBody, MAX_BYTES, KEEP, RETURN_LAST } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!verifyToken(bearer(req))) return json(res, 401, { error: "Invalid session" });

  const b = parseBody(req);
  const room = b.room || "global";
  if (!validRoom(room)) return json(res, 400, { error: "Invalid room" });

  const userId = Number(b.userId);
  if (!Number.isInteger(userId) || userId <= 0) return json(res, 400, { error: "Invalid userId" });
  if (isBanned(userId)) return json(res, 403, { error: "You are banned from chat" });

  const username = clean(b.username, 32);
  const message = clean(b.message);
  if (!username) return json(res, 400, { error: "Invalid username" });
  if (!message) return json(res, 400, { error: "Empty message" });
  if (Buffer.byteLength(message) > MAX_BYTES) return json(res, 400, { error: "Message too long (max " + MAX_BYTES + " bytes)" });

  try {
    // 1 pesan per 2 detik per user
    const [ok] = await redis([["SET", "rl:m:" + userId, "1", "NX", "EX", 2]]);
    if (ok !== "OK") return json(res, 429, { error: "Slow down" });

    const key = "chat:" + room;
    let replyTo = null;
    if (b.replyToId) {
      const [list] = await redis([["LRANGE", key, 0, RETURN_LAST - 1]]);
      for (const x of list || []) {
        try {
          const m = JSON.parse(x);
          if (m.id === String(b.replyToId)) { replyTo = { id: m.id, username: m.username, message: m.message.slice(0, 60) }; break; }
        } catch {}
      }
    }

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      username,
      displayName: clean(b.displayName, 32) || username,
      userId,
      message,
      tier: tierOf(userId, b.keyTier),
      replyTo,
      ts: Math.floor(Date.now() / 1000),
    };
    await redis([
      ["LPUSH", key, JSON.stringify(msg)],
      ["LTRIM", key, 0, KEEP - 1],
      ["EXPIRE", key, 60 * 60 * 24 * 7],
    ]);
    json(res, 200, { message: msg });
  } catch (e) {
    json(res, 500, { error: "Server error" });
  }
};
