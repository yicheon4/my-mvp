// Browser side of Sophie's free chat. Talks ONLY to the same-origin server endpoint; no API key here.
export type ChatTurn = { role: 'you' | 'sophie'; text: string; ko?: string; emotion?: string };
export type Suggestion = { en: string; ko: string; intent: string };
export type LearningCard = { expression: string; meaning_ko: string; usage_note: string } | null;
export type Reply = { speech_text: string; translation_ko: string; emotion: string; suggested_replies: Suggestion[]; learning_card: LearningCard };
export type ChatResult = { ok: true; reply: Reply } | { ok: false; error: string };

const INVITE_KEY = 'persona-world-invite';
export const readInvite = () => { try { return localStorage.getItem(INVITE_KEY) ?? ''; } catch { return ''; } };
export const saveInvite = (v: string) => { try { localStorage.setItem(INVITE_KEY, v); } catch { /* optional */ } };

// One request per (session, turn) even if the screen re-renders, remounts (StrictMode) or the button is tapped twice.
const inflight = new Map<string, Promise<ChatResult>>();
export function requestReply(key: string, body: { sessionId: string; timeOfDay: string; turns: ChatTurn[]; opening: boolean }): Promise<ChatResult> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async (): Promise<ChatResult> => {
    try {
      const res = await fetch('/api/sophie-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-invite-code': readInvite() },
        body: JSON.stringify({ character: 'sophie', place: 'living-room', sessionId: body.sessionId, timeOfDay: body.timeOfDay, opening: body.opening, turns: body.turns.map(t => ({ role: t.role, text: t.text })) }),
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && 'ok' in data) return data as ChatResult;
      return { ok: false, error: res.status === 404 ? 'no_server' : 'upstream' };
    } catch { return { ok: false, error: 'network' }; }
  })();
  inflight.set(key, p);
  p.finally(() => setTimeout(() => inflight.delete(key), 0));
  return p;
}

export const ERRORS: Record<string, string> = {
  quota: '무료 사용 한도에 도달했어요(429). 잠시 뒤나 내일 다시 시도해 주세요. 유료로 바꾸지 않아요.',
  too_fast: '조금만 천천히 보내 주세요.',
  session_limit: '이번 대화의 시험 횟수를 다 썼어요. 「새 대화」로 다시 시작해 주세요.',
  daily_limit: '오늘 시험 사용량을 다 썼어요. 내일 다시 시도해 주세요.',
  auth: 'API 키 인증에 실패했어요. 서버에 넣은 키가 맞는지 확인해 주세요.',
  key_missing: '서버에 GEMINI_API_KEY가 아직 없어요. 키를 넣은 뒤 서버를 다시 켜 주세요.',
  model_missing: '서버에 GEMINI_MODEL(모델 이름)이 아직 없어요.',
  model_not_found: '모델 이름(GEMINI_MODEL)을 찾을 수 없어요. 무료 모델 이름을 확인해 주세요.',
  network: '네트워크 연결이 불안정해요. 다시 시도해 주세요.',
  timeout: '응답이 너무 늦어요. 다시 시도해 주세요.',
  blocked: '안전 기준 때문에 답을 받지 못했어요. 다른 말로 시도해 주세요.',
  bad_output: 'AI 응답 형식이 올바르지 않아 표시하지 않았어요. 다시 시도해 주세요.',
  empty: 'AI가 빈 응답을 보냈어요. 다시 시도해 주세요.',
  upstream: 'AI 서버에서 오류가 났어요. 잠시 뒤 다시 시도해 주세요.',
  invite_required: '시험 참여 코드가 필요해요.',
  invite_not_configured: '이 미리보기에는 아직 시험 참여 코드가 설정되지 않아 대화를 열 수 없어요.',
  no_server: '대화 서버를 찾지 못했어요. 이 주소에서는 AI 대화를 쓸 수 없어요.',
  too_long: '메시지가 너무 길어요(500자까지).',
};
export const errorText = (e: string) => ERRORS[e] ?? '대화를 이어가지 못했어요. 다시 시도해 주세요.';
