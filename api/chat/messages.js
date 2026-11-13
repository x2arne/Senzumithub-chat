// GET /api/chat/messages?room=global  ->  { messages: [...] }  (lama -> baru)
const { redis, verifyToken, bearer, validRoom, json, RETURN_LAST } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  if (!verifyToken(bearer(req))) return json(res, 401, { error: "Invalid session" });

  const room = req.query.room || "global";
  if (!validRoom(room)) return json(res, 400, { error: "Invalid room" });

  try {
    const [list] = await redis([["LRANGE", "chat:" + room, 0, RETURN_LAST - 1]]);
    const messages = (list || []).map((x) => { try { return JSON.parse(x); } catch { return null; } })
      .filter(Boolean).reverse();
    json(res, 200, { messages });
  } catch (e) {
    json(res, 500, { error: "Server error" });
  }
};
