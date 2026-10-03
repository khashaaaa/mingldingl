import { useEffect, useState, type ReactNode } from 'react';

/**
 * Jest renders a screen in one synchronous pass with no frames to wait for, and its tests assert
 * on the whole screen; staging only changes *when* a section mounts, never what it shows.
 */
const IMMEDIATE = process.env.NODE_ENV === 'test';

interface Props {
  /**
   * How many frames to wait before mounting. Sections of one screen take successive stages so
   * their native views are created over several frames rather than in one.
   */
  stage?: number;
  /** Held in the space until the children mount, so the scroll height does not jump. */
  placeholder?: ReactNode;
  children: ReactNode;
}

/**
 * Mounts its children a few frames after the screen around them.
 *
 * On Android every view a screen creates is built on the UI thread in the frame the screen first
 * commits, so a tall screen opened whole stalled for that whole build: the Character Sheet cost
 * one 800ms frame on the Galaxy A51 (2026-10-03), most of it sections below the fold. Wrapping
 * those sections lets the top of the screen land in the first frame and the rest arrive in the
 * frames after, each small enough to keep the transition moving.
 */
export function Deferred({ stage = 1, placeholder = null, children }: Props) {
  const [ready, setReady] = useState(IMMEDIATE);
  useEffect(() => {
    if (IMMEDIATE) return;
    let remaining = Math.max(1, stage);
    let id = 0;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) setReady(true);
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [stage]);
  return <>{ready ? children : placeholder}</>;
}
