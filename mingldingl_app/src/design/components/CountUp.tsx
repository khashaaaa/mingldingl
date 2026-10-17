import { useEffect, useState } from 'react';
import { MOTION, useReduceMotion } from '../motion';
import { Txt, type TxtProps } from './Txt';

/** A number that counts up to its value as it appears (the forge-out curve), then holds. */
export function CountUp({
  value,
  format = String,
  delay = 0,
  ...txt
}: { value: number; format?: (n: number) => string; delay?: number } & Omit<TxtProps, 'children'>) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const length = MOTION.dryBrushDraw.duration * 2;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const k = Math.min(1, Math.max(0, now - start - delay) / length);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce, delay]);
  return <Txt {...txt}>{format(shown)}</Txt>;
}
