import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createSophieHandler, validateOutput, trimTurns, buildContents, buildSystem, createLimiter } from '../server/sophie-chat-core.mjs';
import { loadSophiePrompts } from '../server/sophie-prompts.mjs';

const prompts = loadSophiePrompts(new URL('../characters/', import.meta.url));
const KEY = 'test-key-1234567890';
const good = { speech_text: 'Oh, nice timing! I just got here. How was your day?', translation_ko: '오, 타이밍 좋다! 나 방금 왔어. 오늘 어땠어?', emotion: 'playful',
  suggested_replies: [{ en: 'It was busy.', ko: '바빴어.', intent: '근황 말하기' }, { en: 'Pretty good, thanks!', ko: '꽤 좋았어, 고마워!', intent: '가볍게 답하기' }, { en: 'Why are you here?', ko: '여기 웬일이야?', intent: '궁금함 묻기' }], learning_card: null };
const gemini = (obj: unknown, extra: Record<string, unknown> = {}) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(obj) }] } }], ...extra }) });
function setup(env: Record<string, unknown> = {}, respond: (req: any) => any = () => gemini(good)) {
  const calls: any[] = []; const logs: string[] = [];
  const handle = createSophieHandler({ env: { GEMINI_API_KEY: KEY, GEMINI_MODEL: 'test-model', ...env }, prompts, fetchImpl: (async (url: string, init: any) => { calls.push({ url, init, body: JSON.parse(init.body) }); return respond(init); }) as any, log: (...a: unknown[]) => logs.push(a.join(' ')) });
  return { handle, calls, logs };
}
let n = 0;
const body = (over: Record<string, unknown> = {}) => ({ character: 'sophie', place: 'living-room', sessionId: 'session-' + String(++n).padStart(4, '0'), timeOfDay: 'day', opening: false, turns: [{ role: 'sophie', text: 'Hey!' }, { role: 'you', text: 'Hi Sophie' }], ...over });

test('valid turn → Gemini request keeps roles, scene and schema; key only in header', async () => {
  const { handle, calls } = setup();
  const out = await handle({ body: body(), headers: {} });
  assert.equal(out.status, 200); assert.equal(out.json.ok, true); assert.equal(out.json.reply.suggested_replies.length, 3);
  const c = calls[0];
  assert.match(c.url, /models\/test-model:generateContent$/);
  assert.equal(c.init.headers['x-goog-api-key'], KEY);
  assert.ok(!c.url.includes(KEY) && !JSON.stringify(c.body).includes(KEY));
  assert.deepEqual(c.body.contents.map((x: any) => x.role), ['user', 'model', 'user']);
  assert.match(c.body.contents[0].parts[0].text, /Scene event, not player speech/);
  assert.equal(c.body.contents[2].parts[0].text, 'Hi Sophie', 'player text stays a user turn, never merged into system');
  const sys = c.body.systemInstruction.parts[0].text;
  assert.match(sys, /living room/); assert.match(sys, /does not live here/); assert.match(sys, /Sophie, 23/);
  assert.ok(!sys.includes('Hi Sophie'));
  assert.ok(!sys.includes(JSON.parse(readFileSync(new URL('../characters/character-prompts.json', import.meta.url), 'utf8')).characters.sophie.voice_direction));
  assert.equal(c.body.generationConfig.responseMimeType, 'application/json');
});

test('opening request sends only the scene event', async () => {
  const { handle, calls } = setup();
  const out = await handle({ body: body({ opening: true, turns: [] }), headers: {} });
  assert.equal(out.status, 200);
  assert.equal(calls[0].body.contents.length, 1);
});

test('server allows only Sophie in the living room, checks length and turn order', async () => {
  const { handle, calls } = setup();
  assert.equal((await handle({ body: body({ character: 'chloe' }), headers: {} })).status, 403);
  assert.equal((await handle({ body: body({ place: 'bar' }), headers: {} })).status, 403);
  assert.equal((await handle({ body: body({ turns: [{ role: 'you', text: 'x'.repeat(501) }] }), headers: {} })).json.error, 'too_long');
  assert.equal((await handle({ body: body({ turns: [{ role: 'sophie', text: 'hi' }] }), headers: {} })).status, 400);
  assert.equal((await handle({ body: null, headers: {} })).status, 400);
  assert.equal(calls.length, 0);
});

test('errors are told apart and never faked as a normal reply', async () => {
  const cases: [any, string][] = [
    [() => ({ ok: false, status: 429, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED' } }) }), 'quota'],
    [() => ({ ok: false, status: 400, json: async () => ({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }) }), 'auth'],
    [() => ({ ok: false, status: 403, json: async () => ({ error: { status: 'PERMISSION_DENIED' } }) }), 'auth'],
    [() => ({ ok: false, status: 404, json: async () => ({ error: { status: 'NOT_FOUND' } }) }), 'model_not_found'],
    [() => { throw new TypeError('fetch failed'); }, 'network'],
    [() => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }, 'timeout'],
    [() => ({ ok: true, status: 200, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }), 'blocked'],
    [() => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }) }), 'blocked'],
    [() => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{not json' }] } }] }) }), 'bad_output'],
    [() => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }] }) }), 'empty'],
    [() => gemini({ ...good, suggested_replies: good.suggested_replies.slice(0, 2) }), 'bad_output'],
    [() => gemini({ ...good, emotion: 'happy' }), 'bad_output'],
    [() => gemini({ ...good, speech_text: '안녕! Hi there.' }), 'bad_output'],
  ];
  for (const [respond, code] of cases) {
    const { handle, logs } = setup({}, respond);
    const out = await handle({ body: body(), headers: {} });
    assert.equal(out.json.ok, false, code); assert.equal(out.json.error, code);
    assert.ok(!JSON.stringify(out).includes(KEY) && !logs.join(' ').includes(KEY), 'key never in response or log');
  }
});

test('missing key/model and invite rules', async () => {
  assert.equal((await setup({ GEMINI_API_KEY: '' }).handle({ body: body(), headers: {} })).json.error, 'key_missing');
  assert.equal((await setup({ GEMINI_MODEL: '' }).handle({ body: body(), headers: {} })).json.error, 'model_missing');
  assert.equal((await setup({ hosted: true }).handle({ body: body(), headers: {} })).json.error, 'invite_not_configured', 'hosted previews must set an invite code');
  const inv = setup({ SOPHIE_INVITE_CODE: 'letmein' });
  assert.equal((await inv.handle({ body: body(), headers: { 'x-invite-code': 'nope' } })).status, 401);
  assert.equal((await inv.handle({ body: body(), headers: { 'x-invite-code': 'letmein' } })).status, 200);
});

test('per-session and per-instance limits', () => {
  let t = 1_000_000; const lim = createLimiter(3, () => t);
  assert.equal(lim('a'), null); assert.equal(lim('a'), 'too_fast');
  t += 2000; assert.equal(lim('a'), null); t += 2000; assert.equal(lim('b'), null);
  t += 2000; assert.equal(lim('c'), 'daily_limit');
});

test('history is trimmed to budget and starts on a player turn', () => {
  const turns = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'you' : 'sophie', text: 'x'.repeat(500) }));
  const t = trimTurns(turns);
  assert.ok(t.length <= 16 && t.at(-1).role === 'you' && t.reduce((a: number, b: any) => a + b.text.length, 0) <= 6000);
  assert.equal(buildContents(t, false)[0].role, 'user');
});

test('output validation: 1-3 sentences, Korean only in Korean fields, exactly 3 distinct suggestions', () => {
  assert.equal(validateOutput(good), null);
  assert.ok(validateOutput({ ...good, speech_text: 'That is wild. I would laugh. Then I would cry. Then I would go home.' }), 'four full sentences');
  assert.equal(validateOutput({ ...good, speech_text: 'Oh no! Haha! That is a classic work moment. Did you at least get a free coffee?' }), null, 'short exclamations are free');
  assert.ok(validateOutput({ ...good, speech_text: 'Oh! No! Wow! Haha! Okay. Sure.' }), 'too many exclamations');
  assert.ok(validateOutput({ ...good, suggested_replies: [good.suggested_replies[0], good.suggested_replies[0], good.suggested_replies[1]] }));
  assert.ok(validateOutput({ ...good, learning_card: { expression: 'x' } }));
  assert.equal(validateOutput({ ...good, learning_card: { expression: 'drop by', meaning_ko: '잠깐 들르다', usage_note: '친구 사이에 자연스러워요.' } }), null);
});

test('no key or Gemini call in the browser code; system text has no voice direction', () => {
  const files = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter(f => /\.(ts|tsx)$/.test(String(f)));
  for (const f of files) {
    const src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    assert.ok(!/generativelanguage|x-goog-api-key|VITE_GEMINI|env\.GEMINI|AIza[0-9A-Za-z_-]{20}/.test(src), String(f));
  }
  assert.ok(!buildSystem(prompts, { timeOfDay: 'night' }).includes('Adult feminine'));
});
