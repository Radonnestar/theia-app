import { createContext, useContext } from 'react';

// Gives components access to the 3D scene (iris, flash) and the scroll navigator.
export const TheiaContext = createContext({ theiaRef: { current: null }, goTo: () => {} });
export const useTheia = () => useContext(TheiaContext);
