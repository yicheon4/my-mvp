import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldMaps, MAP_IDS, looks } from '../src/world/world-data.ts';
import { canOccupy, portalAt, arrival, nearestNpc, loadWorld, saveWorld, defaultWorld, WORLD_KEY } from '../src/world/world-engine.ts';
import { stepPosition } from '../src/world/avatar-runtime.ts';

const memoryStore = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return { values, setItem: (k: string, v: string) => { values.set(k, v); }, getItem: (k: string) => values.get(k) ?? null };
};

test('six spaces exist and every spawn point is walkable', () => {
  assert.deepEqual(MAP_IDS.sort(), ['bar', 'bedroom', 'campus', 'kitchen', 'living-room', 'park']);
  for (const map of Object.values(worldMaps)) assert.ok(canOccupy(map, map.spawn.x, map.spawn.y), `${map.id} spawn`);
});

test('portals are two-way, reachable, and arrivals land outside the exit zone', () => {
  for (const map of Object.values(worldMaps)) for (const portal of map.portals) {
    const back = worldMaps[portal.to].portals.find(p => p.id === portal.toPortal);
    assert.ok(back, `${map.id}/${portal.id} target`);
    assert.equal(back!.to, map.id); assert.equal(back!.toPortal, portal.id);
    const a = arrival(portal);
    assert.ok(canOccupy(worldMaps[a.mapId], a.x, a.y), `${map.id}/${portal.id} arrival walkable`);
    assert.equal(portalAt(worldMaps[a.mapId], a.x, a.y), null, `${map.id}/${portal.id} arrival not inside a portal`);
    let reachable = false;
    const [rx, ry, rw, rh] = portal.rect;
    for (let x = rx; x <= rx + rw && !reachable; x += 5) for (let y = ry; y <= ry + rh && !reachable; y += 5) reachable = canOccupy(map, x, y);
    assert.ok(reachable, `${map.id}/${portal.id} can be stepped on`);
  }
});

test('home, school, park and bar form one connected world', () => {
  const seen = new Set(['bedroom']); const queue = ['bedroom'];
  while (queue.length) for (const p of worldMaps[queue.shift() as keyof typeof worldMaps].portals) if (!seen.has(p.to)) { seen.add(p.to); queue.push(p.to); }
  assert.equal(seen.size, 6);
});

test('walking from each spawn to its doors stays inside walls (axis sliding)', () => {
  for (const map of Object.values(worldMaps)) {
    let pos = { x: map.spawn.x, y: map.spawn.y };
    for (let i = 0; i < 400; i++) pos = stepPosition(pos, { x: 1, y: 1 }, .05, 300, (x, y) => canOccupy(map, x, y));
    assert.ok(canOccupy(map, pos.x, pos.y), `${map.id} stays walkable`);
  }
});

test('NPCs can be approached, and free/locked characters keep their spots', () => {
  const people = Object.values(worldMaps).flatMap(m => m.npcs.map(n => n.person)).sort();
  assert.deepEqual(people, [0, 1, 2, 3, 4, 5]);
  for (const map of Object.values(worldMaps)) for (const n of map.npcs) {
    let near = false;
    for (let a = 0; a < 360 && !near; a += 15) {
      const x = n.x + Math.cos(a * Math.PI / 180) * 90, y = n.y + Math.sin(a * Math.PI / 180) * 70;
      near = canOccupy(map, x, y) && nearestNpc(map, x, y) === n;
    }
    assert.ok(near, `${map.id} npc ${n.person} approachable`);
  }
});

test('world save is versioned, separate, and repairs bad data', () => {
  const notes = JSON.stringify({ notes: [{ id: 'mind', en: 'x', ko: 'y', context: '' }], session: null });
  const store = memoryStore({ 'persona-world-v1': notes, 'persona-world-look-v1': '{"outfit":1}' });
  assert.deepEqual(loadWorld(store), defaultWorld());
  const s = { ...defaultWorld(), mapId: 'kitchen' as const, x: 300, y: 600, timeOfDay: 'night' as const, lookId: 'pink-cargo' as const };
  saveWorld(store, s);
  assert.deepEqual(loadWorld(store), s);
  assert.equal(store.values.get('persona-world-v1'), notes);
  assert.equal(store.values.get('persona-world-look-v1'), '{"outfit":1}');
  store.setItem(WORLD_KEY, JSON.stringify({ ...s, x: 5, y: 5, lookId: 'bad' }));
  const repaired = loadWorld(store);
  assert.equal(repaired.mapId, 'kitchen'); assert.equal(repaired.x, worldMaps.kitchen.spawn.x);
  assert.equal(repaired.lookId, looks[0].id); assert.equal(repaired.timeOfDay, 'night');
  store.setItem(WORLD_KEY, '{oops'); assert.deepEqual(loadWorld(store), defaultWorld());
  store.setItem(WORLD_KEY, JSON.stringify({ ...s, version: 2 })); assert.deepEqual(loadWorld(store), defaultWorld());
});

test('no approved look claims a matching mini yet', () => {
  assert.ok(looks.every(l => l.mini === null));
});
