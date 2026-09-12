import { View, Text, StyleSheet } from 'react-native';
import { Tap } from './Tap';
import { ACCENT, FONTS, FONT_SIZES, INK, LINE, RADIUS, SPACE, SURFACE, TRACKING } from '../../lib/theme';

interface Props<T extends string> {
  label: string;
  value: T | null | undefined;
  options: readonly T[];
  optionLabel: (opt: T) => string;
  onChange: (opt: T) => void;
  size?: 'default' | 'compact';
}

/**
 * A setting with a handful of values, drawn as chips rather than buttons.
 *
 * Every option used to be a full forged `GameButton`, so a settings page of four toggles read as
 * eleven calls to action with nothing to tell "this is what you chose" from "this does
 * something". A chip is a state, not a deed: hairline edge, sentence case in the body face, and
 * the chosen one lit in the same gold the app's pills and badges already use.
 */
export function ChoiceRow<T extends string>({
  label, value, options, optionLabel, onChange, size = 'default',
}: Props<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Tap
              key={opt}
              onPress={() => onChange(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, size === 'compact' && styles.chipCompact, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{optionLabel(opt)}</Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACE.sm },
  label: { color: INK.dim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  options: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' },
  chip: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: LINE.edge,
    backgroundColor: SURFACE.panel,
    // A Mongolian label runs 20-40% longer than its English source; wrap the row (see
    // `options` above) and let a chip itself shrink rather than push past its neighbours.
    maxWidth: '100%',
  },
  chipCompact: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.sm },
  chipSelected: { borderColor: ACCENT.base, backgroundColor: ACCENT.soft },
  chipText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    letterSpacing: TRACKING.label,
    flexShrink: 1,
  },
  chipTextSelected: { color: ACCENT.bright },
});
