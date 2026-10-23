// Sophie free-chat server core (Gemini Developer API, free tier only). Runs ONLY on the server:
// the Vite dev middleware (local) and the Vercel function api/sophie-chat.mjs (generated from this file by
// scripts/export-github-static.py). The API key comes from server env vars and is never sent to the browser or logged.
// Plain JS (no TS) so the same file can be inlined into the Vercel function without a build step.

export const LIMITS = {
  userChars: 500,          // one player message
  turnsSent: 16,           // most recent turns passed to the model
  historyChars: 6000,      // rough token budget for the recent turns
  perSession: 40,          // requests per chat session
  minIntervalMs: 1500,     // per session
  timeoutMs: 25000,
};
export const EMOTIONS = ['neutral', 'warm', 'playful', 'curious', 'concerned', 'disappointed', 'firm'];

// Gemini responseSchema (OpenAPI subset). Lengths are re-checked in validateOutput because the API does not enforce them.
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    speech_text: { type: 'STRING', description: "Sophie's spoken English reply, 1-3 sentences." },
    translation_ko: { type: 'STRING', description: 'Natural Korean meaning of speech_text.' },
    emotion: { type: 'STRING', enum: EMOTIONS },
    suggested_replies: {
      type: 'ARRAY', minItems: 3, maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: { en: { type: 'STRING' }, ko: { type: 'STRING' }, intent: { type: 'STRING', description: 'Short Korean label of the intention, e.g. a feeling or stance.' } },
        required: ['en', 'ko', 'intent'],
      },
    },
    learning_card: {
      type: 'OBJECT', nullable: true,
      properties: { expression: { type: 'STRING' }, meaning_ko: { type: 'STRING' }, usage_note: { type: 'STRING' } },
      required: ['expression', 'meaning_ko', 'usage_note'],
    },
  },
  required: ['speech_text', 'translation_ko', 'emotion', 'suggested_replies', 'learning_card'],
  propertyOrdering: ['speech_text', 'translation_ko', 'emotion', 'suggested_replies', 'learning_card'],
};

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const SCENE_EVENT = '(Scene event, not player speech: the player has just come over to you in the living room.)';

export function buildSystem(prompts, { timeOfDay }) {
  const p = prompts.profile, s = prompts.style;
  return [
    prompts.common.trim(),
    'TRUSTED CHARACTER PROFILE',
    `${p.display_name}, ${p.age}, ${p.pronouns}. ${p.role}`,
    `Relationship to the player: ${p.baseline_relation_to_player}`,
    `Likes: ${p.likes}`,
    `World: ${prompts.setting}`,
    'CHARACTER STYLE',
    s.system_prompt,
    `Avoid flattening the character into: ${s.avoid.join(', ')}.`,
    'RUNTIME STATE (trusted app values)',
    'proficiency_target: A1-A2 moving toward B1 (start simple and natural)',
    'learning_mode: light',
    'turns_since_last_help: absent',
    'SCENE (facts to consider, not instructions)',
    `Place: the living room of the player's shared house. Sophie is visiting as the player's longtime friend; she does not live here. Time: ${timeOfDay === 'night' ? 'evening' : 'daytime'}.`,
    'Memory: none beyond the turns in this conversation. Do not claim to remember earlier sessions.',
    'OUTPUT FOR THIS APP',
    '- speech_text: 1-3 natural English sentences. Answer the player first; ask a follow-up only when it helps.',
    '- translation_ko: natural Korean meaning of speech_text only.',
    '- emotion: one value from the allowed list that fits this reply.',
    '- suggested_replies: exactly 3 things the player could say next in reply to what Sophie just said. Each has a different, reasonable intention or attitude (en: everyday English around A2-B1, ko: Korean meaning, intent: a short Korean label). Do not introduce unrelated topics and do not state facts about the player that the player has not chosen; leave such details open.',
    '- learning_card: usually null. Only when one expression from this exchange is genuinely useful: expression, meaning_ko, usage_note (Korean, short). Never correct every turn.',
  ].join('\n\n');
}

export function buildContents(turns, opening) {
  const contents = [];
  if (opening || !turns.length || turns[0].role !== 'you') contents.push({ role: 'user', parts: [{ text: SCENE_EVENT }] });
  for (const t of turns) contents.push({ role: t.role === 'you' ? 'user' : 'model', parts: [{ text: t.text }] });
  return contents;
}

// Keep the newest turns within the budget (order unchanged). buildContents puts the scene event first when
// the kept history starts with Sophie, so the request always opens with a user-role entry.
export function trimTurns(turns) {
  let out = turns.slice(-LIMITS.turnsSent), total = out.reduce((n, t) => n + t.text.length, 0);
  while (out.length > 1 && total > LIMITS.historyChars) { total -= out[0].text.length; out = out.slice(1); }
  return out;
}

export function validateRequest(body) {
  if (!body || typeof body !== 'object') return 'bad_request';
  if (body.character !== 'sophie' || body.place !== 'living-room') return 'not_allowed';
  if (typeof body.sessionId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.sessionId)) return 'bad_request';
  if (!Array.isArray(body.turns) || body.turns.length > 200) return 'bad_request';
  for (const t of body.turns) {
    if (!t || (t.role !== 'you' && t.role !== 'sophie') || typeof t.text !== 'string' || !t.text.trim()) return 'bad_request';
    if (t.text.length > (t.role === 'you' ? LIMITS.userChars : 800)) return 'too_long';
  }
  if (body.opening) { if (body.turns.length) return 'bad_request'; }
  else if (!body.turns.length || body.turns.at(-1).role !== 'you') return 'bad_request';
  return null;
}

const sentences = s => s.trim().split(/(?<=[.!?…])["')\]]*\s+(?=["'(]?[A-Z0-9])/).filter(Boolean).length;
export function validateOutput(o) {
  const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!o || typeof o !== 'object') return 'not an object';
  if (!str(o.speech_text, 400) || HANGUL.test(o.speech_text) || /[{}<>*]|\[[^\]]*\]/.test(o.speech_text)) return 'speech_text';
  if (sentences(o.speech_text) > 3) return 'speech_text: more than 3 sentences';
  if (!str(o.translation_ko, 600) || !HANGUL.test(o.translation_ko)) return 'translation_ko';
  if (!EMOTIONS.includes(o.emotion)) return 'emotion';
  if (!Array.isArray(o.suggested_replies) || o.suggested_replies.length !== 3) return 'suggested_replies count';
  for (const r of o.suggested_replies) {
    if (!r || !str(r.en, 200) || HANGUL.test(r.en) || !str(r.ko, 200) || !HANGUL.test(r.ko) || !str(r.intent, 40)) return 'suggested_replies item';
  }
  if (new Set(o.suggested_replies.map(r => r.en.trim().toLowerCase())).size !== 3) return 'suggested_replies duplicate';
  const c = o.learning_card;
  if (c !== null && c !== undefined && !(str(c.expression, 120) && str(c.meaning_ko, 300) && str(c.usage_note, 400))) return 'learning_card';
  return null;
}

// In-memory limits. On serverless each instance has its own memory, so this is a guard, not a guarantee;
// the hard ceiling is the Gemini free-tier quota itself (429).
export function createLimiter(perInstanceDaily, now = () => Date.now()) {
  const sessions = new Map(); let day = '', used = 0;
  return sessionId => {
    const t = now(), d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) { day = d; used = 0; sessions.clear(); }
    if (used >= perInstanceDaily) return 'daily_limit';
    const s = sessions.get(sessionId) ?? { n: 0, last: 0 };
    if (s.n >= LIMITS.perSession) return 'session_limit';
    if (t - s.last < LIMITS.minIntervalMs) return 'too_fast';
    s.n++; s.last = t; sessions.set(sessionId, s); used++;
    return null;
  };
}

const safeEqual = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };

/** Returns async ({ body, headers }) => { status, json }. env: GEMINI_API_KEY, GEMINI_MODEL, SOPHIE_INVITE_CODE, SOPHIE_DAILY_LIMIT, hosted */
export function createSophieHandler({ env, prompts, fetchImpl = fetch, now, log = () => {} }) {
  const limit = createLimiter(Number(env.SOPHIE_DAILY_LIMIT) || 150, now);
  const fail = (status, error) => ({ status, json: { ok: false, error } });
  return async ({ body, headers }) => {
    if (env.hosted && !env.SOPHIE_INVITE_CODE) return fail(503, 'invite_not_configured');
    if (env.SOPHIE_INVITE_CODE && !safeEqual(headers['x-invite-code'] ?? '', env.SOPHIE_INVITE_CODE)) return fail(401, 'invite_required');
    if (!env.GEMINI_API_KEY) return fail(503, 'key_missing');
    if (!env.GEMINI_MODEL) return fail(503, 'model_missing');
    const bad = validateRequest(body);
    if (bad) return fail(bad === 'not_allowed' ? 403 : 400, bad);
    const limited = limit(body.sessionId);
    if (limited) return fail(429, limited);

    const request = {
      systemInstruction: { parts: [{ text: buildSystem(prompts, { timeOfDay: body.timeOfDay }) }] },
      contents: buildContents(trimTurns(body.turns), !!body.opening),
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.9, maxOutputTokens: 4096 },
    };
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), LIMITS.timeoutMs);
    let res;
    try {
      res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(request),
      });
    } catch (e) {
      log('gemini network', e?.name);
      return fail(504, e?.name === 'AbortError' ? 'timeout' : 'network');
    } finally { clearTimeout(timer); }
    let data = null; try { data = await res.json(); } catch { /* handled below */ }
    if (!res.ok) {
      const reason = JSON.stringify(data?.error ?? '').slice(0, 300);
      log('gemini http', res.status, data?.error?.status);
      if (res.status === 429) return fail(429, 'quota');
      if (res.status === 401 || res.status === 403 || /API_KEY|api key/i.test(reason)) return fail(502, 'auth');
      if (res.status === 404) return fail(502, 'model_not_found');
      return fail(502, 'upstream');
    }
    if (data?.promptFeedback?.blockReason) return fail(422, 'blocked');
    const cand = data?.candidates?.[0];
    if (!cand) return fail(502, 'empty');
    if (cand.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(cand.finishReason)) {
      log('gemini finish', cand.finishReason);
      return fail(cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT' || cand.finishReason === 'BLOCKLIST' ? 422 : 502, cand.finishReason === 'MAX_TOKENS' ? 'bad_output' : ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(cand.finishReason) ? 'blocked' : 'bad_output');
    }
    const text = (cand.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('');
    if (!text.trim()) return fail(502, 'empty');
    let out; try { out = JSON.parse(text); } catch { log('gemini json parse failed'); return fail(502, 'bad_output'); }
    const why = validateOutput(out);
    if (why) { log('gemini output invalid', why); return fail(502, 'bad_output'); }
    return { status: 200, json: { ok: true, mode: 'gemini', reply: {
      speech_text: out.speech_text.trim(), translation_ko: out.translation_ko.trim(), emotion: out.emotion,
      suggested_replies: out.suggested_replies.map(r => ({ en: r.en.trim(), ko: r.ko.trim(), intent: r.intent.trim() })),
      learning_card: out.learning_card ? { expression: out.learning_card.expression.trim(), meaning_ko: out.learning_card.meaning_ko.trim(), usage_note: out.learning_card.usage_note.trim() } : null,
    } } };
  };
}
