import { useEffect, useRef, useMemo } from 'react';
import { createScene } from './lib/scene';
import { initChoreo } from './lib/choreo';
import { store } from './lib/store';
import { TheiaContext } from './lib/context';
import { Loader, Hud, Tags } from './components/Ui';
import { Hero, Mechanism, Precision, Illumination, Transmission } from './components/Sections';

export default function App() {
  const canvasRef = useRef(null);
  const theiaRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    const theia = createScene({
      canvas: canvasRef.current,
      tags: document.querySelectorAll('.tag'),
      onProgress: (p) => store.set({ load: p }),
      onStats: ({ fps, ms }) => store.set({ fps, ms })
    });
    theiaRef.current = theia;
    if (theia.failed) store.set({ glFailed: true });
    navRef.current = initChoreo({ theia });
    return () => { navRef.current && navRef.current.destroy(); theia.dispose && theia.dispose(); };
  }, []);

  const ctx = useMemo(() => ({ theiaRef, goTo: (i) => navRef.current && navRef.current.goTo(i) }), []);

  return (
    <TheiaContext.Provider value={ctx}>
      <canvas ref={canvasRef} className="fixed inset-0 -z-0 h-full w-full" aria-hidden="true" />
      <Loader /><Hud /><Tags />
      <main className="relative z-10">
        <Hero /><Mechanism /><Precision /><Illumination /><Transmission />
      </main>
    </TheiaContext.Provider>
  );
}
