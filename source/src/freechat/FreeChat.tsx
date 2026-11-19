import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PaperPlaneTilt, ArrowClockwise, Sparkle, CaretDown } from '@phosphor-icons/react';
import { KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from '../mobile';
import { requestReply, errorText, readInvite, saveInvite } from './api';
import type { ChatTurn, Suggestion, LearningCard, StoryChat } from './api';

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

// Reuse complete approved EP01 portraits; never splice faces or request new images.
const CHAT_POSES: Record<string, string[]> = {
  chloe: ['00_base','01_toast_front','01_toast_front','02_question_front','04_guarded_front','06_defensive_down','03_challenge'],
  sophie: ['02_attentive','00_neutral','03_dry_humor','04_explain','02_attentive','05_tense','05_tense'],
  ethan: ['00_neutral','01_dry_joke','01_dry_joke','02_skeptical','02_skeptical','02_skeptical','04_challenge'],
  luna: ['00_neutral','05_trust','01_arrival','03_ask_player','04_elena','02_pushback','02_pushback'],
  julian: ['00_neutral','01_joking','02_wry_observer','02_wry_observer','04_defend_luna','03_embarrassed','05_stop_game'],
  oliver: ['00_neutral','04_welcome','01_toast','02_wry','03_im_fine','05_elena','03_im_fine'],
};
const MOODS = ['neutral','warm','playful','curious','concerned','disappointed','firm'];
function ChatPortrait({ base, character, emotion, name }: {base:string; character?:string; emotion:string; name:string}) {
  const [frame,setFrame] = useState({src:base, previous:base});
  const [failed,setFailed] = useState(false);
  const index = Math.max(0, MOODS.indexOf(emotion));
  const pose = character && CHAT_POSES[character]?.[index];
  const wanted = pose ? `/red-ivy/characters/${character}/${pose}.webp` : base;
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.onload = async () => {
      try { await img.decode(); } catch { /* loaded pixels remain usable */ }
      if (active) { setFailed(false); setFrame(f => f.src === wanted ? f : {src:wanted,previous:f.src}); }
    };
    img.onerror = () => { if(active) setFailed(true); }; // retain the last valid portrait
    img.src = wanted;
    return () => { active=false; img.onload=null; img.onerror=null; };
  }, [wanted]);
  return <div className="freechat-portrait" data-emotion={emotion} data-image-error={failed || undefined}>
    <img src={frame.previous} alt="" aria-hidden="true" draggable={false}/>
    <img key={frame.src} className="chat-portrait-current" src={frame.src} alt={name} draggable={false}/>
  </div>;
}

const MAX = 500, WARN_AT = 450;   // same limit as the server (LIMITS.userChars)

type Props = { background: string; portrait: string; timeOfDay: 'day' | 'night'; onBack: () => void; story?: StoryChat; characterName?: string; backLabel?: string; onSaveCard?: (card: NonNullable<LearningCard>) => void; isCardSaved?: (en: string) => boolean };

export default function FreeChat({ background, portrait, timeOfDay, onBack, story, characterName = '소피', backLabel, onSaveCard, isCardSaved }: Props) {
  const keyboard = useKeyboard();
  const { bottomInset, isKeyboardVisible } = useKeyboardInsets();
  const [state, setState] = useState<Saved>(() => story ? fresh() : load());
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<null | 'opening' | 'reply'>(null);
  const [pending, setPending] = useState<string | null>(null);   // player line waiting for Sophie (not saved yet)
  const [error, setError] = useState<{ code: string; retry: 'opening' | 'send' } | null>(null);
  const [invite, setInvite] = useState(readInvite);
  const [openKo, setOpenKo] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);        // input guidance (empty / length); never sent to the server
  const live = useRef({ sessionId: state.sessionId, mounted: true });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (story) return; try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch { /* optional */ } }, [state]);
  useEffect(() => { live.current.sessionId = state.sessionId; }, [state.sessionId]);
  useEffect(() => { live.current.mounted = true; return () => { live.current.mounted = false; }; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [state.turns.length, pending, busy]);

  // Results are applied only if the same session is still open on this screen.
  const stillHere = (sessionId: string) => live.current.mounted && live.current.sessionId === sessionId;

  async function opening(s: Saved) {
    setBusy('opening'); setError(null);
    const res = await requestReply(`${s.sessionId}:opening`, { sessionId: s.sessionId, timeOfDay, turns: [], opening: true, story });
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
    if (busy) return;                                   // one request at a time
    if (!text) { setHint(errorText('empty_input')); return; } // no server call for an empty line
    if (text.length > MAX) { setHint(errorText('too_long')); return; }
    setHint(null);
    if (!state.turns.length) return;
    keyboard.hide();
    const s = state;
    const turns: ChatTurn[] = [...s.turns, { role: 'you', text }];
    setPending(text); setDraft(''); setBusy('reply'); setError(null);
    const res = await requestReply(`${s.sessionId}:${s.turns.length}:${text}`, { sessionId: s.sessionId, timeOfDay, turns, opening: false, story });
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
    setDraft(sg.en); setHint(null); // fill only; the player sends
  }

  function restart() {
    if (busy && !window.confirm('답을 기다리는 중이에요. 새 대화를 시작할까요?')) return;
    keyboard.hide(); setBusy(null); setPending(null); setError(null); setDraft(''); setOpenKo(null); setHint(null);
    const next = { ...fresh(), noticeSeen: state.noticeSeen };
    live.current.sessionId = next.sessionId; setState(next);
  }

  const lastSophie = [...state.turns].reverse().find(t => t.role === 'sophie');
  const needInvite = error?.code === 'invite_required' || error?.code === 'invite_invalid';
  return (
    <section className={`freechat-screen ${isKeyboardVisible ? 'kb-open' : ''}`} aria-label={`${characterName}와 자유 대화`}>
      <img className="scene-art" src={background} alt={story ? "크림슨 클럽" : "거실"} />
      <div className="conversation-shade" />
      <ChatPortrait key={`${state.sessionId}:${portrait}`} base={portrait} character={story?.character} emotion={lastSophie?.emotion ?? 'neutral'} name={characterName} />
      <header className="freechat-header">
        <button className="icon-button" aria-label={backLabel ?? (story ? "1화 피드백으로 돌아가기" : "맵으로 돌아가기")} onClick={() => { keyboard.hide(); onBack(); }}><ArrowLeft size={19} /></button>
        <div><strong>{characterName}</strong><span>{story ? (story.entry === "meet" ? "첫 만남" : "이야기 이후") : "거실 · 오랜 친구"}</span></div>

        <button className="text-chip" onClick={restart}>새 대화</button>
      </header>

      <MobileScroll className="freechat-log">
        <div className="freechat-log-inner">
          {state.turns.map((t, i) => t.role === 'you'
            ? <p key={i} className="bubble you">{t.text}</p>
            : <div key={i} className="bubble sophie"><p>{t.text}</p>{t.ko && <button className="ko-toggle" aria-expanded={openKo === i} onClick={() => setOpenKo(openKo === i ? null : i)}>한국어 뜻 <CaretDown size={11} /></button>}{openKo === i && <p className="ko">{t.ko}</p>}</div>)}
          {pending && <p className="bubble you pending">{pending}</p>}
          {busy && <p className="bubble sophie typing" aria-live="polite">{busy === 'opening' ? `${characterName}의 첫 답변을 기다리는 중…` : `${characterName}의 답변을 기다리는 중…`}</p>}
          {state.card && !busy && <div className="freechat-card"><Sparkle size={15} /><div><b>{state.card.expression}</b><p>{state.card.meaning_ko}</p><small>{state.card.usage_note}</small>{onSaveCard && <button className="text-chip" disabled={isCardSaved?.(state.card.expression)} onClick={() => state.card && onSaveCard(state.card)}>{isCardSaved?.(state.card.expression) ? "메모장에 저장됨" : "이 표현 저장"}</button>}</div></div>}
          {error && !needInvite && <div className="freechat-error" role="alert"><p>{errorText(error.code)}</p>
            {!['session_limit', 'daily_limit', 'invite_not_configured', 'too_long'].includes(error.code) && <button className="text-chip" onClick={() => error.retry === 'opening' ? opening(state) : send()}><ArrowClockwise size={13} /> 다시 시도</button>}
          </div>}
          <div ref={endRef} />
        </div>
      </MobileScroll>
      <footer className="freechat-composer" style={{ paddingBottom: Math.max(12, bottomInset + 8) }}>
        {error && needInvite && <div className="freechat-error" role="alert"><p>{errorText(error.code)}</p>
          <form onSubmit={e => { e.preventDefault(); keyboard.hide(); saveInvite(invite.trim()); setError(null); if (error.retry === 'opening') void opening(state); else void send(); }}>
            <KeyboardInput aria-label="시험 참여 코드" type="password" autoComplete="off" value={invite} onChange={e => setInvite(e.target.value)} placeholder="참여 코드" /><button className="text-chip">확인</button>
          </form>
        </div>}
        {!!state.suggestions.length && !busy && !needInvite && <div className="freechat-suggestions" aria-label="추천 답변">
          {state.suggestions.map(sg => <button key={sg.en} className="suggestion" onClick={() => pickSuggestion(sg)}><small>{sg.intent}</small><span>{sg.en}</span><em>{sg.ko}</em></button>)}
        </div>}
        {!needInvite && <form onSubmit={e => { e.preventDefault(); void send(); }}>
          <KeyboardInput aria-label={`${characterName}에게 영어로 말하기`} placeholder="영어로 자유롭게 써 보세요" value={draft} maxLength={500} onChange={e => { setDraft(e.target.value.slice(0, MAX)); setHint(null); }} disabled={busy === 'opening'} />
          <button className="send-button" aria-label="보내기" disabled={!!busy || !state.turns.length}><PaperPlaneTilt size={18} /></button>
        </form>}
        {(hint || draft.length >= WARN_AT) && <p className="freechat-hint" role="status">{hint ?? `${draft.length}/${MAX}자 · ${MAX - draft.length}자 남았어요`}</p>}
        {!isKeyboardVisible && <details className="chat-information"><summary>대화 이용 안내</summary><p>대화 내용은 Google Gemini로 전송되며 무료 서비스에서는 서비스 개선에 쓰일 수 있어요. 개인정보는 입력하지 마세요. 최근 대화 일부를 참고하며, 이 화면을 나가면 대화가 초기화돼요. 직접 저장한 표현은 메모장에 남아요.</p></details>}
      </footer>
    </section>
  );
}
