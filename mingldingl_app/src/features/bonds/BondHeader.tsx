import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/design/components/Art';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import type { SealablePhoto } from '@/design/components/PhotoTile';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';

/**
 * A bond's header (Figma 31:97): back, their small portrait, name, the state of the seals, options.
 * The portrait and name open their character.
 */
export function BondHeader({
  name,
  status,
  portrait,
  sealed,
  onOpen,
  onOptions,
}: {
  name: string;
  status: string;
  portrait: SealablePhoto | null;
  sealed: boolean;
  /** Their character: tapping the portrait or the name. */
  onOpen?: () => void;
  onOptions?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + dimension.space3 }]}>
      <View style={styles.row}>
        <Icon glyph="back" label={t('common.back')} onPress={() => router.back()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bond.openCompanion', { name })}
          disabled={!onOpen}
          onPressIn={() => feedback('press')}
          onPress={onOpen}
          style={styles.who}
        >
          <AvatarFrame state={sealed ? 'sealed' : 'revealed'} photo={portrait} label={name} size={40} />
          <View style={styles.text}>
            <Txt variant="displayS" numberOfLines={1} accessibilityRole="header">
              {name}
            </Txt>
            <Txt variant="labelS" color="textMuted" numberOfLines={1}>
              {status.toUpperCase()}
            </Txt>
          </View>
        </Pressable>
        {onOptions ? (
          <Icon glyph="more" label={t('bond.optionsTitle')} onPress={onOptions} />
        ) : (
          <View style={styles.slot} />
        )}
      </View>
    </View>
  );
}

function Icon({ glyph, label, onPress }: { glyph: 'back' | 'more'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={styles.slot}
    >
      <Glyph name={glyph} size={24} tint="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Figma's Chat Header: 112 tall, closed by a hairline across the whole width (no brush rule)
  header: {
    paddingHorizontal: dimension.sizeGutter,
    paddingBottom: dimension.space3,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: dimension.space3 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: dimension.space3 },
  text: { flex: 1 },
  slot: { width: 24, height: 24 },
});
