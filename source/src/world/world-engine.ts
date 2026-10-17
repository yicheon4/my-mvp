/** Pure world logic (no DOM): collision, portals, NPC proximity, versioned save.
 * Only plain type annotations so `node --test` can run it directly.
 */
import { worldMaps, looks, MAP_IDS, DEFAULT_LOOK } from './world-data.ts';
import type { Pt, Direction, TimeOfDay, MapId, WorldMapDef, Portal, Npc, Look } from './world-data.ts';

export const WORLD_KEY = 'persona-world:world:v1';
const FEET = [[0, 0], [-16, 0], [16, 0], [0, -8], [0, 8]];
const NPC_RADIUS = 46;
export const TALK_RANGE = 150;

export function pointInPolygon(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function canOccupy(map: WorldMapDef, x: number, y: number) {
  return FEET.every(([dx, dy]) => {
    const px = x + dx, py = y + dy;
    return map.walk.some(p => pointInPolygon(px, py, p)) && !map.blocks.some(p => pointInPolygon(px, py, p));
  }) && !map.npcs.some(n => Math.hypot(n.x - x, (n.y - y) * 1.6) < NPC_RADIUS);
}

export function portalAt(map: WorldMapDef, x: number, y: number): Portal | null {
  return map.portals.find(p => x >= p.rect[0] && x <= p.rect[0] + p.rect[2] && y >= p.rect[1] && y <= p.rect[1] + p.rect[3]) ?? null;
}

export function arrival(portal: Portal) {
  const target = worldMaps[portal.to];
  const entry = target.portals.find(p => p.id === portal.toPortal);
  if (!entry) throw new Error(`Missing portal ${portal.to}/${portal.toPortal}`);
  return { mapId: target.id, x: entry.spawn.x, y: entry.spawn.y, direction: entry.spawn.dir };
}

export function nearestNpc(map: WorldMapDef, x: number, y: number): Npc | null {
  let best: Npc | null = null, dist = TALK_RANGE;
  for (const n of map.npcs) { const d = Math.hypot(n.x - x, n.y - y); if (d < dist) { dist = d; best = n; } }
  return best;
}

// Mini height grows toward the bottom of the screen (closer to the camera).
export function miniHeight(map: WorldMapDef, y: number) {
  const { y0, h0, y1, h1 } = map.scale;
  const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  return h0 + (h1 - h0) * t;
}

export type WorldState = { version: 1; mapId: MapId; x: number; y: number; direction: Direction; timeOfDay: TimeOfDay; lookId: Look['id'] };
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export function defaultWorld(): WorldState {
  const s = worldMaps.bedroom.spawn;
  return { version: 1, mapId: 'bedroom', x: s.x, y: s.y, direction: s.dir, timeOfDay: 'day', lookId: DEFAULT_LOOK };
}

// Reads only the versioned world key. Invalid fields fall back one by one; an unwalkable position returns to the map spawn.
export function loadWorld(storage: Storage): WorldState {
  const base = defaultWorld();
  let raw: any = null;
  try { raw = JSON.parse(storage.getItem(WORLD_KEY) ?? 'null'); } catch { return base; }
  if (raw?.version !== 1) return base;
  const lookId = looks.some(l => l.id === raw.lookId) ? raw.lookId : base.lookId;
  const timeOfDay: TimeOfDay = raw.timeOfDay === 'night' ? 'night' : 'day';
  if (!MAP_IDS.includes(raw.mapId)) return { ...base, lookId, timeOfDay };
  const map = worldMaps[raw.mapId as MapId];
  const dirs: Direction[] = ['down', 'left', 'right', 'up'];
  const ok = Number.isFinite(raw.x) && Number.isFinite(raw.y) && canOccupy(map, raw.x, raw.y);
  return {
    version: 1, mapId: map.id, lookId, timeOfDay,
    x: ok ? raw.x : map.spawn.x, y: ok ? raw.y : map.spawn.y,
    direction: ok && dirs.includes(raw.direction) ? raw.direction : map.spawn.dir,
  };
}

export function saveWorld(storage: Storage, state: WorldState) {
  storage.setItem(WORLD_KEY, JSON.stringify(state));
}
