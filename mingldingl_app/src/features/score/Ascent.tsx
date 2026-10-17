import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { asTier, GEM } from '@/design/components/GemBadge';
import { LiveGem } from '@/design/components/LiveGem';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { XpBar } from '@/design/components/XpBar';
import { color, dimension } from '@/design/tokens';
import { useGetMe, useGetTiers } from '@/lib/api/generated/engine';
import { type StringKey, t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { standing } from './ladder';

/** The Ascent (Figma 28:191): your points, the gems set in the cliff, each tier and what it opens. */
export default function Ascent() {
  const profile = useGetMe().data?.profile;
  const ladder = useGetTiers().data;
  if (!profile || !ladder) return <Scene>{null}</Scene>;
  const { progress, next } = standing(profile.points, ladder);
  return (
    <Scene header={<RoomHeader title={t('room.ascent')} onBack={() => router.back()} />}>
      <XpBar points={profile.points} progress={progress} next={next} />
      <Art name="cliff_gems" style={styles.cliff} />
      <View style={styles.ladder}>
        {[...ladder].reverse().map((tier) => {
          const name = asTier(tier.name);
          const here = name === profile.tier;
          // Figma 28:191: tiers above yours stand back; the thresholds you have passed are gold
          const reached = tier.points <= profile.points;
          return (
            <View
              key={name}
              accessible
              accessibilityLabel={`${t(`tier.${name}`)}, ${tier.points}`}
              accessibilityState={{ selected: here, disabled: !reached }}
              style={[styles.row, here && styles.here, !reached && styles.locked]}
            >
              {here ? (
                <LiveGem tier={name} size={GEM_HERE} />
              ) : (
                <Art name={GEM[name]} style={styles.gem} fit="contain" />
              )}
              <View style={styles.text}>
                <Txt variant="displayS">{t(`tier.${name}`)}</Txt>
                <Txt variant="bodyS" color="textSecondary">
                  {t(`tierPerk.${name}` as StringKey)}
                </Txt>
              </View>
              <Txt variant="numberS" color={reached ? 'textAccent' : 'textMuted'}>
                {tier.points.toLocaleString('en-US')}
              </Txt>
            </View>
          );
        })}
      </View>
    </Scene>
  );
}

/** Your own tier's gem is drawn larger than the rest, and alive. */
const GEM_HERE = 56;

const styles = StyleSheet.create({
  cliff: { width: '100%', height: 120 },
  ladder: { gap: dimension.space2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingHorizontal: dimension.space3,
    paddingVertical: dimension.space3,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
  },
  here: { borderColor: color.borderGold, backgroundColor: color.bgPanel },
  locked: { opacity: 0.55 },
  gem: { width: 45, height: 45 },
  text: { flex: 1, gap: 2 },
});
