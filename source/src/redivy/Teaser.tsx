// Red Ivy 15-second teaser, shown like a trailer: full-screen vertical video on black, then the EP01 start card.
// Sound: the screen opens from a tap, so playback starts with sound; if the browser still refuses, it plays muted
// with a "소리 켜기" button. Reduced motion: no autoplay, the poster waits for a tap.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowCounterClockwise, Play, SpeakerHigh, SpeakerSlash, X } from '@phosphor-icons/react';
import './teaser.css';

const SRC = '/red-ivy/video/teaser-ep01.mp4';
const SUBTITLES = '/red-ivy/video/teaser-ep01.en.vtt';
const POSTER = '/red-ivy/video/teaser-ep01-poster.jpg';

export default function Teaser({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  async function play() {
    const v = video.current; if (!v) return;
    setEnded(false);
    try { v.muted = false; setMuted(false); await v.play(); }
    catch { try { v.muted = true; setMuted(true); await v.play(); } catch { setPlaying(false); } }
  }
  useEffect(() => { if (!reduced) play(); return () => video.current?.pause(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function skip() { const v = video.current; v?.pause(); setEnded(true); setPlaying(false); setProgress(1); }
  function replay() { const v = video.current; if (!v) return; v.currentTime = 0; setProgress(0); play(); }

  return <section className={`rt-root ${ended ? 'is-ended' : ''}`} aria-label="Red Ivy 예고편">
    <video ref={video} className="rt-video" src={SRC} poster={POSTER} playsInline preload="auto"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onTimeUpdate={e => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }}
      onEnded={() => { setEnded(true); setPlaying(false); setProgress(1); }}
      onError={() => { setFailed(true); setEnded(true); }}>
      <track kind="subtitles" src={SUBTITLES} srcLang="en" label="English" default
        onLoad={e => { e.currentTarget.track.mode = 'showing'; }} />
    </video>
    <div className="rt-letterbox" aria-hidden="true" />

    <header className="rt-top">
      <button className="rt-icon" aria-label="홈으로" onClick={onClose}><X size={20} /></button>
      <span className="rt-label">OFFICIAL TEASER</span>
      {!ended && <button className="rt-icon" aria-label={muted ? '소리 켜기' : '소리 끄기'} onClick={() => { const v = video.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }}>{muted ? <SpeakerSlash size={19} /> : <SpeakerHigh size={19} />}</button>}
      {!ended && <button className="rt-skip" onClick={skip}>건너뛰기</button>}
    </header>

    {muted && playing && <button className="rt-unmute" onClick={() => { const v = video.current; if (v) { v.muted = false; setMuted(false); } }}><SpeakerHigh size={16} />소리 켜기</button>}
    {!playing && !ended && <button className="rt-play" aria-label="예고편 재생" onClick={play}><Play size={34} weight="fill" /></button>}
    {!ended && <div className="rt-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>}

    {ended && <div className="rt-end">
      <p className="rt-eyebrow">RED IVY · SEASON 1</p>
      <h1>Episode 1</h1>
      <p className="rt-title">A Perfect Party</p>
      {failed && <p className="rt-error">예고편을 불러오지 못했어요. 바로 1화를 시작할 수 있어요.</p>}
      <button className="rt-start" onClick={onStart}>1화 시작하기<ArrowRight size={19} /></button>
      {!failed && <button className="rt-replay" onClick={replay}><ArrowCounterClockwise size={15} />예고편 다시 보기</button>}
    </div>}
  </section>;
}
