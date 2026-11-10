import { useEffect, useState } from 'react';
import { useStore, ACTS } from '../lib/store';
import { audio } from '../lib/audio';
import { useTheia } from '../lib/context';

const pad = (n, l = 2) => String(n).padStart(l, '0');

/* ---------------- Film-leader loader ---------------- */
export function Loader() {
  const load = useStore((s) => s.load);
  const loaded = useStore((s) => s.loaded);
  const n = Math.max(1, 5 - Math.floor(load * 5));
  return (
    <div role="status" aria-live="polite" className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-ink transition-all duration-1000 ${loaded ? 'pointer-events-none invisible opacity-0' : ''}`}>
      <div className="relative grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(from 0deg, #ffb547, #ff5d73, #7c5cff ${load * 360}deg, rgba(255,255,255,.08) 0)` }}>
        <div className="absolute inset-[3px] rounded-full bg-ink" />
        <span className="relative font-mono text-6xl font-extralight text-bone">{n}</span>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[.34em] text-bone/70">
        Threading film <span className="grad-text-anim">{pad(Math.round(load * 100), 3)}</span>%
      </div>
    </div>
  );
}

/* ---------------- Sound toggle ---------------- */
function SoundButton() {
  const [on, setOn] = useState(false);
  useEffect(() => audio.subscribe(setOn), []);
  if (!audio.supported) return null;
  return (
    <button onClick={() => audio.toggle()} aria-pressed={on} aria-label="Toggle projector ambience" className={`btn-ghost pointer-events-auto ${on ? 'on' : ''}`}>
      Sound
      <span className="eq flex h-3 items-end gap-[2px]" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  );
}

/* ---------------- HUD ---------------- */
export function Hud() {
  const { goTo } = useTheia();
  const act = useStore((s) => s.act);
  const progress = useStore((s) => s.progress);
  const fps = useStore((s) => s.fps);
  const sec = progress * 120, f = Math.floor(sec * 24);
  const tc = `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(Math.floor(sec) % 60)}:${pad(f % 24)}`;
  const healthy = fps >= 55;

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 pt-5 md:px-10">
        <button onClick={() => goTo(0)} className="glass pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-3 pr-5 font-mono text-[13px] tracking-[.4em]" aria-label="THEIA — back to top">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="url(#lg)" strokeWidth="1.8" /><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffb547" /><stop offset="1" stopColor="#7c5cff" /></linearGradient></defs><circle cx="16" cy="8.5" r="3" fill="#ff5d73" /><circle cx="22.5" cy="20" r="3" fill="#7c5cff" /><circle cx="9.5" cy="20" r="3" fill="#2de2c5" /></svg>
          THEIA
        </button>

        <nav className="glass pointer-events-auto hidden items-center gap-1 rounded-full p-1.5 md:flex" aria-label="Acts">
          {ACTS.map((a, i) => (
            <button key={a.roman} onClick={() => goTo(i)} aria-label={`Act ${a.roman}: ${a.name}`} aria-current={act === i}
              className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-[.14em] transition-all duration-500 ${act === i ? 'text-ink' : 'text-bone/60 hover:text-bone'}`}
              style={act === i ? { backgroundImage: 'linear-gradient(100deg, var(--a1), var(--a2))', boxShadow: '0 6px 24px -6px var(--a1)' } : undefined}>
              {a.roman}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <SoundButton />
          <button onClick={() => goTo(4)} className="btn-primary pointer-events-auto hidden !px-5 !py-2.5 sm:inline-flex">Start a project</button>
        </div>
      </header>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between px-5 pb-5 font-mono text-[10px] uppercase tracking-[.2em] text-bone/65 md:px-10 md:text-[11px]">
        <div style={{ textShadow: '0 1px 10px rgba(0,0,0,.9)' }}>
          <div>TC <span className="text-bone">{tc}</span></div>
          <div className="mt-1">Act {ACTS[act].roman} / V — <span className="grad-text">{ACTS[act].name}</span></div>
        </div>
        <div className="hidden w-[26vw] max-w-sm text-center sm:block">
          <div className="relative h-[3px] overflow-hidden rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full" style={{ transform: `scaleX(${progress.toFixed(4)})`, backgroundImage: 'linear-gradient(90deg, var(--a1), var(--a2))', boxShadow: '0 0 14px var(--a1)' }} />
          </div>
          <div className="mt-2" style={{ textShadow: '0 1px 10px rgba(0,0,0,.9)' }}>Reel <span className="text-bone">{pad(f, 6)}</span></div>
        </div>
        <div className="text-right" style={{ textShadow: '0 1px 10px rgba(0,0,0,.9)' }}>
          <div className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 animate-pulseDot rounded-full ${healthy ? 'bg-teal' : 'bg-amber'}`} /><span className="text-bone">{Math.round(fps)}</span> FPS</div>
          <div className="mt-1">35MM · GPU</div>
        </div>
      </footer>
    </>
  );
}

/* ---------------- Blueprint tags that follow 3D parts (positioned by the scene) ---------------- */
export function Tags() {
  const fstop = useStore((s) => s.fstop);
  return (
    <>
      <div className="tag" data-p="1" data-anchor="reelA"><span>Reel A · Ø190 · 5 apertures</span></div>
      <div className="tag" data-p="1" data-anchor="reelB"><span>Take-up · 1.6:1 ratio</span></div>
      <div className="tag" data-p="1" data-anchor="gate"><span>Gate · tolerance ±0.01</span></div>
      <div className="tag" data-p="2" data-anchor="lamp"><span>Lamphouse · 1.2kW tungsten</span></div>
      <div className="tag" data-p="2" data-anchor="chimney"><span>Thermal path · passive</span></div>
      <div className="tag" data-p="3" data-anchor="iris"><span>Aperture · <b style={{ color: 'var(--a1)', fontWeight: 500 }}>{fstop}</b></span></div>
    </>
  );
}

/* ---------------- Live, measured frame meter ---------------- */
export function FpsMeter() {
  const fps = useStore((s) => s.fps);
  const ms = useStore((s) => s.ms);
  const pct = Math.min(1, fps / 120);
  return (
    <div className="glass flex items-center gap-5 rounded-2xl p-4">
      <div className="relative grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(from -90deg, var(--a1), var(--a2) ${pct * 360}deg, rgba(255,255,255,.1) 0)` }}>
        <div className="absolute inset-[5px] rounded-full bg-ink/90" />
        <div className="relative text-center leading-none"><div className="font-mono text-2xl font-light">{Math.round(fps)}</div><div className="mt-1 font-mono text-[8px] tracking-[.2em] text-bone/55">FPS</div></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[.22em] text-bone/60">Live — measured on your GPU</div>
        <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (ms / 33.3) * 100)}%`, backgroundImage: 'linear-gradient(90deg, var(--a1), var(--a2))' }} /></div>
        <div className="mt-2 font-mono text-[10px] tracking-[.14em] text-bone/55">Frame {ms.toFixed(1)} ms · budget 8.3 ms @120Hz</div>
      </div>
    </div>
  );
}
