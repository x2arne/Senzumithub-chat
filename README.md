# Senzu Chat API (Vercel)

Backend chat untuk `Items:AddChat` di Project-senzu.

## Deploy
1. Upload folder ini ke GitHub (repo baru) -> Vercel -> Import Project.
2. Di Vercel: Storage -> Marketplace -> **Upstash Redis** -> sambungkan ke project
   (otomatis mengisi `KV_REST_API_URL` & `KV_REST_API_TOKEN`).
3. Settings -> Environment Variables:
   - `CHAT_SECRET`   = string acak panjang (wajib, buat tanda tangan token)
   - `OWNER_IDS`, `RESELLER_IDS`, `BANNED_IDS` = daftar Roblox UserId dipisah koma (opsional)
4. Redeploy. Tes: `https://NAMA.vercel.app/api/chat/session` (POST) harus balas `{token, expiresAt}`.

## Endpoint
- `POST /api/chat/session`            -> `{ token, expiresAt }`
- `GET  /api/chat/messages?room=...`  -> `{ messages }`   (header `Authorization: Bearer <token>`)
- `POST /api/chat/send`               -> `{ message }`    (header sama)

## Catatan keamanan
- Tier: Owner = UserId di `OWNER_IDS`, Reseller = UserId di `RESELLER_IDS`,
  Premium = key premium (`LRM_KeyTier`), Free = keyless / tanpa key.
- UserId & keyTier dikirim client, jadi bisa dipalsukan: badge cuma kosmetik, bukan keamanan.
- Batas: 280 byte/pesan, 1 pesan per 2 detik per user, 30 sesi/menit per IP.
