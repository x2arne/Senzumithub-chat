// POST /api/chat/session  ->  { token, expiresAt }
const { redis, signToken, ip, json } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    // batas permintaan sesi per IP: 30 / menit
    const k = "rl:s:" + ip(req);
    const [count] = await redis([["INCR", k], ["EXPIRE", k, 60, "NX"]]);
    if (count > 30) return json(res, 429, { error: "Too many requests" });

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    json(res, 200, { token: signToken({ exp: expiresAt }), expiresAt });
  } catch (e) {
    json(res, 500, { error: "Server error" });
  }
};
