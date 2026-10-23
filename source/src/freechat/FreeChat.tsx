import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PaperPlaneTilt, ArrowClockwise, Sparkle, Info, CaretDown } from '@phosphor-icons/react';
import { KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from '../mobile';
import { requestReply, errorText, readInvite, saveInvite } from './api';
import type { ChatTurn, Suggestion, LearningCard } from './api';

// Real AI test: Sophie visiting the living room. Session data lives only in this tab (sessionStorage);
// nothing here is long-term memory, and other sessions are never sent to the server.
const STORE = 'persona-world-freechat-v1';
type Saved = { sessionId: string; turns: ChatTurn[]; suggestions: Suggestion[]; card: LearningCard; noticeSeen?: boolean };
const newId = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9-]/g, '');
const fresh = (): Saved => ({ sessionId: newId(), turns: [], suggestions: [], card: null });
function load(): Saved {
  try { const x = JSON.parse(sessionStorage.getItem(STORE) ?? 'null'); if (x && typeof x.sessionId === 'string' && Array.isArray(x.turns)) return { ...fresh(), ...x }; } catch { /* fresh */ }
  return fresh();
}

type Props = { background: string; portrait: string; timeOfDay: 'day' | 'night'; onBack: () => void };

export default function FreeChat({ background, portrait, timeOfDay, onBack }: Props) {
  const keyboard = useKeyboard();
  const { bottomInset, isKeyboardVisible } = useKeyboardInsets();
  const [state, setState] = useState<Saved>(load);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<null | 'opening' | 'reply'>(null);
  const [pending, setPending] = useState<string | null>(null);   // player line waiting for Sophie (not saved yet)
  const [error, setError] = useState<{ code: string; retry: 'opening' | 'send' } | null>(null);
  const [invite, setInvite] = useState(readInvite);
  const [openKo, setOpenKo] = useState<number | null>(null);
  const live = useRef({ sessionId: state.sessionId, mounted: true });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch { /* optional */ } }, [state]);
  useEffect(() => { live.current.sessionId = state.sessionId; }, [state.sessionId]);
  useEffect(() => { live.current.mounted = true; return () => { live.current.mounted = false; }; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [state.turns.length, pending, busy]);

  // Results are applied only if the same session is still open on this screen.
  const stillHere = (sessionId: string) => live.current.mounted && live.current.sessionId === sessionId;

  async function opening(s: Saved) {
    setBusy('opening'); setError(null);
    const res = await requestReply(`${s.sessionId}:opening`, { sessionId: s.sessionId, timeOfDay, turns: [], opening: true });
    if (!stillHere(s.sessionId)) return;
    setBusy(null);
    if (!res.ok) { setError({ code: res.error, retry: 'opening' }); return; }
    const r = res.reply;
    setState(p => p.sessionId !== s.sessionId || p.turns.length ? p : { ...p, turns: [{ role: 'sophie', text: r.speech_text, ko: r.translation_ko, emotion: r.emotion }], suggestions: r.suggested_replies, card: r.learning_card });
  }
  useEffect(() => { if (!state.turns.length && !busy && !error) void opening(state); /* first greeting, once per session */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId]);

  async function send() {
    const text = draft.trim();
    if (!text || busy || text.length > 500) { if (text.length > 500) setError({ code: 'too_long', retry: 'send' }); return; }
    if (!state.turns.length) return;
    keyboard.hide();
    const s = state;
    const turns: ChatTurn[] = [...s.turns, { role: 'you', text }];
    setPending(text); setDraft(''); setBusy('reply'); setError(null);
    const res = await requestReply(`${s.sessionId}:${s.turns.length}:${text}`, { sessionId: s.sessionId, timeOfDay, turns, opening: false });
    if (!stillHere(s.sessionId)) return;
    setBusy(null); setPending(null);
    if (!res.ok) { setDraft(d => d || text); setError({ code: res.error, retry: 'send' }); return; } // keep the draft; nothing saved, so a retry cannot duplicate it
    const r = res.reply;
    setState(p => p.sessionId !== s.sessionId ? p : { ...p, turns: [...turns, { role: 'sophie', text: r.speech_text, ko: r.translation_ko, emotion: r.emotion }], suggestions: r.suggested_replies, card: r.learning_card });
    setOpenKo(null);
  }

  function pickSuggestion(sg: Suggestion) {
    if (busy || !state.suggestions.includes(sg)) return; // stale or while waiting
    if (draft.trim() && draft.trim() !== sg.en && !window.confirm('입력 중인 문장을 추천 답변으로 바꿀까요?')) return;
    setDraft(sg.en); // fill only; the player sends
  }

  function restart() {
    if (busy && !window.confirm('답을 기다리는 중이에요. 새 대화를 시작할까요?')) return;
    keyboard.hide(); setBusy(null); setPending(null); setError(null); setDraft(''); setOpenKo(null);
    const next = { ...fresh(), noticeSeen: state.noticeSeen };
    live.current.sessionId = next.sessionId; setState(next);
  }

  const lastSophie = [...state.turns].reverse().find(t => t.role === 'sophie');
  const needInvite = error?.code === 'invite_required';
  return (
    <section className={`freechat-screen ${isKeyboardVisible ? 'kb-open' : ''}`} aria-label="소피와 자유 대화">
      <img className="scene-art" src={background} alt="거실" />
      <div className="conversation-shade" />
      <img className="freechat-portrait" src={portrait} alt="소피" data-emotion={lastSophie?.emotion ?? 'neutral'} />
      <header className="freechat-header">
        <button className="icon-button" aria-label="맵으로 돌아가기" onClick={() => { keyboard.hide(); onBack(); }}><ArrowLeft size={19} /></button>
        <div><strong>소피</strong><span>거실 · 오랜 친구</span></div>
        <span className="freechat-badge" title="Gemini 무료 티어로 실제 응답을 받아요">실제 AI 대화 · 시험</span>
        <button className="text-chip" onClick={restart}>새 대화</button>
      </header>
      {!state.noticeSeen && <div className="freechat-notice" role="note"><Info size={14} /><p>무료 Gemini API로 실제 답을 받아요. 무료 서비스는 입력 내용을 Google 서비스 개선에 쓸 수 있으니 이름·연락처 같은 개인정보는 쓰지 마세요. 대화는 이 창에서만 기억해요.</p><button onClick={() => setState(p => ({ ...p, noticeSeen: true }))}>확인</button></div>}
      <MobileScroll className="freechat-log">
        <div className="freechat-log-inner">
          {state.turns.map((t, i) => t.role === 'you'
            ? <p key={i} className="bubble you">{t.text}</p>
            : <div key={i} className="bubble sophie"><p>{t.text}</p>{t.ko && <button className="ko-toggle" aria-expanded={openKo === i} onClick={() => setOpenKo(openKo === i ? null : i)}>한국어 뜻 <CaretDown size={11} /></button>}{openKo === i && <p className="ko">{t.ko}</p>}</div>)}
          {pending && <p className="bubble you pending">{pending}</p>}
          {busy && <p className="bubble sophie typing" aria-live="polite">{busy === 'opening' ? '소피가 다가오는 중…' : '소피가 답하는 중…'}</p>}
          {state.card && !busy && <div className="freechat-card"><Sparkle size={15} /><div><b>{state.card.expression}</b><p>{state.card.meaning_ko}</p><small>{state.card.usage_note}</small></div></div>}
          {error && <div className="freechat-error" role="alert"><p>{errorText(error.code)}</p>
            {needInvite
              ? <form onSubmit={e => { e.preventDefault(); saveInvite(invite.trim()); setError(null); if (error.retry === 'opening') void opening(state); }}><KeyboardInput aria-label="시험 참여 코드" value={invite} onChange={e => setInvite(e.target.value)} placeholder="참여 코드" /><button className="text-chip">확인</button></form>
              : !['session_limit', 'daily_limit', 'invite_not_configured', 'too_long'].includes(error.code) && <button className="text-chip" onClick={() => error.retry === 'opening' ? opening(state) : send()}><ArrowClockwise size={13} /> 다시 시도</button>}
          </div>}
          <div ref={endRef} />
        </div>
      </MobileScroll>
      <footer className="freechat-composer" style={{ paddingBottom: Math.max(12, bottomInset + 8) }}>
        {!!state.suggestions.length && !busy && <div className="freechat-suggestions" aria-label="추천 답변">
          {state.suggestions.map(sg => <button key={sg.en} className="suggestion" onClick={() => pickSuggestion(sg)}><small>{sg.intent}</small><span>{sg.en}</span><em>{sg.ko}</em></button>)}
        </div>}
        <form onSubmit={e => { e.preventDefault(); void send(); }}>
          <KeyboardInput aria-label="소피에게 영어로 말하기" placeholder="영어로 자유롭게 써 보세요" value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} disabled={busy === 'opening'} />
          <button className="send-button" aria-label="보내기" disabled={!draft.trim() || !!busy || !state.turns.length}><PaperPlaneTilt size={18} /></button>
        </form>
      </footer>
    </section>
  );
}
