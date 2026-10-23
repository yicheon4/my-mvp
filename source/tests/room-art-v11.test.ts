import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { placeFrame, waterIndex, playIndex, reverseIndex, v11Enabled } from '../src/world/room-art-v11.ts';

const dir = new URL('../public/dev-art/room-v11/', import.meta.url);
const have = existsSync(new URL('manifest.json', dir));
const m = have ? JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8')) : null;
const pngSize = (rel: string) => { const b = readFileSync(new URL(rel, dir)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('dev preview is off unless dev server AND ?roomart=v11', () => {
  assert.equal(v11Enabled(false, '?roomart=v11'), false);
  assert.equal(v11Enabled(true, ''), false);
  assert.equal(v11Enabled(true, '?roomart=v11'), true);
});

test('anchor math: sheet-absolute anchor lands on the world point, one uniform scale', () => {
  const f = { rect: [60, 6, 194, 284] as [number, number, number, number], anchor: [180, 225] as [number, number] };
  const p = placeFrame(f, [325, 590], .7);
  assert.ok(Math.abs(p.dx + (180 - 60) * .7 - 325) < 1e-9 && Math.abs(p.dy + (225 - 6) * .7 - 590) < 1e-9);
  assert.ok(Math.abs(p.dw / 194 - p.dh / 284) < 1e-12);
});

test('frame order: water lift → 1..3 loop → lower; loops and one-shots; reverse for getting up', () => {
  const water = { loop: 'pour' as const, fps: 6, pourRange: [1, 3] as [number, number], frames: Array(5).fill(null) };
  const seq = [0, 100, 200, 400, 600, 700, 2100].map(t => waterIndex(water as any, t, 2200));
  assert.deepEqual(seq, [0, 0, 1, 2, 3, 1, 4]);
  const once = { loop: false, fps: 6, frames: Array(3).fill(null) }, loop = { loop: true, fps: 2, frames: Array(2).fill(null) };
  assert.deepEqual([0, 200, 400, 900].map(t => playIndex(once as any, t)), [0, 1, 2, 2]);
  assert.deepEqual([0, 500, 1000].map(t => playIndex(loop as any, t)), [0, 1, 0]);
  assert.deepEqual([0, 200, 400].map(t => reverseIndex(once as any, t)), [2, 1, 0]);
});

test('v11 package: only the 11 kept outfits, 25 frames each inside 1600×2560 sheets', { skip: !have && 'dev-art not copied' }, () => {
  assert.deepEqual(Object.keys(m.looks).sort(), ['L01', 'L02', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L14', 'L15']);
  for (const id of ['L03', 'L11', 'L12', 'L13']) assert.ok(!m.looks[id], `${id} must stay removed`);
  for (const [id, lk] of Object.entries<any>(m.looks)) {
    assert.deepEqual(pngSize(lk.src), [1600, 2560], id);
    let n = 0;
    for (const a of Object.values<any>(lk.actions)) for (const f of a.frames) {
      const [x, y, w, h] = f.rect; assert.ok(x >= 0 && y >= 0 && x + w <= 1600 && y + h <= 2560, id);
      n++;
    }
    assert.equal(n, 25, id);
    assert.deepEqual(Object.fromEntries(Object.entries<any>(lk.actions).map(([k, a]) => [k, a.frames.length])), { sit_down: 3, sit_idle: 2, lie_down: 3, lie_idle: 2, water: 5, play_left: 4, play_right: 4, reach_up: 2 });
  }
});

test('v11 room and cat files', { skip: !have && 'dev-art not copied' }, () => {
  const r = m.room;
  for (const tod of ['day', 'night']) {
    assert.deepEqual(pngSize(r.background[tod]), [1536, 1024]);
    assert.deepEqual(pngSize(r.chair_in[tod].src), [1536, 1024]); assert.deepEqual(pngSize(r.chair_out[tod].src), [1536, 1024]);
    for (const f of r.window_open[tod].frames) assert.deepEqual(pngSize(f.src), [1536, 1024]);
  }
  assert.deepEqual(pngSize(m.cat.src), [640, 960]);
  const frames = Object.values<any>(m.cat.frames).flatMap(a => a.frames);
  assert.equal(frames.length, 24);
  assert.equal(m.cat.frames.walk_down.frames[0].rect[3], 78, 'first walk frame is 78px tall at displayScale 1');
});
