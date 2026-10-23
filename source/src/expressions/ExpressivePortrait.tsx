import { useEffect, useRef, useState } from 'react';
import type { Expression, Motion } from './expressions';

type Props = {
  base: string;                                  // existing portrait; also the canvas every expression must match
  art: Partial<Record<Expression, string>>;      // real expression images (missing → base)
  expression: Expression;
  cue: { motion: Motion; id: number } | null;    // play once per id; null stops any running effect
  alt: string;
};
type Layer = { src: string; shown: Expression | 'fallback' };

export const FADE_MS = 300;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Whole-image effects only (not joint animation): a very small nod and a slight tilt, about 0.6s, once.
const MOTION_FRAMES: Record<Motion, Keyframe[]> = {
  nod: [{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }],
  tilt: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-1.6deg)', offset: .35 }, { transform: 'rotate(-1.6deg)', offset: .7 }, { transform: 'rotate(0deg)' }],
};
function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
    img.onerror = () => reject(new Error('missing ' + src));
    img.src = src;
  });
}

/** Two stacked full-size layers. The next expression is preloaded, put on the spare layer above the current one and
 * faded in; the current layer stays fully visible underneath until the fade ends (no blank frame, no size jump).
 * Results that arrive after a newer request are dropped, so a fast reply never shows a stale expression. */
export default function ExpressivePortrait({ base, art, expression, cue, alt }: Props) {
  const [layers, setLayers] = useState<[Layer, Layer]>([{ src: base, shown: 'fallback' }, { src: base, shown: 'fallback' }]);
  const [front, setFront] = useState(0);
  const [incoming, setIncoming] = useState<{ index: number; visible: boolean } | null>(null);
  const token = useRef(0);
  const baseSize = useRef<Promise<[number, number]> | null>(null);
  const current = useRef<Layer>({ src: base, shown: 'fallback' });
  const box = useRef<HTMLDivElement>(null);
  const frontRef = useRef(0), incomingRef = useRef<number | null>(null);
  frontRef.current = front; incomingRef.current = incoming?.index ?? null;

  useEffect(() => {
    const my = ++token.current;
    const want = art[expression];
    baseSize.current ??= load(base).then(b => [b.naturalWidth, b.naturalHeight] as [number, number]);
    const resolve = async (): Promise<Layer> => {
      if (!want) return { src: base, shown: 'fallback' };
      try {
        const [img, [w, h]] = await Promise.all([load(want), baseSize.current!]);
        if (img.naturalWidth !== w || img.naturalHeight !== h) { console.warn(`expression ${expression}: canvas ${img.naturalWidth}x${img.naturalHeight} differs from base ${w}x${h}; using base`); return { src: base, shown: 'fallback' }; }
        return { src: want, shown: expression };
      } catch { return { src: base, shown: 'fallback' }; }
    };
    resolve().then(next => {
      if (my !== token.current) return;
      if (next.src === current.current.src) { current.current = next; box.current?.setAttribute('data-shown', next.shown); return; }
      current.current = next;
      // A fade still running: settle it first so the layer being shown is never swapped mid-fade.
      const settled = incomingRef.current ?? frontRef.current;
      if (incomingRef.current !== null) setFront(settled);
      const spare = 1 - settled;
      setLayers(l => { const c = [...l] as [Layer, Layer]; c[spare] = next; return c; });
      setIncoming({ index: spare, visible: false });
      requestAnimationFrame(() => requestAnimationFrame(() => { if (my === token.current) setIncoming({ index: spare, visible: true }); }));
      box.current?.setAttribute('data-shown', next.shown);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, base, art]);

  useEffect(() => {
    const el = box.current;
    if (!el || !cue || reducedMotion()) return;
    const anim = el.animate(MOTION_FRAMES[cue.motion], { duration: 620, easing: 'ease-in-out' });
    el.setAttribute('data-motion', cue.motion);
    anim.onfinish = () => el.setAttribute('data-motion', 'none');
    return () => { anim.cancel(); el.setAttribute('data-motion', 'none'); }; // new cue, new chat or leaving the screen
  }, [cue]);

  const finishFade = () => { if (incoming?.visible) { setFront(incoming.index); setIncoming(null); } };
  return (
    <div ref={box} className="conversation-character expressive" data-expression={expression} data-shown={current.current.shown} data-motion="none">
      {layers.map((l, i) => {
        const isIncoming = incoming?.index === i;
        const opacity = isIncoming ? (incoming!.visible ? 1 : 0) : i === front ? 1 : 0;
        return <img key={i} className="expr-layer" src={l.src} alt={i === front && !isIncoming ? alt : ''} aria-hidden={!(i === front && !isIncoming)} draggable={false}
          style={{ opacity, zIndex: isIncoming ? 2 : 1, transition: isIncoming ? `opacity ${FADE_MS}ms ease` : 'none' }}
          onTransitionEnd={isIncoming ? finishFade : undefined} />;
      })}
    </div>
  );
}
