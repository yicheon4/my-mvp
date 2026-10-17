import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { assetUrl, keyOf, resolveCharacter } from './presets';
import type { Manifest, Selection } from './presets';

// Decoded atlases stay cached; extras of the same head×look share one atlas, so switching them is instant.
const atlases = new Map<string, Promise<HTMLImageElement>>();
function loadAtlas(url: string) {
  let p = atlases.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
      img.onerror = () => reject(new Error('load failed: ' + url));
      img.src = url;
    });
    p.catch(() => atlases.delete(url)); // allow retry
    atlases.set(url, p);
  }
  return p;
}

type Props = { selection: Selection; manifest: Manifest | null; label: string; className?: string; dataError?: boolean; onRetryData?: () => void };

/** Shows exactly ONE complete full-body frame (manifest sourceRect), uniformly scaled (contain). */
export default function CharacterFrame({ selection, manifest, label, className = '', dataError, onRetryData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const key = keyOf(selection);

  useEffect(() => {
    if (!manifest) return;
    const mine = ++revision.current;
    setStatus('loading');
    let entry;
    try { entry = resolveCharacter(selection, manifest); } catch { setStatus('error'); return; }
    loadAtlas(assetUrl(entry.src)).then(img => {
      if (mine !== revision.current) return; // a newer selection started; never overwrite it
      const [x, y, w, h] = entry.sourceRect;
      if (x < 0 || y < 0 || x + w > img.naturalWidth || y + h > img.naturalHeight) throw new Error('frame exceeds atlas');
      const canvas = canvasRef.current, wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      // Layout size (not getBoundingClientRect): the phone frame is CSS-scaled, and the canvas style size is in layout px.
      const box = { width: wrap.clientWidth, height: wrap.clientHeight };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(box.width / w, box.height / h);
      // Canvas is sized to the frame's own aspect ratio, so the body is never stretched.
      canvas.width = Math.max(1, Math.round(w * scale * dpr));
      canvas.height = Math.max(1, Math.round(h * scale * dpr));
      canvas.style.width = `${w * scale}px`;
      canvas.style.height = `${h * scale}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
      setShownKey(keyOf(selection));
      setStatus('ready');
    }).catch(() => { if (mine === revision.current) setStatus('error'); });
  }, [key, manifest, retry]);

  // Re-fit on size changes (rotation, panel open/close) without changing the selection.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    let first = true;
    const ro = new ResizeObserver(() => { if (first) { first = false; return; } setRetry(r => r + 1); });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const failed = status === 'error' || dataError;
  return <div ref={wrapRef} className={`character-frame ${className} is-${failed ? 'error' : status}`} role="img" aria-label={label} data-key={shownKey ?? ''} data-status={failed ? 'error' : status}>
    <canvas ref={canvasRef} aria-hidden="true" style={{ visibility: status === 'ready' && shownKey === key ? 'visible' : 'hidden' }} />
    {!failed && status === 'loading' && <span className="character-loading" aria-live="polite">캐릭터를 불러오는 중…</span>}
    {failed && <div className="character-error" role="alert"><p>캐릭터 이미지를 불러오지 못했어요.</p><button onClick={() => { if (dataError) onRetryData?.(); else setRetry(r => r + 1); }}><ArrowClockwise size={14} />다시 시도</button></div>}
  </div>;
}
