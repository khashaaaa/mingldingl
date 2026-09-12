import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, type StyleProp, type TextStyle } from 'react-native';
import { i18n } from '../../lib/i18n';
import { worldWhen, worldWhenText, worldTimeSpoken } from '../../lib/worldTime';
import { formatCountdown } from '../../lib/townSquareTime';

interface Props {
  targetIso: string | null;
  nowMs: number;
  worldKey: string;
  exactKey: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

// How long a tap holds the exact clock up before it reverts to the world's phrasing.
const REVEAL_MS = 4000;

/**
 * A countdown speaks the world's units first ("tomorrow at 13:00", move 13) rather than a raw
 * "in 1d 4h" — the most modern thing on the screen. A tap bares the exact clock for four seconds
 * (nothing is actually hidden — it's one tap away), then it reverts on its own. Mongolian has no
 * translated world phrases yet, so `worldTimeSpoken()` keeps it on the exact clock outright, and
 * the accessibility label always carries both forms regardless of locale.
 */
export function WorldClock({ targetIso, nowMs, worldKey, exactKey, style, testID }: Props) {
  const [showExact, setShowExact] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);

  const exact = i18n.t(exactKey, { time: formatCountdown(targetIso, nowMs) });
  const world = i18n.t(worldKey, { when: worldWhenText(worldWhen(targetIso, nowMs)) });
  const text = showExact || !worldTimeSpoken() ? exact : world;

  function reveal() {
    setShowExact(true);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setShowExact(false), REVEAL_MS);
  }

  return (
    <Pressable onPress={reveal} accessibilityRole="button" accessibilityLabel={`${world} ${exact}`} testID={testID}>
      <Text style={style}>{text}</Text>
    </Pressable>
  );
}
