import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sun, MoonStars, ChatCircleDots, DoorOpen, Info } from '@phosphor-icons/react';
import { worldMaps, mapArt, defaultMini, looks, WORLD_W, WORLD_H } from './world-data';
import type { Direction, MapId, Npc, WorldMapDef } from './world-data';
import { canOccupy, portalAt, arrival, nearestNpc, miniHeight } from './world-engine';
import type { WorldState } from './world-engine';
import { stepPosition, frameAt } from './avatar-runtime';

type Person = { name: string; art: string; locked: boolean };
type Props = {
  initial: WorldState;
  people: Person[];
  onSave: (state: WorldState) => void;
  onTalk: (person: number, state: WorldState) => void;
  onHome: (state: WorldState) => void;
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

export default function WorldMap({ initial, people, onSave, onTalk, onHome }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<WorldState>(initial);
  const [mapId, setMapId] = useState<MapId>(initial.mapId);
  const [time, setTime] = useState(initial.timeOfDay);
  const [near, setNear] = useState<Npc | null>(null);
  const [door, setDoor] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const [loading, setLoading] = useState(true);
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0, active: false, id: -1 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const lock = useRef(true); // no portal until the feet leave every exit zone once
  const moving = useRef(false);
  const busy = useRef(false);
  const nearRef = useRef<Npc | null>(null);
  const debug = typeof location !== 'undefined' && location.search.includes('worlddebug');
  const look = looks.find(l => l.id === initial.lookId) ?? looks[0];
  if (debug) (window as any).__pwWorld = stateRef;
  const cb = useRef({ onSave, onTalk });
  cb.current = { onSave, onTalk };
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
    const mini = image(defaultMini.art);
    let view = { w: 1, h: 1, dpr: 1 };
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, .05); last = now;
      const s = stateRef.current, map = worldMaps[s.mapId];
      const bg = image(mapArt[s.mapId][s.timeOfDay]);
      // input
      let ix = 0, iy = 0;
      keys.current.forEach(k => { ix += KEYS[k][0]; iy += KEYS[k][1]; });
      if (stick.current.active) { ix += stick.current.x; iy += stick.current.y; }
      if (busy.current || typing()) { ix = 0; iy = 0; }
      const next = stepPosition({ x: s.x, y: s.y, direction: s.direction }, { x: ix, y: iy }, dt, SPEED, (x, y) => canOccupy(map, x, y));
      moving.current = !!next.moving;
      if (next.moving) walkClock += dt * 1000; else walkClock = 0;
      stateRef.current = { ...s, x: next.x, y: next.y, direction: (Math.hypot(ix, iy) > .2 && next.direction) || s.direction };
      const cur = stateRef.current;
      // portals
      const portal = portalAt(map, cur.x, cur.y);
      if (!portal) lock.current = false;
      else if (!lock.current && !busy.current) travel(portal);
      setDoor(portalLabel(map, cur.x, cur.y));
      const npc = nearestNpc(map, cur.x, cur.y);
      if (npc !== nearRef.current) { nearRef.current = npc; setNear(npc); }
      if (now - lastSave > 1500) { lastSave = now; cb.current.onSave(cur); }
      draw(ctx, view, map, bg, mini, cur, frameAt(walkClock, moving.current, reduced));
      setLoading(!ready(bg));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); cb.current.onSave(stateRef.current); };
  }, []);

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
  return <section className={`world-screen ${time}`} aria-label={`${map.name} 맵`}>
    <div className="world-canvas" ref={wrapRef}><canvas ref={canvasRef} aria-hidden="true" /></div>
    <div className={`world-fade ${fading ? 'on' : ''}`} />
    <header className="world-top">
      <button className="icon-button" aria-label="나의 방 화면으로" onClick={() => { busy.current = true; onHome(stateRef.current); }}><ArrowLeft size={20} /></button>
      <div className="world-place"><span className="eyebrow">PERSONA WORLD</span><strong>{map.name}</strong></div>
      <button className="world-time" onClick={toggleTime} aria-label={time === 'day' ? '밤으로 바꾸기' : '낮으로 바꾸기'}>{time === 'day' ? <Sun size={17} /> : <MoonStars size={17} />}<span>{time === 'day' ? '낮' : '밤'}</span></button>
    </header>
    <p className="world-notice"><Info size={12} />미니 캐릭터는 아직 기본 복장(흰 티·청바지) 그림만 있어요. 「{look.name}」 미니는 준비 중이에요.</p>
    {loading && <p className="world-loading">맵을 불러오는 중…</p>}
    {door && !person && <p className="world-door"><DoorOpen size={14} />{door}(으)로 이어지는 길</p>}
    <div className="world-stick" onPointerDown={e => { stick.current = { x: 0, y: 0, active: true, id: e.pointerId }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture is optional */ } stickMove(e); }} onPointerMove={stickMove} onPointerUp={stickEnd} onPointerCancel={stickEnd} onLostPointerCapture={stickEnd} data-scroll-drag="ignore" aria-label="이동 조이스틱">
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
    {person && <button className="world-talk" onClick={talk}><ChatCircleDots size={20} weight="fill" /><span><b>{person.name}</b>{person.locked ? '친밀도 쌓기 안내 보기' : '와 이야기하기'}</span><kbd>E</kbd></button>}
    {debug && <p className="world-debug">{mapId} · {Math.round(stateRef.current.x)}, {Math.round(stateRef.current.y)}</p>}
  </section>;

  function draw(ctx: CanvasRenderingContext2D, view: { w: number; h: number; dpr: number }, map: WorldMapDef, bg: HTMLImageElement, mini: HTMLImageElement, s: WorldState, f: number) {
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
    // NPC ground rings (behind characters)
    for (const n of map.npcs) {
      ctx.fillStyle = '#7a5aa333'; ctx.beginPath(); ctx.ellipse(n.x, n.y, 44, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f5ecff'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.stroke(); ctx.setLineDash([]);
    }
    // player
    const h = miniHeight(map, s.y);
    ctx.fillStyle = '#3a2a4a38'; ctx.beginPath(); ctx.ellipse(s.x, s.y, h * .2, h * .055, 0, 0, Math.PI * 2); ctx.fill();
    if (ready(mini)) {
      const row = defaultMini.directions.indexOf(s.direction as Direction);
      const [sx, sy, sw, sh] = defaultMini.frames[row * 4 + f];
      const w = h * sw / sh;
      ctx.drawImage(mini, sx, sy, sw, sh, s.x - w / 2, s.y - h, w, h);
    }
    // foreground parts of the art that stand in front of the player
    for (const o of map.occluders) {
      if (s.y >= o.baseY) continue;
      ctx.save(); ctx.beginPath(); o.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
      ctx.drawImage(bg, 0, 0, WORLD_W, WORLD_H); ctx.restore();
    }
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
    if (debug) {
      const poly = (pts: [number, number][], c: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); };
      map.walk.forEach(p => poly(p, '#00e676')); map.blocks.forEach(p => poly(p, '#ff1744')); map.occluders.forEach(o => poly(o.poly, '#2979ff'));
      map.portals.forEach(p => { ctx.fillStyle = '#ffea0066'; ctx.fillRect(...p.rect); });
      ctx.fillStyle = '#ff1744'; ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
  }
}
