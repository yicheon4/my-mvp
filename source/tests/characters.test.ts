import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CHARACTER_IDS, buildConversationInput, responseErrors, schemaErrors } from '../characters/prompt.ts';
import type { CharacterData } from '../characters/prompt.ts';

const dir = new URL('../characters/', import.meta.url);
const read = (f: string) => readFileSync(new URL(f, dir), 'utf8');
const data: CharacterData = { common: read('common-system.txt'), prompts: JSON.parse(read('character-prompts.json')), profiles: JSON.parse(read('profiles.json')), schema: JSON.parse(read('response-schema.json')) };
const appSrc = readFileSync(new URL('../src/story-data.ts', import.meta.url), 'utf8');
const protoSrc = readFileSync(new URL('../src/Prototype.tsx', import.meta.url), 'utf8');

test('six character ids match the app people order and both data files', () => {
  const appIds = [...appSrc.matchAll(/\{id:'([a-z]+)',name:/g)].map(m => m[1]);
  assert.deepEqual(appIds, [...CHARACTER_IDS]);
  for (const id of CHARACTER_IDS) {
    assert.ok(data.prompts.characters[id], id);
    assert.equal(data.profiles.characters[id].appIndex, CHARACTER_IDS.indexOf(id));
    assert.equal(data.profiles.characters[id].age, data.prompts.characters[id].age);
  }
});

test('system input holds common rules, profile and style; no voice direction, no unrevealed material', () => {
  for (const id of CHARACTER_IDS) {
    const { system, messages } = buildConversationInput(data, { characterId: id });
    assert.ok(system.includes('STYLE WITHOUT SCRIPTING'));
    assert.ok(system.includes(data.prompts.characters[id].system_prompt));
    assert.ok(!system.includes(data.prompts.characters[id].voice_direction), 'voice_direction is future-only');
    assert.match(system, /learning_mode: light/);
    assert.match(system, /proficiency_target: B1/);
    assert.match(system, /Revealed facts: none\./);
    assert.deepEqual(messages, []);
    // nothing from the author-only layer of the setting book (hidden facts / story beats) is stored or sent
    for (const w of ['반려', '면접', '제안을 받았', '지원서', '폐기', '숨은 정보', '서사 진행']) assert.ok(!system.includes(w), `${id}: ${w}`);
  }
  const raw = read('profiles.json') + read('character-prompts.json');
  for (const w of ['숨은 정보', '반려당', '면접 제안', '지원서를 저장']) assert.ok(!raw.includes(w), w);
});

test('revealed facts and agreed memories are included only when the app passes them', () => {
  const { system } = buildConversationInput(data, { characterId: 'chloe', revealedFacts: ['FACT_X'], agreedMemories: ['MEM_Y'], learningMode: 'coach', level: 'A1-A2', turnsSinceLastHelp: 2 });
  assert.match(system, /- FACT_X/); assert.match(system, /- MEM_Y/);
  assert.match(system, /learning_mode: coach/); assert.match(system, /proficiency_target: A1-A2/); assert.match(system, /turns_since_last_help: 2/);
});

test('recent turns map to chat roles and are capped', () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'you' as const : 'friend' as const, text: 't' + i }));
  const { messages } = buildConversationInput(data, { characterId: 'oliver', recentTurns: turns });
  assert.equal(messages.length, 12);
  assert.deepEqual(messages.at(-1), { role: 'user', content: 't19' });
  assert.equal(messages[0].role, 'assistant');
});

test('no example lines, catchphrases or demo replies reach the model input', () => {
  const quoted = [...protoSrc.matchAll(/text:'([^']{12,})'/g), ...protoSrc.matchAll(/en:'([^']{12,})'/g), ...appSrc.matchAll(/'([A-Z][^']{20,}[.?!])'/g)].map(m => m[1]);
  assert.ok(quoted.length > 20, 'found demo/scene lines to check');
  for (const id of CHARACTER_IDS) {
    const { system } = buildConversationInput(data, { characterId: id });
    for (const q of quoted) assert.ok(!system.includes(q), `${id} leaks "${q}"`);
    assert.ok(!/catchphrase:|greeting:|example:|sample_lines|phrase_bank/i.test(JSON.stringify(data.prompts.characters[id])));
  }
  assert.ok(!/quote:'/.test(appSrc), 'profile catchphrase field removed');
});

test('response schema is strict and every object closes its properties', () => {
  const walk = (s: any): void => {
    if (s.type === 'object') { assert.equal(s.additionalProperties, false); assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort()); Object.values(s.properties).forEach(walk); }
    (s.anyOf ?? []).forEach(walk);
  };
  walk(data.schema);
  for (const id of CHARACTER_IDS) for (const g of data.prompts.characters[id].gestures) assert.ok(data.schema.properties.gesture.enum.includes(g), `${id} ${g}`);
});

test('response checks keep speech and study card apart', () => {
  const ok = { speech_text: 'placeholder line', emotion: 'neutral', gesture: 'small_nod', learning_card: null };
  assert.deepEqual(responseErrors(data.schema, ok), []);
  assert.ok(schemaErrors(data.schema, { ...ok, score: 3 }).length, 'no extra keys such as scores');
  assert.ok(schemaErrors(data.schema, { ...ok, emotion: 'angry' }).length);
  assert.ok(responseErrors(data.schema, { ...ok, speech_text: '*smiles* placeholder' }).length, 'no stage directions in speech');
  assert.ok(responseErrors(data.schema, { ...ok, speech_text: 'placeholder 설명' }).length, 'no Korean in speech');
  const card = { kind: 'correction', original: 'a', suggestion: 'b', explanation_ko: '설명', register_note_ko: '말투' };
  assert.ok(responseErrors(data.schema, { ...ok, learning_card: card }).length, 'light mode: no unrequested card');
  assert.deepEqual(responseErrors(data.schema, { ...ok, learning_card: card }, { learningMode: 'coach' }), []);
  assert.deepEqual(responseErrors(data.schema, { ...ok, learning_card: { ...card, kind: 'requested_help' } }, { helpRequested: true }), []);
});

test('no secret keys or model API calls in the client code', () => {
  const files = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter(f => /\.(ts|tsx)$/.test(String(f)));
  for (const f of files) {
    const src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    assert.ok(!/sk-ant-|api[_-]?key|anthropic|openai|x-api-key|from ['"][^'"]*characters\/prompt/i.test(src), String(f));
  }
});
