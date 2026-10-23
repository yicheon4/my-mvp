/** Persona World Mini v10: map-only walking avatar.
 * Common face/brown bob for everyone; only the outfit follows the v9 look (L01–L15, shoes included).
 * Bags/necklaces and the v9 head are not shown on the map (their saved values are kept elsewhere).
 * Each frame is one complete full-body drawing at manifest rect [x,y,w,h]; never slice sheets into quarters.
 * Adapted from PersonaWorld_Mini_v10/integration/mini.mjs. Plain type annotations so `node --test` can run it.
 */
export const MINI_BASE = '/persona-mini-v10/';
export type MiniDirection = 'down' | 'left' | 'right' | 'up';
export type MiniLook = { name: string; src: string; imageSize: [number, number]; referenceHeight: number; frames: Record<MiniDirection, { rect: [number, number, number, number] }[]> };
export type MiniManifest = { version: number; directions: MiniDirection[]; fps: number; idleFrame: number; looks: Record<string, MiniLook> };

// Removed outfits (same list as presets.ts RETIRED_LOOKS) are never drawn or pre-warmed on the map.
export const RETIRED_MINI: readonly string[] = ['L03', 'L11', 'L12', 'L13'];
export const resolveLook = (look: string | undefined, manifest: MiniManifest) => (look && manifest.looks[look] && !RETIRED_MINI.includes(look) ? look : 'L01');

// Walk frames play only while the feet really move; standing still (or blocked by a wall) shows idleFrame of the last direction.
export function frameFor(manifest: MiniManifest, look: string, direction: MiniDirection, moving: boolean, walkMs: number, reducedMotion = false) {
  const entry = manifest.looks[resolveLook(look, manifest)];
  const dir = manifest.directions.includes(direction) ? direction : 'down';
  const index = moving && !reducedMotion ? Math.floor(Math.max(0, walkMs) * manifest.fps / 1000) % 4 : manifest.idleFrame;
  return { entry, rect: entry.frames[dir][index].rect, index };
}

// Feet-anchored, one uniform scale: `height` is the on-map height of the look's reference body height.
export function miniPlacement(entry: MiniLook, rect: [number, number, number, number], x: number, y: number, height: number) {
  const scale = height / entry.referenceHeight;
  const [, , sw, sh] = rect;
  return { dx: x - sw * scale / 2, dy: y - sh * scale, dw: sw * scale, dh: sh * scale };
}

// Neighbors to warm up after the selected look is ready (never the whole set up front).
export function neighborLooks(look: string, manifest: MiniManifest) {
  const ids = Object.keys(manifest.looks).filter(id => !RETIRED_MINI.includes(id)).sort();
  const i = ids.indexOf(resolveLook(look, manifest));
  return [ids[(i + 1) % ids.length], ids[(i - 1 + ids.length) % ids.length]].filter(id => id !== look);
}

let manifestPromise: Promise<MiniManifest> | null = null;
export function loadMiniManifest(fetcher: typeof fetch = fetch) {
  manifestPromise ??= fetcher(MINI_BASE + 'manifest.json')
    .then(r => { if (!r.ok) throw new Error('mini manifest ' + r.status); return r.json(); })
    .catch(e => { manifestPromise = null; throw e; });
  return manifestPromise;
}

const sheets = new Map<string, Promise<HTMLImageElement>>();
export function loadMiniSheet(manifest: MiniManifest, look: string) {
  const id = resolveLook(look, manifest);
  let p = sheets.get(id);
  if (!p) {
    const url = MINI_BASE + manifest.looks[id].src.replace(/^\.?\//, '');
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
      img.onerror = () => reject(new Error('mini sheet failed: ' + id));
      img.src = url;
    });
    p.catch(() => sheets.delete(id)); // allow retry
    sheets.set(id, p);
  }
  return p;
}
