import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { frameFor, miniPlacement, neighborLooks, resolveLook } from '../src/world/mini-v10.ts';

const root = new URL('../public/persona-mini-v10/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const v9 = JSON.parse(readFileSync(new URL('../public/persona-v9/catalog.json', import.meta.url), 'utf8'));
const pngSize = (file: URL) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('one mini sheet per v9 look (L01–L15), names match', () => {
  assert.deepEqual(Object.keys(manifest.looks).sort(), v9.looks.map((l: any) => l.id).sort());
  for (const l of v9.looks) assert.equal(manifest.looks[l.id].name, l.name);
});

test('240 frames: 4 directions × 4 frames per look, each rect inside its real PNG', () => {
  let n = 0;
  for (const [id, e] of Object.entries<any>(manifest.looks)) {
    const file = new URL(e.src, root);
    assert.ok(existsSync(file), id);
    assert.deepEqual(pngSize(file), e.imageSize, id);
    for (const d of ['down', 'left', 'right', 'up']) {
      assert.equal(e.frames[d].length, 4, `${id} ${d}`);
      for (const { rect: [x, y, w, h] } of e.frames[d]) {
        assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= e.imageSize[0] && y + h <= e.imageSize[1], `${id} ${d}`);
        n++;
      }
    }
  }
  assert.equal(n, 240);
});

test('idle uses frame 1 of the last direction; walking cycles at manifest fps; reduced motion stays idle', () => {
  assert.equal(manifest.idleFrame, 1); assert.equal(manifest.fps, 6);
  assert.equal(frameFor(manifest, 'L07', 'left', false, 999).index, 1);
  assert.deepEqual(frameFor(manifest, 'L07', 'left', false, 0).rect, manifest.looks.L07.frames.left[1].rect);
  const seq = [0, 170, 340, 510, 680].map(ms => frameFor(manifest, 'L07', 'up', true, ms).index);
  assert.deepEqual(seq, [0, 1, 2, 3, 0]);
  assert.equal(frameFor(manifest, 'L07', 'up', true, 400, true).index, 1);
  assert.equal(resolveLook('bad', manifest), 'L01');
});

test('feet anchored at (x, y) with one uniform scale', () => {
  const e = manifest.looks.L14, rect = e.frames.right[2].rect;
  const p = miniPlacement(e, rect, 500, 800, 210);
  assert.ok(Math.abs(p.dy + p.dh - 800) < 1e-9);
  assert.ok(Math.abs(p.dx + p.dw / 2 - 500) < 1e-9);
  assert.ok(Math.abs(p.dw / rect[2] - p.dh / rect[3]) < 1e-12);
});

test('only neighbors are pre-warmed, not all 15', () => {
  const n = neighborLooks('L01', manifest);
  assert.deepEqual(n.sort(), ['L02', 'L15']);
});
