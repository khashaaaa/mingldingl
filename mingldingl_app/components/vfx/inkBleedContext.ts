import { createContext, useContext } from 'react';

/**
 * True while an `InkBleed` above is photographing or settling. Skia's view photograph ignores
 * `overflow: hidden` on Android, so a frame strip clipped to one frame (`InkDraw`) came out as the
 * whole strip, a row of flames across the toast. Such a child holds its place until this is false.
 */
export const InkBleedingContext = createContext(false);

export const useInkBleeding = () => useContext(InkBleedingContext);
