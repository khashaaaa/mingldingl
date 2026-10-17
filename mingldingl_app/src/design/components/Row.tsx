import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import { color, dimension } from '../tokens';
import { Txt } from './Txt';

/** A hairline row: a title in Yeseva, a line under it, and a short word or count at its end. */
export function Row({
  title,
  subtitle,
  meta,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.text}>
        <Txt variant="displayS">{title}</Txt>
        {subtitle ? (
          <Txt variant="bodyS" color="textSecondary">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {meta ? (
        <Txt variant="labelS" color="textSecondary">
          {meta}
        </Txt>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={styles.row}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible style={styles.row}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space4,
    minHeight: 72,
    paddingVertical: dimension.space3,
    paddingHorizontal: dimension.sizeGutter,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  text: { flex: 1, gap: 2 },
});
