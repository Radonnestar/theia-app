/* =====================================================================
   THEIA — 3D SCENE
   Procedural 35mm projector · volumetric tungsten beam · dust · film post
   ===================================================================== */
import * as T from 'three';

/** Creates the THEIA 3D scene on `canvas`. Returns the control surface (S, I, iris, frame, kick, flash, ready, dispose). */
export function createScene({ canvas, tags = [], onProgress = () => {}, onStats = () => {} }) {
  const W = window;
  const progress = (p) => onProgress(Math.min(1, Math.max(0, p)));
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  } catch (e) { console.warn('[THEIA] WebGL unavailable', e); return { failed: true }; }

  const reduceMotion = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isGL2 = renderer.capabilities.isWebGL2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x050607, 1);

  /* ------------------------------------------------------------------
     Public state. GSAP (choreo.js) tweens S; the render loop reads it.
     ------------------------------------------------------------------ */
  const FLOOR = -2.0;   // studio floor height (projector sits on a tall stand)
  const S = {
    px: -1.2, py: 2.0, pz: 13.5,         // camera position
    tx: 1.0, ty: 1.9, tz: 0,             // look-at target
    fov: 36, roll: 0,
    focusOff: 0,                         // rack-focus offset from target distance
    dof: 0.32,                           // depth-of-field strength
    fog: 0.042,
    beam: 0.8, spread: 1.0, glow: 0.22,  // beam brightness / widening / lens flare
    key: 2.6, exposure: 1.0, halation: 0.2,
    spin: 1.0                            // base reel speed multiplier
  };
  const I = { dolly: 0, fog: 0, exposure: 1 };   // intro offsets (non-scroll)
  const iris = { v: 0.75 };                       // 0 closed .. 1 open
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const stats = { fps: 60, ms: 16.6 };
  const hooks = [];                               // per-frame callbacks (dt, time)
  let spinImp = 0, flash = 0;

  const scene = new T.Scene();
  scene.background = new T.Color(0x040506);
  scene.fog = new T.FogExp2(0x07080a, S.fog);
  const camera = new T.PerspectiveCamera(S.fov, innerWidth / innerHeight, 0.2, 90);

  /* ------------------------------------------------------------------
     Procedural textures
     ------------------------------------------------------------------ */
  let _seed = 1337;
  const rand = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function tex(canvas, srgb, repeat) {
    const t = new T.CanvasTexture(canvas);
    t.wrapS = t.wrapT = T.MirroredRepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.encoding = T.sRGBEncoding;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }

  function concreteCanvas() {
    const N = 1024, c = mkCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = '#4b4b49'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 280; i++) {
      const x = rand() * N, y = rand() * N, r = 24 + rand() * 150, v = rand() > 0.5 ? 255 : 0;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},${0.035 + rand() * 0.05})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const img = g.getImageData(0, 0, N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * 44; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.94; }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 800; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + rand() * 0.4})`; g.beginPath(); g.arc(rand() * N, rand() * N, 0.6 + rand() * 2.6, 0, 6.283); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) { let x = rand() * N, y = rand() * N; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 14; k++) { x += (rand() - 0.5) * 60; y += (rand() - 0.3) * 50; g.lineTo(x, y); } g.stroke(); }
    return c;
  }
  function brushedCanvas(base) {
    const N = 512, c = mkCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 5600; i++) {
      const y = rand() * N, x = rand() * N, l = 30 + rand() * 320, v = rand() > 0.5 ? 255 : 10;
      g.strokeStyle = `rgba(${v},${v},${v},${0.008 + rand() * 0.04})`; g.lineWidth = 0.5 + rand() * 1.2;
      for (const ox of [0, -N]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + l, y + (rand() - 0.5) * 1.2); g.stroke(); }
    }
    return c;
  }
  // Engraved lens ring: ticks + numerals + knurl bands
  function ringCanvas(labels, bg, fg, repeats) {
    const w = 2048, h = 256, c = mkCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 9) { g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, 0, 3, 62); g.fillRect(x, h - 62, 3, 62); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 4, 0, 3, 62); g.fillRect(x + 4, h - 62, 3, 62); }
    g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = 3; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '500 46px "JetBrains Mono", ui-monospace, monospace';
    const n = labels.length * repeats, step = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * step + step / 2;
      g.fillText(labels[i % labels.length], x, 128);
      g.beginPath(); g.moveTo(x, 78); g.lineTo(x, 98); g.stroke();
      g.beginPath(); g.moveTo(x, 158); g.lineTo(x, 178); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + step / 2, 82); g.lineTo(x + step / 2, 92); g.stroke(); g.lineWidth = 3;
    }
    return c;
  }
  function labelCanvas() {
    const c = mkCanvas(512, 128), g = c.getContext('2d');
    g.drawImage(brushedCanvas('#b4b7ba'), 0, 0, 512, 128, 0, 0, 512, 128);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(5, 5, 502, 118);
    g.fillStyle = '#16171a'; g.textBaseline = 'middle';
    g.font = '600 44px "JetBrains Mono", monospace'; g.fillText('THEIA  MK.IV', 24, 44);
    g.font = '400 22px "JetBrains Mono", monospace'; g.fillText('35MM · No.0024 · ASSEMBLED IN SILICON', 24, 92);
    return c;
  }
  function filmCanvas() {   // sprocket holes (alpha cut-outs) + faint frame lines
    const c = mkCanvas(64, 64), g = c.getContext('2d');
    g.fillStyle = '#17110a'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#241a10'; g.fillRect(12, 4, 40, 56);
    g.clearRect(3, 22, 6, 9); g.clearRect(55, 22, 6, 9);
    return c;
  }

  /* ------------------------------------------------------------------
     Geometry helpers
     ------------------------------------------------------------------ */
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cylX = (r1, r2, len, seg = 48) => { const g = new T.CylinderGeometry(r1, r2, len, seg); g.rotateZ(-Math.PI / 2); return g; };  // axis → +x
  const cylZ = (r, len, seg = 32) => { const g = new T.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return g; };          // axis → +z
  function merge(list) {
    const gs = list.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0; gs.forEach((g) => (n += g.attributes.position.count));
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
    let o = 0;
    gs.forEach((g) => { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
    const m = new T.BufferGeometry();
    m.setAttribute('position', new T.BufferAttribute(P, 3)); m.setAttribute('normal', new T.BufferAttribute(N, 3)); m.setAttribute('uv', new T.BufferAttribute(U, 2));
    return m;
  }
  function at(g, x, y, z, rz) { if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; }
  function gearGeo(r, teeth, thick, phase = 0) {
    const parts = [cylZ(r, thick, teeth * 2)];
    const tw = (2 * Math.PI * r) / teeth * 0.52;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2 + phase;
      parts.push(at(box(tw, r * 0.2, thick), Math.cos(a) * (r + r * 0.07), Math.sin(a) * (r + r * 0.07), 0, a + Math.PI / 2));
    }
    return merge(parts);
  }

  /* ------------------------------------------------------------------
     Build helpers that need renderer: materials + environment
     ------------------------------------------------------------------ */
  const M = {};
  function buildMaterials() {
    const brushA = brushedCanvas('#a9acb0');
    const mapA = tex(brushA, true), roughA = tex(brushA, false);
    const conc = concreteCanvas();
    const cMap = tex(conc, true), cBump = tex(conc, false);
    M.alu = new T.MeshStandardMaterial({ color: 0xd2d4d6, metalness: 1, roughness: 0.62, map: mapA, roughnessMap: roughA });
    M.aluDark = new T.MeshStandardMaterial({ color: 0x25272a, metalness: 0.9, roughness: 0.55, roughnessMap: roughA });
    M.enamel = new T.MeshStandardMaterial({ color: 0x121315, metalness: 0.5, roughness: 0.58, roughnessMap: roughA });
    M.brass = new T.MeshStandardMaterial({ color: 0xc19a5a, metalness: 1, roughness: 0.38, roughnessMap: roughA });
    M.rubber = new T.MeshStandardMaterial({ color: 0x0b0b0c, metalness: 0.0, roughness: 0.85 });
    M.roll = new T.MeshStandardMaterial({ color: 0x14100c, metalness: 0.15, roughness: 0.42 });
    const fMap = tex(ringCanvas(['0.6', '1', '1.5', '2', '3', '5', '10', '∞'], '#17181b', '#e1dbc9', 3), true);
    fMap.wrapS = T.RepeatWrapping;
    M.focus = new T.MeshStandardMaterial({ color: 0xffffff, map: fMap, bumpMap: fMap, bumpScale: 1.4, metalness: 0.75, roughness: 0.42 });
    const aMap = tex(ringCanvas(['1.4', '2', '2.8', '4', '5.6', '8', '11', '16'], '#8e9296', '#101113', 3), true);
    aMap.wrapS = T.RepeatWrapping;
    M.apRing = new T.MeshStandardMaterial({ color: 0xffffff, map: aMap, bumpMap: aMap, bumpScale: 1.0, metalness: 0.9, roughness: 0.45 });
    const lMap = tex(labelCanvas(), true);
    M.label = new T.MeshStandardMaterial({ map: lMap, metalness: 0.8, roughness: 0.5 });
    const fl = new T.CanvasTexture(filmCanvas()); fl.wrapS = fl.wrapT = T.RepeatWrapping; fl.encoding = T.sRGBEncoding; fl.repeat.set(1, 70);
    M.film = new T.MeshStandardMaterial({ map: fl, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.32, metalness: 0.2 });
    M.concrete = new T.MeshStandardMaterial({ color: 0x555555, map: cMap, bumpMap: cBump, bumpScale: 0.7, roughness: 0.93, metalness: 0 });
    const fm = cMap.clone(); fm.repeat.set(36, 36); fm.needsUpdate = true;
    const fb = cBump.clone(); fb.repeat.set(36, 36); fb.needsUpdate = true;
    M.floor = new T.MeshStandardMaterial({ color: 0x303030, map: fm, bumpMap: fb, bumpScale: 0.18, roughness: 0.88, metalness: 0 });
    const wc = mkCanvas(512, 512), wg = wc.getContext('2d');
    wg.fillStyle = '#4b2f1c'; wg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { const y = rand() * 512, v = rand() > 0.5 ? 255 : 0; wg.strokeStyle = `rgba(${v},${v * 0.7},${v * 0.4},${0.03 + rand() * 0.08})`; wg.lineWidth = 0.6 + rand() * 2.4; wg.beginPath(); wg.moveTo(0, y); wg.bezierCurveTo(170, y + (rand() - 0.5) * 16, 340, y + (rand() - 0.5) * 16, 512, y + (rand() - 0.5) * 10); wg.stroke(); }
    M.walnut = new T.MeshStandardMaterial({ color: 0xffffff, map: tex(wc, true), roughness: 0.5, metalness: 0 });
    M.iron = new T.MeshStandardMaterial({ color: 0x171717, metalness: 0.7, roughness: 0.6 });
    M.bulb = new T.MeshBasicMaterial({ color: new T.Color(2.4, 2.3, 2.1) });
    M.glass = new T.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffc88a, emissiveIntensity: 2.4, roughness: 0.08, metalness: 0 });
    M.dark = new T.MeshStandardMaterial({ color: 0x060607, metalness: 0.7, roughness: 0.35 });
    M.gate = new T.MeshBasicMaterial({ color: new T.Color(2.6, 1.6, 0.75) });
    M.vent = new T.MeshBasicMaterial({ color: new T.Color(1.7, 0.8, 0.3) });
  }

  function buildEnvironment() {
    const es = new T.Scene();
    const bm = (r, g, b) => new T.MeshBasicMaterial({ color: new T.Color(r, g, b), side: T.DoubleSide });
    const panel = (w, h, mat, x, y, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    es.add(new T.Mesh(new T.SphereGeometry(40, 24, 14), new T.MeshBasicMaterial({ color: new T.Color(0.014, 0.016, 0.02), side: T.BackSide })));
    panel(16, 10, bm(6.0, 4.6, 3.4), -9, 11, 10);      // tungsten key softbox
    panel(3, 18, bm(0.8, 0.88, 1.0), 14, 6, -5);       // dim cool strip
    panel(14, 14, bm(0.3, 0.22, 0.15), 12, 2.5, 8);    // warm bounce from the beam side
    panel(30, 6, bm(0.16, 0.14, 0.12), 0, -4, 0);      // floor bounce
    const pm = new T.PMREMGenerator(renderer);
    const rtEnv = pm.fromScene(es, 0.02);
    pm.dispose();
    scene.environment = rtEnv.texture;
  }

  /* ------------------------------------------------------------------
     The projector
     ------------------------------------------------------------------ */
  const anchors = {};
  const spinners = [];     // { obj, axis, k }  — rotated every frame
  let reelA, reelB, focusPivot, apPivot, irisBlades = [];
  const P = new T.Group();
  const LY = 1.0;          // lens axis height (local)

  function add(geo, mat, x, y, z, parent) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    (parent || P).add(m); return m;
  }

  function buildReel(R, rollR, thick) {
    const g = new T.Group();
    const sh = new T.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 10, hp = new T.Path();
      hp.absarc(Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58, R * 0.27, 0, Math.PI * 2, true); sh.holes.push(hp);
    }
    const hc = new T.Path(); hc.absarc(0, 0, R * 0.13, 0, Math.PI * 2, true); sh.holes.push(hc);
    const dep = 0.035;
    const fg = new T.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 40 });
    add(fg, M.alu, 0, 0, -thick / 2, g);
    add(fg, M.alu, 0, 0, thick / 2 - dep, g);
    add(cylZ(rollR, thick - 0.06, 64), M.roll, 0, 0, 0, g);
    add(cylZ(R * 0.16, thick + 0.1, 24), M.brass, 0, 0, 0, g);
    add(cylZ(R * 0.07, thick + 0.2, 16), M.aluDark, 0, 0, 0, g);
    // rim notch so rotation reads
    add(box(0.05, 0.1, thick + 0.02), M.brass, R - 0.02, 0, 0, g);
    return g;
  }

  function ribbon(pts, width, mat) {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], 0)), false, 'catmullrom', 0.35);
    const N = 200, pos = [], idx = [], uv = [];
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPoint(u);
      const z = 0.55 + 0.24 * (ss(0.03, 0.2, u) - ss(0.8, 0.97, u));
      pos.push(p.x, p.y, z - width / 2, p.x, p.y, z + width / 2); uv.push(0, u, 1, u);
    }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }

  function buildProjector() {
    P.position.set(0, 0.5, 0); scene.add(P);

    // --- floor + plinth
    const floor = new T.Mesh(new T.PlaneGeometry(240, 240), M.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; scene.add(floor);
    buildStand();

    // --- base + housing
    add(box(4.6, 0.18, 1.95), M.alu, -0.1, 0.09, 0);
    add(box(2.7, 1.5, 1.3), M.enamel, -0.15, 0.93, 0);
    add(box(2.76, 0.05, 1.36), M.alu, -0.15, 1.69, 0);
    add(box(2.76, 0.05, 1.36), M.alu, -0.15, 0.19, 0);

    // --- mechanism plate (camera-facing +z)
    add(box(1.95, 1.2, 0.06), M.alu, -0.15, 0.93, 0.68);
    add(box(0.48, 0.36, 0.02), M.dark, 0.1, 1.08, 0.715);
    const glow = new T.Mesh(new T.PlaneGeometry(0.34, 0.22), M.gate); glow.position.set(0.1, 1.08, 0.727); P.add(glow);
    const lab = new T.Mesh(new T.PlaneGeometry(0.72, 0.18), M.label); lab.position.set(0.38, 0.45, 0.713); P.add(lab);
    // screws
    const sc = [];
    [[-1.05, 1.47], [0.75, 1.47], [-1.05, 0.39], [0.75, 0.39]].forEach((s) => { sc.push(at(cylZ(0.036, 0.022, 14), s[0], s[1], 0.72)); sc.push(at(box(0.05, 0.008, 0.024), s[0], s[1], 0.73, (s[0] * 7) % 3)); });
    add(merge(sc), M.aluDark, 0, 0, 0);
    // gears
    const gBig = add(gearGeo(0.28, 28, 0.05), M.alu, -0.62, 0.78, 0.745);
    const gSmall = add(gearGeo(0.14, 14, 0.05, Math.PI / 14), M.brass, -0.2, 0.78, 0.745);
    spinners.push({ o: gBig, k: -0.5 }, { o: gSmall, k: 1.0 });
    // rollers (with sprocket teeth)
    const r1 = add(merge([cylZ(0.12, 0.17, 24)].concat(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 6.283; return at(box(0.03, 0.03, 0.17), Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0, a); }))), M.aluDark, -0.7, 1.4, 0.8);
    const r2 = add(cylZ(0.12, 0.17, 24), M.aluDark, 0.55, 0.62, 0.8);
    spinners.push({ o: r1, k: 0.9 }, { o: r2, k: 0.9 });
    // dial
    const dial = add(cylZ(0.13, 0.12, 32), M.aluDark, 0.62, 1.38, 0.79);
    add(box(0.02, 0.1, 0.13), M.brass, 0.0, 0.05, 0.0, dial);

    // --- reels, posts, spindles
    const rA = [-1.1, 2.75, 0.55], rB = [0.85, 2.75, 0.55];
    reelA = buildReel(0.95, 0.7, 0.4); reelA.position.set(...rA); P.add(reelA);
    reelB = buildReel(0.95, 0.38, 0.4); reelB.position.set(...rB); P.add(reelB);
    [rA, rB].forEach((r) => {
      add(box(0.2, 1.1, 0.18), M.enamel, r[0], 2.2, -0.05);
      add(cylZ(0.07, 0.86, 16), M.aluDark, r[0], r[1], 0.38);
    });
    // film strip
    const film = ribbon([[-0.45, 2.72], [-0.52, 2.1], [-0.57, 1.6], [-0.57, 1.36], [-0.42, 1.28], [0.0, 1.22], [0.1, 1.08], [0.2, 0.94], [0.34, 0.76], [0.43, 0.62], [0.55, 0.49], [0.67, 0.62], [0.8, 0.95], [0.9, 1.5], [0.92, 2.1], [0.9, 2.38]], 0.3, M.film);
    P.add(film);

    // --- lamphouse
    add(cylX(0.62, 0.62, 1.4, 56), M.enamel, -2.2, LY, 0);
    add(cylX(0.7, 0.7, 0.12, 56), M.alu, -2.96, LY, 0);
    const fins = []; for (let k = 0; k < 6; k++) fins.push(new T.TorusGeometry(0.64, 0.035, 10, 56).rotateY(Math.PI / 2).translate(-1.7 - k * 0.2, LY, 0));
    add(merge(fins), M.alu, 0, 0, 0);
    const vents = []; for (let k = 0; k < 7; k++) { const dy = -0.27 + k * 0.09; vents.push(box(0.6, 0.03, 0.08).translate(-2.2, LY + dy, Math.sqrt(0.62 * 0.62 - dy * dy))); }
    const ventMesh = new T.Mesh(merge(vents), M.vent); P.add(ventMesh);
    const chim = new T.CylinderGeometry(0.2, 0.2, 0.5, 28); add(chim, M.enamel, -2.2, 1.85, 0);
    add(new T.CylinderGeometry(0.27, 0.27, 0.06, 28), M.alu, -2.2, 2.13, 0);
    // cables hang from the lamphouse to the floor
    const FL = FLOOR - 0.5;
    const cab1 = new T.CatmullRomCurve3([new T.Vector3(-3.0, 0.95, 0.1), new T.Vector3(-3.4, 0.5, 0.3), new T.Vector3(-3.6, -1.0, 0.6), new T.Vector3(-3.3, FL + 0.05, 1.1), new T.Vector3(-4.4, FL + 0.05, 1.8)]);
    add(new T.TubeGeometry(cab1, 50, 0.05, 8), M.rubber, 0, 0, 0);
    const cab2 = new T.CatmullRomCurve3([new T.Vector3(-1.5, 0.2, -0.65), new T.Vector3(-1.6, -1.0, -1.0), new T.Vector3(-2.2, FL + 0.05, -1.4), new T.Vector3(-3.6, FL + 0.05, -1.2)]);
    add(new T.TubeGeometry(cab2, 40, 0.04, 8), M.rubber, 0, 0, 0);

    // --- lens assembly (axis +x at y = LY)
    add(cylX(0.56, 0.56, 0.12, 56), M.aluDark, 1.26, LY, 0);
    add(cylX(0.44, 0.44, 1.0, 56), M.alu, 1.7, LY, 0);
    focusPivot = new T.Group(); focusPivot.position.set(1.55, LY, 0); P.add(focusPivot);
    add(cylX(0.5, 0.5, 0.4, 120), M.focus, 0, 0, 0, focusPivot);
    apPivot = new T.Group(); apPivot.position.set(1.98, LY, 0); P.add(apPivot);
    add(cylX(0.5, 0.5, 0.3, 120), M.apRing, 0, 0, 0, apPivot);
    add(cylX(0.4, 0.4, 0.37, 56), M.enamel, 2.315, LY, 0);
    add(new T.TorusGeometry(0.4, 0.038, 12, 64).rotateY(Math.PI / 2), M.alu, 2.5, LY, 0);
    const glass = add(new T.CircleGeometry(0.36, 64).rotateY(Math.PI / 2), M.glass, 2.43, LY, 0); glass.castShadow = false;
    add(new T.RingGeometry(0.295, 0.31, 64).rotateY(Math.PI / 2), M.dark, 2.437, LY, 0).castShadow = false;
    add(new T.RingGeometry(0.215, 0.225, 64).rotateY(Math.PI / 2), M.dark, 2.44, LY, 0).castShadow = false;
    // iris blades
    const irisG = new T.Group(); irisG.position.set(2.47, LY, 0); irisG.rotation.y = Math.PI / 2; P.add(irisG);
    for (let i = 0; i < 8; i++) {
      const b = new T.Mesh(box(0.3, 0.13, 0.004), M.dark); b.userData.a = (i / 8) * Math.PI * 2; b.userData.z = i * 0.0007;
      b.castShadow = false; irisG.add(b); irisBlades.push(b);
    }
    setIris(iris.v, true);

    // world-space anchors for the blueprint tags
    const wp = (x, y, z) => new T.Vector3(x, y + 0.5, z);
    anchors.reelA = wp(-1.1, 2.75, 0.8); anchors.reelB = wp(0.85, 2.75, 0.8); anchors.gate = wp(0.1, 1.08, 0.8);
    anchors.lamp = wp(-2.2, 1.0, 0.62); anchors.gear = wp(-0.62, 0.78, 0.8); anchors.chimney = wp(-2.2, 2.1, 0); anchors.iris = wp(2.5, LY + 0.3, 0);
  }


  /* ------------------------------------------------------------------
     Concrete room + projection screen (wireframe UI, per the storyboard)
     ------------------------------------------------------------------ */
  function uiCanvas() {
    const c = mkCanvas(1024, 576), g = c.getContext('2d');
    g.fillStyle = '#d9cfba'; g.fillRect(0, 0, 1024, 576);
    g.fillStyle = '#2a241b'; g.strokeStyle = '#2a241b'; g.lineWidth = 3;
    g.fillRect(48, 34, 96, 18); [220, 310, 400, 490].forEach((x) => g.fillRect(x, 38, 60, 10)); g.strokeRect(850, 28, 120, 30);
    g.fillRect(64, 130, 440, 36); g.fillRect(64, 182, 340, 36);
    g.globalAlpha = 0.45; for (let i = 0; i < 4; i++) g.fillRect(64, 250 + i * 22, 380 - (i % 2) * 70, 9); g.globalAlpha = 1;
    g.strokeRect(64, 360, 160, 44); g.fillRect(244, 360, 120, 44);
    g.strokeRect(580, 100, 380, 270); g.beginPath(); g.moveTo(580, 100); g.lineTo(960, 370); g.moveTo(960, 100); g.lineTo(580, 370); g.stroke();
    for (let i = 0; i < 3; i++) { const x = 64 + i * 316; g.strokeRect(x, 430, 290, 120); g.fillRect(x + 18, 450, 90, 12); g.globalAlpha = 0.4; g.fillRect(x + 18, 480, 240, 8); g.fillRect(x + 18, 500, 190, 8); g.globalAlpha = 1; }
    const v = g.createRadialGradient(512, 288, 140, 512, 288, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,12,4,.78)');
    g.fillStyle = v; g.fillRect(0, 0, 1024, 576);
    return c;
  }
  function buildRoom() {
    const mk = (rx, ry) => {
      const m = M.floor.clone(); m.map = M.floor.map.clone(); m.bumpMap = M.floor.bumpMap.clone();
      m.map.repeat.set(rx, ry); m.bumpMap.repeat.set(rx, ry); m.map.needsUpdate = m.bumpMap.needsUpdate = true; m.color.set(0x383838); return m;
    };
    const wall = (w, h, mat, x, y, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); };
    const CY = FLOOR + 7;
    wall(44, 14, mk(8, 3), 14.4, CY, 0, -Math.PI / 2);
    wall(70, 14, mk(14, 3), 0, CY, -10, 0);
    wall(44, 14, mk(8, 3), -16, CY, 0, Math.PI / 2);
    buildLoft();
    const t = new T.CanvasTexture(uiCanvas()); t.encoding = T.sRGBEncoding; t.anisotropy = maxAniso;
    M.screen = new T.MeshBasicMaterial({ map: t, color: new T.Color(0.6, 0.6, 0.6) });
    const sc = new T.Mesh(new T.PlaneGeometry(8.4, 4.7), M.screen); sc.position.set(14.3, 1.6, 0); sc.rotation.y = -Math.PI / 2; scene.add(sc);
  }


  /* ------------------------------------------------------------------
     Heavy industrial stand: cast-iron base · brushed-steel column · walnut trim
     ------------------------------------------------------------------ */
  function buildStand() {
    const FL = FLOOR - 0.5;                       // floor in projector-local space
    const cyl = (r1, r2, h, seg = 56) => new T.CylinderGeometry(r1, r2, h, seg);
    add(cyl(1.55, 1.65, 0.22, 72), M.iron, 0, FL + 0.11, 0);
    add(cyl(0.34, 0.8, 0.56, 56), M.iron, 0, FL + 0.5, 0);
    const bolts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; bolts.push(cyl(0.06, 0.06, 0.05, 10).translate(Math.cos(a) * 1.28, FL + 0.245, Math.sin(a) * 1.28)); }
    add(merge(bolts), M.aluDark, 0, 0, 0);
    const colBot = FL + 0.78, colTop = -0.12;
    add(cyl(0.17, 0.17, colTop - colBot, 48), M.alu, 0, (colBot + colTop) / 2, 0);
    add(cyl(0.27, 0.27, 0.09, 48), M.iron, 0, colBot + 0.05, 0);
    add(cyl(0.27, 0.27, 0.09, 48), M.iron, 0, colTop - 0.22, 0);
    add(cyl(0.25, 0.25, 0.46, 48), M.walnut, 0, (colBot + colTop) / 2 + 0.2, 0);          // walnut sleeve
    add(cyl(0.27, 0.27, 0.04, 48), M.brass, 0, (colBot + colTop) / 2 + 0.43, 0);
    add(cyl(0.27, 0.27, 0.04, 48), M.brass, 0, (colBot + colTop) / 2 - 0.03, 0);
    [-1, 1].forEach((k) => add(box(0.12, 1.0, 0.12), M.iron, k * 0.55, -0.62, 0).rotation.z = k * 0.62);   // braces
    add(box(2.9, 0.1, 1.8), M.iron, 0, -0.17, 0);
    add(box(5.0, 0.12, 2.2), M.walnut, 0, -0.06, 0);                                     // walnut top
    add(box(5.04, 0.03, 2.24), M.brass, 0, -0.13, 0);
  }

  /* ------------------------------------------------------------------
     Design-studio loft: pillars · gridded factory windows · track lights · clutter
     ------------------------------------------------------------------ */
  function buildLoft() {
    const H = 14, CY = FLOOR + H / 2, TOP = FLOOR + H;
    const grey = (c, rough) => new T.MeshStandardMaterial({ color: c, roughness: rough == null ? 0.85 : rough, metalness: 0 });
    // ceiling + beams
    const ceil = new T.Mesh(new T.PlaneGeometry(80, 44), grey(0x161616)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, TOP, 0); scene.add(ceil);
    [-6, 2, 10].forEach((z) => { const b = new T.Mesh(box(80, 0.7, 0.9), M.concrete); b.position.set(0, TOP - 0.35, z); b.castShadow = true; scene.add(b); });
    // pillars
    [[-10, -7], [10, -7], [-10, 5], [10, 5]].forEach((p) => { const m = new T.Mesh(box(1.3, H, 1.3), M.concrete); m.position.set(p[0], CY, p[1]); m.castShadow = m.receiveShadow = true; scene.add(m); });
    // big gridded factory window (daylight source) on the back wall
    const WW = 24, WH = 9, WY = FLOOR + 6.5;
    const glass = new T.Mesh(new T.PlaneGeometry(WW, WH), new T.MeshBasicMaterial({ color: new T.Color(1.9, 2.0, 2.15) }));
    glass.position.set(0, WY, -9.93); scene.add(glass);
    const bars = [];
    for (let x = -WW / 2; x <= WW / 2 + 0.01; x += 2) bars.push(box(0.1, WH, 0.14).translate(x, WY, -9.84));
    for (let y = -WH / 2; y <= WH / 2 + 0.01; y += 1.5) bars.push(box(WW, 0.1, 0.14).translate(0, WY + y, -9.84));
    bars.push(box(WW + 0.5, 0.35, 0.25).translate(0, WY - WH / 2 - 0.1, -9.85), box(WW + 0.5, 0.35, 0.25).translate(0, WY + WH / 2 + 0.1, -9.85));
    const mull = new T.Mesh(merge(bars), M.dark); mull.castShadow = false; scene.add(mull);
    // suspended track lighting
    const bars2 = [], bulbs = [], cans = [];
    const TY = TOP - 3.2;
    bars2.push(box(16, 0.12, 0.14).translate(-2, TY, -2));
    [-9, 5].forEach((x) => bars2.push(box(0.05, 3.2, 0.05).translate(x, TY + 1.6, -2)));
    for (let i = 0; i < 6; i++) {
      const x = -9 + i * 2.8, tilt = 0.5 + (i % 2) * 0.15;
      const can = new T.CylinderGeometry(0.16, 0.2, 0.55, 20); can.rotateX(tilt); can.translate(x, TY - 0.32, -1.8); cans.push(can);
      const b = new T.CircleGeometry(0.15, 20); b.rotateX(Math.PI / 2 + tilt); b.translate(x, TY - 0.55, -1.6); bulbs.push(b);
    }
    const track = new T.Mesh(merge(bars2.concat(cans)), M.dark); track.castShadow = true; scene.add(track);
    scene.add(new T.Mesh(merge(bulbs), M.bulb));

    // ---- clutter: books, rolled blueprints, drawing bin, film cans
    const bookCols = ['#d9d4c8', '#2a2a2a', '#6d6d68', '#aaa598', '#a9a597', '#4a4a47', '#9c3d2c'];
    const bookMats = bookCols.map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    const pageMat = new T.MeshStandardMaterial({ color: 0xe6e2d6, roughness: 0.92 });
    function stack(x, z, n) {
      let y = FLOOR;
      for (let i = 0; i < n; i++) {
        const w = 1.0 + rand() * 0.5, d = 0.7 + rand() * 0.35, h = 0.1 + rand() * 0.13, cv = bookMats[Math.floor(rand() * bookMats.length)];
        const b = new T.Mesh(box(w, h, d), [pageMat, cv, cv, cv, pageMat, pageMat]);
        b.position.set(x + (rand() - 0.5) * 0.12, y + h / 2, z + (rand() - 0.5) * 0.12); b.rotation.y = (rand() - 0.5) * 0.5;
        b.castShadow = b.receiveShadow = true; scene.add(b); y += h;
      }
    }
    stack(-6.8, 2.6, 6); stack(-5.9, 3.4, 3); stack(7.6, 1.8, 5); stack(-9, 0.5, 11); stack(8, -4, 5);
    const paper = new T.MeshStandardMaterial({ color: 0xd3dae3, roughness: 0.9, side: T.DoubleSide });
    const rollG = (len) => { const g = new T.CylinderGeometry(0.085, 0.085, len, 18); return g; };
    [[-4.2, 4.6, 0.4], [-3.7, 4.9, -0.25], [-4.1, 5.2, 0.1]].forEach((r, i) => {
      const m = new T.Mesh(rollG(1.5 + i * 0.1), paper); m.rotation.z = Math.PI / 2; m.rotation.y = r[2]; m.position.set(r[0], FLOOR + 0.085 + (i === 2 ? 0.16 : 0), r[1]); m.castShadow = m.receiveShadow = true; scene.add(m);
    });
    const bin = new T.Mesh(new T.CylinderGeometry(0.5, 0.42, 0.95, 28, 1, true), new T.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.6, roughness: 0.55, side: T.DoubleSide }));
    bin.position.set(-7.2, FLOOR + 0.475, -3.4); bin.castShadow = true; scene.add(bin);
    for (let i = 0; i < 7; i++) {
      const m = new T.Mesh(rollG(1.5 + rand() * 0.5), paper); const a = (i / 7) * 6.283;
      m.position.set(-7.2 + Math.cos(a) * 0.22, FLOOR + 1.0, -3.4 + Math.sin(a) * 0.22); m.rotation.set(Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14); m.castShadow = true; scene.add(m);
    }
    for (let k = 0; k < 3; k++) { const c = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.1, 40), M.alu); c.position.set(3.6, FLOOR + 0.05 + k * 0.11, 2.2); c.castShadow = c.receiveShadow = true; scene.add(c); }
  }

  let lastIris = -1;
  function setIris(v, force) {
    if (!force && Math.abs(v - lastIris) < 0.001) return;
    lastIris = v;
    const r = 0.17 + 0.2 * v, tw = (1 - v) * 0.5;
    irisBlades.forEach((b) => {
      const a = b.userData.a;
      b.position.set(Math.cos(a) * r, Math.sin(a) * r, b.userData.z);
      b.rotation.z = a + Math.PI / 2 + tw;
    });
    if (apPivot) apPivot.rotation.x = (1 - v) * 1.4;
  }

  /* ------------------------------------------------------------------
     Light: ONE directional key (tungsten) + a practical at the lens
     ------------------------------------------------------------------ */
  const key = new T.DirectionalLight(0xfff3e8, S.key);
  const lensLight = new T.PointLight(0xffd2a0, 1.2, 12, 2);
  function buildLights() {
    key.position.set(-6, 11, 9); key.target.position.set(0, 1.5, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
    scene.add(key, key.target);
    lensLight.position.set(2.9, 1.5, 0); scene.add(lensLight);
    const day = new T.DirectionalLight(0xdde7f5, 0.85); day.position.set(1, 7, -14); day.target.position.set(0, 0, 3); scene.add(day, day.target);   // daylight through the factory windows
    scene.add(new T.HemisphereLight(0x1a2028, 0x0a0907, 0.3));   // negative-fill whisper so the black isn't dead
  }

  /* ------------------------------------------------------------------
     Volumetric beam (ConeGeometry) + dust + lens flare
     ------------------------------------------------------------------ */
  const LENS_X = 2.5, LENS_Y = 1.5, BEAM_L = 11.5, BEAM_R = 3.2;
  let beamOuter, beamCore, dust, motes, flareA, flareB;
  const beamUniforms = { uTime: { value: 0 }, uIntensity: { value: 0.85 }, uFlicker: { value: 1 }, uColor: { value: new T.Color(1.0, 0.74, 0.44) }, uPow: { value: 1.6 } };

  const BEAM_VS = `
    varying vec3 vN; varying vec3 vV; varying float vAlong;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = -mv.xyz; vN = normalize(normalMatrix * normal); vAlong = 1.0 - uv.y;
      gl_Position = projectionMatrix * mv;
    }`;
  const BEAM_FS = `
    uniform float uTime, uIntensity, uFlicker, uPow; uniform vec3 uColor;
    varying vec3 vN; varying vec3 vV; varying float vAlong;
    void main(){
      float ndv = abs(dot(normalize(vN), normalize(vV)));
      float edge = pow(ndv, uPow);
      float fall = pow(1.0 - vAlong, 1.3);
      float apex = smoothstep(0.0, 0.035, vAlong);
      float band = 0.9 + 0.1 * sin(vAlong * 38.0 - uTime * 0.9);
      float a = min(edge * fall * apex * band * uIntensity * uFlicker, 0.5);
      gl_FragColor = vec4(uColor, a);
    }`;

  function coneGeo(R, L, seg) {
    const g = new T.ConeGeometry(R, L, seg, 1, true);
    g.translate(0, -L / 2, 0);        // apex at origin, base at −L
    g.rotateZ(Math.PI / 2);           // axis → +x
    return g;
  }

  function buildBeam() {
    const mk = (R, L, pw, mul) => {
      const mat = new T.ShaderMaterial({
        uniforms: { uTime: beamUniforms.uTime, uIntensity: { value: 1 }, uFlicker: beamUniforms.uFlicker, uColor: beamUniforms.uColor, uPow: { value: pw } },
        vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending
      });
      mat.userData.mul = mul;
      const m = new T.Mesh(coneGeo(R, L, 72), mat); m.position.set(LENS_X, LENS_Y, 0); m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m;
    };
    beamOuter = mk(BEAM_R, BEAM_L, 1.8, 0.11);
    beamCore = mk(BEAM_R * 0.3, BEAM_L * 0.75, 3.0, 0.14);

    // dust inside the beam (shader-animated)
    const COUNT = 2600, aRand = new Float32Array(COUNT * 4), pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT * 4; i++) aRand[i] = Math.random();
    const dg = new T.BufferGeometry();
    dg.setAttribute('position', new T.BufferAttribute(pos, 3)); dg.setAttribute('aRand', new T.BufferAttribute(aRand, 4));
    dust = new T.Points(dg, new T.ShaderMaterial({
      uniforms: { uTime: beamUniforms.uTime, uPx: { value: 800 }, uLen: { value: BEAM_L }, uR: { value: BEAM_R }, uFlare: { value: 1 }, uBeam: { value: 1 }, uOrigin: { value: new T.Vector3(LENS_X, LENS_Y, 0) }, uFlicker: beamUniforms.uFlicker },
      vertexShader: `
        attribute vec4 aRand; uniform float uTime, uPx, uLen, uR, uFlare, uBeam, uFlicker; uniform vec3 uOrigin; varying float vA;
        void main(){
          float t = uTime;
          float a = fract(aRand.x + t * (0.004 + aRand.w * 0.010));
          float cr = uR * a * uFlare;
          float rr = sqrt(aRand.y) * cr;
          float ang = aRand.z * 6.2831 + t * (aRand.w - 0.5) * 0.3;
          vec3 p = uOrigin + vec3(a * uLen, cos(ang) * rr, sin(ang) * rr);
          p += vec3(sin(t*0.31 + aRand.y*40.0), cos(t*0.27 + aRand.x*31.0), sin(t*0.23 + aRand.z*27.0)) * 0.14;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max((1.0 + aRand.w * 2.4) * 0.016 * uPx / -mv.z, 1.5);
          float edge = 1.0 - smoothstep(0.65, 1.0, rr / (cr + 0.001));
          float tw = 0.55 + 0.45 * sin(t * 1.6 + aRand.x * 60.0);
          vA = (0.25 + 0.75 * aRand.w) * edge * smoothstep(0.0, 0.07, a) * (1.0 - a * 0.75) * uBeam * tw * uFlicker;
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float s = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.58) * 1.3, s * vA);
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    dust.frustumCulled = false; dust.renderOrder = 3; scene.add(dust);

    // ambient motes floating in the room (lit by the same single key — rendered faint)
    const MC = 1100, mp = new Float32Array(MC * 3);
    for (let i = 0; i < MC; i++) { mp[i * 3] = -14 + Math.random() * 30; mp[i * 3 + 1] = 0.2 + Math.random() * 8; mp[i * 3 + 2] = -9 + Math.random() * 20; }
    const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(mp, 3));
    const sprite = (() => { const c = mkCanvas(32, 32), g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c); })();
    motes = new T.Points(mg, new T.PointsMaterial({ size: 0.035, map: sprite, color: 0xcdb08a, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
    motes.frustumCulled = false; scene.add(motes);

    // lens flare (soft core + anamorphic streak)
    const core = (() => { const c = mkCanvas(256, 256), g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,240,215,1)'); gr.addColorStop(0.12, 'rgba(255,206,140,.75)'); gr.addColorStop(0.4, 'rgba(255,150,70,.18)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new T.CanvasTexture(c); })();
    const streak = (() => { const c = mkCanvas(512, 64), g = c.getContext('2d'); const gx = g.createLinearGradient(0, 0, 512, 0); gx.addColorStop(0, 'rgba(255,170,90,0)'); gx.addColorStop(0.5, 'rgba(255,225,185,1)'); gx.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gx; g.fillRect(0, 0, 512, 64); g.globalCompositeOperation = 'destination-in'; const gy = g.createLinearGradient(0, 0, 0, 64); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.5, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gy; g.fillRect(0, 0, 512, 64); return new T.CanvasTexture(c); })();
    const sm = (map) => new T.SpriteMaterial({ map, color: 0xffc890, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.3 });
    flareA = new T.Sprite(sm(core)); flareA.position.set(LENS_X + 0.1, LENS_Y, 0); flareA.scale.set(3.2, 3.2, 1); scene.add(flareA);
    flareB = new T.Sprite(sm(streak)); flareB.position.set(LENS_X + 0.1, LENS_Y, 0); flareB.scale.set(26, 0.9, 1); scene.add(flareB);
  }

  /* ------------------------------------------------------------------
     Post: depth-of-field (bokeh gather) · film halation · tone map · grain
     ------------------------------------------------------------------ */
  let rt, postMat, postScene, postCam, hasDepth = true;
  function buildPost() {
    hasDepth = isGL2 || renderer.extensions.has('WEBGL_depth_texture');
    const opts = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: isGL2 ? T.HalfFloatType : T.UnsignedByteType, depthBuffer: true, stencilBuffer: false };
    rt = new T.WebGLRenderTarget(4, 4, opts);
    if (hasDepth) { rt.depthTexture = new T.DepthTexture(4, 4, T.UnsignedIntType); }
    postMat = new T.ShaderMaterial({
      uniforms: {
        tColor: { value: rt.texture }, tDepth: { value: hasDepth ? rt.depthTexture : rt.texture }, uRes: { value: new T.Vector2(4, 4) },
        uNear: { value: camera.near }, uFar: { value: camera.far }, uFocus: { value: 8 }, uAperture: { value: 0.3 }, uMaxBlur: { value: 14 },
        uTime: { value: 0 }, uExposure: { value: 1 }, uHalation: { value: 0.5 }, uGrain: { value: 0.03 }, uVig: { value: 0.62 }, uHasDepth: { value: hasDepth ? 1 : 0 }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes;
        uniform float uNear, uFar, uFocus, uAperture, uMaxBlur, uTime, uExposure, uHalation, uGrain, uVig, uHasDepth;
        varying vec2 vUv;
        float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float linZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
        float cocPx(float z){ return clamp(abs(z - uFocus) / max(z, 0.001) * uAperture, 0.0, 1.0) * uMaxBlur; }
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main(){
          float fr = floor(uTime * 24.0);
          vec2 jit = (vec2(hash12(vec2(fr, 1.0)), hash12(vec2(fr, 2.0))) - 0.5) * 0.0009;   // gate weave
          vec2 uv = vUv + jit;
          vec3 col = texture2D(tColor, uv).rgb;
          float r0 = 0.0;
          if (uHasDepth > 0.5) r0 = cocPx(linZ(uv));
          if (r0 > 0.6) {
            vec3 acc = col; float ws = 1.0;
            for (int i = 1; i <= 26; i++) {
              float fi = float(i); float rr = sqrt(fi / 26.0); float an = fi * 2.39996;
              float d = rr * r0;
              vec2 suv = uv + vec2(cos(an), sin(an)) * d / uRes;
              float cs = cocPx(linZ(suv));
              vec3 s = texture2D(tColor, suv).rgb;
              float w = smoothstep(d - 1.5, d + 0.5, cs);
              float l = dot(s, vec3(0.3, 0.59, 0.11));
              w *= 1.0 + min(l * l, 8.0) * 0.6;       // bokeh highlights
              acc += s * w; ws += w;
            }
            col = acc / ws;
          }
          vec3 hal = vec3(0.0);                          // film halation
          for (int j = 0; j < 12; j++) {
            float fj = float(j); float an = fj * 2.39996; float rad = mix(6.0, 46.0, fj / 12.0) * uRes.y / 1080.0;
            hal += max(texture2D(tColor, uv + vec2(cos(an), sin(an)) * rad / uRes).rgb - vec3(0.85), 0.0);
          }
          col += hal / 12.0 * vec3(1.0, 0.5, 0.22) * uHalation * 2.2;
          col *= uExposure;
          float lm = dot(col, vec3(0.3, 0.59, 0.11));
          col = mix(vec3(lm), col, 0.5 + 0.5 * smoothstep(0.5, 1.5, lm));   // black & white world, warm only where light is
          col = aces(col);
          vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
          col *= mix(1.0 - uVig, 1.0, 1.0 - smoothstep(0.35, 1.05, length(q) * 1.15));
          float g = hash12(vUv * uRes + fr * 17.0) - 0.5;
          col += g * uGrain * (0.4 + 0.6 * (1.0 - dot(col, vec3(0.333))));
          float sc = hash12(vec2(fr, 9.0));
          if (sc > 0.965) { float x = hash12(vec2(fr, 4.0)); col += smoothstep(0.0012, 0.0, abs(vUv.x - x)) * 0.045; }
          col = pow(max(col, 0.0), vec3(1.0 / 2.2));
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), postMat); quad.frustumCulled = false;
    postScene = new T.Scene(); postScene.add(quad); postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /* ------------------------------------------------------------------
     Sizing + adaptive quality
     ------------------------------------------------------------------ */
  let quality = 1, lastResizeW = 0, lastResizeH = 0;
  const tmpV2 = new T.Vector2();
  function resize(force) {
    const w = innerWidth, h = innerHeight;
    const small = Math.min(w, h) < 700;
    const dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
    const scale = Math.max(1.0, Math.max(dpr, small ? 1.0 : 1.35)) * quality;
    renderer.setPixelRatio(scale); renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(tmpV2);
    rt.setSize(tmpV2.x, tmpV2.y);
    postMat.uniforms.uRes.value.set(tmpV2.x, tmpV2.y);
    postMat.uniforms.uMaxBlur.value = 15 * (tmpV2.y / 1080);
    dust.material.uniforms.uPx.value = tmpV2.y * 0.5 * 0.9;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    lastResizeW = w; lastResizeH = h;
  }
  let rzT = 0; const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => resize(), 120); }; addEventListener('resize', onResize);
  const onMove = (e) => { mouse.tx = (e.clientX / innerWidth - 0.5) * 2; mouse.ty = -(e.clientY / innerHeight - 0.5) * 2; }; addEventListener('pointermove', onMove, { passive: true });

  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  const _dir = new T.Vector3(), _pos = new T.Vector3(), _tgt = new T.Vector3(), _p = new T.Vector3();
  let time = 0, lastT = performance.now(), dipT = 0, dipV = 1, frames = 0, accMs = 0, lastQ = 0, fpsAcc = 0, fpsN = 0, fpsT = 0;
  let curFov = -1, curAspect = -1;
  const tagEls = Array.from(tags).map((el) => ({ el, a: anchors, key: el.dataset.anchor, p: +el.dataset.p }));

  let built = false;
  function frame() {
    if (!built) return;
    const now = performance.now();
    const dtMs = now - lastT; lastT = now;
    const dt = Math.min(dtMs / 1000, 0.1);
    time += dt; frames++;

    // --- measured stats (honest numbers for the HUD)
    fpsAcc += dtMs; fpsN++; fpsT += dtMs;
    if (fpsT > 300) {
      stats.ms = fpsAcc / fpsN; stats.fps = 1000 / stats.ms; fpsAcc = 0; fpsN = 0; fpsT = 0;
      onStats({ fps: stats.fps, ms: stats.ms });
    }
    // --- adaptive resolution
    accMs += dtMs;
    if (frames % 90 === 0) {
      const avg = accMs / 90; accMs = 0;
      if (now - lastQ > 2500) {
        if (avg > 22 && quality > 0.62) { quality = Math.max(0.62, quality - 0.13); resize(); lastQ = now; }
        else if (avg < 10.5 && quality < 1) { quality = Math.min(1, quality + 0.08); resize(); lastQ = now; }
      }
    }

    // --- projector flicker (arc-lamp + shutter)
    let flick = 0.93 + 0.045 * Math.sin(time * 47) * Math.sin(time * 13.1) + 0.02 * Math.sin(time * 113);
    if (dipT > 0) { dipT -= dt; flick *= dipV; } else if (Math.random() < dt * 0.9) { dipT = 0.04 + Math.random() * 0.07; dipV = 0.78 + Math.random() * 0.15; }
    if (reduceMotion) flick = 0.95;
    flash *= Math.exp(-dt * 3.2);
    const lum = flick + flash * 0.5;

    // --- reels, gears, rollers
    spinImp *= Math.exp(-dt * 2.2);
    const w = (0.9 * S.spin + spinImp) * (reduceMotion ? 0.2 : 1);
    reelA.rotation.z += w * dt * 0.7;
    reelB.rotation.z += w * dt * 0.7 * 1.84;
    focusPivot.rotation.x -= spinImp * dt * 0.4;
    for (const s of spinners) s.o.rotation.z += w * s.k * dt;

    // --- lighting + materials
    key.intensity = S.key * (0.975 + 0.025 * flick);
    lensLight.intensity = (0.8 + S.beam * 0.8) * lum;
    M.glass.emissiveIntensity = (1.4 + S.beam * 1.2) * lum;
    M.gate.color.setRGB(2.6 * lum, 1.6 * lum, 0.75 * lum);
    M.vent.color.setRGB(1.7 * (0.9 + 0.1 * lum), 0.8 * (0.9 + 0.1 * lum), 0.3);
    scene.fog.density = S.fog + I.fog;
    if (M.screen) M.screen.color.setScalar(Math.min(1.5, 0.12 + S.beam * 0.62) * lum);

    // --- beam
    beamUniforms.uTime.value = time;
    beamUniforms.uFlicker.value = lum;
    const spread = S.spread;
    beamOuter.scale.set(1, spread, spread); beamCore.scale.set(1, spread, spread);
    beamOuter.material.uniforms.uIntensity.value = S.beam * beamOuter.material.userData.mul;
    beamCore.material.uniforms.uIntensity.value = S.beam * beamCore.material.userData.mul;
    dust.material.uniforms.uBeam.value = 0.6 + S.beam * 0.7;
    dust.material.uniforms.uFlare.value = spread;
    flareA.material.opacity = Math.min(1, S.glow * 0.7 * lum); flareB.material.opacity = Math.min(1, S.glow * 0.22 * lum);
    const fs = 2.2 + S.glow * 4.0; flareA.scale.set(fs, fs, 1); flareB.scale.set(5 + S.glow * 16, 0.3 + S.glow * 0.6, 1);

    // --- ambient motes drift
    const mp = motes.geometry.attributes.position.array;
    for (let i = 0; i < mp.length; i += 3) { mp[i] += Math.sin(time * 0.2 + i) * 0.0016; mp[i + 1] += 0.0012 + Math.sin(time * 0.31 + i * 0.7) * 0.0009; if (mp[i + 1] > 8.4) mp[i + 1] = 0.2; }
    motes.geometry.attributes.position.needsUpdate = true;

    setIris(iris.v);

    // --- camera
    mouse.x += (mouse.tx - mouse.x) * 0.045; mouse.y += (mouse.ty - mouse.y) * 0.045;
    _pos.set(S.px, S.py, S.pz); _tgt.set(S.tx, S.ty, S.tz);
    _dir.copy(_pos).sub(_tgt); const dist = _dir.length(); _dir.normalize();
    camera.position.copy(_pos).addScaledVector(_dir, I.dolly);
    if (camera.position.y < FLOOR + 0.25) camera.position.y = FLOOR + 0.25;
    camera.up.set(0, 1, 0); camera.lookAt(_tgt);
    camera.rotateZ((S.roll * Math.PI) / 180);
    const par = (dist + I.dolly) / 8;
    camera.translateX(mouse.x * 0.3 * par); camera.translateY(mouse.y * 0.17 * par);
    const aspect = innerWidth / innerHeight;
    const k = Math.max(1, 16 / 9 / aspect);
    const vf = Math.min(100, ((2 * Math.atan(Math.tan((S.fov * Math.PI) / 360) * (1 + (k - 1) * 0.75))) * 180) / Math.PI);
    if (Math.abs(vf - curFov) > 0.001 || aspect !== curAspect) { camera.fov = vf; camera.aspect = aspect; camera.updateProjectionMatrix(); curFov = vf; curAspect = aspect; }

    // --- post uniforms
    const pu = postMat.uniforms;
    pu.uFocus.value = Math.max(0.5, dist + I.dolly + S.focusOff);
    pu.uAperture.value = S.dof;
    pu.uTime.value = time;
    pu.uExposure.value = S.exposure * I.exposure * (0.97 + 0.03 * flick + flash * 0.25);
    pu.uHalation.value = S.halation;

    // --- hooks (Lenis etc. are driven by choreo.js)
    for (let i = 0; i < hooks.length; i++) hooks[i](dt, time);

    // --- render: scene → HDR target → DOF/halation/grade → screen
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);

    // --- blueprint tags glued to 3D parts
    const act = +document.body.dataset.act;
    const vw = innerWidth, vh = innerHeight;
    for (let i = 0; i < tagEls.length; i++) {
      const t = tagEls[i]; if (t.p !== act) continue;
      const a = anchors[t.key]; if (!a) continue;
      _p.copy(a).project(camera);
      const vis = _p.z < 1 && Math.abs(_p.x) < 0.9 && Math.abs(_p.y) < 0.9;
      t.el.style.visibility = vis ? 'visible' : 'hidden';
      if (vis) t.el.style.transform = `translate3d(${((_p.x * 0.5 + 0.5) * vw).toFixed(1)}px,${((-_p.y * 0.5 + 0.5) * vh).toFixed(1)}px,0)`;
    }
  }

  /* ------------------------------------------------------------------
     Boot (spread over frames so the leader countdown stays alive)
     ------------------------------------------------------------------ */
  const tick = () => new Promise((r) => setTimeout(r, 16));
  async function boot() {
    progress(0.04);
    try { await Promise.race([document.fonts.load('500 40px "JetBrains Mono"'), new Promise((r) => setTimeout(r, 1200))]); } catch (e) {}
    progress(0.12); await tick();
    buildMaterials(); progress(0.34); await tick();
    buildEnvironment(); progress(0.5); await tick();
    buildProjector(); buildRoom(); buildLights(); progress(0.7); await tick();
    buildBeam(); buildPost(); resize(); progress(0.84); await tick();
    try { renderer.compile(scene, camera); } catch (e) {}
    progress(0.94); await tick();
    built = true; lastT = performance.now();
    frame(); frame();
    progress(1);
  }

  const api = {
    S, I, iris, stats, anchors, hooks, renderer, camera, scene,
    frame,
    kick: (v) => { spinImp = Math.max(spinImp, Math.min(v, 14)); },
    flash: (v) => { flash = Math.max(flash, v); },
    ready: boot(),
    failed: false,
    dispose() { built = false; removeEventListener('resize', onResize); removeEventListener('pointermove', onMove); try { renderer.dispose(); } catch (e) {} }
  };
  api.ready.catch((e) => { console.error('[THEIA] boot failed', e); api.failed = true; });
  return api;
}
