import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { comeBack, getGetMeQueryKey, goAway, useGetMe } from '@/lib/api/generated/engine';
import type { MeView } from '@/lib/api/generated/model';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { weekday } from '../common/time';

/** The lengths offered (the engine allows 1 to away.maxDays). */
const DAYS = [
  { days: 1, label: 'away.day1' },
  { days: 3, label: 'away.day3' },
  { days: 7, label: 'away.day7' },
] as const;

/**
 * Away by the fire (Figma 259:2231): a few days when nothing goes cold. Choosing goes away and returns
 * to the War Room; while away the one choice is to come back now. Once in thirty days.
 */
export default function Away() {
  const profile = useGetMe().data?.profile;
  const client = useQueryClient();
  const act = async (call: () => Promise<MeView>) => {
    try {
      // The engine's answer is the new truth; profile.updated says the same a moment later.
      client.setQueryData(getGetMeQueryKey(), await call());
      router.back();
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    }
  };
  return (
    <Scene header={<RoomHeader title={t('room.warRoom')} onBack={router.back} />}>
      <Txt variant="displayL" engraved accessibilityRole="header" style={styles.title}>
        {t('away.title')}
      </Txt>
      {profile?.awayUntil ? (
        <View style={styles.rows}>
          <PickRow label={t('away.comeBack')} selected={false} onPress={() => act(() => comeBack())} />
        </View>
      ) : profile?.awayNextAt ? null : (
        <View style={styles.rows}>
          {DAYS.map((d) => (
            <PickRow
              key={d.days}
              label={t(d.label)}
              selected={false}
              onPress={() => act(() => goAway({ days: d.days }))}
            />
          ))}
        </View>
      )}
      <View style={styles.notice}>
        <Banner
          glyph="night"
          tint="textSecondary"
          text={
            profile?.awayUntil
              ? t('away.until', { day: weekday(profile.awayUntil) })
              : profile?.awayNextAt
                ? t('away.next', { day: weekday(profile.awayNextAt) })
                : t('away.notice')
          }
        />
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: dimension.space2, marginBottom: dimension.space3 },
  rows: { marginHorizontal: -dimension.sizeGutter },
  notice: { marginTop: dimension.space4 },
});
