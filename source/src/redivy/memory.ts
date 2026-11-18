// In-memory only (lost on page refresh, never written to localStorage): the learner's utterances for the current
// run of an episode, the pending draft while a choice is open, and the end-of-episode feedback result.
// This follows the project rule that conversation content is not stored; only progress (node + choices) is saved.
import type { Option } from './engine';

export type Utterance = { choice_id: string; option: Option; title_ko: string; intent_ko: string; text: string; check: 'not_opposite' | 'kept_after_warning' | 'unchecked' };
export type Alternative = { en: string; ko: string; nuance_ko: string };
export type FeedbackItem = { choice_id: string; meaning_ko: string; already_natural: boolean; coaching_ko: string; alternatives: Alternative[] };
type Run = { sessionId: string; utterances: Utterance[]; draft: { choice_id: string; option: Option | null; text: string } | null; feedback: { key: string; items: FeedbackItem[] } | null };

const runs = new Map<string, Run>();
export function run(episodeId: string): Run {
  let r = runs.get(episodeId);
  if (!r) { r = { sessionId: crypto.randomUUID(), utterances: [], draft: null, feedback: null }; runs.set(episodeId, r); }
  return r;
}
export function recordUtterance(episodeId: string, u: Utterance) {
  const r = run(episodeId);
  r.utterances = [...r.utterances.filter(x => x.choice_id !== u.choice_id), u];
  r.draft = null; r.feedback = null;
}
export function resetRun(episodeId: string) { runs.delete(episodeId); }
