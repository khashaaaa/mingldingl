import { StyleSheet, View } from 'react-native';
import { boxShadow } from '../effects';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

const KIND = {
  info: { glyph: 'bell', edge: color.borderStrong },
  reward: { glyph: 'spark', edge: color.borderGold },
  error: { glyph: 'ember', edge: color.statusDanger },
} as const;

export type ToastKind = keyof typeof KIND;

export function Toast({ kind, message }: { kind: ToastKind; message: string }) {
  const k = KIND[kind];
  return (
    <View
      accessible
      accessibilityRole={kind === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.toast, { borderLeftColor: k.edge }]}
    >
      <Glyph
        name={k.glyph}
        size={24}
        tint={kind === 'error' ? 'textDanger' : kind === 'reward' ? 'accentGoldBright' : 'textSecondary'}
      />
      <Txt variant="bodyS" style={{ flex: 1 }}>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingVertical: 14,
    paddingHorizontal: dimension.space4,
    backgroundColor: color.bgPanel,
    borderLeftWidth: 3,
    boxShadow: boxShadow('shadowRaised'),
    alignSelf: 'stretch',
  },
});
