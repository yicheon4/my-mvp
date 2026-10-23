import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sun, MoonStars, ChatCircleDots, DoorOpen, Info } from '@phosphor-icons/react';
import { worldMaps, mapArt, WORLD_W, WORLD_H } from './world-data';
import type { Direction, MapId, Npc, WorldMapDef } from './world-data';
import { canOccupy, portalAt, arrival, nearestNpc, miniHeight } from './world-engine';
import type { WorldState } from './world-engine';
import { stepPosition } from './avatar-runtime';
import { loadMiniManifest, loadMiniSheet, frameFor, miniPlacement, neighborLooks } from './mini-v10';
import type { MiniManifest, MiniDirection } from './mini-v10';
import { withAnd } from '../story-data';
import { ROOM_CONFIG, roomSpots, catPath, catSpot, stepRoom, initialRoom, stepCat, initialCat, loadRoom, saveRoom, needsWater } from './room-actions';
import type { RoomState, Spot, Cat, RoomConfig, RoomSave } from './room-actions';
import type { Pt } from './world-data';
import { V11_BASE, placeFrame, waterIndex, playIndex, reverseIndex, BED_HIP_ESTIMATE, v11Enabled } from './room-art-v11';
import type { V11Manifest, V11Frame } from './room-art-v11';

// DEV-ONLY draft art preview (?roomart=v11). Production builds never enable it.
const ROOM_ART = typeof location !== 'undefined' && v11Enabled(!!import.meta.env.DEV, location.search);
let v11Promise: Promise<V11Manifest> | null = null;
const loadV11 = () => (v11Promise ??= fetch(V11_BASE + 'manifest.json').then(r => { if (!r.ok) throw new Error('v11 ' + r.status); return r.json(); }).catch(e => { v11Promise = null; throw e; }));

type Person = { name: string; art: string; locked: boolean };
type Props = {
  initial: WorldState;
  look: string; // v9 selection.look (L01–L15); the map mini shows this outfit only
  lookName: string;
  people: Person[];
  onSave: (state: WorldState) => void;
  onTalk: (person: number, state: WorldState) => void;
  onHome: (state: WorldState) => void;
  paused?: boolean;          // another panel is open over the map (e.g. the customize panel)
  onWardrobe?: () => void;   // wardrobe action → existing customize panel
};

const SPEED = 270;
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const images = new Map<string, HTMLImageElement>();
function image(src: string) {
  let img = images.get(src);
  if (!img) { img = new Image(); img.decoding = 'async'; img.src = src; images.set(src, img); }
  return img;
}
const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;
const typing = () => { const el = document.activeElement as HTMLElement | null; return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };

// Room-action effects drawn on the map (no extra art: light, particles and temporary cat/toy drawings only).
type Fx = { kind: 'window' | 'water' | 'leaf' | 'touch'; start: number; until: number };
const roomConfig = (): RoomConfig => { try { return { ...ROOM_CONFIG, ...JSON.parse(localStorage.getItem('persona-world:room-config') ?? '{}') }; } catch { return ROOM_CONFIG; } };
const POSE_LABEL: Record<string, string> = { chair: '의자에 앉음', bed: '침대에 누움', plant: '물주기', cat: '고양이와 놀기' };

export default function WorldMap({ initial, look, lookName, people, onSave, onTalk, onHome, paused = false, onWardrobe }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<WorldState>(initial);
  const [mapId, setMapId] = useState<MapId>(initial.mapId);
  const [time, setTime] = useState(initial.timeOfDay);
  const [near, setNear] = useState<Npc | null>(null);
  const [door, setDoor] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const [loading, setLoading] = useState(true);
  // v10 mini: load the selected outfit sheet first, then warm its neighbors. Never fall back to another outfit.
  const miniManifest = useRef<MiniManifest | null>(null);
  const miniSheet = useRef<HTMLImageElement | null>(null);
  const lookRef = useRef(look);
  const [miniStatus, setMiniStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [miniRetry, setMiniRetry] = useState(0);
  useEffect(() => {
    lookRef.current = look; miniSheet.current = null; setMiniStatus('loading');
    let alive = true, warm: ReturnType<typeof setTimeout> | undefined;
    loadMiniManifest().then(m => { miniManifest.current = m; return loadMiniSheet(m, look).then(img => {
      if (!alive) return;
      miniSheet.current = img; setMiniStatus('ready');
      warm = setTimeout(() => neighborLooks(look, m).forEach(id => loadMiniSheet(m, id).catch(() => {})), 1500);
    }); }).catch(() => { if (alive) setMiniStatus('error'); });
    return () => { alive = false; if (warm) clearTimeout(warm); };
  }, [look, miniRetry]);
  // The map-mini notice starts open, then folds into a small chip so it does not cover exits at the top.
  const [noticeOpen, setNoticeOpen] = useState(true);
  useEffect(() => { const t = setTimeout(() => setNoticeOpen(false), 5000); return () => clearTimeout(t); }, []);
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0, active: false, id: -1 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const lock = useRef(true); // no portal until the feet leave every exit zone once
  const moving = useRef(false);
  const busy = useRef(false);
  const nearRef = useRef<Npc | null>(null);
  const debug = typeof location !== 'undefined' && location.search.includes('worlddebug');
  if (debug) (window as any).__pwWorld = stateRef;
  const cb = useRef({ onSave, onTalk, onWardrobe });
  cb.current = { onSave, onTalk, onWardrobe };
  const pausedRef = useRef(paused); pausedRef.current = paused;
  // room actions
  const cfg = useRef(roomConfig());
  // Starting (reload / arrival) inside a spot never auto-triggers it: leave the spot once first.
  const startRoom = (st: WorldState): RoomState => { const r = initialRoom(); for (const sp of roomSpots[st.mapId] ?? []) if (Math.hypot(st.x - sp.at[0], st.y - sp.at[1]) <= sp.r * ROOM_CONFIG.zoneScale * ROOM_CONFIG.exitScale) r.rearm.add(sp.id); return r; };
  const room = useRef<RoomState>(startRoom(initial));
  const roomSave = useRef<RoomSave>(loadRoom(localStorage));
  const lockMove = useRef(false);
  const fx = useRef<Fx | null>(null);
  const cat = useRef<Cat | null>(null);
  const catEligible = useRef(false);
  const [roomUi, setRoomUi] = useState<{ phase: string; action: string; chip: string }>({ phase: 'free', action: '', chip: '' });
  const uiKey = useRef('');
  // v11 draft art (dev preview only)
  const v11 = useRef<V11Manifest | null>(null);
  const [v11State, setV11State] = useState<'off' | 'loading' | 'ready' | 'error'>(ROOM_ART ? 'loading' : 'off');
  useEffect(() => { if (!ROOM_ART) return; loadV11().then(m => { v11.current = m; setV11State('ready'); }, () => setV11State('error')); }, []);
  const actT0 = useRef(0), endT0 = useRef(0), lastPhase = useRef('free');
  const catPrev = useRef<Pt | null>(null), catVel = useRef<Pt>([0, 0]);
  if (debug) (window as any).__pwRoom = { room, cat, roomSave, cfg };
  const save = (patch: Partial<WorldState> = {}) => { stateRef.current = { ...stateRef.current, ...patch }; cb.current.onSave(stateRef.current); };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing()) return;
      if (KEYS[e.code]) { keys.current.add(e.code); e.preventDefault(); }
      if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && nearRef.current && !e.repeat) { e.preventDefault(); talk(); }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    const reset = () => { keys.current.clear(); stick.current = { x: 0, y: 0, active: false, id: -1 }; setKnob({ x: 0, y: 0 }); };
    const hidden = () => { if (document.hidden) reset(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', reset); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0, last = performance.now(), walkClock = 0, lastSave = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let view = { w: 1, h: 1, dpr: 1 };
    const resize = () => {
      const r = { width: wrap.clientWidth, height: wrap.clientHeight }; // layout px; the phone frame is CSS-scaled
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, .05); last = now;
      const s = stateRef.current, map = worldMaps[s.mapId];
      const clean = v11.current && s.mapId === 'bedroom' ? image(V11_BASE + v11.current.room.background[s.timeOfDay]) : null;
      const bg = clean && ready(clean) ? clean : image(mapArt[s.mapId][s.timeOfDay]); // chair-free background only with the chair layer
      // input
      let ix = 0, iy = 0;
      keys.current.forEach(k => { ix += KEYS[k][0]; iy += KEYS[k][1]; });
      if (stick.current.active) { ix += stick.current.x; iy += stick.current.y; }
      const isPaused = busy.current || typing() || pausedRef.current;
      if (isPaused) { ix = 0; iy = 0; }
      const input = Math.hypot(ix, iy) > .2;
      if (lockMove.current) { ix = 0; iy = 0; } // an action is starting/running/ending; movement input only ends it
      const next = stepPosition({ x: s.x, y: s.y, direction: s.direction }, { x: ix, y: iy }, dt, SPEED, (x, y) => canOccupy(map, x, y));
      moving.current = !!next.moving;
      if (next.moving) walkClock += dt * 1000; else walkClock = 0;
      stateRef.current = { ...s, x: next.x, y: next.y, direction: (Math.hypot(ix, iy) > .2 && next.direction) || s.direction };
      roomStep(map, dt * 1000, input, isPaused, !!next.moving, now);
      const cur = stateRef.current;
      // portals
      const portal = portalAt(map, cur.x, cur.y);
      if (!portal) lock.current = false;
      else if (!lock.current && !busy.current) travel(portal);
      setDoor(portalLabel(map, cur.x, cur.y));
      const npc = nearestNpc(map, cur.x, cur.y);
      if (npc !== nearRef.current) { nearRef.current = npc; setNear(npc); }
      if (now - lastSave > 1500) { lastSave = now; cb.current.onSave(cur); }
      draw(ctx, view, map, bg, cur, walkClock, reduced);
      setLoading(!ready(bg));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); room.current = initialRoom(); fx.current = null; lockMove.current = false; cb.current.onSave(stateRef.current); };
  }, []);

  /** One frame of automatic room actions (bedroom only). Movement input is never overridden: it only ends an action. */
  function roomStep(map: WorldMapDef, dtMs: number, input: boolean, isPaused: boolean, playerMoved: boolean, now: number) {
    const base = roomSpots[map.id];
    if (!base) { if (room.current.phase !== 'free' || cat.current) { room.current = initialRoom(); lockMove.current = false; fx.current = null; cat.current = null; } return; }
    if (!cat.current) room.current = startRoom(stateRef.current); // just arrived in the room
    const s = stateRef.current, me: Pt = [s.x, s.y], c = cfg.current;
    const path = catPath[map.id]!;
    cat.current ??= initialCat(path);
    // the cat plays only if the player walked up to it (the cat wandering next to a still player never starts play)
    const dCat = Math.hypot(cat.current.x - s.x, cat.current.y - s.y);
    if (dCat > c.catPlayRadius * c.exitScale) catEligible.current = false;
    else if (playerMoved && dCat <= c.catPlayRadius) catEligible.current = true;
    const watered = !needsWater(roomSave.current, Date.now(), c);
    const spots: Spot[] = base.map(sp => sp.id === 'plant' && watered ? { ...sp, durationMs: 900 } : sp);
    const playing = room.current.spot?.id === 'cat' && room.current.phase !== 'free' && room.current.phase !== 'waiting';
    if (catEligible.current || playing) spots.push(catSpot([cat.current.x, cat.current.y], me, c));
    const out = stepRoom(room.current, { x: s.x, y: s.y, dir: s.direction, dt: dtMs, input, paused: isPaused, spots, canStand: (x, y) => canOccupy(map, x, y), cfg: c });
    room.current = out.state; lockMove.current = out.lockMove;
    if (out.started) actT0.current = now;
    if (out.state.phase === 'ending' && lastPhase.current !== 'ending') endT0.current = now;
    lastPhase.current = out.state.phase;
    if (out.pos || out.face) stateRef.current = { ...stateRef.current, ...(out.pos ? { x: out.pos[0], y: out.pos[1] } : {}), ...(out.face ? { direction: out.face } : {}) };
    if (out.lockMove) moving.current = false; // no walking frames while sitting / lying / acting
    if (out.started) {
      const id = out.started.id, t = now;
      if (id === 'window') { roomSave.current = { ...roomSave.current, windowOpen: !roomSave.current.windowOpen }; saveRoom(localStorage, roomSave.current); fx.current = { kind: 'window', start: t, until: t + 900 }; }
      if (id === 'plant') {
        if (watered) fx.current = { kind: 'leaf', start: t, until: t + 900 };
        else fx.current = { kind: 'water', start: t, until: t + out.started.durationMs };
      }
      if (id === 'wardrobe') fx.current = { kind: 'touch', start: t, until: t + out.started.durationMs };
    }
    if (out.ended) {
      if (fx.current && fx.current.kind !== 'window') fx.current = null; // nothing (can, toy, water) stays on screen
      if (out.ended.id === 'wardrobe' && !out.cancelled && !isPaused) cb.current.onWardrobe?.();
      if (out.ended.id === 'plant' && !out.cancelled && !watered) { roomSave.current = { ...roomSave.current, lastWateredAt: Date.now() }; saveRoom(localStorage, roomSave.current); } // only a finished watering counts
    }
    const playingNow = room.current.spot?.id === 'cat' && (room.current.phase === 'starting' || room.current.phase === 'active');
    const before: Pt = [cat.current.x, cat.current.y];
    cat.current = stepCat(cat.current, path, dtMs, Math.random, [stateRef.current.x, stateRef.current.y], playingNow, (x, y) => canOccupy(map, x, y));
    const mv: Pt = [cat.current.x - before[0], cat.current.y - before[1]]; if (Math.hypot(mv[0], mv[1]) > .01) catVel.current = mv;
    const sp = room.current.spot, ph = room.current.phase;
    const active = ph === 'starting' || ph === 'active' || ph === 'ending';
    const draft = !!(v11.current && v11.current.looks[lookRef.current] && ready(image(V11_BASE + v11.current.looks[lookRef.current].src)));
    const chip = !active || !sp ? '' : draft && (sp.id !== 'plant' || fx.current?.kind === 'water') && sp.id !== 'cat'
      ? `${POSE_LABEL[sp.id] ?? (sp.id === 'wardrobe' ? '옷장에 손 뻗기' : '창문에 손 뻗기')} · v11 초안 그림${sp.id === 'chair' ? ' (앉는 과정 원화 미완성)' : sp.id === 'bed' ? ' (눕는 과정·침대 위치 추정)' : ''}`
      : draft && sp.id === 'cat' ? '고양이와 놀기 · v11 초안 그림'
      : sp.pose && sp.pose !== 'touch' ? `${POSE_LABEL[sp.id]} · 동작 그림 준비 전` : '';
    const key = `${ph}|${active ? sp?.id : ''}|${chip}`;
    if (key !== uiKey.current) { uiKey.current = key; setRoomUi({ phase: ph, action: active ? sp?.id ?? '' : ph === 'waiting' ? `near:${sp?.id}` : '', chip }); }
  }

  function portalLabel(map: WorldMapDef, x: number, y: number) {
    const p = map.portals.find(p => Math.abs(x - (p.rect[0] + p.rect[2] / 2)) < p.rect[2] / 2 + 110 && Math.abs(y - (p.rect[1] + p.rect[3] / 2)) < p.rect[3] / 2 + 90);
    return p ? p.label : null;
  }

  function travel(portal: ReturnType<typeof portalAt> & {}) {
    busy.current = true; setFading(true);
    setTimeout(() => {
      const a = arrival(portal);
      lock.current = true;
      save({ mapId: a.mapId, x: a.x, y: a.y, direction: a.direction });
      setMapId(a.mapId);
      setTimeout(() => { setFading(false); busy.current = false; }, 60);
    }, 200);
  }

  function talk() {
    const npc = nearRef.current;
    if (!npc || busy.current) return;
    busy.current = true; keys.current.clear();
    cb.current.onTalk(npc.person, stateRef.current);
  }

  function toggleTime() {
    const t = stateRef.current.timeOfDay === 'day' ? 'night' : 'day';
    save({ timeOfDay: t }); setTime(t);
  }

  function stickMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!stick.current.active || e.pointerId !== stick.current.id) return;
    const r = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2, len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    setKnob({ x: dx, y: dy });
    const dead = len < 8;
    stick.current.x = dead ? 0 : dx / max; stick.current.y = dead ? 0 : dy / max;
  }
  function stickEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== stick.current.id) return;
    stick.current = { x: 0, y: 0, active: false, id: -1 }; setKnob({ x: 0, y: 0 });
  }

  const map = worldMaps[mapId];
  const person = near ? people[near.person] : null;
  return <section className={`world-screen ${time}`} aria-label={`${map.name} 맵`} data-room-phase={roomUi.phase} data-room-action={roomUi.action}>
    <div className="world-canvas" ref={wrapRef}><canvas ref={canvasRef} aria-hidden="true" /></div>
    <div className={`world-fade ${fading ? 'on' : ''}`} />
    <header className="world-top">
      <button className="icon-button" aria-label="나의 방 화면으로" onClick={() => { busy.current = true; onHome(stateRef.current); }}><ArrowLeft size={20} /></button>
      <div className="world-place"><span className="eyebrow">PERSONA WORLD</span><strong>{map.name}</strong></div>
      <button className="world-time" onClick={toggleTime} aria-label={time === 'day' ? '밤으로 바꾸기' : '낮으로 바꾸기'}>{time === 'day' ? <Sun size={17} /> : <MoonStars size={17} />}<span>{time === 'day' ? '낮' : '밤'}</span></button>
    </header>
    {noticeOpen
      ? <button className="world-notice" onClick={() => setNoticeOpen(false)} aria-label="안내 접기"><Info size={12} /><span>맵에서는 모두 같은 얼굴·헤어의 미니로 보여요. 착장 「{lookName}」만 반영되고, 가방·목걸이는 맵에서 생략돼요.</span></button>
      : <button className="world-notice-chip" onClick={() => setNoticeOpen(true)} aria-label="맵 미니 안내 펼치기"><Info size={12} />맵 미니 안내</button>}
    {miniStatus === 'loading' && !loading && <p className="world-loading">미니 캐릭터를 불러오는 중…</p>}
    {miniStatus === 'error' && <div className="world-mini-error" role="alert"><p>미니 캐릭터 이미지를 불러오지 못했어요.</p><button onClick={() => setMiniRetry(r => r + 1)}>다시 시도</button></div>}
    {loading && <p className="world-loading">맵을 불러오는 중…</p>}
    {door && !person && <p className="world-door"><DoorOpen size={14} />{door}(으)로 이어지는 길</p>}
    <div className="world-stick" onPointerDown={e => { stick.current = { x: 0, y: 0, active: true, id: e.pointerId }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture is optional */ } stickMove(e); }} onPointerMove={stickMove} onPointerUp={stickEnd} onPointerCancel={stickEnd} onLostPointerCapture={stickEnd} data-scroll-drag="ignore" aria-label="이동 조이스틱">
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
    {person && <button className="world-talk" onClick={talk}><ChatCircleDots size={20} weight="fill" /><span><b>{person.name}</b>{person.locked ? '친밀도 쌓기 안내 보기' : `${withAnd(person.name).slice(person.name.length)} 이야기하기`}</span><kbd>E</kbd></button>}
    {roomUi.chip && <p className="room-chip" role="status">{roomUi.chip}</p>}
    {v11State !== 'off' && mapId === 'bedroom' && <p className="room-art-badge">{v11State === 'ready' ? '아트 미리보기 v11 · 검토용 초안 (개발용)' : v11State === 'error' ? 'v11 초안을 불러오지 못해 기존 그림으로 표시 중' : 'v11 초안 불러오는 중…'}</p>}
    {debug && <p className="world-debug">{mapId} · {Math.round(stateRef.current.x)}, {Math.round(stateRef.current.y)}</p>}
  </section>;

  /** v11 draft pose for the running action, or null (→ normal v10 drawing). */
  function v11Pose(map: WorldMapDef, s: WorldState, t: number): { img: HTMLImageElement; frame: V11Frame; world: Pt; scale: number; seated: boolean } | null {
    const m = v11.current, r = room.current, sp = r.spot;
    if (!m || !sp || !(r.phase === 'starting' || r.phase === 'active' || r.phase === 'ending')) return null;
    const lk = m.looks[lookRef.current]; if (!lk) return null; // unsupported outfit → keep the normal image
    const img = image(V11_BASE + lk.src); if (!ready(img)) return null;
    const el = t - actT0.current, A = lk.actions;
    let key = '', idx = 0, world: Pt = [s.x, s.y], seated = false;
    if (sp.id === 'chair' || sp.id === 'bed') {
      const down = A[sp.id === 'chair' ? 'sit_down' : 'lie_down'], idle = A[sp.id === 'chair' ? 'sit_idle' : 'lie_idle'];
      const downMs = down.frames.length * 1000 / down.fps;
      if (r.phase === 'ending') { key = sp.id === 'chair' ? 'sit_down' : 'lie_down'; idx = reverseIndex(down, t - endT0.current); }
      else if (el < downMs) { key = sp.id === 'chair' ? 'sit_down' : 'lie_down'; idx = playIndex(down, el); }
      else { key = sp.id === 'chair' ? 'sit_idle' : 'lie_idle'; idx = playIndex(idle, el - downMs); }
      world = sp.id === 'chair' ? m.room.chair_out[s.timeOfDay].seat : BED_HIP_ESTIMATE; seated = true;
    } else if (sp.id === 'plant') {
      if (fx.current?.kind !== 'water') return null; // already watered: leaf reaction only, no can
      key = 'water'; idx = waterIndex(A.water, el, sp.durationMs);
    } else if (sp.id === 'cat') {
      const c = cat.current; if (!c || c.mode !== 'play' || r.phase !== 'active') return null;
      key = c.x >= s.x ? 'play_right' : 'play_left'; idx = playIndex(A[key], el);
    } else if (sp.id === 'wardrobe' || sp.id === 'window') { key = 'reach_up'; idx = playIndex(A.reach_up, el); }
    const a = A[key]; if (!a || !a.frames[idx]) return null;
    return { img, frame: a.frames[idx], world, scale: miniHeight(map, world[1]) / lk.referenceHeight, seated };
  }

  // Soft highlight on the object the player is about to use, and the open-window light/breeze.
  function drawRoomBack(ctx: CanvasRenderingContext2D, t: number, playerBox: [number, number, number, number] | null) {
    const r = room.current;
    if (roomSave.current.windowOpen || fx.current?.kind === 'window') {
      const k = fx.current?.kind === 'window' ? Math.min(1, (t - fx.current.start) / 600) : 1;
      const a = roomSave.current.windowOpen ? k : 1 - k;
      if (a > 0.01) {
        const g = ctx.createRadialGradient(490, 150, 10, 490, 150, 190);
        g.addColorStop(0, `rgba(255,255,235,${.55 * a})`); g.addColorStop(1, 'rgba(255,255,235,0)');
        ctx.fillStyle = g; ctx.fillRect(300, 0, 380, 380);
        // breeze: light streaks drifting in from the window
        ctx.strokeStyle = `rgba(150,195,235,${.85 * a})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const p = ((t / 2600 + i / 6) % 1), x = 430 + i * 22 + p * 160, y = 90 + i * 28 + Math.sin(p * 6 + i) * 10 + p * 120;
          ctx.globalAlpha = Math.sin(p * Math.PI); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 18, y - 8, x + 40, y + 2); ctx.stroke();
        }
        // a few petals carried in by the breeze
        for (let i = 0; i < 5; i++) { const p = ((t / 3400 + i / 5) % 1); ctx.globalAlpha = a * Math.sin(p * Math.PI); ctx.fillStyle = i % 2 ? '#f7c9da' : '#ffffff'; ctx.beginPath(); ctx.ellipse(470 + i * 30 + p * 210, 120 + i * 24 + p * 260 + Math.sin(p * 9 + i) * 14, 7, 4, p * 6, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    const sp = r.spot;
    if (sp && (r.phase === 'waiting' || r.phase === 'starting')) {
      const k = r.phase === 'waiting' ? Math.min(1, r.dwell / cfg.current.dwellMs) : 1;
      const pulse = .5 + .5 * Math.sin(t / 260);
      ctx.save();
      if (playerBox) { ctx.beginPath(); ctx.rect(0, 0, WORLD_W, WORLD_H); ctx.rect(...playerBox); ctx.clip('evenodd'); } // keep the glow off the player
      ctx.globalAlpha = .18 + .22 * k + .08 * pulse;
      const g = ctx.createRadialGradient(sp.hint.at[0], sp.hint.at[1], 4, sp.hint.at[0], sp.hint.at[1], Math.max(sp.hint.rx, sp.hint.ry));
      g.addColorStop(0, '#fff8dc'); g.addColorStop(1, 'rgba(255,248,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sp.hint.at[0], sp.hint.at[1], sp.hint.rx, sp.hint.ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  // Water stream, droplets and leaf sparkles; cat toy (temporary drawing) while playing.
  function drawRoomFront(ctx: CanvasRenderingContext2D, s: WorldState, h: number, t: number) {
    const f = fx.current;
    if (f && (f.kind === 'water' || f.kind === 'leaf')) {
      const k = (t - f.start) / (f.until - f.start);
      const plant = roomSpots.bedroom!.find(p => p.id === 'plant')!.target;
      if (f.kind === 'water' && k < .8) {
        const hx = s.x + h * .14, hy = s.y - h * .5;
        ctx.strokeStyle = 'rgba(90,160,235,.85)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -t / 10;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + plant[0]) / 2, hy - 60, plant[0] - 10, plant[1] - 20); ctx.stroke(); ctx.setLineDash([]);
        for (let i = 0; i < 9; i++) { const p = (t / 500 + i / 9) % 1; ctx.fillStyle = `rgba(110,175,240,${.95 * (1 - p)})`; ctx.beginPath(); ctx.arc(plant[0] - 40 + i * 10, plant[1] - 22 + p * 46, 6.5, 0, Math.PI * 2); ctx.fill(); }
      }
      // leaves react: small green sparkles rising
      for (let i = 0; i < (f.kind === 'water' ? 8 : 4); i++) {
        const p = (k * 1.4 + i / 8) % 1; ctx.fillStyle = `rgba(120,200,110,${Math.sin(p * Math.PI)})`;
        ctx.beginPath(); ctx.ellipse(plant[0] - 40 + (i * 23) % 90, plant[1] - 30 - p * 55, 7, 4, -.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    const r = room.current;
    if (r.spot?.id === 'cat' && r.phase === 'active' && cat.current?.mode === 'play') {
      // TEMPORARY toy drawing (stick + feather) swinging from the player's hand toward the cat
      const c = cat.current, side = c.x >= s.x ? 1 : -1, hx = s.x + side * h * .12, hy = s.y - h * .45;
      const sw = Math.sin(t / 180) * 18, tx = hx + side * 70, ty = hy + 30 + sw;
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = '#c9a7e8'; ctx.beginPath(); ctx.ellipse(tx, ty + 10, 7, 14, sw / 40, 0, Math.PI * 2); ctx.fill();
    }
  }
  // TEMPORARY cat (simple drawing, labelled 임시) until real cat sprites exist.
  function drawCat(ctx: CanvasRenderingContext2D, map: WorldMapDef, c: Cat, t: number) {
    const m = v11.current;
    if (m && map.id === 'bedroom') {
      const img = image(V11_BASE + m.cat.src);
      if (ready(img)) {
        const [vx, vy] = catVel.current;
        const key = c.mode === 'walk' || c.mode === 'approach' ? (Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'walk_right' : 'walk_left') : (vy > 0 ? 'walk_down' : 'walk_up'))
          : c.mode === 'play' ? 'paw' : c.mode === 'rest' ? 'loaf' : c.mode === 'cooldown' ? 'look_up' : 'sit';
        const a = m.cat.frames[key];
        if (a?.frames.length) {
          const f = a.frames[Math.floor(t * a.fps / 1000) % a.frames.length];
          const { dx, dy, dw, dh } = placeFrame(f, [c.x, c.y], m.cat.displayScale);
          ctx.fillStyle = 'rgba(58,42,74,.2)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.drawImage(img, f.rect[0], f.rect[1], f.rect[2], f.rect[3], dx, dy, dw, dh);
          ctx.font = '600 13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = '#3b2d4bcc'; ctx.beginPath(); ctx.roundRect(c.x - 18, dy - 24, 36, 18, 9); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('초안', c.x, dy - 11);
          return;
        }
      }
    }
    const sc = miniHeight(map, c.y) / 215, x = c.x, y = c.y, d = c.dir;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * d, sc);
    ctx.fillStyle = 'rgba(58,42,74,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    const sitting = c.mode !== 'walk' && c.mode !== 'approach', bob = c.mode === 'walk' || c.mode === 'approach' ? Math.sin(t / 110) * 2 : 0;
    ctx.fillStyle = '#f2c79a'; ctx.strokeStyle = '#a8764e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(-4, sitting ? -24 : -20 + bob, sitting ? 20 : 30, sitting ? 22 : 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // body
    const tail = Math.sin(t / (c.mode === 'play' ? 120 : 400)) * 10;
    ctx.beginPath(); ctx.moveTo(-26, -18); ctx.quadraticCurveTo(-46, -30 + tail, -40, -50 + tail); ctx.stroke(); // tail
    const hy = sitting ? -50 : -34 + bob;
    ctx.beginPath(); ctx.arc(18, hy, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // head
    ctx.beginPath(); ctx.moveTo(8, hy - 9); ctx.lineTo(10, hy - 22); ctx.lineTo(17, hy - 12); ctx.moveTo(22, hy - 12); ctx.lineTo(29, hy - 22); ctx.lineTo(29, hy - 8); ctx.fill(); ctx.stroke(); // ears
    ctx.fillStyle = '#4a3a3a'; ctx.beginPath(); ctx.arc(14, hy - 1, 1.8, 0, Math.PI * 2); ctx.arc(23, hy - 1, 1.8, 0, Math.PI * 2); ctx.fill();
    if (c.mode === 'play') { const up = Math.max(0, Math.sin(t / 160)) * 14; ctx.fillStyle = '#f2c79a'; ctx.beginPath(); ctx.ellipse(26, -18 - up, 5, 8, -.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } // paw swipe
    ctx.restore();
    ctx.font = '600 14px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#3b2d4bcc'; ctx.beginPath(); ctx.roundRect(x - 20, y - 92 * sc - 10, 40, 20, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('임시', x, y - 92 * sc + 5);
  }

  function draw(ctx: CanvasRenderingContext2D, view: { w: number; h: number; dpr: number }, map: WorldMapDef, bg: HTMLImageElement, s: WorldState, walkMs: number, reduced: boolean) {
    const scale = Math.max(view.h / WORLD_H, view.w / WORLD_W);
    const vw = view.w / scale, vh = view.h / scale;
    const camX = Math.min(Math.max(s.x - vw / 2, 0), WORLD_W - vw);
    const camY = Math.min(Math.max(s.y - 40 - vh / 2, 0), WORLD_H - vh);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#efe4f3'; ctx.fillRect(0, 0, view.w, view.h);
    if (!ready(bg)) return;
    const k = scale * view.dpr;
    ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);
    ctx.drawImage(bg, 0, 0, WORLD_W, WORLD_H);
    // Exit markers stay visible so every connection can be found (arrow points off the nearest edge).
    for (const p of map.portals) {
      const [rx, ry, rw, rh] = p.rect, cx = rx + rw / 2, cy = ry + rh / 2;
      const edges = [[cy, '↑'], [WORLD_H - cy, '↓'], [cx, '←'], [WORLD_W - cx, '→']] as const;
      const arrow = [...edges].sort((a, b) => a[0] - b[0])[0][1];
      ctx.fillStyle = '#fff6c855'; ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 14); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      const label = `${arrow} ${p.label}`;
      ctx.font = '600 24px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
      const tw = ctx.measureText(label).width + 28;
      const lx = Math.min(Math.max(cx, tw / 2 + 8), WORLD_W - tw / 2 - 8), ly = Math.min(Math.max(cy, 30), WORLD_H - 30);
      ctx.fillStyle = '#3b2d4be6'; ctx.beginPath(); ctx.roundRect(lx - tw / 2, ly - 20, tw, 40, 20); ctx.fill();
      ctx.fillStyle = '#fff6c8'; ctx.fillText(label, lx, ly + 8);
    }
    // NPC ground rings (behind characters)
    for (const n of map.npcs) {
      ctx.fillStyle = '#7a5aa333'; ctx.beginPath(); ctx.ellipse(n.x, n.y, 44, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f5ecff'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.stroke(); ctx.setLineDash([]);
    }
    const roomT = performance.now();
    let playerBox: [number, number, number, number] | null = null;
    // v11 draft room layers (dev preview): chair layer only on top of the chair-free background (no double chair)
    const v11m = v11.current, v11Room = !!v11m && map.id === 'bedroom' && bg.src.includes('/dev-art/');
    const sitting = room.current.spot?.id === 'chair' && room.current.phase !== 'free' && room.current.phase !== 'waiting';
    const chairLayer = v11Room ? image(V11_BASE + v11m!.room[sitting ? 'chair_out' : 'chair_in'][s.timeOfDay].src) : null;
    if (v11Room) {
      if (roomSave.current.windowOpen) { const w = v11m!.room.window_open[s.timeOfDay]; const fr = image(V11_BASE + w.frames[Math.floor(roomT * w.fps / 1000) % w.frames.length].src); if (ready(fr)) ctx.drawImage(fr, 0, 0, WORLD_W, WORLD_H); }
      if (chairLayer && ready(chairLayer)) ctx.drawImage(chairLayer, 0, 0, WORLD_W, WORLD_H);
    }
    // player
    const h = miniHeight(map, s.y);
    const catObj = roomSpots[map.id] ? cat.current : null;
    if (catObj && catObj.y < s.y) drawCat(ctx, map, catObj, roomT);
    const pose = v11Room ? v11Pose(map, s, roomT) : null;
    if (!pose?.seated) { ctx.fillStyle = '#3a2a4a38'; ctx.beginPath(); ctx.ellipse(s.x, s.y, h * .2, h * .055, 0, 0, Math.PI * 2); ctx.fill(); }
    const m = miniManifest.current, sheet = miniSheet.current;
    if (pose) {
      // draft pose frame: manifest rect, sheet-absolute anchor on the world point, one common scale
      const { dx, dy, dw, dh } = placeFrame(pose.frame, pose.world, pose.scale);
      ctx.drawImage(pose.img, pose.frame.rect[0], pose.frame.rect[1], pose.frame.rect[2], pose.frame.rect[3], dx, dy, dw, dh);
      playerBox = [dx, dy, dw, dh];
      if (debug) { ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(pose.world[0], pose.world[1], 5, 0, Math.PI * 2); ctx.fill(); }
    } else if (m && sheet) {
      // One complete frame at its manifest rect, feet on (x, y), uniform scale; idleFrame when not actually moving.
      const { entry, rect } = frameFor(m, lookRef.current, s.direction as MiniDirection, moving.current, walkMs, reduced);
      const nudge = fx.current?.kind === 'touch' ? Math.sin(Math.min(1, (roomT - fx.current.start) / (fx.current.until - fx.current.start)) * Math.PI) * 6 : 0; // reaches toward the wardrobe
      const { dx, dy, dw, dh } = miniPlacement(entry, rect, s.x, s.y - nudge, h);
      ctx.drawImage(sheet, rect[0], rect[1], rect[2], rect[3], dx, dy, dw, dh);
      playerBox = [dx, dy, dw, dh];
    }
    if (catObj && catObj.y >= s.y) drawCat(ctx, map, catObj, roomT);
    // foreground parts of the art that stand in front of the player
    for (const o of map.occluders) {
      if (s.y >= o.baseY) continue;
      ctx.save(); ctx.beginPath(); o.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
      ctx.drawImage(bg, 0, 0, WORLD_W, WORLD_H); ctx.restore();
    }
    // room effects go above furniture fronts (water on the shelf plants, window light), never over the player herself
    if (roomSpots[map.id]) { drawRoomBack(ctx, roomT, playerBox); drawRoomFront(ctx, s, h, roomT); }
    // NPC badges (portrait circle + name). NPC minis are not made yet.
    for (const n of map.npcs) {
      const p = people[n.person], img = image(p.art);
      const cx = n.x, cy = n.y - 118, r = 46;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 12, cy + r); ctx.lineTo(cx, cy + r + 20); ctx.lineTo(cx + 12, cy + r); ctx.fill();
      if (ready(img)) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#ece3f4'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const [fx, fy, fs] = n.face;
        ctx.drawImage(img, fx - fs / 2, fy - fs / 2, fs, fs, cx - r, cy - r, r * 2, r * 2); ctx.restore();
      }
      ctx.font = '600 22px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
      const label = p.locked ? `${p.name} 🔒` : p.name, tw = ctx.measureText(label).width + 24;
      ctx.fillStyle = n === nearRef.current ? '#6d4f96' : '#3b2d4bd9';
      ctx.beginPath(); ctx.roundRect(cx - tw / 2, cy - r - 44, tw, 34, 17); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(label, cx, cy - r - 19);
    }
    // Off-screen exits: pin a small direction tag to the screen edge so every connection stays findable.
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.font = '600 11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    for (const p of map.portals) {
      const [rx, ry, rw, rh] = p.rect;
      // Same anchor as the in-world label (clamped near map edges), so a partly visible label is not doubled.
      const wy = Math.min(Math.max(ry + rh / 2, 30), WORLD_H - 30);
      const px = (rx + rw / 2 - camX) * scale, py = (wy - camY) * scale;
      const top = 138, bottom = view.h - 26, left = 8, right = view.w - 8;
      if (px >= 0 && px <= view.w && py >= top - 30 && py <= view.h) continue; // in-world label is visible
      const dx = rx + rw / 2 - s.x, dy = ry + rh / 2 - s.y;
      const arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
      const label = `${arrow} ${p.label}`, tw = ctx.measureText(label).width + 16;
      const x = Math.min(Math.max(px, left + tw / 2), right - tw / 2), y = Math.min(Math.max(py, top + 11), bottom - 11);
      ctx.fillStyle = '#3b2d4bd9'; ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 11, tw, 22, 11); ctx.fill();
      ctx.fillStyle = '#fff6c8'; ctx.fillText(label, x, y + 4);
    }
    ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);
    if (debug && !(window as any).__pwNoOutline) {
      const poly = (pts: [number, number][], c: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); };
      map.walk.forEach(p => poly(p, '#00e676')); map.blocks.forEach(p => poly(p, '#ff1744')); map.occluders.forEach(o => poly(o.poly, '#2979ff'));
      map.portals.forEach(p => { ctx.fillStyle = '#ffea0066'; ctx.fillRect(...p.rect); });
      ctx.fillStyle = '#ff1744'; ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
  }
}
