import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldMaps } from '../src/world/world-data.ts';
import { canOccupy, portalAt } from '../src/world/world-engine.ts';
import { ROOM_CONFIG, roomSpots, catPath, stepRoom, initialRoom, pickSpot, catSpot, stepCat, initialCat, loadRoom, needsWater, facing } from '../src/world/room-actions.ts';
import type { RoomState, Spot } from '../src/world/room-actions.ts';

const map = worldMaps.bedroom, spots = roomSpots.bedroom!, cfg = ROOM_CONFIG;
const canStand = (x: number, y: number) => canOccupy(map, x, y);
const run = (s: RoomState, frames: number, inp: Partial<Parameters<typeof stepRoom>[1]> & { x: number; y: number }) => {
  let out = { state: s } as ReturnType<typeof stepRoom>; const events: string[] = [];
  for (let f = 0; f < frames; f++) { out = stepRoom(out.state, { dir: 'up', dt: 16, input: false, paused: false, spots, canStand, cfg, ...inp }); if (out.started) events.push('start:' + out.started.id); if (out.ended) events.push('end:' + out.ended.id); }
  return { out, events };
};

test('every spot is a walkable standing place, away from the door, and spots do not overlap', () => {
  for (const s of spots) {
    assert.ok(canStand(s.at[0], s.at[1]), s.id);
    assert.ok(!portalAt(map, s.at[0], s.at[1]), s.id);
    assert.ok(facing(s.face, s.at, s.target), `${s.id} face`);
  }
  for (const a of spots) for (const b of spots) if (a !== b) assert.ok(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) > a.r + b.r, `${a.id}/${b.id}`);
  for (const p of catPath.bedroom!) { assert.ok(canStand(p[0], p[1]), String(p)); assert.ok(spots.every(s => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) > s.r + 20), 'cat path clear of spots ' + p); }
});

test('passing by with movement input never starts an action', () => {
  const bed = spots.find(s => s.id === 'bed')!;
  const { events } = run(initialRoom(), 120, { x: bed.at[0], y: bed.at[1], dir: bed.face, input: true });
  assert.deepEqual(events, []);
});

test('stop inside a spot facing the object for ~0.6 s → starts once, with a short alignment', () => {
  const bed = spots.find(s => s.id === 'bed')!;
  const near = { x: bed.at[0] + 20, y: bed.at[1] + 10, dir: bed.face };
  const short = run(initialRoom(), Math.floor(cfg.dwellMs / 16) - 3, near);
  assert.deepEqual(short.events, [], 'not before dwell');
  const r = run(short.out.state, 30, near);
  assert.deepEqual(r.events, ['start:bed']);
  assert.equal(r.out.state.phase, 'active');
});

test('not facing the object → no action', () => {
  const bed = spots.find(s => s.id === 'bed')!;
  const { events } = run(initialRoom(), 100, { x: bed.at[0], y: bed.at[1], dir: 'right' });
  assert.deepEqual(events, []);
});

test('hold action ends with movement input, then needs leaving the spot before it can repeat', () => {
  const ch = spots.find(s => s.id === 'chair')!;
  let r = run(initialRoom(), 60, { x: ch.at[0], y: ch.at[1], dir: ch.face });
  assert.deepEqual(r.events, ['start:chair']);
  r = run(r.out.state, 20, { x: ch.at[0], y: ch.at[1], dir: ch.face, input: true });
  assert.deepEqual(r.events, ['end:chair']);
  r = run(r.out.state, 200, { x: ch.at[0], y: ch.at[1], dir: ch.face });
  assert.deepEqual(r.events, [], 'standing still in the same spot does not repeat');
  r = run(r.out.state, 5, { x: ch.at[0] + 200, y: ch.at[1], dir: 'right', input: true });
  r = run(r.out.state, 60, { x: ch.at[0], y: ch.at[1], dir: ch.face });
  assert.deepEqual(r.events, ['start:chair'], 'after leaving and coming back it works again');
});

test('one-shot action ends by itself and does not loop', () => {
  const w = spots.find(s => s.id === 'window')!;
  const r = run(initialRoom(), 400, { x: w.at[0], y: w.at[1], dir: w.face });
  assert.deepEqual(r.events, ['start:window', 'end:window']);
});

test('one-shot action stops at once on movement input (cancelled)', () => {
  const p = spots.find(s => s.id === 'plant')!;
  let r = run(initialRoom(), 60, { x: p.at[0], y: p.at[1], dir: p.face });
  assert.deepEqual(r.events, ['start:plant']);
  const out = stepRoom(r.out.state, { x: p.at[0], y: p.at[1], dir: p.face, dt: 16, input: true, paused: false, spots, canStand, cfg });
  assert.equal(out.ended?.id, 'plant'); assert.equal(out.cancelled, true); assert.equal(out.lockMove, false);
});

test('paused (other screen open) → no action, and an active hold ends', () => {
  const p = spots.find(s => s.id === 'plant')!;
  assert.deepEqual(run(initialRoom(), 100, { x: p.at[0], y: p.at[1], dir: p.face, paused: true }).events, []);
  const bed = spots.find(s => s.id === 'bed')!;
  let r = run(initialRoom(), 60, { x: bed.at[0], y: bed.at[1], dir: bed.face });
  r = run(r.out.state, 20, { x: bed.at[0], y: bed.at[1], dir: bed.face, paused: true });
  assert.deepEqual(r.events, ['end:bed']);
});

test('overlapping candidates → one target chosen by distance and facing', () => {
  const a: Spot = { ...spots[0], id: 'chair', at: [500, 700], r: 80, target: [500, 600] };
  const b: Spot = { ...spots[1], id: 'bed', at: [540, 700], r: 80, target: [540, 600] };
  assert.equal(pickSpot([a, b], 535, 700, 'up', cfg, new Set())?.id, 'bed');
  assert.equal(pickSpot([a, b], 505, 700, 'up', cfg, new Set())?.id, 'chair');
});

test('alignment never jumps far or through furniture', () => {
  const far: Spot = { ...spots[0], at: [372, 690], r: 400 };
  const r = run(initialRoom(), 60, { x: 600, y: 760, dir: 'left' }) ; // no spot there
  assert.deepEqual(r.events, []);
  let s = stepRoom(initialRoom(), { x: 600, y: 760, dir: 'left', dt: 700, input: false, paused: false, spots: [far], canStand, cfg });
  assert.ok(s.started && s.state.to![0] === 600, 'beyond maxAlign → stays in place');
});

test('cat spot keeps the player in place; cat only wanders on its path and stops while playing', () => {
  const sp = catSpot([700, 770], [640, 770], cfg);
  assert.equal(sp.face, 'right'); assert.ok(sp.noAlign);
  let c = initialCat(catPath.bedroom!); let rnd = 0; const r = () => (rnd = (rnd + .37) % 1);
  for (let i = 0; i < 2000; i++) { c = stepCat(c, catPath.bedroom!, 16, r, [300, 900], false, canStand); assert.ok(canStand(c.x, c.y)); }
  for (let i = 0; i < 200; i++) c = stepCat(c, catPath.bedroom!, 16, r, [640, 770], true, canStand);
  assert.equal(c.mode, 'play');
  c = stepCat(c, catPath.bedroom!, 16, r, [640, 770], false, canStand); assert.equal(c.mode, 'cooldown');
});

test('room save: watering interval; missing/old data is harmless', () => {
  const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.deepEqual(loadRoom(st), { windowOpen: false, lastWateredAt: 0 });
  mem.set('persona-world:room:v1', '{bad'); assert.deepEqual(loadRoom(st), { windowOpen: false, lastWateredAt: 0 });
  assert.ok(needsWater({ windowOpen: false, lastWateredAt: 0 }, Date.now(), cfg));
  assert.ok(!needsWater({ windowOpen: false, lastWateredAt: 1000 }, 1000 + cfg.waterIntervalMs - 1, cfg));
});
