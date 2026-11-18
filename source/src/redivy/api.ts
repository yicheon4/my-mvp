// Browser side of the Red Ivy AI calls. Same-origin /api/ai only (the server holds the key and the trusted scene
// text); this file sends ids, the chosen option and the learner's own sentence(s). No key, no Gemini address here.
import { readInvite, errorText } from '../freechat/api';
import type { Option } from './engine';
import type { FeedbackItem } from './memory';

export type AiFailure = { ok: false; error: string; message: string };
type Check = { verdict: 'opposite' | 'not_opposite'; reason_ko: string };

async function post<T>(body: unknown, signal: AbortSignal, pick: (d: any) => T | null): Promise<{ ok: true; value: T } | AiFailure> {
  try {
    const res = await fetch('/api/ai', { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-invite-code': readInvite().trim() }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const error = data?.error ?? (res.status === 404 ? 'no_server' : 'upstream');
      return { ok: false, error, message: storyError(error) };
    }
    if (data.mode !== 'gemini') return { ok: false, error: 'bad_output', message: storyError('bad_output') };
    const value = pick(data);
    return value ? { ok: true, value } : { ok: false, error: 'bad_output', message: storyError('bad_output') };
  } catch (e) {
    const error = e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network';
    return { ok: false, error, message: storyError(error) };
  }
}
export const storyError = (e: string) => e === 'story_missing' ? '서버에 Red Ivy 대본 데이터가 연결되지 않았어요.' : errorText(e);

export function checkMeaning(a: { sessionId: string; episodeId: string; choiceId: string; option: Option; text: string }, signal: AbortSignal) {
  return post<Check>({ mode: 'red-ivy-check', ...a }, signal, d => (d.check && (d.check.verdict === 'opposite' || d.check.verdict === 'not_opposite') && typeof d.check.reason_ko === 'string' ? d.check : null));
}

export function requestFeedback(a: { sessionId: string; episodeId: string; items: { choiceId: string; option: Option; text: string }[] }, signal: AbortSignal) {
  return post<FeedbackItem[]>({ mode: 'red-ivy-feedback', ...a }, signal, d => {
    const items = d.feedback?.items;
    const ok = Array.isArray(items) && items.length === a.items.length && items.every((x: any, i: number) =>
      x && x.choice_id === a.items[i].choiceId && typeof x.meaning_ko === 'string' && typeof x.coaching_ko === 'string' && typeof x.already_natural === 'boolean'
      && Array.isArray(x.alternatives) && x.alternatives.length === 2 && x.alternatives.every((y: any) => y && typeof y.en === 'string' && typeof y.ko === 'string' && typeof y.nuance_ko === 'string'));
    return ok ? items : null;
  });
}
