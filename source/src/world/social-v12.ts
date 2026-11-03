/** v12 social actions (PersonaWorld_SocialActions_v12): full-body NPC minis that patrol, waving, auto sit / sink / stove
 * spots on the living room, kitchen and campus maps, and the campus bicycle. Pure logic + two small canvas effects,
 * plain types only so `node --test` can run it.
 * Anchors are FRAME-LOCAL (v12): drawX = X - ax*s, drawY = Y - ay*s. Never reuse the v11 sheet-absolute formula.
 * Rects come from the manifest; sheets are never re-sliced by guessing a grid.
 */
import type { Direction, MapId, Npc, Pt, WorldMapDef } from './world-data.ts';
import { pointInPolygon, portalAt } from './world-engine.ts';
import type { Spot } from './room-actions.ts';

export const V12_BASE = '/persona-v12/';
export type V12Frame = { rect: [number, number, number, number]; anchor: [number, number]; anchorKind?: string };
export type V12Clip = { frames: number[]; fps: number; loop: boolean };
export type V12Entry = {
  src: string; imageSize: [number, number]; referenceHeight: number; frames: V12Frame[]; clips: Record<string, V12Clip>;
  idleByDirection?: Record<Direction, number>; groupScale?: Record<string, number>;
};
export type V12Manifest = { version: number; anchorSpace: string; npcs: Record<string, V12Entry>; players: Record<string, V12Entry> };
export type V12Spot = {
  id: string; map: MapId; label: string; auto: boolean; approach: Pt; render: Pt; facing: Direction; clip?: string;
  radius: number; dwellMs: number; height: number; mirrorX?: boolean; effect?: 'water' | 'flame'; effectPoint?: Pt;
  effectOcclusion?: Pt[][]; occlusion?: Pt[][];
};
export type V12NpcDef = { id: string; person: number; map: MapId; spawn: Pt; patrol: Pt[]; speed: number; talkRange: number; greetRange: number; locked: boolean };
export type V12Locations = {
  spots: V12Spot[]; npcs: V12NpcDef[];
  bicycle: { allowedMaps: MapId[]; speedMultiplier: number; collisionRadius: number; mountMs: number; dismountMs: number; stopBeforePortal: boolean };
};

// ---- frames ----
/** Frame of a clip at `ms`. One-shot clips hold their last frame; reduced motion keeps the first frame. */
export function clipFrame(e: V12Entry, clip: string, ms: number, reduced = false): V12Frame | null {
  const c = e.clips[clip]; if (!c?.frames.length) return null;
  let i = reduced ? 0 : Math.floor(Math.max(0, ms) * c.fps / 1000);
  i = c.loop ? i % c.frames.length : Math.min(i, c.frames.length - 1);
  return e.frames[c.frames[i]] ?? null;
}
export const clipMs = (e: V12Entry, clip: string) => { const c = e.clips[clip]; return c ? c.frames.length * 1000 / c.fps : 0; };
/** Frame-local anchor on the world point; one uniform scale (shown height / referenceHeight). */
export function placeV12(f: V12Frame, world: Pt, scale: number) {
  const [, , w, h] = f.rect, [ax, ay] = f.anchor;
  return { dx: world[0] - ax * scale, dy: world[1] - ay * scale, dw: w * scale, dh: h * scale };
}
/** NPC frame: walk clip only while really moving, the direction's idle frame when still, the (front) wave clip while waving. */
export function npcFrame(e: V12Entry, dir: Direction, moving: boolean, walkMs: number, waveMs: number | null, reduced = false) {
  if (waveMs !== null) return clipFrame(e, 'wave', waveMs, reduced);
  if (moving && !reduced) return clipFrame(e, 'walk_' + dir, walkMs);
  return e.frames[e.idleByDirection?.[dir] ?? 0] ?? null;
}

// ---- auto spots (sit / sink / stove) through the existing room-action state machine ----
const SPOT_POSE: Record<string, Spot['pose']> = { wash: 'wash', cook: 'cook' };
/** v12 spot → room Spot: `approach` is where the feet stop (collision, dwell, return point); `render` is only for drawing. */
export function toRoomSpot(s: V12Spot): Spot {
  const target = s.effectPoint ?? s.render;
  return {
    id: s.id as Spot['id'], key: s.id, label: s.label, at: s.approach, r: s.radius, target, face: s.facing,
    hint: { at: target, rx: 70, ry: 45 }, hold: true, durationMs: 0, pose: SPOT_POSE[s.clip ?? ''] ?? 'sit', dwellMs: s.dwellMs,
  };
}
export const autoSpots = (loc: V12Locations, map: MapId) => loc.spots.filter(s => s.auto && s.map === map);

// ---- NPCs ----
export type NpcRun = Npc & { id: string; locked: boolean; dir: Direction; moving: boolean; walkMs: number; patrol: Pt[]; target: number; wait: number; blocked: number; waveMs: number | null; speed: number };
const lineClear = (a: Pt, b: Pt, ok: (x: number, y: number) => boolean) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
  for (let i = 0; i <= n; i++) if (!ok(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) return false;
  return true;
};
/** Keeps only patrol points that are standable AND reachable in a straight, clear line from the previous kept point
 * (including the way back to the first one). Walls, furniture and exits never sit on a patrol route. */
export function validPatrol(points: Pt[], ok: (x: number, y: number) => boolean): Pt[] {
  const kept: Pt[] = [];
  for (const p of points) if (ok(p[0], p[1]) && (!kept.length || lineClear(kept[kept.length - 1], p, ok))) kept.push(p);
  while (kept.length > 1 && !lineClear(kept[kept.length - 1], kept[0], ok)) kept.pop();
  return kept;
}
// Where each NPC really is, kept for the session so returning from a talk puts them back where they stood.
const npcMemory = new Map<string, { x: number; y: number; dir: Direction; target: number }>();
export function initNpcs(map: WorldMapDef, loc: V12Locations | null, ok: (x: number, y: number) => boolean): NpcRun[] {
  return map.npcs.map(n => {
    const def = loc?.npcs.find(d => d.person === n.person && d.map === map.id);
    const patrol = def ? validPatrol(def.patrol, (x, y) => ok(x, y) && !portalAt(map, x, y)) : [];
    const mem = npcMemory.get(map.id + ':' + n.person), home = def && ok(def.spawn[0], def.spawn[1]) ? def.spawn : [n.x, n.y];
    const at = mem && ok(mem.x, mem.y) ? mem : { x: home[0], y: home[1], dir: 'down' as Direction, target: 0 };
    return { ...n, id: def?.id ?? String(n.person), locked: !!def?.locked, x: at.x, y: at.y, dir: at.dir, moving: false, walkMs: 0,
      patrol: patrol.length ? patrol : [[n.x, n.y]], target: Math.min(at.target, Math.max(0, patrol.length - 1)), wait: 800, blocked: 0, waveMs: null, speed: def?.speed ?? 35 };
  });
}
export const rememberNpc = (mapId: MapId, n: NpcRun) => npcMemory.set(mapId + ':' + n.person, { x: n.x, y: n.y, dir: n.dir, target: n.target });
export const forgetNpcs = () => npcMemory.clear(); // tests
const dirOf = (dx: number, dy: number): Direction => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
/** One frame of a patrolling NPC. `hold` (talking, waving, screen paused, player close by) stops it in place.
 * `ok` must reject walls, furniture, exits, the player and other NPCs. A blocked step waits, then tries the next point. */
export function stepNpc(n: NpcRun, dtMs: number, hold: boolean, ok: (x: number, y: number) => boolean, rnd: () => number): NpcRun {
  const c: NpcRun = { ...n };
  if (c.waveMs !== null) { c.waveMs += dtMs; c.moving = false; return c; }
  if (hold || c.patrol.length < 2) { c.moving = false; c.walkMs = 0; return c; }
  if (c.wait > 0) { c.wait -= dtMs; c.moving = false; c.walkMs = 0; return c; }
  const [tx, ty] = c.patrol[c.target], dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (d < 1.5) { c.target = (c.target + 1) % c.patrol.length; c.wait = 1200 + rnd() * 1800; c.moving = false; c.walkMs = 0; return c; }
  const len = Math.min(d, c.speed * Math.min(dtMs, 50) / 1000), nx = c.x + dx / d * len, ny = c.y + dy / d * len;
  if (!ok(nx, ny)) { // someone/something in the way: stand still, give up on this point after a while
    c.moving = false; c.walkMs = 0; c.blocked += dtMs;
    if (c.blocked > 1500) { c.blocked = 0; c.target = (c.target + 1) % c.patrol.length; c.wait = 600; }
    return c;
  }
  c.blocked = 0; c.dir = dirOf(dx, dy); c.x = nx; c.y = ny; c.moving = len > 0.01; c.walkMs += dtMs;
  return c;
}

// ---- bicycle ----
export type Bike = { phase: 'off' | 'mount' | 'ride' | 'dismount'; t: number; from?: Pt; to?: Pt };
export const BIKE_OFF: Bike = { phase: 'off', t: 0 };
/** Wider footprint while riding; exits are never entered on the bike. */
export function canRideAt(map: WorldMapDef, x: number, y: number, r: number, npcs: { x: number; y: number }[]) {
  return [[0, 0], [-r, 0], [r, 0], [0, -8], [0, 8]].every(([dx, dy]) => {
    const px = x + dx, py = y + dy;
    return map.walk.some(p => pointInPolygon(px, py, p)) && !map.blocks.some(p => pointInPolygon(px, py, p)) && !portalAt(map, px, py);
  }) && !npcs.some(n => bikeTouches(n, x, y));
}
/** A person is too close to the bicycle: the bike is long sideways (~±90 px) and the rider + bike hide whoever stands
 * just behind, so the depth margin is wider than on foot too (46 px instead of ~29). */
export const bikeTouches = (n: { x: number; y: number }, x: number, y: number) => Math.hypot((n.x - x) / 2, n.y - y) < 46;
/** Riding move: delta capped per frame, checked in small sub-steps per axis so fast riding never skips through a wall. */
export function rideStep(p: Pt, input: Pt, dtSec: number, speed: number, ok: (x: number, y: number) => boolean) {
  const len = Math.hypot(input[0], input[1]); if (len < .2) return { x: p[0], y: p[1], moving: false };
  const dt = Math.min(Math.max(dtSec, 0), .05), dx = input[0] / len * speed * dt, dy = input[1] / len * speed * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6)); let x = p[0], y = p[1];
  for (let i = 0; i < n; i++) { if (ok(x + dx / n, y)) x += dx / n; if (ok(x, y + dy / n)) y += dy / n; }
  return { x, y, moving: x !== p[0] || y !== p[1] };
}
/** A free place to step off beside the bike (null → keep riding and ask the player to move a little). */
export function dismountSpot(p: Pt, ok: (x: number, y: number) => boolean): Pt | null {
  for (const [dx, dy] of [[0, 35], [40, 0], [-40, 0], [0, -35], [60, 35], [-60, 35], [0, 0]]) if (ok(p[0] + dx, p[1] + dy)) return [p[0] + dx, p[1] + dy];
  return null;
}
export const nearBike = (loc: V12Locations, map: MapId, x: number, y: number) =>
  loc.bicycle.allowedMaps.includes(map) && loc.spots.some(s => s.id === 'bicycle' && s.map === map && Math.hypot(x - s.approach[0], y - s.approach[1]) <= s.radius);
export const rideClip = (dir: Direction) => 'ride_' + dir;

// ---- effects (drawn behind the player: the tap and the hob are on the back counter) ----
export function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, ms: number, reduced = false) {
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#d7f4ffcc'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 34); ctx.stroke();
  ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { const yy = y + ((reduced ? i * 8 : ms * .05 + i * 9) % 34); ctx.beginPath(); ctx.moveTo(x - 1, yy); ctx.lineTo(x + 2, yy + 5); ctx.stroke(); }
  ctx.restore();
}
export function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, ms: number, reduced = false) {
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, px = x + Math.cos(a) * 24, py = y + Math.sin(a) * 8, h = reduced ? 7 : 7 + Math.sin(ms * .012 + i) * 2;
    ctx.fillStyle = '#399ff0dd'; ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.quadraticCurveTo(px - 2, py - h, px, py - h - 3); ctx.quadraticCurveTo(px + 4, py - h / 2, px + 3, py); ctx.fill();
  }
  ctx.restore();
}
