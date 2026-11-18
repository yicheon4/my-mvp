// Red Ivy story player (season 1). First-person: the player is the club's new member, a seventh person who never
// speaks for the six characters. Images are optional slots (art-manifest.ts); missing art shows placeholders.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Chats, Check, LockSimple, Microphone, PaperPlaneTilt, Sparkle, SpeakerHigh, Stop, Translate, X, ArrowCounterClockwise, Lightbulb, DeviceMobile, Eye } from '@phosphor-icons/react';
import { BottomSheet, KeyboardInput, KeyboardTextarea, MobileScroll, useKeyboard, useKeyboardInsets } from '../mobile';
import { readInvite, saveInvite } from '../freechat/api';
import { backgroundFile, backgrounds, cast, cgFile, cgs, portraitFile, splitPortrait, voices } from './art-manifest';
import type { CastId } from './art-manifest';
import { catalog, DEV_UNLOCK_ALL, isOpen } from './episodes';
import type { CatalogEntry } from './episodes';
import { choicesOf, clearProgress, freshProgress, node as findNode, nextId, pathTo, promptLine, readProgress, saveProgress } from './engine';
import type { ChoiceNode, Episode, LineNode, Option, Progress, StoryNode } from './engine';
import { recordUtterance, resetRun, run } from './memory';
import type { FeedbackItem, Utterance } from './memory';
import { checkMeaning, requestFeedback } from './api';
import './redivy.css';

export type NotePhrase = { id: string; en: string; ko: string; context: string };
type View = 'list' | 'intro' | 'play' | 'feedback';
type Phase = 'pick' | 'input' | 'checking' | 'opposite' | 'check_failed';

const PHONE: LineNode['channel'][] = ['post', 'group_chat', 'private_message'];
const OPPOSITE_TEXT = '방금 문장은 선택한 뜻과 반대로 전달될 수 있어요. 다시 말해볼까요?';

function safeStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }

// Image with a placeholder underneath: the placeholder is always drawn, the image fades in only after it has
// loaded and disappears on error, so a missing file never leaves an empty or flickering stage.
function Art({ src, className, alt = '' }: { src: string | null; className: string; alt?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => setState('loading'), [src]);
  if (!src || state === 'error') return null;
  return <img className={`${className} ri-art ${state === 'ok' ? 'is-loaded' : ''}`} src={src} alt={alt} draggable={false} onLoad={() => setState('ok')} onError={() => setState('error')} />;
}

// Preload cache: an image is shown only after it has decoded, so the stage never flashes an empty layer.
const preloaded = new Map<string, Promise<boolean>>();
function preload(src: string | null | undefined): Promise<boolean> {
  if (!src) return Promise.resolve(false);
  let p = preloaded.get(src);
  if (!p) {
    const img = new Image(); img.decoding = 'async'; img.src = src;
    p = (img.decode ? img.decode() : new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = bad; }))
      .then(() => true, () => !!(img.complete && img.naturalWidth));
    p.then(ok => { if (!ok) preloaded.delete(src); }); // allow a retry later if the file was missing
    preloaded.set(src, p);
  }
  return p;
}

// Crossfading image layer. A new src replaces the current one only once it has loaded (~0.3s fade, none with
// reduced motion). If it fails to load, the previous image stays. src=null clears the layer.
let layerSeq = 0;
function FadeLayer({ src, render }: { src: string | null; render: (src: string) => ReactNode }) {
  const [layers, setLayers] = useState<{ src: string; id: number }[]>([]);
  useEffect(() => {
    if (!src) { setLayers([]); return; }
    let alive = true;
    preload(src).then(ok => { if (alive && ok) setLayers(l => (l[l.length - 1]?.src === src ? l : [...l.slice(-1), { src, id: ++layerSeq }])); });
    return () => { alive = false; };
  }, [src]);
  return <>{layers.map((l, i) => <div key={l.id} className={`ri-layer ${i === layers.length - 1 ? 'is-top' : ''}`}
    onAnimationEnd={() => setLayers(ls => (ls.length > 1 && ls[ls.length - 1].id === l.id ? [l] : ls))}>{render(l.src)}</div>)}</>;
}

function Stage({ bg, cgId, blackout, place }: { bg: string | null; cgId?: string; blackout?: boolean; place: string }) {
  const color = (bg && backgrounds[bg]?.color) || '#241a2a';
  if (blackout) return <div className="ri-stage ri-blackout" aria-hidden="true" />;
  return <div className="ri-stage" style={{ background: `linear-gradient(180deg, ${color} 0%, #1a1220 100%)` }}>
    {/* 9:16 plate: cover on phones; on wider screens the plate stays centred over a blurred copy of itself. */}
    <FadeLayer src={backgroundFile(bg)} render={s => <><img className="ri-bg-blur" src={s} alt="" draggable={false} /><img className="ri-bg" src={s} alt={place} draggable={false} /></>} />
    {cgId && <div className="ri-cg"><div className="ri-cg-placeholder"><Eye size={22} weight="thin" /><span>{cgs[cgId]?.label ?? '특별 장면'}</span></div><Art key={cgId} src={cgFile(cgId)} className="ri-cg-img" /></div>}
  </div>;
}

function Silhouette({ id }: { id: CastId }) {
  const c = cast[id];
  return <div className="ri-silhouette" style={{ ['--ri-tint' as string]: c?.color ?? '#555' }} aria-hidden="true">
    <svg viewBox="0 0 200 300"><circle cx="100" cy="78" r="44" /><path d="M20 300 C24 190 58 150 100 150 C142 150 176 190 180 300 Z" /></svg>
    <span>{c?.name}</span><small>{c?.ko}</small>
  </div>;
}

// Dialogue portrait (head-to-thigh 1024×1536 canvas), shown as a close conversation partner, not a floor sprite.
// Every file uses the same container and ratio; the same file on consecutive lines never re-transitions.
function Portrait({ slot, lift }: { slot?: string; lift: number }) {
  const src = slot ? portraitFile(slot) : null;
  const character = slot ? splitPortrait(slot).character : null;
  return <div className="ri-portrait" data-slot={slot ?? ''} style={lift ? { ['--ri-lift' as string]: `${lift}px` } : undefined}>
    {slot && !src && character && <Silhouette id={character} />}
    <FadeLayer src={src} render={s => <img className="ri-portrait-img" src={s} alt={character ? cast[character]?.name ?? '' : ''} draggable={false} />} />
  </div>;
}

/** Art the next few taps can show (both branches at a choice), so it is decoded before it is needed. */
function upcomingArt(ep: Episode, fromId: string, choices: Record<string, Option>): string[] {
  const out = new Set<string>(); const queue: [string | null, number][] = [[fromId, 0]];
  while (queue.length) {
    const [id, depth] = queue.shift()!;
    const n = findNode(ep, id); if (!n || depth > 5) continue;
    const bg = backgroundFile(n.background); if (bg) out.add(bg);
    if (n.kind === 'line') { const p = portraitFile(n.portrait); if (p) out.add(p); }
    if (n.kind === 'choice') { const o = choices[n.choice_id]; for (const b of o ? [n.branch[o]] : [n.branch.A, n.branch.B]) queue.push([b, depth + 1]); }
    else queue.push([n.next, depth + 1]);
  }
  return [...out];
}

function speakerName(n: LineNode) {
  if (n.channel === 'narration' || n.channel === 'end_card') return '';
  if (n.label) return n.label;
  return cast[n.speaker as CastId]?.name ?? voices[n.speaker] ?? n.speaker.toUpperCase();
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = .9;
  const v = window.speechSynthesis.getVoices().find(x => x.lang === 'en-US'); if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

function InviteField() {
  const [invite, setInvite] = useState(readInvite);
  return <details className="ri-invite"><summary>시험 참여 코드 (AI 피드백용)</summary>
    <KeyboardInput aria-label="시험 참여 코드" type="password" autoComplete="off" value={invite} placeholder="안내받은 참여 코드" onChange={e => { setInvite(e.target.value); saveInvite(e.target.value.trim()); }} />
    <small>API 키가 아닌 참여 코드예요. 로컬 개발 서버에 코드가 설정돼 있지 않다면 비워 둬도 돼요.</small>
  </details>;
}

// Shared across mounts so a StrictMode remount or a quick re-entry does not send the same feedback request twice.
const inflight = new Map<string, Promise<{ ok: true; value: FeedbackItem[] } | { ok: false; error: string; message: string }>>();

export default function RedIvy({ notes, onSaveNote, onExit }: { notes: NotePhrase[]; onSaveNote: (p: NotePhrase) => boolean; onExit: () => void }) {
  const keyboard = useKeyboard();
  const { bottomInset } = useKeyboardInsets();
  const [view, setView] = useState<View>('list');
  const [entry, setEntry] = useState<CatalogEntry | null>(null);
  const ep = entry?.data ?? null;
  const [progress, setProgress] = useState<Progress | null>(null);
  const [userLine, setUserLine] = useState<{ choice_id: string; text: string; text_message: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [option, setOption] = useState<Option | null>(null);
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState(false);
  const [showKo, setShowKo] = useState(false);
  const [sheet, setSheet] = useState<'history' | 'notebook' | null>(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const [checkInfo, setCheckInfo] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [storageError, setStorageError] = useState('');
  const recognition = useRef<any>(null);
  const checkCtrl = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [lift, setLift] = useState(0);

  useEffect(() => () => { recognition.current?.abort(); checkCtrl.current?.abort(); window.speechSynthesis?.cancel(); }, []);
  // Persist progress (ids only). Utterances stay in memory.ts.
  useEffect(() => {
    if (!progress) return;
    const s = safeStorage();
    try { if (!s) throw new Error('no storage'); saveProgress(s, progress); setStorageError(''); }
    catch { setStorageError('이 브라우저에서는 진행 상황을 저장할 수 없어요. 새로고침하면 처음부터 시작돼요.'); }
  }, [progress]);

  const current = ep && progress ? findNode(ep, progress.node_id) : undefined;
  // Decode the art the next taps can reach (from the intro too) so scene and expression changes don't wait.
  useEffect(() => { if (ep && (view === 'intro' || view === 'play')) upcomingArt(ep, progress?.node_id ?? ep.start, progress?.choices ?? {}).forEach(preload); }, [ep, view, progress?.node_id]); // eslint-disable-line react-hooks/exhaustive-deps
  // When the dialogue/choice panel grows past ~32% of the screen (two languages, larger text, mic notice), lift the
  // portrait a little (max 6%) instead of shrinking it; anything taller simply covers the lower body.
  useEffect(() => {
    const el = bottomRef.current, root = el?.parentElement;
    if (!el || !root) { setLift(0); return; }
    const update = () => {
      // Rects are in viewport px (the phone frame may be CSS-scaled); --ri-lift is in the screen's own px.
      const rr = root.getBoundingClientRect(), H = rr.height; if (!H) return;
      const panel = rr.bottom - el.getBoundingClientRect().top;
      setLift(Math.round(Math.min(.06 * H, Math.max(0, panel - .32 * H)) * (root.clientHeight / H)));
    };
    const ro = new ResizeObserver(update); ro.observe(el); ro.observe(root); update();
    return () => ro.disconnect();
  }, [view, bottomInset, current?.id]);
  const path = useMemo(() => (ep && progress ? pathTo(ep, progress.node_id, progress.choices) : []), [ep, progress]);
  const utterances = ep ? run(ep.episode_id).utterances : [];
  const saved = (en: string) => notes.some(n => n.en.trim().toLowerCase() === en.trim().toLowerCase());

  // Restore the open choice (picked option + draft) after the notebook/history sheet or a remount.
  useEffect(() => {
    if (!ep || current?.kind !== 'choice') return;
    const d = run(ep.episode_id).draft;
    if (d && d.choice_id === current.choice_id) { setOption(d.option); setDraft(d.text); setPhase(d.option ? 'input' : 'pick'); }
    else { setOption(null); setDraft(''); setPhase('pick'); }
    setHint(false); setCheckInfo('');
  }, [ep, current?.id]);
  useEffect(() => { if (ep && current?.kind === 'choice') run(ep.episode_id).draft = { choice_id: current.choice_id, option, text: draft }; }, [ep, current?.id, option, draft]);

  function stopMic() { recognition.current?.abort(); recognition.current = null; setListening(false); }
  function openEpisode(e: CatalogEntry) {
    if (!isOpen(e)) return;
    setEntry(e); setConfirmRestart(false); setView('intro');
  }
  function startEpisode(mode: 'continue' | 'restart') {
    if (!ep) return;
    keyboard.hide(); stopMic(); setUserLine(null); setSheet(null);
    const s = safeStorage();
    if (mode === 'restart') { resetRun(ep.episode_id); try { if (s) clearProgress(s, ep.episode_id); } catch { /* storage unavailable */ } setProgress(freshProgress(ep)); setView('play'); return; }
    const p = s ? readProgress(s, ep) : null;
    if (p?.finished) { setProgress(p); setView('feedback'); return; }
    setProgress(p ?? freshProgress(ep)); setView('play');
  }
  function finish() { setProgress(p => (p ? { ...p, finished: true, updated_at: Date.now() } : p)); setView('feedback'); }
  function advance() {
    if (!ep || !progress || sheet) return;
    window.speechSynthesis?.cancel();
    if (userLine) { setUserLine(null); return; }
    if (!current || current.kind === 'choice') return;
    if (current.kind === 'end') { finish(); return; }
    const next = nextId(ep, current.id, progress.choices);
    if (!next) { finish(); return; }
    setProgress(p => (p ? { ...p, node_id: next, updated_at: Date.now() } : p));
  }
  function commit(check: Utterance['check']) {
    if (!ep || current?.kind !== 'choice' || !option) return;
    const c = current, text = draft.trim(), o = c.options.find(x => x.id === option)!;
    recordUtterance(ep.episode_id, { choice_id: c.choice_id, option, title_ko: c.title_ko, intent_ko: o.intent_ko, text, check });
    keyboard.hide(); stopMic();
    setUserLine({ choice_id: c.choice_id, text, text_message: c.medium === 'text_message' });
    setProgress(p => (p ? { ...p, node_id: c.branch[option], choices: { ...p.choices, [c.choice_id]: option }, updated_at: Date.now() } : p));
  }
  async function submit() {
    if (!ep || current?.kind !== 'choice' || !option || !draft.trim() || phase === 'checking') return;
    keyboard.hide(); stopMic(); setPhase('checking'); setCheckInfo('');
    const ctrl = new AbortController(); checkCtrl.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const r = await checkMeaning({ sessionId: run(ep.episode_id).sessionId, episodeId: ep.episode_id, choiceId: current.choice_id, option, text: draft.trim() }, ctrl.signal);
    clearTimeout(timer);
    if (checkCtrl.current !== ctrl) return;
    checkCtrl.current = null;
    if (!r.ok) { setCheckInfo(r.message); setPhase('check_failed'); return; }
    if (r.value.verdict === 'opposite') { setCheckInfo(r.value.reason_ko); setPhase('opposite'); return; }
    commit('not_opposite');
  }
  function mic() {
    if (listening) { recognition.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !window.isSecureContext) { setNotice('이 환경에서는 마이크를 쓸 수 없어요. 아래 칸에 영어로 입력해 주세요.'); return; }
    setNotice(''); window.speechSynthesis?.cancel();
    const rec = new SR(); recognition.current = rec; rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e: any) => { const t = String(e.results[0][0].transcript ?? ''); setDraft(t); setListening(false); setNotice('인식된 문장이에요. 틀린 부분은 고친 뒤 말하기를 눌러 주세요.'); };
    rec.onerror = (e: any) => { setListening(false); if (e.error === 'aborted') return; setNotice(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? '마이크 권한이 꺼져 있어요. 아래 칸에 영어로 입력해서 계속할 수 있어요.' : '음성을 알아듣지 못했어요. 다시 말하거나 아래 칸에 입력해 주세요.'); };
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setListening(false); setNotice('마이크를 시작하지 못했어요. 아래 칸에 입력해 주세요.'); }
  }

  // ---------- list ----------
  if (view === 'list') return <div className="ri-root">
    <header className="page-header"><button className="icon-button" aria-label="나의 방으로" onClick={onExit}><ArrowLeft size={22} /></button><div><p className="eyebrow">RED IVY · SEASON 1</p><h1>아이비의 붉은 덩굴</h1><p className="muted">크림슨 클럽의 신입 멤버가 되어, 영어로 직접 말해요.</p></div></header>
    <MobileScroll className="pw-scroll"><main className="ri-list">
      {catalog.map(e => {
        const open = isOpen(e); const s = safeStorage(); const p = e.data && s ? readProgress(s, e.data) : null;
        return <button key={e.episode_id} className={`ri-ep ${open ? '' : 'is-locked'}`} disabled={!open} aria-label={`${e.number}화 ${e.title}${open ? '' : ' 열 수 없음'}`} onClick={() => openEpisode(e)}>
          <span className="ri-ep-no">EP{String(e.number).padStart(2, '0')}</span>
          <span className="ri-ep-body"><strong>{e.title}</strong><small>{e.access === 'free' ? '무료' : '유료 예정'} · {!e.data ? '준비 중' : p?.finished ? '완료' : p ? '이어하기 가능' : '시작 전'}{e.access === 'premium' && e.data && DEV_UNLOCK_ALL ? ' · 개발 검토로 열림' : ''}</small></span>
          {open ? <ArrowRight size={16} /> : <LockSimple size={16} />}
        </button>;
      })}
    </main></MobileScroll>
  </div>;

  if (!ep || !entry) return null;
  const s = safeStorage();
  const saveState = s ? readProgress(s, ep) : null;

  // ---------- intro ----------
  if (view === 'intro') return <div className="ri-root ri-intro">
    <Stage bg={ep.scenes[0]?.background ?? null} place={ep.scenes[0]?.place_ko ?? ''} />
    <header className="ri-top"><button className="icon-button" aria-label="에피소드 목록" onClick={() => setView('list')}><ArrowLeft size={22} /></button><span>RED IVY · EP{String(ep.number).padStart(2, '0')}</span></header>
    <section className="ri-intro-card">
      <p className="eyebrow">EPISODE {ep.number} · {ep.access === 'free' ? '무료' : '유료 예정'}</p>
      <h1>{ep.title}</h1>
      {entry?.intro && <p className="ri-intro-copy">{entry.intro}</p>}
      {saveState && !confirmRestart && <button className="gold-button" onClick={() => startEpisode('continue')}>{saveState.finished ? '마지막 화면 보기' : '이어하기'}<ArrowRight size={18} /></button>}
      {!saveState && <button className="gold-button" onClick={() => startEpisode('restart')}>시작하기<ArrowRight size={18} /></button>}
      {saveState && (confirmRestart
        ? <div className="ri-confirm"><p>지금까지의 진행과 선택을 지우고 처음부터 시작할까요?</p><div><button className="text-button" onClick={() => setConfirmRestart(false)}>취소</button><button className="gold-button" onClick={() => startEpisode('restart')}>처음부터 시작</button></div></div>
        : <button className="text-button" onClick={() => setConfirmRestart(true)}><ArrowCounterClockwise size={15} />처음부터 다시 시작</button>)}
      <details className="ri-privacy"><summary>AI·저장 안내</summary><p>말하기를 누르면 입력한 영어 문장, 선택한 뜻, 직전 장면 대사가 Google Gemini로 전달돼요. 이름·연락처 같은 개인정보는 말하지 마세요. 앱은 진행 위치와 선택(A/B)만 이 브라우저에 저장하고, 내가 한 말의 원문과 음성은 저장하지 않아요.</p></details>
      {storageError && <p className="ri-error" role="alert">{storageError}</p>}
    </section>
  </div>;

  // ---------- feedback ----------
  if (view === 'feedback') return <FeedbackView ep={ep} utterances={utterances} picks={progress?.choices ?? {}} saved={saved} onSaveNote={onSaveNote}
    onRestart={() => { setConfirmRestart(false); startEpisode('restart'); }} onList={() => setView('list')} onExit={onExit} />;

  // ---------- play ----------
  if (!current || !progress) return null;
  const scene = ep.scenes.find(x => x.index === current.scene);
  const placeLabel = current.background && current.background !== scene?.background ? backgrounds[current.background]?.label ?? scene?.place_ko : scene?.place_ko;
  const choice = current.kind === 'choice' ? current : null;
  const prompt = choice ? promptLine(ep, choice.choice_id) : undefined;
  const shownLine: LineNode | undefined = current.kind === 'line' ? current : prompt;
  const audience = !userLine && !!current.audience;
  // Portrait: this line's slot, or the latest one of the same scene (so narration/choices keep the speaker visible).
  const stagePortrait = (() => {
    if (current.kind === 'line' && current.channel !== 'speech') return undefined;
    if (current.kind === 'beat' || current.kind === 'end') return undefined;
    const pool = [...path, current].filter(n => n.scene === current.scene && !!n.audience === !!current.audience);
    for (let i = pool.length - 1; i >= 0; i--) { const n = pool[i]; if (n.kind === 'line' && n.portrait) return n.portrait; if (n.kind === 'line' && n.channel === 'narration' && i === pool.length - 1) return undefined; }
    return undefined;
  })();
  const phoneThread = (() => {
    const isPhone = (n?: StoryNode) => n?.kind === 'line' && PHONE.includes(n.channel);
    const onPhone = isPhone(current) || (choice?.medium === 'text_message') || (userLine?.text_message ?? false);
    if (!onPhone) return null;
    const items: { key: string; who: string; text: string; ko?: string; mine?: boolean; cg?: string; post?: boolean }[] = [];
    for (const n of userLine ? path : [...path, current]) {
      if (n.scene !== current.scene) continue;
      if (n.kind === 'line' && PHONE.includes(n.channel)) items.push({ key: n.id, who: n.channel === 'post' ? 'IVY TALK' : (n.label ?? speakerName(n)), text: n.text, ko: n.ko, cg: n.cg, post: n.channel === 'post' });
      if (n.kind === 'choice' && n.medium === 'text_message' && progress.choices[n.choice_id]) {
        const u = utterances.find(x => x.choice_id === n.choice_id);
        items.push({ key: n.id + '-me', who: '나', text: u?.text ?? '(보낸 메시지 · 새로고침 전 입력이라 표시하지 않아요)', mine: true });
      }
    }
    return items.slice(-5);
  })();
  const lineForBox = userLine ? null : shownLine;
  const hideBox = !!phoneThread && !userLine && current.kind === 'line';

  return <div className={`ri-root ri-play ${audience ? 'is-audience' : ''}`}>
    <Stage bg={current.background} cgId={current.kind === 'beat' ? current.cg : undefined} blackout={current.kind === 'beat' && current.blackout} place={scene?.place_ko ?? ''} />
    <Portrait slot={phoneThread ? undefined : stagePortrait} lift={lift} />
    <div className="ri-tap" role="button" tabIndex={0} aria-label="다음 대사" onClick={advance} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } }} aria-disabled={!!choice && !userLine} />
    <header className="ri-top">
      <button className="icon-button" aria-label="에피소드 소개로 (진행 저장됨)" onClick={() => { stopMic(); keyboard.hide(); setView('intro'); }}><X size={20} /></button>
      <span className="ri-place">{placeLabel}</span>
      <button className={`icon-button ${showKo ? 'is-on' : ''}`} aria-pressed={showKo} aria-label="한국어 번역 보기" onClick={() => setShowKo(v => !v)}><Translate size={20} /></button>
      <button className="icon-button" aria-label="지난 대사" onClick={() => { keyboard.hide(); setSheet('history'); }}><Chats size={20} /></button>
      <button className="icon-button" aria-label="나의 메모장 열기" onClick={() => { keyboard.hide(); setSheet('notebook'); }}><BookOpen size={20} /></button>
    </header>
    {audience && <p className="ri-audience"><Eye size={13} />관객 시점</p>}
    {storageError && <p className="ri-error ri-floating" role="alert">{storageError}</p>}

    {phoneThread && <section className="ri-phone" aria-label="휴대폰 화면" ref={el => { if (el) el.scrollTop = el.scrollHeight; }} onClick={() => { if (!choice || userLine) advance(); }}><div className="ri-phone-bar"><DeviceMobile size={14} />메시지</div>
      {phoneThread.map(m => <div key={m.key} className={`ri-msg ${m.mine ? 'is-mine' : ''} ${m.post ? 'is-post' : ''}`}>
        <small>{m.who}</small>{m.cg && <div className="ri-msg-photo"><Eye size={16} weight="thin" /><span>{cgs[m.cg]?.label}</span><Art src={cgFile(m.cg)} className="ri-msg-img" /></div>}
        <p>{m.text}</p>{showKo && m.ko && <p className="ri-ko">{m.ko}</p>}
      </div>)}
      {(!choice || userLine) && <small className="ri-next">▼</small>}
    </section>}

    {current.kind === 'line' && current.channel === 'end_card' && !userLine && <div className="ri-endcard"><p>{current.text}</p>{showKo && current.ko && <p className="ri-ko">{current.ko}</p>}<small className="ri-next">▼</small></div>}
    {current.kind === 'beat' && <p className="ri-beat-hint">▼</p>}

    <div className="ri-bottom" ref={bottomRef} style={bottomInset > 0 ? { bottom: bottomInset + 8 } : undefined}>
      {userLine && !userLine.text_message && <div className="ri-box is-me" onClick={advance}><div className="ri-name">나</div><p className="ri-en">{userLine.text}</p><small className="ri-next">▼</small></div>}
      {lineForBox && !hideBox && lineForBox.channel !== 'end_card' && !(choice && phoneThread) && <div className={`ri-box ${lineForBox.channel === 'narration' ? 'is-narration' : ''}`} onClick={advance}>
        {speakerName(lineForBox) && <div className="ri-name">{speakerName(lineForBox)}</div>}
        <p className="ri-en">{lineForBox.text}<button className="ri-sound" aria-label="대사 듣기" onClick={e => { e.stopPropagation(); speak(lineForBox.text); }}><SpeakerHigh size={17} /></button></p>
        {showKo && lineForBox.ko && <p className="ri-ko">{lineForBox.ko}</p>}
        {!choice && <small className="ri-next">▼</small>}
      </div>}

      {choice && !userLine && <ChoicePanel choice={choice} phase={phase} option={option} draft={draft} hint={hint} listening={listening} notice={notice} info={checkInfo}
        onPick={o => { setOption(o); setPhase('input'); setNotice(''); }} onRepick={() => { stopMic(); keyboard.hide(); setOption(null); setPhase('pick'); setHint(false); }}
        onDraft={t => { setDraft(t); if (phase !== 'input') setPhase('input'); }} onHint={() => setHint(true)} onMic={mic} onSubmit={submit}
        onRetrySpeak={() => { setPhase('input'); setCheckInfo(''); }} onRetryCheck={submit} onContinue={k => commit(k)}
        onCancelCheck={() => { checkCtrl.current?.abort(); checkCtrl.current = null; setPhase('input'); }} />}
    </div>

    <BottomSheet open={sheet === 'history'} onOpenChange={o => { if (!o) setSheet(null); }} title="지난 대사" description={`${ep.title} · 지금까지 지나온 장면`} snap={.82}>
      <div className="history-list ri-history">{[...path].map(n => {
        if (n.kind === 'line') return <div key={n.id} className="history-turn friend"><small>{speakerName(n) || (n.channel === 'end_card' ? '' : '내레이션')}{n.audience ? ' · 관객 시점' : ''}</small><p>{n.text}</p>{n.ko && <small>{n.ko}</small>}</div>;
        if (n.kind === 'choice') { const u = utterances.find(x => x.choice_id === n.choice_id); const o = progress.choices[n.choice_id]; return <div key={n.id} className="history-turn you"><small>나 · {n.options.find(x => x.id === o)?.intent_ko}</small><p>{u?.text ?? '이 선택에서 한 말은 새로고침 전에 입력해 기록이 없어요.'}</p></div>; }
        return null;
      })}{!path.length && <p className="muted">아직 지나온 대사가 없어요.</p>}</div>
    </BottomSheet>
    <BottomSheet open={sheet === 'notebook'} onOpenChange={o => { if (!o) setSheet(null); }} title="나의 메모장" description="저장한 표현을 보고 닫으면 같은 장면으로 돌아와요." snap={.82}>
      <div className="sheet-body ri-notes">{!notes.length ? <p className="muted">아직 저장한 표현이 없어요.</p> : notes.map(n => <article key={n.id} className="ri-note"><div><h3>{n.en}</h3><button className="ri-sound" aria-label={`${n.en} 듣기`} onClick={() => speak(n.en)}><SpeakerHigh size={17} /></button></div><p>{n.ko}</p><small>{n.context}</small></article>)}</div>
    </BottomSheet>
  </div>;
}

function ChoicePanel(p: {
  choice: ChoiceNode; phase: Phase; option: Option | null; draft: string; hint: boolean; listening: boolean; notice: string; info: string;
  onPick: (o: Option) => void; onRepick: () => void; onDraft: (t: string) => void; onHint: () => void; onMic: () => void; onSubmit: () => void;
  onRetrySpeak: () => void; onRetryCheck: () => void; onContinue: (k: 'kept_after_warning' | 'unchecked') => void; onCancelCheck: () => void;
}) {
  const { choice, phase, option } = p;
  const picked = choice.options.find(o => o.id === option);
  if (phase === 'pick' || !picked) return <section className="ri-choice" aria-label="선택하기">
    {choice.options.map(o => <button key={o.id} className="ri-option" onClick={() => p.onPick(o.id)}><span>{o.id}</span>{o.intent_ko}</button>)}
  </section>;
  if (phase === 'opposite') return <section className="ri-choice ri-alert" role="alertdialog" aria-label="뜻 확인">
    <p className="ri-alert-title">{OPPOSITE_TEXT}</p>{p.info && <small>{p.info}</small>}
    <blockquote>{p.draft}</blockquote>
    <div className="ri-row"><button className="text-button" onClick={p.onRetrySpeak}>다시 말하기</button><button className="gold-button" onClick={() => p.onContinue('kept_after_warning')}>선택한 뜻으로 계속하기</button></div>
  </section>;
  if (phase === 'check_failed') return <section className="ri-choice ri-alert" role="alertdialog" aria-label="확인 실패">
    <p className="ri-alert-title">확인을 완료하지 못했어요</p><small>{p.info}</small>
    <blockquote>{p.draft}</blockquote>
    <div className="ri-row"><button className="text-button" onClick={p.onRetryCheck}>다시 시도</button><button className="gold-button" onClick={() => p.onContinue('unchecked')}>선택한 뜻으로 계속하기</button></div>
    <button className="text-button" onClick={p.onRetrySpeak}>문장 고치기</button>
  </section>;
  const checking = phase === 'checking';
  return <section className="ri-choice ri-input" aria-label="영어로 말하기">
    <div className="ri-picked"><span>{picked.id}</span><p>{picked.intent_ko}</p><button className="text-button" disabled={checking} onClick={p.onRepick}>다른 뜻</button></div>
    <div className="ri-mic-row">
      <button className={`mic-button ri-mic ${p.listening ? 'listening' : ''}`} disabled={checking} onClick={p.onMic} aria-label={p.listening ? '음성 입력 마치기' : '마이크로 말하기'}>{p.listening ? <Stop size={26} weight="fill" /> : <Microphone size={30} weight="fill" />}</button>
      <div><strong>{p.listening ? '듣고 있어요…' : '영어로 말하기'}</strong></div>
    </div>
    {p.notice && <p className="ri-notice" role="status">{p.notice}</p>}
    <KeyboardTextarea aria-label="내가 할 영어 문장 (확인·수정)" rows={2} maxLength={500} value={p.draft} disabled={checking} placeholder="Say it your way in English…" onChange={e => p.onDraft(e.target.value)} />
    {p.hint ? <p className="ri-hint"><Lightbulb size={14} /><span>{picked.hint_en}</span></p>
      : <button className="text-button ri-hint-btn" disabled={checking} onClick={p.onHint}><Lightbulb size={14} />영어 힌트 보기</button>}
    {checking ? <div className="ri-row"><p className="ri-checking" role="status">뜻을 확인하고 있어요…</p><button className="text-button" onClick={p.onCancelCheck}>취소</button></div>
      : <button className="gold-button" disabled={!p.draft.trim()} onClick={p.onSubmit}>이 문장으로 말하기<PaperPlaneTilt size={17} /></button>}
  </section>;
}

function FeedbackView({ ep, utterances, picks, saved, onSaveNote, onRestart, onList, onExit }: {
  ep: Episode; utterances: Utterance[]; picks: Record<string, Option>; saved: (en: string) => boolean; onSaveNote: (p: NotePhrase) => boolean; onRestart: () => void; onList: () => void; onExit: () => void;
}) {
  const choices = choicesOf(ep);
  const items = choices.map(c => utterances.find(u => u.choice_id === c.choice_id)).filter((u): u is Utterance => !!u);
  const key = items.map(u => `${u.choice_id}:${u.option}:${u.text}`).join('|');
  const r = run(ep.episode_id);
  const [result, setResult] = useState<FeedbackItem[] | null>(r.feedback?.key === key ? r.feedback.items : null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState(false);
  async function load() {
    if (!items.length || busy) return;
    setBusy(true); setError('');
    const k = r.sessionId + key;
    let p = inflight.get(k);
    if (!p) {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 45000);
      p = requestFeedback({ sessionId: r.sessionId, episodeId: ep.episode_id, items: items.map(u => ({ choiceId: u.choice_id, option: u.option, text: u.text })) }, ctrl.signal).finally(() => { clearTimeout(t); inflight.delete(k); });
      inflight.set(k, p);
    }
    const out = await p;
    setBusy(false);
    if (!out.ok) { setError(out.message); return; }
    r.feedback = { key, items: out.value }; setResult(out.value);
  }
  useEffect(() => { if (!result && items.length) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (n: NotePhrase) => { if (onSaveNote(n)) setStatus('메모장에 저장했어요.'); };
  const label = `Red Ivy ${ep.number}화`;
  return <div className="ri-root ri-feedback">
    <header className="page-header"><button className="icon-button" aria-label="에피소드 목록" onClick={onList}><ArrowLeft size={22} /></button><div><p className="eyebrow">RED IVY · EP{String(ep.number).padStart(2, '0')} 완료</p><h1>{ep.title}</h1></div></header>
    <MobileScroll className="pw-scroll"><main className="ri-fb">
      {busy && <p className="ri-status" role="status"><Sparkle size={15} />피드백을 불러오는 중…</p>}
      {error && <div className="ri-error" role="alert"><p>{error}</p><InviteField /><button className="gold-button" onClick={load}>피드백 다시 받기</button></div>}
      {choices.map(c => {
        const u = items.find(x => x.choice_id === c.choice_id);
        const f = result?.find(x => x.choice_id === c.choice_id);
        const pl = promptLine(ep, c.choice_id);
        return <article key={c.choice_id} className="ri-fb-item">
          <dl>
            <dt>상황</dt><dd>{pl ? <>{speakerName(pl) && <b>{speakerName(pl)}: </b>}“{pl.text}”{pl.ko && <small>{pl.ko}</small>}</> : '—'}</dd>
            <dt>의도</dt><dd>{c.options.find(o => o.id === (u?.option ?? picks[c.choice_id]))?.intent_ko ?? '—'}</dd>
            <dt>내 문장</dt><dd className="ri-said">{u ? u.text : '—'}</dd>
            {f && <><dt>의미</dt><dd>{f.meaning_ko}</dd><dt>피드백</dt><dd>{f.coaching_ko}</dd></>}
          </dl>
          {f && <>
            {f.alternatives.map((a, k) => <div key={a.en} className="ri-alt"><h3>{a.en}</h3><p>{a.ko}</p><small>{a.nuance_ko}</small>
              <button className="gold-button" disabled={saved(a.en)} onClick={() => save({ id: `redivy-${crypto.randomUUID()}`, en: a.en, ko: a.ko, context: `${label} · ${c.title_ko} · ${a.nuance_ko}` })}>{saved(a.en) ? '메모장에 저장됨' : '이 표현 저장'}<BookOpen size={16} /></button></div>)}
            {u && <button className="text-button ri-save-fb" disabled={saved(u.text)} onClick={() => save({ id: `redivy-${crypto.randomUUID()}`, en: u.text, ko: f.meaning_ko, context: `${label} · 내 문장 피드백 · ${f.coaching_ko}` })}>{saved(u.text) ? '이 피드백 저장됨' : '내 문장과 피드백 저장'}<BookOpen size={14} /></button>}
          </>}
        </article>;
      })}
      {status && <p className="ri-status" role="status"><Check size={14} />{status}</p>}
      <div className="ri-fb-actions">
        {confirm ? <div className="ri-confirm"><p>처음부터 다시 시작할까요?</p><div><button className="text-button" onClick={() => setConfirm(false)}>취소</button><button className="gold-button" onClick={onRestart}>처음부터 시작</button></div></div>
          : <button className="text-button" onClick={() => setConfirm(true)}><ArrowCounterClockwise size={15} />처음부터 다시 하기</button>}
        <button className="text-button" onClick={onList}>에피소드 목록</button>
        <button className="text-button" onClick={onExit}>나의 방으로</button>
      </div>
    </main></MobileScroll>
  </div>;
}
