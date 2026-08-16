import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export type VfxLevel = 'full' | 'reduced' | 'off';

export function resolveVfxLevel(platform: string, reduceMotion: boolean): 'full' | 'reduced' {
  if (platform === 'web' || reduceMotion) return 'reduced';
  return 'full';
}

export function useVfxLevel(): VfxLevel {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  if (process.env.EXPO_PUBLIC_VFX === 'off') return 'off';
  return resolveVfxLevel(Platform.OS, reduceMotion);
}
