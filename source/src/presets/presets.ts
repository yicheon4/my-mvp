/** Persona World v9 complete-character presets.
 * A selection {head, look, extra} resolves to ONE already-complete full-body frame in an atlas.
 * Never layer or cut body parts. Adapted from PersonaWorld_Presets_v9/integration/presets.mjs.
 * Only plain type annotations so `node --test` can run this file directly.
 */
export const BASE = '/persona-v9/';
export const STORAGE_KEY = 'persona-world-presets-v9';
export const EXTRAS = ['none', 'necklace', 'bag'] as const;
export type Extra = typeof EXTRAS[number];
export type Selection = { head: string; look: string; extra: Extra };
export const DEFAULT_SELECTION: Selection = Object.freeze({ head: 'H01', look: 'L01', extra: 'none' }) as Selection;

export type Catalog = {
  heads: { id: string; name: string }[];
  looks: { id: string; name: string }[];
  extras: { id: string; name: string; locked: boolean; category?: string; artStatus?: string }[];
};
export type Entry = { src: string; sourceRect: [number, number, number, number]; imageSize: [number, number]; head: string; look: string; extra: Extra };
export type Manifest = { characters: Record<string, Entry> };
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

// Locked (premium, art not included) extras are never accepted into the selection.
export function validateSelection(selection: unknown, catalog: Catalog): Selection {
  const raw = (selection && typeof selection === 'object' ? selection : {}) as Partial<Selection>;
  return {
    head: catalog.heads.some(x => x.id === raw.head) ? raw.head! : DEFAULT_SELECTION.head,
    look: catalog.looks.some(x => x.id === raw.look) ? raw.look! : DEFAULT_SELECTION.look,
    extra: EXTRAS.includes(raw.extra as Extra) ? raw.extra as Extra : 'none',
  };
}

export const keyOf = (s: Selection) => `${s.head}_${s.look}_${s.extra}`;

export function resolveCharacter(selection: Selection, manifest: Manifest): Entry {
  const entry = manifest.characters[keyOf(selection)];
  if (!entry) throw new Error(`완성 이미지가 없는 조합: ${keyOf(selection)}`);
  return entry;
}

// Reads only the v9 key. Older look saves (persona-world-look-v1, v7 world lookId) are never mapped to a head.
export function readSelection(catalog: Catalog, storage: Storage): Selection {
  try { return validateSelection(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'), catalog); }
  catch { return { ...DEFAULT_SELECTION }; }
}

export function saveSelection(selection: Selection, catalog: Catalog, storage: Storage): Selection {
  const s = validateSelection(selection, catalog);
  storage.setItem(STORAGE_KEY, JSON.stringify(s));
  return s;
}

export const assetUrl = (src: string) => BASE + src.replace(/^\.?\//, '');
export const lookThumb = (head: string, look: string) => `${BASE}thumbs/${head}_${look}.webp`;
export const headThumb = (head: string) => `${BASE}thumbs/${head}.webp`;

// Catalog + manifest are fetched once (small JSON); atlases are loaded only for the current selection.
let dataPromise: Promise<{ catalog: Catalog; manifest: Manifest }> | null = null;
export function loadPresetData(fetcher: typeof fetch = fetch) {
  dataPromise ??= Promise.all([
    fetcher(BASE + 'catalog.json').then(r => { if (!r.ok) throw new Error('catalog ' + r.status); return r.json(); }),
    fetcher(BASE + 'manifest.json').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); }),
  ]).then(([catalog, manifest]) => ({ catalog, manifest })).catch(e => { dataPromise = null; throw e; });
  return dataPromise;
}
