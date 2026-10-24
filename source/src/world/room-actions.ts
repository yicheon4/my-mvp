/** Automatic life actions in 'my room' (no action buttons). Pure logic, no DOM, so `node --test` can run it.
 * Walk into a small spot where a person would stand (beside the bed, in front of the chair...), face the object
 * and stop for ~0.6 s → the action starts. Passing by never triggers. After an action, the player must leave that
 * spot and come back to trigger it again. Only one action at a time.
 * Pose art (sit / lie / water / play) does not exist yet: the state, position and timing work, but the mini keeps its
 * standing idle frame and `poseReady` is false. Never rotate or squash the standing frame to fake a pose.
 */
import type { Direction, MapId, Pt } from './world-data.ts';

export const ROOM_CONFIG = {
  dwellMs: 600,          // stop this long inside a spot, facing the object
  zoneScale: 1,          // multiplies every spot radius
  exitScale: 1.3,        // leave this far (× radius) before the same spot can trigger again
  alignMs: 220,          // short slide to the exact spot when an action starts
  maxAlign: 90,          // never align farther than this (no teleport)
  waterIntervalMs: 5 * 60 * 1000,
  catPlayRadius: 95,
};
export type RoomConfig = typeof ROOM_CONFIG;

export type ActionId = 'chair' | 'bed' | 'window' | 'wardrobe' | 'plant' | 'cat';
export type Spot = {
  id: ActionId; label: string;
  at: Pt; r: number;         // standing spot (feet) and radius
  target: Pt;                // the object the player faces
  face: Direction;           // direction the mini faces during the action
  hint: { at: Pt; rx: number; ry: number }; // soft highlight on the object
  hold: boolean;             // true: lasts until the player moves (sit, lie, play); false: plays once
  durationMs: number;        // for one-shot actions
  pose: 'sit' | 'lie' | 'water' | 'play' | 'touch' | null; // pose art needed (none exists yet)
  noAlign?: boolean;         // stay where the player stopped (the cat comes to the player instead)
};

// Bedroom (maps-bedroom-*.webp, 1536×1024). Spots sit where a person stands, not over whole furniture.
export const roomSpots: Partial<Record<MapId, Spot[]>> = {
  bedroom: [
    { id: 'chair', label: '의자에 앉기', at: [372, 690], r: 52, target: [285, 560], face: 'left', hint: { at: [285, 575], rx: 70, ry: 55 }, hold: true, durationMs: 0, pose: 'sit' },
    { id: 'bed', label: '침대에 눕기', at: [852, 548], r: 55, target: [660, 450], face: 'left', hint: { at: [690, 470], rx: 170, ry: 80 }, hold: true, durationMs: 0, pose: 'lie' },
    { id: 'window', label: '창문 열고 닫기', at: [458, 606], r: 46, target: [490, 150], face: 'up', hint: { at: [490, 150], rx: 85, ry: 120 }, hold: false, durationMs: 900, pose: null },
    { id: 'wardrobe', label: '옷장 열기', at: [1125, 640], r: 52, target: [1150, 350], face: 'up', hint: { at: [1150, 360], rx: 150, ry: 210 }, hold: false, durationMs: 380, pose: 'touch' },
    { id: 'plant', label: '화분 물주기', at: [935, 702], r: 46, target: [1085, 660], face: 'right', hint: { at: [1090, 650], rx: 85, ry: 60 }, hold: false, durationMs: 2200, pose: 'water' },
  ],
};
// The cat wanders only between these floor points (inside the walkable floor, away from the door and furniture).
export const catPath: Partial<Record<MapId, Pt[]>> = {
  bedroom: [[600, 720], [700, 770], [800, 705], [720, 860], [580, 830], [650, 930], [780, 935]],
};

const DIRS: Record<Direction, Pt> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** Facing check with only 4 walk directions: the object must be within ~80° of where the mini looks. */
export function facing(dir: Direction, from: Pt, to: Pt) {
  const [fx, fy] = DIRS[dir]; const dx = to[0] - from[0], dy = to[1] - from[1]; const len = Math.hypot(dx, dy) || 1;
  return (fx * dx + fy * dy) / len > Math.cos(80 * Math.PI / 180);
}
export const dirTo = (from: Pt, to: Pt): Direction => { const dx = to[0] - from[0], dy = to[1] - from[1]; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };

/** One target among overlapping spots: inside the radius and facing; closest wins, facing straighter breaks ties. */
export function pickSpot(spots: Spot[], x: number, y: number, dir: Direction, cfg: RoomConfig, skip: Set<ActionId>) {
  let best: Spot | null = null, score = Infinity;
  for (const s of spots) {
    if (skip.has(s.id)) continue;
    const d = Math.hypot(x - s.at[0], y - s.at[1]);
    if (d > s.r * cfg.zoneScale || !facing(dir, [x, y], s.target)) continue;
    const [fx, fy] = DIRS[dir], dx = s.target[0] - x, dy = s.target[1] - y, cos = (fx * dx + fy * dy) / (Math.hypot(dx, dy) || 1);
    const sc = d + (1 - cos) * 40;
    if (sc < score) { score = sc; best = s; }
  }
  return best;
}

export type Phase = 'free' | 'waiting' | 'starting' | 'active' | 'ending';
export type RoomState = {
  phase: Phase; spot: Spot | null; dwell: number; t: number;
  from: Pt | null; to: Pt | null;           // alignment / stand-up slide
  rearm: Set<ActionId>;                     // spots that need leaving before they can trigger again
};
export const initialRoom = (): RoomState => ({ phase: 'free', spot: null, dwell: 0, t: 0, from: null, to: null, rearm: new Set() });

export type StepIn = {
  x: number; y: number; dir: Direction; dt: number;   // dt in ms
  input: boolean;                                     // movement input is being given right now
  paused: boolean;                                    // another screen/panel is open, or typing
  spots: Spot[];
  canStand: (x: number, y: number) => boolean;
  cfg: RoomConfig;
};
export type StepOut = { state: RoomState; pos?: Pt; face?: Direction; lockMove: boolean; started?: Spot; ended?: Spot; cancelled?: boolean; waiting?: Spot | null };

function pathClear(a: Pt, b: Pt, canStand: StepIn['canStand']) {
  for (let i = 1; i <= 8; i++) { const t = i / 8; if (!canStand(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
  return true;
}

/** Advances the action state machine by one frame. */
export function stepRoom(s: RoomState, i: StepIn): StepOut {
  const st: RoomState = { ...s, rearm: new Set(s.rearm) };
  // re-arm spots the player has walked away from
  for (const id of st.rearm) {
    const sp = i.spots.find(p => p.id === id);
    if (!sp || Math.hypot(i.x - sp.at[0], i.y - sp.at[1]) > sp.r * i.cfg.zoneScale * i.cfg.exitScale) st.rearm.delete(id);
  }
  const end = (sp: Spot, cancelled = false): StepOut => { st.phase = 'free'; st.spot = null; st.dwell = 0; st.t = 0; st.from = st.to = null; st.rearm.add(sp.id); return { state: st, lockMove: false, ended: sp, cancelled }; };

  if (st.phase === 'free' || st.phase === 'waiting') {
    if (i.paused || i.input) { st.phase = 'free'; st.dwell = 0; st.spot = null; return { state: st, lockMove: false, waiting: i.paused ? null : undefined }; }
    const sp = pickSpot(i.spots, i.x, i.y, i.dir, i.cfg, st.rearm);
    if (!sp) { st.phase = 'free'; st.dwell = 0; st.spot = null; return { state: st, lockMove: false, waiting: null }; }
    st.dwell = st.spot?.id === sp.id ? st.dwell + i.dt : i.dt; st.spot = sp; st.phase = 'waiting';
    if (st.dwell < i.cfg.dwellMs) return { state: st, lockMove: false, waiting: sp };
    // start: short alignment to the exact spot only if close and the way is clear
    const here: Pt = [i.x, i.y], d = Math.hypot(sp.at[0] - i.x, sp.at[1] - i.y);
    const align = !sp.noAlign && d > 1 && d <= i.cfg.maxAlign && i.canStand(sp.at[0], sp.at[1]) && pathClear(here, sp.at, i.canStand);
    st.phase = 'starting'; st.t = 0; st.from = here; st.to = align ? sp.at : here; st.dwell = 0;
    return { state: st, lockMove: true, face: sp.face, started: sp };
  }

  const sp = st.spot!;
  if (st.phase === 'starting') {
    st.t += i.dt;
    const k = Math.min(1, st.t / Math.max(1, i.cfg.alignMs)), e = k * k * (3 - 2 * k);
    const pos: Pt = [st.from![0] + (st.to![0] - st.from![0]) * e, st.from![1] + (st.to![1] - st.from![1]) * e];
    if (k >= 1) { st.phase = 'active'; st.t = 0; }
    return { state: st, pos, face: sp.face, lockMove: true };
  }
  if (st.phase === 'active') {
    st.t += i.dt;
    if (sp.hold) {
      if (i.input || i.paused) { st.phase = 'ending'; st.t = 0; st.from = [i.x, i.y]; st.to = [i.x, i.y]; return { state: st, lockMove: true, face: sp.face }; }
      return { state: st, lockMove: true, face: sp.face };
    }
    if (i.input || i.paused) return end(sp, true); // moving away stops it at once; nothing is left on screen
    if (st.t >= sp.durationMs) return end(sp);
    return { state: st, lockMove: true, face: sp.face };
  }
  // ending: stand up at the (walkable) spot, then hand movement back
  st.t += i.dt;
  if (st.t >= 160) return end(sp);
  return { state: st, lockMove: true, face: sp.face };
}

/** The cat's spot follows the cat. It is offered only when the player walked up to the cat (see WorldMap). */
export const catSpot = (cat: Pt, player: Pt, cfg: RoomConfig): Spot => ({ id: 'cat', label: '고양이와 놀기', at: cat, r: cfg.catPlayRadius, target: cat, face: dirTo(player, cat), hint: { at: [cat[0], cat[1] - 18], rx: 46, ry: 30 }, hold: true, durationMs: 0, pose: 'play', noAlign: true });

// ---- cat (temporary drawing; wander → sit/rest; plays only when the player came to it) ----
export type Cat = { x: number; y: number; dir: 1 | -1; mode: 'walk' | 'sit' | 'rest' | 'approach' | 'play' | 'cooldown'; target: number; t: number; lookAt: Pt | null };
export const initialCat = (path: Pt[]): Cat => ({ x: path[0][0], y: path[0][1], dir: 1, mode: 'sit', target: 1, t: 0, lookAt: null });
const CAT_SPEED = 45;
export function stepCat(c: Cat, path: Pt[], dt: number, rnd: () => number, player: Pt, playing: boolean, canStand: (x: number, y: number) => boolean): Cat {
  const n: Cat = { ...c, t: c.t + dt };
  const moveTo = (tx: number, ty: number, speed: number) => {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy), stepLen = speed * dt / 1000;
    if (d <= stepLen) { n.x = tx; n.y = ty; return true; }
    const nx = n.x + dx / d * stepLen, ny = n.y + dy / d * stepLen;
    if (canStand(nx, ny)) { n.x = nx; n.y = ny; }
    n.dir = dx >= 0 ? 1 : -1; return false;
  };
  if (playing) {
    n.lookAt = player; n.dir = player[0] >= n.x ? 1 : -1;
    if (n.mode !== 'play') { const side = player[0] >= n.x ? -1 : 1; const reached = moveTo(player[0] + side * 70, player[1] + 6, CAT_SPEED * 1.6); if (reached || n.t > 1600) { n.mode = 'play'; n.t = 0; } else n.mode = 'approach'; }
    return n;
  }
  if (n.mode === 'play' || n.mode === 'approach') { n.mode = 'cooldown'; n.t = 0; }
  if (n.mode === 'cooldown') { n.lookAt = null; if (n.t > 1500) { n.mode = 'sit'; n.t = 0; } return n; }
  n.lookAt = null;
  if (n.mode === 'walk') { if (moveTo(path[n.target][0], path[n.target][1], CAT_SPEED)) { n.mode = rnd() < .5 ? 'sit' : 'rest'; n.t = 0; } return n; }
  if (n.t > (n.mode === 'rest' ? 6000 : 3500)) { let next = Math.floor(rnd() * path.length); if (next === n.target) next = (next + 1) % path.length; n.target = next; n.mode = 'walk'; n.t = 0; }
  return n;
}

// ---- persisted room state ----
export const ROOM_KEY = 'persona-world:room:v1';
export type RoomSave = { windowOpen: boolean; lastWateredAt: number };
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
export function loadRoom(storage: Store): RoomSave {
  try { const x = JSON.parse(storage.getItem(ROOM_KEY) ?? 'null'); return { windowOpen: x?.windowOpen === true, lastWateredAt: Number.isFinite(x?.lastWateredAt) ? x.lastWateredAt : 0 }; } catch { return { windowOpen: false, lastWateredAt: 0 }; }
}
export const saveRoom = (storage: Store, r: RoomSave) => storage.setItem(ROOM_KEY, JSON.stringify(r));
export const needsWater = (r: RoomSave, now: number, cfg: RoomConfig) => now - r.lastWateredAt >= cfg.waterIntervalMs;
