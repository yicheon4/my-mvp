/** Room-action art (PersonaWorld_RoomActions_v11; the package marks it a review candidate, see the art QA notes).
 * On by default in every build (the user asked for it on the public link); `?roomart=off` shows the plain v10 mini instead.
 * Files live in public/room-v11 and are exported with the site.
 * Uses manifest rects and sheet-absolute anchors exactly as given: frame-local anchor = (ax-rx, ay-ry), one common scale per
 * draw (same perspective scale as the v10 walk), no stretching, rotation or body compositing. Anything missing → caller keeps
 * the normal v10 drawing.
 * Pure helpers only (plain types) so `node --test` can check them.
 */
export const V11_BASE = '/room-v11/';
export type Rect = [number, number, number, number];
export type V11Frame = { rect: Rect; anchor: [number, number] };
export type V11Action = { loop: boolean | 'pour'; fps: number; frames: V11Frame[]; pourRange?: [number, number] };
export type V11Look = { src: string; imageSize: [number, number]; referenceHeight: number; actions: Record<string, V11Action> };
type Layer = { src: string; offset: [number, number] };
export type V11Manifest = {
  version: number; status: string; anchorSpace: 'sheet';
  looks: Record<string, V11Look>;
  room: {
    imageSize: [number, number];
    background: Record<'day' | 'night', string>;
    chair_in: Record<'day' | 'night', Layer & { seat: [number, number] }>;
    chair_out: Record<'day' | 'night', Layer & { seat: [number, number] }>;
    window_open: Record<'day' | 'night', { fps: number; loop: boolean; frames: Layer[] }>;
  };
  cat: { src: string; imageSize: [number, number]; displayScale: number; frames: Record<string, { fps: number; loop: boolean; frames: V11Frame[] }> };
};

/** Where a frame lands: anchor on the world point, uniform scale. */
export function placeFrame(f: V11Frame, world: [number, number], scale: number) {
  const [rx, ry, w, h] = f.rect, [ax, ay] = f.anchor;
  return { dx: world[0] - (ax - rx) * scale, dy: world[1] - (ay - ry) * scale, dw: w * scale, dh: h * scale };
}

const at = (fps: number, ms: number) => Math.floor(Math.max(0, ms) * fps / 1000);
/** Water: 0 = lift, 1..3 loop while pouring, 4 = lower in the last frame time. */
export function waterIndex(a: V11Action, elapsed: number, duration: number) {
  const step = 1000 / a.fps, [p0, p1] = a.pourRange ?? [1, 3];
  if (elapsed < step) return 0;
  if (elapsed >= duration - step) return a.frames.length - 1;
  return p0 + at(a.fps, elapsed - step) % (p1 - p0 + 1);
}
/** Some cat cells also hold a stray ear/tail piece of the neighbouring cell, separated by empty rows.
 * Given the opaque-pixel count of each row of a frame, keep only the band of rows with the most pixels (the cat itself). */
export function mainBand(rows: number[]): [number, number] {
  let best: [number, number] = [0, rows.length - 1], bestSum = -1, start = -1, sum = 0;
  for (let y = 0; y <= rows.length; y++) {
    if (y < rows.length && rows[y] > 0) { if (start < 0) { start = y; sum = 0; } sum += rows[y]; continue; }
    if (start >= 0 && sum > bestSum) { bestSum = sum; best = [start, y - 1]; }
    start = -1;
  }
  return best;
}
/** Same frame with its rect cut to the main band; the anchor stays on the same sheet pixel, so placement does not move. */
export const trimRows = (f: V11Frame, rows: number[]): V11Frame => { const [a, b] = mainBand(rows); return { rect: [f.rect[0], f.rect[1] + a, f.rect[2], b - a + 1], anchor: f.anchor }; };

/** The water stream shows only on the pour frames (pourRange, both ends included); never while lifting or lowering. */
export const WATER_TIMING: V11Action = { loop: 'pour', fps: 6, pourRange: [1, 3], frames: Array(5).fill(null) };
export function pouring(a: V11Action, elapsed: number, duration: number) {
  const [p0, p1] = a.pourRange ?? [1, 3], i = waterIndex(a, elapsed, duration);
  return elapsed >= 0 && elapsed < duration && i >= p0 && i <= p1;
}
/** One-shot plays once then holds the last frame; loop repeats. */
export const playIndex = (a: V11Action, elapsed: number) => a.loop === true ? at(a.fps, elapsed) % a.frames.length : Math.min(a.frames.length - 1, at(a.fps, elapsed));
/** Getting up: the down action backwards (art for the transition is not final). */
export const reverseIndex = (a: V11Action, elapsed: number) => Math.max(0, a.frames.length - 1 - at(a.fps, elapsed));

// World points for pose anchors. Chair seat comes from the manifest; the bed hip point is NOT given by the package,
// so this preview uses an estimate on the mattress that must be confirmed against final art.
export const BED_HIP_ESTIMATE: [number, number] = [705, 405];

export function v11Enabled(search: string) { return new URLSearchParams(search).get('roomart') !== 'off'; }
