import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArtName } from '@/design/art/manifest';
import { FillArt } from '@/design/components/Art';
import type { StringKey } from '@/lib/i18n';

/** How each festival dresses the square (Figma 47:479–47:1168): an ornament, its line, its honour line. */
export const FESTIVAL: Record<
  string,
  {
    /**
     * Where the World Floor variant hangs it: y from the frame's top (a top ornament), its height, an
     * optional centred width, and its opacity (Figma 0.5, the fireworks 0.6).
     */
    ornament?: { art: ArtName; at: 'top' | 'foot'; y?: number; h: number; w?: number; o: number };
    under?: ArtName;
    line: StringKey;
    honour?: StringKey;
  }
> = {
  tsagaanSar: {
    ornament: { art: 'fest_khadag', at: 'top', y: 60, h: 40, o: 0.5 },
    under: 'fest_cup',
    line: 'festival.line.tsagaanSar',
    honour: 'festival.honour.tsagaanSar',
  },
  naadam: {
    ornament: { art: 'naadam_pennants', at: 'foot', h: 90, w: 350, o: 0.5 },
    line: 'festival.line.naadam',
    honour: 'festival.honour.naadam',
  },
  lastBell: {
    ornament: { art: 'fest_fireworks', at: 'top', y: 0, h: 163, o: 0.6 },
    line: 'festival.line.lastBell',
  },
  // Figma 47:918: the knot hangs centred above the bell card, not under its words.
  dayOfBond: {
    // y 68, not the frame's 90: the room header here sits 22 higher than the frame's, and the knot
    // must still show above the card.
    ornament: { art: 'fest_knot', at: 'top', y: 68, h: 110, w: 110, o: 0.5 },
    line: 'festival.line.dayOfBond',
  },
  march8: {
    ornament: { art: 'fest_blossoms', at: 'top', y: 40, h: 120, o: 0.5 },
    line: 'festival.line.march8',
  },
};

/** A festival's ornament, drawn behind the room (over the floor, under the words). */
export function Ornament({ festival, masked }: { festival?: string | null; masked?: boolean }) {
  const insets = useSafeAreaInsets();
  const o = masked
    ? { art: 'fest_masks' as const, at: 'foot' as const, h: 100, o: 0.5 }
    : festival
      ? FESTIVAL[festival]?.ornament
      : undefined;
  if (!o) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ornament,
        o.at === 'top' ? { top: insets.top + (o.y ?? 0) - FRAME_STATUS } : { bottom: insets.bottom + 72 },
        { height: o.h, opacity: o.o },
        o.w ? { left: '50%', right: undefined, width: o.w, marginLeft: -o.w / 2 } : null,
      ]}
    >
      <FillArt name={o.art} />
    </View>
  );
}

/** The status bar Figma's 390×844 frames draw above the room. */
const FRAME_STATUS = 44;

const styles = StyleSheet.create({
  ornament: { position: 'absolute', left: 0, right: 0 },
});
