import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_SELECTION, STORAGE_KEY, validateSelection, resolveCharacter, readSelection, saveSelection, keyOf, EXTRAS } from '../src/presets/presets.ts';

const root = new URL('../public/persona-v9/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('catalog.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const pngSize = (file: URL) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const memoryStore = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return { values, setItem: (k: string, v: string) => { values.set(k, v); }, getItem: (k: string) => values.get(k) ?? null };
};

test('7 heads × 15 looks × 3 extras = 315 keys, each a real frame inside a real file', () => {
  assert.equal(catalog.heads.length, 7); assert.equal(catalog.looks.length, 15);
  let n = 0; const files = new Set<string>();
  for (const h of catalog.heads) for (const l of catalog.looks) for (const extra of EXTRAS) {
    const e = resolveCharacter({ head: h.id, look: l.id, extra }, manifest);
    const file = new URL(e.src, root);
    assert.ok(existsSync(file), e.src);
    const [w, ht] = pngSize(file);
    assert.deepEqual([w, ht], e.imageSize, `${e.src} size`);
    const [x, y, fw, fh] = e.sourceRect;
    assert.ok(x >= 0 && y >= 0 && x + fw <= w && y + fh <= ht && fw > 0 && fh > 0, `${keyOf({ head: h.id, look: l.id, extra })} rect`);
    assert.equal(e.head, h.id); assert.equal(e.look, l.id); assert.equal(e.extra, extra);
    files.add(e.src); n++;
  }
  assert.equal(n, 315); assert.equal(Object.keys(manifest.characters).length, 315); assert.equal(files.size, 105);
});

test('three frames of one atlas do not overlap (no blind thirds)', () => {
  for (const h of catalog.heads) for (const l of catalog.looks) {
    const r = EXTRAS.map(extra => manifest.characters[`${h.id}_${l.id}_${extra}`].sourceRect).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < 3; i++) assert.ok(r[i - 1][0] + r[i - 1][2] <= r[i][0], `${h.id}_${l.id} frames overlap`);
  }
});

test('thumbnails exist for every head and head×look', () => {
  for (const h of catalog.heads) {
    assert.ok(existsSync(new URL(`thumbs/${h.id}.webp`, root)));
    for (const l of catalog.looks) assert.ok(existsSync(new URL(`thumbs/${h.id}_${l.id}.webp`, root)));
  }
});

test('free extras are none/necklace/bag only; 26 locked items have no art and cannot be selected', () => {
  const free = catalog.extras.filter((e: any) => !e.locked).map((e: any) => e.id);
  assert.deepEqual(free, ['none', 'necklace', 'bag']);
  const locked = catalog.extras.filter((e: any) => e.locked);
  assert.equal(locked.length, 26);
  for (const e of locked) {
    assert.equal(e.artStatus, 'not-included');
    assert.equal(validateSelection({ ...DEFAULT_SELECTION, extra: e.id }, catalog).extra, 'none');
  }
  assert.throws(() => resolveCharacter({ head: 'H01', look: 'L01', extra: 'premium-B01' as any }, manifest));
});

test('default is H01/L01/none; saves only the v9 key and keeps old data', () => {
  const notes = JSON.stringify({ notes: [{ id: 'mind', en: 'x', ko: 'y', context: '' }], session: { turns: [], phrases: [] } });
  const store = memoryStore({ 'persona-world-v1': notes, 'persona-world-look-v1': '{"outfit":1,"hair":1}', 'persona-world:world:v1': '{"version":1,"lookId":"pink-cargo"}' });
  assert.deepEqual(readSelection(catalog, store), { head: 'H01', look: 'L01', extra: 'none' });
  saveSelection({ head: 'H05', look: 'L14', extra: 'bag' }, catalog, store);
  assert.deepEqual(readSelection(catalog, store), { head: 'H05', look: 'L14', extra: 'bag' });
  assert.equal(store.values.get('persona-world-v1'), notes);
  assert.equal(store.values.get('persona-world-look-v1'), '{"outfit":1,"hair":1}');
  assert.equal(store.values.get('persona-world:world:v1'), '{"version":1,"lookId":"pink-cargo"}');
  store.setItem(STORAGE_KEY, '{oops'); assert.deepEqual(readSelection(catalog, store), DEFAULT_SELECTION);
  store.setItem(STORAGE_KEY, JSON.stringify({ head: 'H99', look: 'L03', extra: 'premium-G01' }));
  assert.deepEqual(readSelection(catalog, store), { head: 'H01', look: 'L03', extra: 'none' });
});

test('removed outfits (L03, L11, L12, L13) are not offered; a saved removed outfit becomes L01', async () => {
  const { activeCatalog, RETIRED_LOOKS, validateSelection, readSelection } = await import('../src/presets/presets.ts');
  const { readFileSync } = await import('node:fs');
  const raw = JSON.parse(readFileSync(new URL('../public/persona-v9/catalog.json', import.meta.url), 'utf8'));
  const c = activeCatalog(raw);
  assert.deepEqual(c.looks.map((l: any) => l.id), ['L01', 'L02', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L14', 'L15']);
  assert.deepEqual([...RETIRED_LOOKS].sort(), ['L03', 'L11', 'L12', 'L13']);
  for (const id of RETIRED_LOOKS) assert.equal(validateSelection({ head: 'H04', look: id, extra: 'bag' }, c).look, 'L01');
  const mem = new Map([['persona-world-presets-v9', JSON.stringify({ head: 'H05', look: 'L12', extra: 'necklace' })]]);
  assert.deepEqual(readSelection(c, { getItem: k => mem.get(k) ?? null, setItem: () => {} }), { head: 'H05', look: 'L01', extra: 'necklace' }, 'head and extra kept');
});
