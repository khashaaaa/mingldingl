import { Pressable, StyleSheet, View } from 'react-native';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

type Props =
  | {
      label: string;
      kind?: 'row';
      selected?: boolean;
      /** Indented under the row that holds it (a district under Ulaanbaatar). */
      nested?: boolean;
      /** Set on a row that opens to others: its chevron turns down while they show. */
      expanded?: boolean;
      onPress: () => void;
    }
  | { label: string; kind: 'group' };

/** A row in a picker: a place to choose, a place that opens to others, or a group heading. */
export function PickRow(props: Props) {
  if (props.kind === 'group')
    return (
      <Txt variant="labelM" color="textMuted" accessibilityRole="header" style={styles.group}>
        {props.label}
      </Txt>
    );
  const { label, selected, nested, expanded, onPress } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={
        expanded === undefined ? { selected: !!selected } : { selected: !!selected, expanded }
      }
      onPress={onPress}
      style={[styles.row, nested && styles.nested]}
    >
      <Txt variant="bodyM" color={selected ? 'accentGoldBright' : 'textPrimary'} style={{ flex: 1 }}>
        {label}
      </Txt>
      {selected && expanded === undefined ? (
        <Glyph name="check" size={20} tint="accentGoldBright" />
      ) : (
        <View style={expanded && styles.down}>
          <Glyph name="chevron" size={16} tint={selected ? 'accentGoldBright' : 'textMuted'} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingVertical: 15,
    paddingHorizontal: dimension.sizeGutter,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  nested: { paddingLeft: dimension.sizeGutter * 2 },
  down: { transform: [{ rotate: '90deg' }] },
  group: { paddingVertical: 10, paddingHorizontal: dimension.sizeGutter },
});
