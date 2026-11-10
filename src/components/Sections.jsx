import { useState } from 'react';
import { useTheia } from '../lib/context';
import { store } from '../lib/store';
import { FpsMeter } from './Ui';

const Sec = ({ id, children, className = '' }) => (
  <section id={id} className={`act relative flex min-h-screen items-center px-6 py-28 md:px-16 ${className}`}>{children}</section>
);

export function Hero() {
  const { goTo } = useTheia();
  return (
    <Sec id="act1" className="items-end justify-center pb-16 pt-[50vh] text-center md:pb-20">
      <div className="scrim hero-plate" />
      <div className="hero-in relative z-10 flex flex-col items-center">
        <h1 className="title" aria-label="THEIA">{'THEIA'.split('').map((c, i) => <span key={i} data-ch className="ch">{c}</span>)}</h1>
        <p data-r className="glass mt-5 rounded-full px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[.38em] text-bone sm:text-sm md:text-base">
          The Interface <span className="grad-text-anim">Architects</span>
        </p>
        <div data-r className="mt-7 flex flex-wrap justify-center gap-3">
          <button className="btn-primary" onClick={() => goTo(1)}>Enter the studio</button>
          <button className="btn-ghost" onClick={() => goTo(4)}>Start a project</button>
        </div>
      </div>
    </Sec>
  );
}

const MECH = [
  ['Discover', 'Research, flows and wireframes before pixels.', 'from-teal to-sky'],
  ['Structure', 'Information architecture, tokens and grids.', 'from-sky to-violet'],
  ['Prototype', 'Interactive, testable, in real code.', 'from-violet to-coral']
];
export function Mechanism() {
  return (
    <Sec id="act2">
      <div className="scrim scrim-l" />
      <div className="relative z-10 max-w-xl">
        <div data-r className="kicker">Act II — Physical mechanism</div>
        <h2 data-r className="h2 mt-4">Every reel is a <span className="grad-text">decision.</span></h2>
        <p data-r className="lead mt-5">Interfaces are machines: moving parts, tolerances, rhythm. We design the mechanism, then the experience that rides on it.</p>
        <div className="mt-8 grid gap-3">
          {MECH.map(([t, d, g], i) => (
            <div key={t} data-r className="glass group flex items-start gap-4 rounded-2xl p-4 transition-transform duration-500 hover:-translate-x-[-6px]">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g} font-mono text-sm text-ink`}>0{i + 1}</div>
              <div><div className="font-medium">{t}</div><div className="mt-1 text-sm text-bone/65">{d}</div></div>
            </div>
          ))}
        </div>
      </div>
    </Sec>
  );
}

const STATS = [['120', 'FPS target', 'Locked frame pacing on mid-range GPUs'], ['0', 'Layout reflows', 'Transform-only motion, measured'], ['<8ms', 'WebGL budget', 'Per-frame render envelope']];
export function Precision() {
  return (
    <Sec id="act3" className="justify-end">
      <div className="scrim scrim-r" />
      <div className="relative z-10 w-full max-w-xl md:text-right">
        <div data-r className="kicker">Act III — Precision engineering</div>
        <h2 data-r className="h2 mt-4">Tolerance of <span className="grad-text">±0.01.</span></h2>
        <p data-r className="lead mt-5">Performance is a feature you can feel. We budget it like a film budget — every millisecond accounted for.</p>
        <div className="mt-8 grid grid-cols-3 gap-3 text-left">
          {STATS.map(([v, l, d]) => (
            <div key={l} data-r className="glass rounded-2xl p-4">
              <div className="grad-text text-3xl font-semibold tracking-tight md:text-4xl">{v}</div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[.16em]">{l}</div>
              <div className="mt-1 hidden text-xs text-bone/55 md:block">{d}</div>
            </div>
          ))}
        </div>
        <div data-r className="mt-3 text-left"><FpsMeter /></div>
      </div>
    </Sec>
  );
}

const SERVICES = [
  ['Spatial UI', 'Depth, parallax and 3D interfaces that stay accessible and fast.', 0.35, 'f/2.8', 'from-coral to-amber'],
  ['Custom Shader Pipelines', 'GLSL effects, post-processing and bespoke render passes.', 0.7, 'f/1.8', 'from-violet to-sky'],
  ['Design Systems', 'Tokens, components and docs that scale across teams.', 1, 'f/1.2', 'from-teal to-sky']
];
function ServiceCard({ s, i }) {
  const { theiaRef } = useTheia();
  const [open, setOpen] = useState(false);
  const [name, desc, iris, f, g] = s;
  const set = (v, fs) => { const t = theiaRef.current; if (t && t.iris) t.iris.v = v; store.set({ fstop: fs }); };
  return (
    <button data-r onClick={() => setOpen(!open)} aria-expanded={open}
      onMouseEnter={() => set(iris, f)} onFocus={() => set(iris, f)} onMouseLeave={() => set(0.75, 'f/1.4')} onBlur={() => set(0.75, 'f/1.4')}
      className="glass ring-grad group relative w-full overflow-hidden rounded-2xl p-5 text-left transition-transform duration-500 hover:-translate-y-1">
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${g} opacity-30 blur-2xl transition-opacity group-hover:opacity-70`} />
      <div className="relative flex items-center justify-between">
        <div><div className="font-mono text-[10px] tracking-[.2em] text-bone/55">0{i + 1} · {f}</div><div className="mt-1 text-lg font-medium">{name}</div></div>
        <span className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br ${g} text-ink transition-transform duration-500 ${open ? 'rotate-45' : ''}`}>+</span>
      </div>
      <div className={`relative grid transition-all duration-500 ${open ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><p className="overflow-hidden text-sm text-bone/70">{desc}</p></div>
    </button>
  );
}
export function Illumination() {
  return (
    <Sec id="act4">
      <div className="scrim scrim-l" />
      <div className="relative z-10 max-w-lg">
        <div data-r className="kicker">Act IV — The illumination</div>
        <h2 data-r className="h2 mt-4">Light the <span className="grad-text">interface.</span></h2>
        <p data-r className="lead mt-5">Hover a service to open the aperture.</p>
        <div className="mt-8 grid gap-3">{SERVICES.map((s, i) => <ServiceCard key={s[0]} s={s} i={i} />)}</div>
      </div>
    </Sec>
  );
}

export function Transmission() {
  const [sent, setSent] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const body = `${d.get('msg')}\n\n— ${d.get('name')} (${d.get('email')})\nBudget: ${d.get('budget')}`;
    window.location.href = `mailto:hello@theia.studio?subject=${encodeURIComponent('Project inquiry — ' + d.get('name'))}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };
  return (
    <Sec id="act5">
      <div className="scrim scrim-b" />
      <div className="relative z-10 md:ml-auto md:w-[60%]">
        <div data-r className="kicker">Act V — Studio transmission</div>
        <h2 data-r className="h2 mt-4">Let's roll <span className="grad-text-anim">camera.</span></h2>
        <form data-r onSubmit={submit} className="glass-dark mt-8 grid gap-3 rounded-3xl p-5 md:p-7">
          <div className="grid gap-3 md:grid-cols-2">
            <input className="field" name="name" required placeholder="Your name" aria-label="Name" />
            <input className="field" name="email" type="email" required placeholder="Email" aria-label="Email" />
          </div>
          <select className="field" name="budget" aria-label="Budget" defaultValue="$25–50k"><option>$10–25k</option><option>$25–50k</option><option>$50–100k</option><option>$100k+</option></select>
          <textarea className="field min-h-[110px]" name="msg" required placeholder="Tell us about the project" aria-label="Project" />
          <button className="btn-primary justify-center" type="submit">{sent ? 'Transmission sent ✓' : 'Send transmission'}</button>
        </form>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[.25em] text-bone/75" style={{ textShadow: '0 1px 10px #000' }}>© {new Date().getFullYear()} THEIA — The Interface Architects</p>
      </div>
    </Sec>
  );
}