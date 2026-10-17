import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { HonourCell } from '@/design/components/HonourCell';
import { Cascade, Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { useGetHonours } from '@/lib/api/generated/engine';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { moonLine } from '../common/time';
import { emblem, honourText } from './honours';

/** The honour case (Figma 28:556): earned emblems first, glowing; the rest dim and unnamed. */
export function HonourCase() {
  const all = useGetHonours().data ?? [];
  const earned = all.filter((h) => h.earned);
  const shown = [...earned, ...all.filter((h) => !h.earned)];
  return (
    <Scene header={<RoomHeader title={t('room.honours')} onBack={() => router.back()} />}>
      <Txt variant="labelM" color="textAccent" align="center">
        {t('honours.count', { n: earned.length, total: all.length }).toUpperCase()}
      </Txt>
      <View style={styles.grid}>
        <Cascade>
          {shown.map((h) => (
            <HonourCell
              key={h.key}
              emblem={emblem(h.key)}
              name={t(honourText(h.key, 'name'))}
              earned={h.earned}
              onPress={() => router.push(`/honours/${h.key}`)}
            />
          ))}
        </Cascade>
      </View>
    </Scene>
  );
}

/** One honour (Figma 28:679): the emblem, when it was earned in the world's calendar, what for, its saying. */
export function HonourDetail() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const h = useGetHonours().data?.find((x) => x.key === key);
  return (
    <Scene header={<RoomHeader title={t('room.honours')} onBack={() => router.back()} />}>
      {h?.earned && h.earnedAt ? (
        <View style={styles.detail}>
          {/* The emblem is lifted out of the case and set down; its words bleed in under it. */}
          <Reveal rise={-18}>
            <Art name={emblem(h.key)} style={styles.big} fit="contain" />
          </Reveal>
          <Reveal order={1} delay={120} style={styles.words}>
            <Txt variant="displayL" color="textAccent" align="center" accessibilityRole="header">
              {t(honourText(h.key, 'name'))}
            </Txt>
            <Txt variant="labelS" color="textMuted" align="center">
              {(h.times > 1
                ? t('honours.times', { count: h.times })
                : moonLine('honours.earnedOn', h.earnedAt)
              ).toUpperCase()}
            </Txt>
          </Reveal>
          <Reveal order={2} delay={120} style={styles.words}>
            <Txt variant="bodyM" align="center">
              {t(honourText(h.key, 'for'))}
            </Txt>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {t(honourText(h.key, 'line'))}
            </Txt>
          </Reveal>
        </View>
      ) : null}
    </Scene>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 4 },
  detail: { alignItems: 'center', gap: 14, paddingTop: 48 },
  big: { width: 160, height: 160 },
  words: { alignItems: 'center', gap: 14, alignSelf: 'stretch' },
});
