import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clipFrame, clipMs, placeV12, npcFrame, toRoomSpot, autoSpots, validPatrol, initNpcs, stepNpc, forgetNpcs, rememberNpc, canRideAt, rideStep, dismountSpot, nearBike } from '../src/world/social-v12.ts';
import type { V12Manifest, V12Locations, NpcRun } from '../src/world/social-v12.ts';
import { worldMaps } from '../src/world/world-data.ts';
import { canOccupy, nearestNpc, portalAt } from '../src/world/world-engine.ts';
import { stepRoom, initialRoom, ROOM_CONFIG } from '../src/world/room-actions.ts';

const dir = new URL('../public/persona-v12/', import.meta.url);
const m: V12Manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
const loc: V12Locations = JSON.parse(readFileSync(new URL('locations.json', dir), 'utf8'));
const pngSize = (rel: string) => { const b = readFileSync(new URL(rel, dir)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('v12 manifest: frame-local anchors, every rect inside its real PNG, active looks only', () => {
  assert.equal(m.anchorSpace, 'frame-local');
  assert.deepEqual(Object.keys(m.players).sort(), ['L01', 'L02', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L14', 'L15']);
  for (const e of [...Object.values(m.players), ...Object.values(m.npcs)]) {
    assert.deepEqual(pngSize(e.src), e.imageSize, e.src);
    for (const f of e.frames) {
      const [x, y, w, h] = f.rect;
      assert.ok(x >= 0 && y >= 0 && x + w <= e.imageSize[0] && y + h <= e.imageSize[1], e.src);
      assert.ok(f.anchor[0] >= 0 && f.anchor[0] <= w && f.anchor[1] >= 0 && f.anchor[1] <= h, 'anchor is inside its own frame');
    }
    for (const c of Object.values(e.clips)) for (const i of c.frames) assert.ok(e.frames[i], 'clip frame exists');
  }
  assert.equal(Object.keys(m.npcs).length, 6);
});

test('frame-local placement: anchor lands on the world point with one scale', () => {
  const p = placeV12({ rect: [500, 300, 100, 200], anchor: [50, 190] }, [700, 600], .8);
  assert.deepEqual(p, { dx: 700 - 40, dy: 600 - 152, dw: 80, dh: 160 });
});

test('clips: one-shot wave plays once and holds; loops repeat; reduced motion keeps the first frame', () => {
  const e = m.players.L01;
  assert.equal(clipMs(e, 'wave'), 1000);
  assert.equal(clipFrame(e, 'wave', 5000), e.frames[0]); // last frame of [0,1,2,3,2,3,1,0]
  assert.equal(clipFrame(e, 'wave', 130), e.frames[1]);
  assert.equal(clipFrame(e, 'wash', 0), e.frames[8]);
  assert.equal(clipFrame(e, 'wash', 340), e.frames[9]);
  assert.equal(clipFrame(e, 'wash', 680), e.frames[8]);
  assert.equal(clipFrame(e, 'wash', 340, true), e.frames[8]);
  assert.equal(clipFrame(e, 'nope', 0), null);
});

test('NPC frames: idle frame of the facing when still (no walking in place), walk only while moving', () => {
  const e = m.npcs.sophie;
  assert.equal(npcFrame(e, 'left', false, 900, null), e.frames[5]);
  assert.equal(npcFrame(e, 'up', true, 0, null), e.frames[12]);
  assert.equal(npcFrame(e, 'up', true, 180, null), e.frames[13]);
  assert.equal(npcFrame(e, 'right', true, 180, null, true), e.frames[9]);
  assert.equal(npcFrame(e, 'right', false, 0, 0), e.frames[16]); // wave is the front clip
});

test('every NPC def matches the map person and every kept patrol segment stays on clear floor', () => {
  for (const d of loc.npcs) {
    const map = worldMaps[d.map];
    assert.ok(map.npcs.some(n => n.person === d.person), d.id);
    const ok = (x: number, y: number) => canOccupy(map, x, y, []) && !portalAt(map, x, y);
    const kept = validPatrol(d.patrol, ok);
    assert.ok(kept.length >= 2, `${d.id} keeps a route`);
    for (let i = 0; i < kept.length; i++) {
      const a = kept[i], b = kept[(i + 1) % kept.length];
      for (let k = 0; k <= 20; k++) assert.ok(ok(a[0] + (b[0] - a[0]) * k / 20, a[1] + (b[1] - a[1]) * k / 20), `${d.id} segment ${i}`);
    }
  }
  // a point inside furniture is dropped
  const kitchen = worldMaps.kitchen, ok = (x: number, y: number) => canOccupy(kitchen, x, y, []);
  assert.deepEqual(validPatrol([[1050, 560], [700, 500], [1095, 560]], ok), [[1050, 560], [1095, 560]]);
});

test('NPC patrol: walks, stops when held, waits when blocked, and positions survive a remount', () => {
  forgetNpcs();
  const map = worldMaps['living-room'], ok = (x: number, y: number) => canOccupy(map, x, y, []);
  let [n] = initNpcs(map, loc, ok);
  assert.equal(n.id, 'sophie'); assert.equal(n.locked, false);
  n = { ...n, wait: 0, target: 1 };
  const held = stepNpc(n, 16, true, ok, () => 0);
  assert.equal(held.moving, false); assert.equal(held.x, n.x);
  let walked: NpcRun = n;
  for (let i = 0; i < 30; i++) walked = stepNpc(walked, 16, false, ok, () => 0);
  assert.ok(walked.x !== n.x || walked.y !== n.y);
  const blocked = stepNpc({ ...n, wait: 0 }, 16, false, () => false, () => 0);
  assert.equal(blocked.moving, false); assert.equal(blocked.x, n.x);
  rememberNpc('living-room', walked);
  const [back] = initNpcs(map, loc, ok);
  assert.equal(back.x, walked.x); assert.equal(back.y, walked.y);
  forgetNpcs();
});

test('runtime NPC positions drive collision and the talk target (no ghost at the old spot)', () => {
  const map = worldMaps['living-room'];
  const moved = [{ ...map.npcs[0], x: 805, y: 745 }];
  assert.equal(canOccupy(map, 760, 720, moved), true);
  assert.equal(canOccupy(map, 805, 745, moved), false);
  assert.equal(nearestNpc(map, 900, 760, moved)?.x, 805);
});

test('auto spots: approach is standable floor, render is only for drawing, dwell and facing from the package', () => {
  for (const id of ['living-room', 'kitchen', 'campus'] as const) for (const v of autoSpots(loc, id)) {
    assert.ok(canOccupy(worldMaps[id], v.approach[0], v.approach[1], []), v.id);
    const s = toRoomSpot(v);
    assert.deepEqual(s.at, v.approach); assert.equal(s.key, v.id); assert.equal(s.hold, true); assert.equal(s.dwellMs, v.dwellMs);
  }
  assert.deepEqual(autoSpots(loc, 'kitchen').map(v => v.id).sort(), ['island-stool', 'sink', 'stove']);
  assert.equal(autoSpots(loc, 'campus').some(v => v.id === 'bicycle'), false); // the bike is a button, not an auto spot
});

test('sink: 2 s facing stop starts washing; walking past or moving resets it', () => {
  const v = autoSpots(loc, 'kitchen').find(v => v.id === 'sink')!, spots = [toRoomSpot(v)];
  const step = (st: ReturnType<typeof initialRoom>, input: boolean, dir: 'up' | 'down' = 'up') => stepRoom(st, { x: v.approach[0], y: v.approach[1], dir, dt: 100, input, paused: false, spots, canStand: () => true, cfg: ROOM_CONFIG });
  let st = initialRoom(); let started = false;
  for (let i = 0; i < 19; i++) { const o = step(st, false); st = o.state; started ||= !!o.started; }
  assert.equal(started, false);
  st = step(st, true).state; assert.equal(st.dwell, 0); // a move resets the wait
  for (let i = 0; i < 21; i++) { const o = step(st, false); st = o.state; started ||= !!o.started; }
  assert.equal(started, true);
  let back = initialRoom(); for (let i = 0; i < 30; i++) back = step(back, false, 'down').state;
  assert.equal(back.phase, 'free'); // back turned → never
});

test('bicycle: campus only, wider footprint, never through an exit, sub-stepped, dismount needs space', () => {
  const campus = worldMaps.campus, r = loc.bicycle.collisionRadius;
  assert.equal(nearBike(loc, 'campus', 348, 297), true);
  assert.equal(nearBike(loc, 'campus', 600, 700), false);
  assert.equal(nearBike(loc, 'living-room', 348, 297), false);
  const ok = (x: number, y: number) => canRideAt(campus, x, y, r, []);
  // ride toward the park exit for a long time: stops before it
  let p: [number, number] = [348, 297];
  for (let i = 0; i < 200; i++) { const s = rideStep(p, [-1, -1], .05, 270 * loc.bicycle.speedMultiplier, ok); p = [s.x, s.y]; }
  assert.equal(portalAt(campus, p[0], p[1]), null);
  assert.ok(ok(p[0], p[1]));
  // a huge frame time is capped (no tunnelling)
  const s = rideStep([600, 700], [1, 0], 5, 9999, ok);
  assert.ok(s.x - 600 <= 9999 * .05 + 1e-6);
  assert.deepEqual(dismountSpot([600, 700], () => false), null);
  // people: the bike keeps a long sideways and a wider depth margin than walking
  assert.equal(canRideAt(campus, 600, 700, r, [{ x: 680, y: 700 }]), false);
  assert.equal(canRideAt(campus, 600, 700, r, [{ x: 600, y: 670 }]), false);
  assert.equal(canRideAt(campus, 600, 700, r, [{ x: 600, y: 640 }]), true);
  assert.deepEqual(dismountSpot([600, 700], (x, y) => x === 600 && y === 735), [600, 735]);
});
