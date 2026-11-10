import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { store } from './store';
import { audio } from './audio';

gsap.registerPlugin(ScrollTrigger);

/* Five storyboard framings. The camera holds while a section is on screen and glides in the gaps. */
const K = {
  overview:  { px: 0.2, py: -0.2, pz: 17.5, tx: 0.4, ty: 0.9, tz: 0, fov: 38, roll: 0, focusOff: 0, dof: 0.3, fog: 0.04, beam: 0.8, spread: 1.0, glow: 0.22, key: 2.6, exposure: 1.0, halation: 0.2, spin: 1.0 },
  mechanism: { px: -1.6, py: 2.0, pz: 5.4, tx: 0.6, ty: 1.5, tz: 0.5, fov: 34, roll: 0, focusOff: 0, dof: 0.8, fog: 0.045, beam: 0.6, spread: 1.0, glow: 0.12, key: 2.6, exposure: 1.0, halation: 0.2, spin: 1.2 },
  precision: { px: -3.6, py: 2.7, pz: 3.6, tx: -0.4, ty: 2.1, tz: 0.5, fov: 36, roll: 1.5, focusOff: 1.2, dof: 1.0, fog: 0.045, beam: 0.6, spread: 1.0, glow: 0.12, key: 2.6, exposure: 1.0, halation: 0.2, spin: 2.2 },
  illumin:   { px: 0.6, py: -1.0, pz: 6.2, tx: 8.5, ty: 1.4, tz: 0, fov: 40, roll: 0, focusOff: 0, dof: 0.35, fog: 0.032, beam: 1.7, spread: 1.2, glow: 0.5, key: 2.4, exposure: 1.0, halation: 0.35, spin: 1.0 },
  transmit:  { px: 3.5, py: -0.4, pz: 18.0, tx: 5.6, ty: 0.5, tz: 0, fov: 40, roll: -1.5, focusOff: 0, dof: 0.28, fog: 0.04, beam: 0.9, spread: 1.1, glow: 0.3, key: 2.8, exposure: 1.0, halation: 0.3, spin: 0.7 }
};
const ORDER = ['overview', 'mechanism', 'precision', 'illumin', 'transmit'];

export function initChoreo({ theia }) {
  const D = document, W = window;
  const hasGL = !!(theia && !theia.failed && theia.S);
  const reduce = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  W.scrollTo(0, 0);

  const sections = Array.from(D.querySelectorAll('section.act'));
  let camTL = null, current = -1, destroyed = false;

  /* ---------------- Lenis (single clock with GSAP) ---------------- */
  let lenis = null;
  const lenisTick = (t) => lenis && lenis.raf(t * 1000);
  const renderTick = () => hasGL && theia.frame();
  if (!reduce) {
    lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(lenisTick);
  }
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(renderTick);

  const ctx = gsap.context((self) => {
    /* ---------------- Camera timeline ---------------- */
    const buildCamera = () => {
      if (!hasGL) return;
      if (camTL) { camTL.scrollTrigger && camTL.scrollTrigger.kill(); camTL.kill(); }
      const S = theia.S, max = ScrollTrigger.maxScroll(W), vh = W.innerHeight;
      const pos = sections.map((s, i) => (i === 0 ? 0 : Math.min(max, Math.max(0, s.offsetTop + s.offsetHeight / 2 - vh / 2))));
      pos[pos.length - 1] = max;
      camTL = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: D.body, start: 0, end: 'max', scrub: 1, onUpdate: (self) => store.set({ progress: self.progress }) } });
      camTL.set({}, {}, max);
      for (let i = 0; i < ORDER.length - 1; i++) {
        const a = pos[i], gap = pos[i + 1] - pos[i];
        if (gap <= 0) continue;
        camTL.fromTo(S, { ...K[ORDER[i]] }, { ...K[ORDER[i + 1]], duration: gap * 0.6, ease: 'power2.inOut', immediateRender: false }, a + gap * 0.2);
      }
    };

    /* ---------------- Section state + simple reveals ---------------- */
    const setAct = (i) => {
      if (i === current) return;
      current = i; D.body.dataset.act = i; store.set({ act: i, fstop: 'f/1.4' });
      if (hasGL) gsap.to(theia.iris, { v: i === 3 ? 0.95 : 0.75, duration: 1.4, ease: 'power2.out', overwrite: 'auto' });
      audio.swell();
    };
    sections.forEach((s, i) => {
      ScrollTrigger.create({ trigger: s, start: 'top 60%', end: 'bottom 60%', onToggle: (self) => { if (self.isActive) setAct(i); } });
      if (i === 0) return;
      gsap.from(s.querySelectorAll('[data-r]'), { autoAlpha: 0, y: 28, duration: 0.9, stagger: 0.07, ease: 'power2.out', scrollTrigger: { trigger: s, start: 'top 62%', once: true } });
    });
    gsap.to('.hero-in', { autoAlpha: 0, y: -50, ease: 'none', scrollTrigger: { trigger: '#act1', start: 'top top', end: '70% top', scrub: true } });

    /* ---------------- Scroll velocity → reels + audio ---------------- */
    const onVel = (v) => { if (hasGL) theia.kick(v * 0.28); audio.energy(Math.min(1, v / 40)); };
    if (lenis) lenis.on('scroll', (e) => onVel(Math.abs(e.velocity || 0)));

    /* ---------------- Start: strike the lamp ---------------- */
    const start = () => {
      if (destroyed) return;
      if (hasGL) { Object.assign(theia.I, { dolly: 5.5, fog: 0.05, exposure: 0.0 }); Object.assign(theia.S, K.overview); }
      buildCamera(); ScrollTrigger.refresh(); setAct(0);
      gsap.set('.hero-in [data-r], .hero-in [data-ch]', { autoAlpha: 0 });
      setTimeout(() => {
        if (destroyed) return;
        store.set({ loaded: true });
        if (hasGL) {
          gsap.to(theia.I, { exposure: 1, duration: 2.4, ease: 'power2.out' });
          gsap.to(theia.I, { dolly: 0, fog: 0, duration: 5.2, ease: 'power3.out' });
          setTimeout(() => theia.flash(0.9), 350);
        }
        gsap.fromTo('.hero-in [data-ch]', { autoAlpha: 0, yPercent: 40, filter: 'blur(16px)' }, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 2.2, stagger: 0.14, delay: 0.3, ease: 'power3.out' });
        gsap.fromTo('.hero-in [data-r]', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.5, stagger: 0.1, delay: 0.9, ease: 'power3.out' });
      }, 650);
    };
    if (hasGL) {
      const timeout = new Promise((r) => setTimeout(r, 15000));
      Promise.race([theia.ready, timeout]).then(start).catch(start);
    } else { start(); }

    let rz = 0;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { buildCamera(); ScrollTrigger.refresh(); }, 300); };
    W.addEventListener('resize', onResize);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { if (!destroyed) { buildCamera(); ScrollTrigger.refresh(); } });
    self.add(() => W.removeEventListener('resize', onResize));
  });

  const goTo = (i) => {
    const el = sections[i]; if (!el) return;
    const y = i === 0 ? 0 : Math.min(el.offsetTop, ScrollTrigger.maxScroll(W));
    if (lenis) lenis.scrollTo(y, { duration: 2.0, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else W.scrollTo({ top: y, behavior: 'smooth' });
  };

  return {
    goTo, lenis,
    destroy() {
      destroyed = true; ctx.revert();
      gsap.ticker.remove(lenisTick); gsap.ticker.remove(renderTick);
      if (lenis) lenis.destroy();
    }
  };
}
