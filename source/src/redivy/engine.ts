// Red Ivy story engine: pure functions over the generated episode data (no React, no network).
// Saved progress = story id, episode id, node id and the A/B choice per choice point. Learner utterances and
// audio are never written to storage (see memory.ts for the in-memory copy used by the end-of-episode feedback).

export type Option = 'A' | 'B';
export type Channel = 'speech' | 'narration' | 'post' | 'group_chat' | 'private_message' | 'end_card';
type Base = { id: string; scene: number; background: string | null; audience?: boolean; directions?: string[] };
export type LineNode = Base & { kind: 'line'; speaker: string; channel: Channel; text: string; ko?: string; label?: string; portrait?: string; cg?: string; in_branch?: { choice_id: string; option: Option }; next: string | null };
export type BeatNode = Base & { kind: 'beat'; cg?: string; blackout?: boolean; next: string };
export type ChoiceNode = Base & { kind: 'choice'; choice_id: string; title_ko: string; options: { id: Option; intent_ko: string; hint_en: string }[]; branch: Record<Option, string>; rejoin: string; medium?: 'text_message'; next: null };
export type EndNode = Base & { kind: 'end'; next: null };
export type StoryNode = LineNode | BeatNode | ChoiceNode | EndNode;
export type Episode = { story_id: string; episode_id: string; number: number; title: string; access: 'free' | 'premium'; start: string; scenes: { index: number; place_ko: string; background?: string }[]; nodes: StoryNode[] };

export type Progress = { story_id: string; episode_id: string; node_id: string; choices: Record<string, Option>; finished: boolean; updated_at: number };
type Store = { version: 1; episodes: Record<string, Progress> };
export const PROGRESS_KEY = 'persona-world-redivy-v1';

export const node = (ep: Episode, id: string | null | undefined) => (id ? ep.nodes.find(n => n.id === id) : undefined);

/** Next node id after `id`. A choice only advances once its option is known. */
export function nextId(ep: Episode, id: string, choices: Record<string, Option>): string | null {
  const n = node(ep, id);
  if (!n) return null;
  if (n.kind === 'choice') { const o = choices[n.choice_id]; return o ? n.branch[o] : null; }
  return n.next;
}

/** The nodes the player has passed from the start up to (not including) `untilId`, following saved choices. */
export function pathTo(ep: Episode, untilId: string, choices: Record<string, Option>): StoryNode[] {
  const out: StoryNode[] = [];
  let id: string | null = ep.start, guard = 0;
  while (id && id !== untilId && guard++ < 2000) {
    const n = node(ep, id);
    if (!n) break;
    out.push(n);
    id = nextId(ep, id, choices);
  }
  return out;
}

export const choicesOf = (ep: Episode) => ep.nodes.filter((n): n is ChoiceNode => n.kind === 'choice');
/** The last line the player heard before a choice (shown with the choice and used as “상황” in feedback). */
export function promptLine(ep: Episode, choiceId: string): LineNode | undefined {
  const i = ep.nodes.findIndex(n => n.kind === 'choice' && n.choice_id === choiceId);
  for (let k = i - 1; k >= 0; k--) { const n = ep.nodes[k]; if (n.kind === 'line' && !n.in_branch && !n.audience) return n; }
  return undefined;
}

function readStore(storage: Storage): Store {
  try {
    const x = JSON.parse(storage.getItem(PROGRESS_KEY) || 'null');
    if (x && x.version === 1 && x.episodes && typeof x.episodes === 'object') return x;
  } catch { /* corrupt → start empty */ }
  return { version: 1, episodes: {} };
}
/** Saved progress for this episode, or null if missing or no longer valid for the current data. */
export function readProgress(storage: Storage, ep: Episode): Progress | null {
  const p = readStore(storage).episodes[ep.episode_id];
  if (!p || p.story_id !== ep.story_id || typeof p.node_id !== 'string' || !node(ep, p.node_id) || !p.choices || typeof p.choices !== 'object') return null;
  const choices: Record<string, Option> = {};
  for (const c of choicesOf(ep)) { const o = p.choices[c.choice_id]; if (o === 'A' || o === 'B') choices[c.choice_id] = o; }
  // The saved node must be reachable with the saved choices, otherwise branches and lines could get mixed up.
  const path = pathTo(ep, p.node_id, choices);
  const reached = path.length === 0 ? ep.start === p.node_id : nextId(ep, path[path.length - 1].id, choices) === p.node_id;
  if (!reached) return null;
  return { story_id: ep.story_id, episode_id: ep.episode_id, node_id: p.node_id, choices, finished: !!p.finished, updated_at: Number(p.updated_at) || 0 };
}
export function saveProgress(storage: Storage, p: Progress) {
  const s = readStore(storage);
  s.episodes[p.episode_id] = p;
  storage.setItem(PROGRESS_KEY, JSON.stringify(s));
}
export function clearProgress(storage: Storage, episodeId: string) {
  const s = readStore(storage);
  delete s.episodes[episodeId];
  storage.setItem(PROGRESS_KEY, JSON.stringify(s));
}
export const freshProgress = (ep: Episode): Progress => ({ story_id: ep.story_id, episode_id: ep.episode_id, node_id: ep.start, choices: {}, finished: false, updated_at: Date.now() });
