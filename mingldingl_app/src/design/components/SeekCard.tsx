import { StyleSheet, View } from 'react-native';
import { t, tLine, tPlace } from '@/lib/i18n';
import { color, dimension } from '../tokens';
import { Art, Glyph } from './Art';
import { AvatarFrame } from './AvatarFrame';
import { CANDLELIT_PAD, Candlelit } from './Candlelit';
import { GEM, type Tier } from './GemBadge';
import { NameTitle } from './NameTitle';
import type { SealablePhoto } from './PhotoTile';
import { Txt } from './Txt';

/**
 * A companion in the Tavern (Figma 26:3): a night card lit by the candles below it, their portrait sealed
 * under wax (only its ThumbHash), name (a stranger in the Tavern has none: "A traveller") and age, gem and place, the oath they swore, their tale.
 * "Has children" sits under the place when they chose to show it (Figma 254:13347).
 */
export function SeekCard({
  name,
  age,
  tier,
  place,
  oath,
  tale,
  portrait,
  sealed = true,
  full,
  hasChildren = false,
}: {
  /** null in the Tavern: a stranger is nameless until a bond is made. */
  name: string | null;
  age: number;
  tier: Tier;
  place: string | null;
  oath: string | null;
  tale: string | null;
  portrait: SealablePhoto | null;
  /** In the Tavern always; in a bond until the first seal breaks. */
  sealed?: boolean;
  /** The whole tale, not three lines (their character in a bond). */
  full?: boolean;
  /** They have children and chose to show it. */
  hasChildren?: boolean;
}) {
  const shown = name ?? t('seek.traveller');
  const nameAge = t('seek.nameAge', { name: shown, age });
  return (
    <View style={styles.card}>
      <Candlelit art="card_night" />
      <AvatarFrame
        state={sealed ? 'sealed' : 'revealed'}
        photo={portrait ? { ...portrait, url: sealed ? null : portrait.url } : null}
        label={!sealed ? nameAge : name ? t('seek.sealedPortrait', { name }) : t('seek.travellerPortrait')}
        size={150}
      />
      <NameTitle name={shown} text={nameAge} />
      <View style={styles.line}>
        <Art name={GEM[tier]} style={styles.gem} fit="contain" />
        <Txt variant="labelM" color="textSecondary">
          {place
            ? tLine('seek.tierPlace', { tier: `tier.${tier}` }, { place: tPlace(place) })
            : t(`tier.${tier}`)}
        </Txt>
      </View>
      {hasChildren ? (
        <View style={styles.line}>
          <Glyph name="person" size={16} tint="textSecondary" />
          <Txt variant="labelM" color="textSecondary">
            {t('seek.hasChildren')}
          </Txt>
        </View>
      ) : null}
      {oath ? (
        <View style={styles.chip}>
          <View style={styles.dot} />
          <Txt variant="labelS" color="textAccent">
            {t(`oath.${oath as 'Bond'}`)}
          </Txt>
        </View>
      ) : null}
      {tale ? (
        <Txt variant="voiceM" color="textSecondary" align="center" numberOfLines={full ? undefined : 3}>
          {t('quests.quote', { text: tale })}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Figma 26:3: the stele spans the gutter (350 of 390), whatever its contents.
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: dimension.space3,
    padding: CANDLELIT_PAD,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: dimension.space2 },
  gem: { width: 33, height: 33 }, // Figma 26:3 "Gem art"
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space2,
    paddingHorizontal: dimension.space3,
    paddingVertical: dimension.space1,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.accentGold },
});
