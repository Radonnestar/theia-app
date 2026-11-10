import { useSyncExternalStore } from 'react';

// Tiny external store so the 3D / scroll layers can talk to React without prop drilling.
let state = { act: 0, progress: 0, fps: 60, ms: 16.6, load: 0, loaded: false, glFailed: false, fstop: 'f/1.4' };
const subs = new Set();

export const store = {
  get: () => state,
  set(patch) {
    let changed = false;
    for (const k in patch) if (state[k] !== patch[k]) { changed = true; break; }
    if (!changed) return;
    state = { ...state, ...patch };
    subs.forEach((f) => f());
  },
  subscribe(f) { subs.add(f); return () => subs.delete(f); }
};

export function useStore(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
}

export const ACTS = [
  { roman: 'I', name: 'Studio Overview' },
  { roman: 'II', name: 'Physical Mechanism' },
  { roman: 'III', name: 'Precision Engineering' },
  { roman: 'IV', name: 'The Illumination' },
  { roman: 'V', name: 'Studio Transmission' }
];
