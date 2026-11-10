/* =====================================================================
   THEIA — CINEMATIC OPENING LOOP (Web Audio API, fully procedural)
   An 18-second cycle: deep D-minor swell that rises, peaks with a sub
   boom, and fades into reverb, over a soft ticking clock.
   Scroll adds brightness. Off until the visitor opts in.
   ===================================================================== */
export function createAudio() {
  const W = window;
  const AC = W.AudioContext || W.webkitAudioContext;
  const listeners = new Set();
  const CYCLE = 18;
  let ctx = null, master = null, wet = null, dry = null, on = false, energy = 0, target = 0, timer = 0, nextT = 0;
  const N = {};

  function impulse(seconds, decay) {            // generated cathedral-ish reverb tail
    const len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -20; lim.ratio.value = 6;
    master.connect(lim); lim.connect(ctx.destination);

    dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(master);
    const rev = ctx.createConvolver(); rev.buffer = impulse(4.5, 2.6);
    wet = ctx.createGain(); wet.gain.value = 0.9; rev.connect(wet).connect(master);
    N.bus = ctx.createGain(); N.bus.connect(dry); N.bus.connect(rev);

    // continuous sub drone (the floor under everything)
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 36.7;   // D1
    const sg = ctx.createGain(); sg.gain.value = 0.2; sub.connect(sg).connect(N.bus); sub.start();
    N.lp = ctx.createBiquadFilter();            // shared "brightness" filter for swells
  }

  // one 18-second movie-trailer swell + boom + ticks, scheduled at absolute time t
  function scheduleCycle(t) {
    const notes = [73.42, 110.0, 146.83, 174.61, 220.0];     // D2 A2 D3 F3 A3  (D minor)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(160, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + 12);   // rise
    lp.frequency.exponentialRampToValueAtTime(240, t + CYCLE); // fall
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.22, t + 12);
    env.gain.exponentialRampToValueAtTime(0.0001, t + CYCLE);
    lp.connect(env).connect(N.bus);
    N.cycleLP = lp;

    notes.forEach((f, i) => {
      [-7, 7].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + i * 1.5;
        const g = ctx.createGain(); g.gain.value = 0.18 / (1 + i * 0.35);
        o.connect(g).connect(lp); o.start(t); o.stop(t + CYCLE + 0.2);
      });
    });

    // boom at the peak (12s): sine drop + soft noise bloom
    const bt = t + 12;
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.setValueAtTime(70, bt); b.frequency.exponentialRampToValueAtTime(30, bt + 3);
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, bt); bg.gain.exponentialRampToValueAtTime(0.5, bt + 0.05); bg.gain.exponentialRampToValueAtTime(0.0001, bt + 3.6);
    b.connect(bg).connect(N.bus); b.start(bt); b.stop(bt + 3.7);

    // soft ticking clock, one per second, quietly rounded
    for (let s = 0; s < CYCLE; s++) {
      const tt = t + s;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, tt); o.frequency.exponentialRampToValueAtTime(260, tt + 0.05);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
      o.connect(g).connect(N.bus); o.start(tt); o.stop(tt + 0.09);
    }
  }

  function update() {
    if (!ctx || !on) return;
    if (ctx.currentTime >= nextT - 1) { scheduleCycle(nextT); nextT += CYCLE; }   // seamless loop
    target *= 0.92; energy += (target - energy) * 0.15;
    if (N.cycleLP) N.cycleLP.detune.setTargetAtTime(Math.min(1, energy) * 500, ctx.currentTime, 0.3);
  }

  function swell() {          // soft bloom on act change
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(146.8, t); o.frequency.exponentialRampToValueAtTime(110, t + 2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g).connect(N.bus); o.start(t); o.stop(t + 2.5);
  }

  function click() {          // soft tap
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
  }

  async function setOn(v) {
    on = v; listeners.forEach((f) => f(v));
    if (v) {
      if (!ctx) build();
      try { await ctx.resume(); } catch (e) {}
      if (!nextT || nextT < ctx.currentTime) nextT = ctx.currentTime + 0.1;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.8, ctx.currentTime, 1.5);   // slow fade-in
      clearInterval(timer); timer = setInterval(update, 80); update();
      click();
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      clearInterval(timer);
      setTimeout(() => { if (!on && ctx) { ctx.close(); ctx = null; nextT = 0; } }, 1800);
    }
  }

  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });

  return {
    supported: !!AC,
    energy: (v) => { target = Math.max(target, v); },
    click, swell,
    toggle: () => setOn(!on),
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
    get on() { return on; }
  };
}

export const audio = createAudio();