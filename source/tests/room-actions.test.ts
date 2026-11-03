import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldMaps } from '../src/world/world-data.ts';
import { canOccupy, portalAt } from '../src/world/world-engine.ts';
import { ROOM_CONFIG, roomSpots, catPath, stepRoom, initialRoom, pickSpot, catSpot, stepCat, initialCat, loadRoom, needsWater, facing, dwellOf, spotKey, towardWindow, spotDist, dirTo } from '../src/world/room-actions.ts';
import type { RoomState, Spot } from '../src/world/room-actions.ts';

const map = worldMaps.bedroom, spots = roomSpots.bedroom!, cfg = ROOM_CONFIG;
const canStand = (x: number, y: number) => canOccupy(map, x, y);
const run = (s: RoomState, frames: number, inp: Partial<Parameters<typeof stepRoom>[1]> & { x: number; y: number }) => {
  let out = { state: s } as ReturnType<typeof stepRoom>; const events: string[] = [];
  for (let f = 0; f < frames; f++) { out = stepRoom(out.state, { dir: 'up', dt: 16, input: false, paused: false, spots, canStand, cfg, ...inp }); if (out.started) events.push('start:' + out.started.id); if (out.ended) events.push('end:' + out.ended.id); }
  return { out, events };
};

// Points where the player can stand to use a spot: its point, or samples all along its edge line.
const standPoints = (s: Spot): [number, number][] => !s.edge ? [s.at] : s.edge.slice(1).flatMap((b, i) => { const a = s.edge![i]; return [0, .25, .5, .75, 1].map(t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as [number, number]); });

test('every spot is a walkable standing place, away from the door, and spots do not overlap', () => {
  for (const s of spots) for (const p of standPoints(s)) {
    assert.ok(canStand(p[0], p[1]), `${spotKey(s)} ${p}`);
    assert.ok(!portalAt(map, p[0], p[1]), spotKey(s));
    assert.ok(facing(s.edge ? dirTo(p, s.target) : s.face, p, s.target), `${spotKey(s)} face`);
  }
  for (const a of spots) for (const b of spots) if (a !== b) for (const p of standPoints(a)) assert.ok(spotDist(b, p[0], p[1]) > a.r + b.r, `${spotKey(a)}/${spotKey(b)} at ${p}`);
  assert.equal(new Set(spots.map(spotKey)).size, spots.length, 'spot keys are unique');
  for (const p of catPath.bedroom!) { assert.ok(canStand(p[0], p[1]), String(p)); assert.ok(spots.every(s => spotDist(s, p[0], p[1]) > s.r + 20), 'cat path clear of spots ' + p); }
});

test('passing by with movement input never starts an action', () => {
  const bed = spots.find(s => s.id === 'bed')!;
  const { events } = run(initialRoom(), 120, { x: bed.at[0], y: bed.at[1], dir: bed.face, input: true });
  assert.deepEqual(events, []);
});

test('stop inside a spot facing the object for its stop time → starts once, with a short alignment', () => {
  const bed = spots.find(s => s.id === 'bed')!;
  const near = { x: bed.at[0] + 20, y: bed.at[1] + 10, dir: bed.face };
  const short = run(initialRoom(), Math.floor(dwellOf(bed, cfg) / 16) - 3, near);
  assert.deepEqual(short.events, [], 'not before dwell');
  const r = run(short.out.state, 30, near);
  assert.deepEqual(r.events, ['start:bed']);
  assert.equal(r.out.state.phase, 'active');
});

test('bed: anywhere along its edge (foot, long side, head side) lies down after 2 s, not before; wardrobe edge needs 1.5 s', () => {
  const bed = spots.find(s => s.id === 'bed')!;
  for (const p of standPoints(bed)) {
    const at = { x: p[0], y: p[1], dir: dirTo(p, bed.target) };
    const early = run(initialRoom(), Math.floor(1900 / 16), at);
    assert.deepEqual(early.events, [], `${p} not before 2 s`);
    const r = run(early.out.state, 20, at);
    assert.deepEqual(r.events, ['start:bed'], String(p));
    assert.deepEqual(r.out.state.to, p, 'she stays where she stopped');
  }
  const w = spots.find(s => s.id === 'wardrobe')!;
  for (const p of standPoints(w)) {
    const at = { x: p[0], y: p[1], dir: 'up' as const };
    const early = run(initialRoom(), Math.floor(1400 / 16), at);
    assert.deepEqual(early.events, [], `${p} not before 1.5 s`);
    assert.deepEqual(run(early.out.state, 20, at).events.slice(0, 1), ['start:wardrobe'], String(p));
  }
});

test('after lying, the bed needs leaving its edge before it can repeat', () => {
  const bed = spots.find(s => s.id === 'bed')!, [x, y] = standPoints(bed)[6], dir = dirTo([x, y], bed.target);
  let r = run(initialRoom(), 160, { x, y, dir });
  r = run(r.out.state, 20, { x, y, dir, input: true });
  assert.deepEqual(r.events, ['end:bed']);
  const [x2, y2] = standPoints(bed)[2];
  assert.deepEqual(run(r.out.state, 200, { x: x2, y: y2, dir: dirTo([x2, y2], bed.target) }).events, [], 'still at the bed edge: waits');
  r = run(r.out.state, 5, { x, y: y + 150, dir: 'down', input: true });
  assert.deepEqual(run(r.out.state, 160, { x, y, dir }).events, ['start:bed'], 'after stepping away it works again');
});

test('bed / wardrobe edge: stopping sideways after walking along it counts; back turned does not', () => {
  const bed = spots.find(s => s.id === 'bed')!, [x, y] = standPoints(bed)[6];
  for (const p of standPoints(bed)) for (const dir of ['left', 'right', 'up'] as const) assert.deepEqual(run(initialRoom(), 160, { x: p[0], y: p[1], dir }).events, ['start:bed'], `${p} ${dir}`);
  assert.deepEqual(run(initialRoom(), 160, { x, y, dir: 'down' }).events, [], 'back turned');
  const w = spots.find(s => s.id === 'wardrobe')!;
  for (const p of standPoints(w)) for (const dir of ['left', 'right'] as const) assert.deepEqual(run(initialRoom(), 120, { x: p[0], y: p[1], dir }).events.slice(0, 1), ['start:wardrobe'], `${p} ${dir}`);
});

test('lying on the bed: pushing up or left points at the window, down or right does not', () => {
  const bed = spots.find(s => s.id === 'bed')!.target, win = spots.find(s => s.id === 'window')!.target;
  assert.ok(towardWindow([0, -1], bed, win)); assert.ok(towardWindow([-1, 0], bed, win)); assert.ok(towardWindow([-.7, -.7], bed, win));
  assert.ok(!towardWindow([0, 1], bed, win)); assert.ok(!towardWindow([1, 0], bed, win)); assert.ok(!towardWindow([0, 0], bed, win));
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
  let r = run(initialRoom(), 160, { x: bed.at[0], y: bed.at[1], dir: bed.face });
  r = run(r.out.state, 20, { x: bed.at[0], y: bed.at[1], dir: bed.face, paused: true });
  assert.deepEqual(r.events, ['end:bed']);
});

test('overlapping candidates → one target chosen by distance and facing', () => {
  const a: Spot = { ...spots[0], id: 'chair', at: [500, 700], r: 80, target: [500, 600] };
  const b: Spot = { ...spots[1], id: 'bed', at: [540, 700], r: 80, target: [540, 600], edge: undefined };
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
