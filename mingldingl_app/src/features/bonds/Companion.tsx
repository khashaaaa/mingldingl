import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { asTier } from '@/design/components/GemBadge';
import { PhotoTile } from '@/design/components/PhotoTile';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SeekCard } from '@/design/components/SeekCard';
import { SettingRow } from '@/design/components/SettingRow';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetBond } from '@/lib/api/generated/engine';
import { t } from '@/lib/i18n';
import { DEEP, deepAnswer, deepTitle } from '../character/DeepProfile';
import { Scene } from '../common/Scene';

/**
 * Their character in a bond, opened from the bond's header: the Seek card (Figma 26:3) with what
 * the seals have given you so far — portraits one per seal, the district at the third, all at the
 * fourth. The engine sends only what is revealed, and `bond.updated` redraws it as seals break.
 */
export default function Companion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bond = useGetBond(id).data;
  const header = <RoomHeader title={t('room.companion')} onBack={() => router.back()} />;
  if (!bond) return <Scene header={header}>{null}</Scene>;

  const other = bond.other;
  const [first, ...rest] = other.portraits;
  return (
    <Scene header={header}>
      <View style={styles.body}>
        <SeekCard
          name={other.name}
          age={other.age}
          tier={asTier(other.tier)}
          place={other.place ?? null}
          oath={other.oath ?? null}
          tale={other.bio ?? null}
          portrait={first ? { id: first.id, url: first.url, thumbHash: first.thumbHash } : null}
          sealed={bond.seals < 1}
          full
        />
        {rest.length > 0 ? (
          <View style={styles.grid}>
            {rest.map((p, i) =>
              p.url ? (
                <View key={p.id}>
                  <PhotoTile
                    state="filled"
                    photo={{ id: p.id, url: p.url, thumbHash: p.thumbHash }}
                    label={t('companion.portraitAt', { name: other.name, n: i + 2 })}
                  />
                </View>
              ) : null,
            )}
          </View>
        ) : null}
        {other.deep ? (
          // The fourth seal's gift to a member (Figma 35:285's rows, read-only).
          <View style={styles.deep}>
            {DEEP.filter((q) => other.deep?.[q.field]).map((q) => (
              <SettingRow
                key={q.field}
                glyph={q.glyph}
                title={deepTitle(q.field)}
                value={deepAnswer(q.field, other.deep?.[q.field] ?? '')}
              />
            ))}
          </View>
        ) : null}
        <Txt variant="voiceM" color="textSecondary" align="center">
          {bond.nextSealAt == null
            ? t('companion.allSeals')
            : t('companion.nextSeal', { n: bond.seals + 1, at: bond.nextSealAt })}
        </Txt>
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: dimension.space5, paddingTop: dimension.space4 },
  deep: { alignSelf: 'stretch', marginHorizontal: -dimension.sizeGutter },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: dimension.space3,
  },
});
