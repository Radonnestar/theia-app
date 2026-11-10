# THEIA — The Interface Architects

**Live demo:** https://theia-app-lime.vercel.app

A cinematic, scroll-driven landing page for a fictional UI/UX and frontend engineering studio. A procedural Three.js design-studio loft with a 35mm projector, driven by a five-act GSAP/ScrollTrigger timeline, with a Tailwind + React interface and a procedural Web Audio score. All studio names, numbers and copy are placeholders.

**Stack:** Vite 5 · React 18 · Tailwind CSS 3 · Three.js r128 · GSAP + ScrollTrigger · Lenis · Web Audio API

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
npm run preview
```

## Structure

```
src/
  App.jsx               mounts the 3D scene + scroll choreography
  index.css             Tailwind layers, per-act accent colours, components
  components/
    Ui.jsx              loader, HUD, blueprint tags, FPS meter
    Sections.jsx        the five acts
  lib/
    scene.js            Three.js loft, projector, beam, post-processing
    choreo.js           Lenis + GSAP ScrollTrigger camera timeline
    audio.js            procedural cinematic loop (opt-in)
    store.js, context.js  shared state
```

## Deploy (Vercel)

Deployed at https://theia-app-lime.vercel.app. To deploy your own copy, import the GitHub repo in Vercel. The framework preset is detected as Vite (`vercel.json` already sets the build command and output directory). No environment variables are needed.

Or from the CLI: `npx vercel --prod`.

## Notes

- Sound is off until the visitor clicks **Sound**.
- Respects `prefers-reduced-motion` and falls back gracefully if WebGL is unavailable.
- The contact form opens a `mailto:` to the placeholder `hello@theia.studio`. Change it in `src/components/Sections.jsx`.
