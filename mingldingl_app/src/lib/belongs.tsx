import { createContext, useContext } from 'react';
import type { Belongs } from './gate';

const BelongsContext = createContext<Belongs>({ group: 'loading' });
export const BelongsProvider = BelongsContext.Provider;

/** The gate's current answer, for screens that render by it (closed reasons, onboarding step). */
export const useBelongs = () => useContext(BelongsContext);
