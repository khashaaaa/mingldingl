import { StyleSheet, View } from 'react-native';
import { t } from '@/lib/i18n';
import type { ArtName } from '../art/manifest';
import { dimension } from '../tokens';
import { Art } from './Art';
import { LiveGem } from './LiveGem';
import { Txt } from './Txt';

export const TIERS = ['Garnet', 'Opal', 'Amethyst', 'Sapphire', 'Ruby', 'Emerald'] as const;
export type Tier = (typeof TIERS)[number];

export const GEM = {
  Garnet: 'gem_garnet',
  Opal: 'gem_opal',
  Amethyst: 'gem_amethyst',
  Sapphire: 'gem_sapphire',
  Ruby: 'gem_ruby',
  Emerald: 'gem_emerald',
} as const satisfies Record<Tier, ArtName>;

/** The engine sends the tier as a string; anything unknown is shown as the first gem, never blank. */
export const asTier = (s: string): Tier =>
  (TIERS as readonly string[]).includes(s) ? (s as Tier) : 'Garnet';

/** The tier's painted gem with its name beneath; `alive` when it is the gem you hold. */
export function GemBadge({ tier, size = 56, alive = false }: { tier: Tier; size?: number; alive?: boolean }) {
  const name = t(`tier.${tier}`);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={name} style={styles.badge}>
      {alive ? (
        <LiveGem tier={tier} size={size} />
      ) : (
        <Art name={GEM[tier]} style={{ width: size, height: size }} fit="contain" />
      )}
      <Txt variant="labelS" color="textSecondary">
        {name}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', gap: dimension.space2 },
});
