import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { equip, resolveLayers, frameAt, stepPosition, saveAppearance, loadAppearance, createLatestLoader, APPEARANCE_KEY } from '../src/world/avatar-runtime.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/world/${name}`, import.meta.url), 'utf8'));
const catalog = read('options-v3.json');
const registry = read('mini-assets.json').registry;
const memoryStore = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return { values, setItem: (k: string, v: string) => { values.set(k, v); }, getItem: (k: string) => values.get(k) ?? null };
};

test('v3 catalog: 94 options, required counts, white tee + jeans default', () => {
  const count = (key: string) => catalog.categories.find((c: { key: string }) => c.key === key).options.length;
  assert.equal(catalog.categories.reduce((n: number, c: { options: unknown[] }) => n + c.options.length, 0), 94);
  assert.equal(count('top'), 12); assert.equal(count('pants'), 12);
  assert.equal(count('shoes'), 8); assert.equal(count('necklace'), 8);
  assert.equal(catalog.defaultSelection.top, 'T01'); assert.equal(catalog.defaultSelection.pants, 'P01');
});

test('outfit hides separates; removing it or picking a separate brings them back', () => {
  const base = { ...catalog.defaultSelection, top: 'T07', pants: 'P04' };
  const dressed = equip(base, 'outfit', 'D01');
  const keys = resolveLayers(dressed, {}).missing;
  assert.ok(keys.includes('outfit/D01'));
  assert.ok(!keys.some(k => k.startsWith('top/') || k.startsWith('pants/')));
  const removed = equip(dressed, 'outfit', null);
  assert.equal(removed.top, 'T07'); assert.equal(removed.pants, 'P04');
  assert.ok(!resolveLayers(removed, {}).missing.some(k => k.includes('null')));
  const swapped = equip(dressed, 'top', 'T03');
  assert.equal(swapped.outfit, null); assert.equal(swapped.pants, 'P04');
});

test('missing art is explicit, not silently replaced by another look', () => {
  const r = resolveLayers({ ...catalog.defaultSelection, hairStyle: 'H04' }, registry);
  assert.equal(r.ready, false); assert.equal(r.layers.length, 0);
  assert.ok(r.missing.includes('hair-front/H04/C03'));
  assert.ok(r.missing.includes('top/T01'));
  assert.ok(Object.values(registry).every((e: any) => e.status === 'missing' && e.url === null));
});

test('collision stops movement; diagonal speed is normalized', () => {
  assert.equal(stepPosition({ x: 0, y: 0 }, { x: 1, y: 1 }, .05, 100, () => false).moving, false);
  const p = stepPosition({ x: 0, y: 0 }, { x: 1, y: 1 }, .05, 100);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 5) < 1e-8);
  assert.equal(frameAt(250, true), 2); assert.equal(frameAt(250, false), 0);
  assert.equal(frameAt(250, true, true), 0);
});

test('first load gives v3 defaults and never touches existing app saves', () => {
  const notes = JSON.stringify({ notes: [{ id: 'mind', en: 'It’s been on my mind.', ko: '계속 마음에 걸렸어.', context: '' }], session: null });
  const look = JSON.stringify({ outfit: 1, hair: 1, makeup: 0, background: 1 });
  const store = memoryStore({ 'persona-world-v1': notes, 'persona-world-look-v1': look });
  const selection = loadAppearance(store, catalog);
  assert.deepEqual(selection, catalog.defaultSelection);
  saveAppearance(store, selection);
  assert.equal(store.values.get('persona-world-v1'), notes);
  assert.equal(store.values.get('persona-world-look-v1'), look);
  assert.deepEqual(JSON.parse(store.values.get(APPEARANCE_KEY)!), { version: 3, selection });
});

test('saved choices restore; bad IDs and non-v3 saves fall back to defaults', () => {
  const store = memoryStore();
  saveAppearance(store, { ...catalog.defaultSelection, hairStyle: 'H04', top: 'T07', hat: 'A06', glasses: 'bad' });
  const restored = loadAppearance(store, catalog);
  assert.equal(restored.hairStyle, 'H04'); assert.equal(restored.top, 'T07'); assert.equal(restored.hat, 'A06');
  assert.equal(restored.glasses, null);
  store.setItem(APPEARANCE_KEY, JSON.stringify({ version: 2, selection: { top: 'T02' } }));
  assert.deepEqual(loadAppearance(store, catalog), catalog.defaultSelection);
  store.setItem(APPEARANCE_KEY, '{broken');
  assert.deepEqual(loadAppearance(store, catalog), catalog.defaultSelection);
});

test('an older slow load cannot overwrite a newer selection', async () => {
  const resolvers: Record<string, (v: string) => void> = {};
  const latest = createLatestLoader((name: string) => new Promise<string>(r => { resolvers[name] = r; }));
  const first = latest('T01'), second = latest('T07');
  resolvers.T07('T07'); resolvers.T01('T01');
  assert.equal(await first, null); assert.equal(await second, 'T07');
});
