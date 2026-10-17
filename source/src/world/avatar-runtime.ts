/** Persona World v3 appearance + mini avatar runtime.
 * Adapted from the v3 handoff starter (아트_자료/PersonaWorld_v3/integration/avatar-runtime.mjs).
 * Changes from the starter:
 * - top/pants are kept while an outfit is worn; the outfit only hides them when layers are resolved,
 *   so removing the outfit brings back the previous separates instead of leaving top/pants empty.
 * - createLatestLoader() keeps an older, slower image load from overwriting a newer selection.
 * Contains no art. Every registry entry stays "missing" until real aligned atlases exist.
 * Only plain type annotations are used so `node --test` can run this file directly.
 */
export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = typeof DIRECTIONS[number];
export const ATLAS = { columns: 4, rows: 4, frameWidth: 256, frameHeight: 256, fps: 8 };
export const APPEARANCE_KEY = 'persona-world:appearance:v3';

export type Selection = Record<string, string | null>;
export type Catalog = {
  defaultSelection: Selection;
  categories: { key: string; allowNone?: boolean; options: { id: string }[] }[];
};
export type RegistryEntry = {
  url: string | null;
  zByDirection: Record<Direction, number> | null;
  frameWidth?: number;
  frameHeight?: number;
};
export type Layer = RegistryEntry & { key: string; url: string; zByDirection: Record<Direction, number> };
export type LoadedLayer = Layer & { image: HTMLImageElement };
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export function equip(selection: Selection, category: string, id: string | null): Selection {
  const next = { ...selection, [category]: id };
  if (category === 'top' || category === 'pants') next.outfit = null;
  return next;
}

// Hair atlases are specific to hairstyle AND dye color. No whole-body hue rotation.
export function resolveLayers(selection: Selection, registry: Record<string, RegistryEntry>, direction: Direction = 'down') {
  if (!DIRECTIONS.includes(direction)) throw new Error('Unknown direction');
  const s = selection;
  const keys = [
    `body/${s.skin}`, `face/${s.face}`, `eyes/${s.eyes}`,
    `hair-back/${s.hairStyle}/${s.hairColor}`,
    ...(s.outfit ? [`outfit/${s.outfit}`] : [`pants/${s.pants}`, `top/${s.top}`]),
    `shoes/${s.shoes}`, `hair-front/${s.hairStyle}/${s.hairColor}`,
    ...['bag', 'necklace', 'glasses', 'hat'].filter(k => s[k]).map(k => `${k}/${s[k]}`),
  ];
  const missing = keys.filter(k => !registry[k]?.url || !Number.isFinite(registry[k]?.zByDirection?.[direction]));
  const layers = keys.filter(k => !missing.includes(k))
    .map(key => ({ key, ...registry[key] }) as Layer)
    .sort((a, b) => a.zByDirection[direction] - b.zByDirection[direction]);
  return { layers, missing, ready: missing.length === 0 };
}

export function frameAt(elapsedMs: number, moving: boolean, reducedMotion = false) {
  // Frame 0 is idle/contact. 1/2/3 provide the other walk-cycle phases.
  return !moving || reducedMotion ? 0 : Math.floor(elapsedMs / (1000 / ATLAS.fps)) % 4;
}

export type Position = { x: number; y: number; direction?: Direction; moving?: boolean };
export function stepPosition(position: Position, input: { x: number; y: number }, seconds: number, speed: number,
  canOccupy: (x: number, y: number) => boolean = () => true): Position {
  const length = Math.hypot(input.x, input.y);
  if (!length) return { ...position, moving: false };
  const dt = Math.min(Math.max(seconds, 0), .05);
  const dx = input.x / length * speed * dt;
  const dy = input.y / length * speed * dt;
  let x = position.x, y = position.y;
  if (canOccupy(x + dx, y)) x += dx;
  if (canOccupy(x, y + dy)) y += dy;
  const direction: Direction = Math.abs(input.x) > Math.abs(input.y) ? (input.x > 0 ? 'right' : 'left') : (input.y > 0 ? 'down' : 'up');
  return { x, y, moving: x !== position.x || y !== position.y, direction };
}

export async function loadLayerImages(layers: Layer[]): Promise<LoadedLayer[]> {
  return Promise.all(layers.map(async layer => {
    const image = new Image();
    image.src = layer.url;
    await image.decode();
    const fw = layer.frameWidth ?? ATLAS.frameWidth, fh = layer.frameHeight ?? ATLAS.frameHeight;
    if (image.naturalWidth !== fw * 4 || image.naturalHeight !== fh * 4)
      throw new Error(`Atlas dimensions incorrect: ${layer.key}`);
    return { ...layer, image };
  }));
}

// Each call gets a ticket; a result is returned only if no newer call started meanwhile (otherwise null).
export function createLatestLoader<T, R>(load: (input: T) => Promise<R>) {
  let ticket = 0;
  return async (input: T): Promise<R | null> => {
    const mine = ++ticket;
    const result = await load(input);
    return mine === ticket ? result : null;
  };
}

export function drawAvatar(ctx: CanvasRenderingContext2D, layers: LoadedLayer[], direction: Direction, frame: number, x: number, y: number, size = 96) {
  const row = DIRECTIONS.indexOf(direction);
  if (row < 0 || !Number.isInteger(frame) || frame < 0 || frame > 3) throw new Error('Invalid frame');
  for (const layer of layers) {
    const fw = layer.frameWidth ?? ATLAS.frameWidth, fh = layer.frameHeight ?? ATLAS.frameHeight;
    ctx.drawImage(layer.image, frame * fw, row * fh, fw, fh, x - size / 2, y - size, size, size);
  }
}

export function saveAppearance(storage: Storage, selection: Selection) {
  storage.setItem(APPEARANCE_KEY, JSON.stringify({ version: 3, selection }));
}

// Reads only the v3 key. Older app saves (persona-world-look-v1) and v1/v2 package IDs are never mapped into v3.
export function loadAppearance(storage: Storage, catalog: Catalog): Selection {
  try {
    const parsed = JSON.parse(storage.getItem(APPEARANCE_KEY) ?? 'null');
    if (parsed?.version !== 3) return { ...catalog.defaultSelection };
    const selected: Selection = {};
    for (const c of catalog.categories) {
      const id = parsed.selection?.[c.key];
      selected[c.key] = (id === null && c.allowNone) || c.options.some(o => o.id === id) ? id : catalog.defaultSelection[c.key];
    }
    return selected;
  } catch { return { ...catalog.defaultSelection }; }
}
