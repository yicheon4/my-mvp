// Appended after sophie-chat-core.mjs (with PROMPTS inlined) to form the Vercel function api/ai.mjs (POST /api/ai).
// Env vars (Vercel → Settings → Environment Variables, Production): GEMINI_API_KEY, GEMINI_MODEL, SOPHIE_INVITE_CODE,
// optional SOPHIE_DAILY_LIMIT. Logs (Vercel → Logs) start with [ai] and never contain the key, invite code or chat text.
let handle;
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }
  handle ??= createSophieHandler({ env: { ...process.env, hosted: true }, prompts: PROMPTS, log: (...a) => console.log('[ai]', ...a) });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const out = await handle({ body, headers: req.headers });
  res.status(out.status).json(out.json);
}
