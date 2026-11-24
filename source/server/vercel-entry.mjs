// Appended after sophie-chat-core.mjs (with PROMPTS inlined) to form the Vercel function api/ai.mjs (POST /api/ai).
// Env vars (Vercel → Settings → Environment Variables, Production): GEMINI_API_KEY, GEMINI_MODEL, SOPHIE_INVITE_CODE,
// optional SOPHIE_DAILY_LIMIT. Logs (Vercel → Logs) start with [ai] and never contain the key, invite code or chat text.
// Declared limit for this function (Vercel docs: Node.js /api routes use an exported config object). One request spends at
// most LIMITS.timeoutMs (25s) on Gemini, retries included, so 60s leaves headroom and stays within every Hobby limit.
export const config = { maxDuration: 60 };
let handle;
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }
  handle ??= createSophieHandler({ env: { ...process.env, hosted: true }, prompts: PROMPTS, redIvy: RED_IVY, log: (...a) => console.log('[ai]', ...a) });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  // If the browser leaves or cancels, stop the Gemini call in flight and start no further retry.
  const gone = new AbortController();
  res.on('close', () => { if (!res.writableEnded) gone.abort(); });
  const out = await handle({ body, headers: req.headers, signal: gone.signal });
  if (gone.signal.aborted) return;
  res.status(out.status).json(out.json);
}
