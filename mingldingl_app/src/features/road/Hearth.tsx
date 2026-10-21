import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { CandleRow } from '@/design/components/CandleRow';
import { DestinationTile } from '@/design/components/DestinationTile';
import { FadedArt } from '@/design/components/FadedArt';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import type { GlyphName } from '@/design/glyphs';
import { useGetSeek } from '@/lib/api/generated/engine';
import { type StringKey, t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { candleLine } from '../seek/SeekScreen';

const DOORS: { glyph: GlyphName; label: StringKey; to: Href }[] = [
  { glyph: 'fire', label: 'hearth.fire', to: '/seek' },
  { glyph: 'letters', label: 'hearth.letters', to: '/quests' },
  { glyph: 'stage', label: 'hearth.square', to: '/square' },
  { glyph: 'forge', label: 'hearth.forge', to: '/missions' },
  { glyph: 'person', label: 'hearth.mirror', to: '/character' },
  { glyph: 'satchel', label: 'hearth.satchel', to: '/satchel' },
];

/** The sky's phase by the Ulaanbaatar hour (UTC+8): night, dawn, day, dusk. */
export function skyPhase(now = Date.now()): 'night' | 'dawn' | 'day' | 'dusk' {
  const h = new Date(now + 8 * 3_600_000).getUTCHours();
  return h < 5 ? 'night' : h < 8 ? 'dawn' : h < 18 ? 'day' : h < 21 ? 'dusk' : 'night';
}

/**
 * The Hearth (Figma 28:3), the home of the hold: the sky window, tonight's candles and six doors.
 * Its ⋮ opens the Hold. (Figma paints the dusk sky; the other three phases are owed as art.)
 */
export default function Hearth() {
  const seek = useGetSeek().data;
  const phase = skyPhase();
  return (
    <Scene
      header={
        <RoomHeader
          title={t('room.hearth')}
          onBack={() => router.back()}
          action={{ glyph: 'more', label: t('room.hold'), onPress: () => router.push('/hold?at=hearth') }}
        />
      }
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('hearth.window')}
        style={styles.window}
      >
        <FadedArt name="hearth_window" />
      </View>
      <Txt variant="voiceL" color="textSecondary" align="center">
        {t(`hearth.sky.${phase}`)}
      </Txt>
      {seek ? (
        <CandleRow
          left={seek.candlesLeft}
          total={seek.candlesPerDay}
          size="large"
          label={candleLine(seek.candlesLeft).toUpperCase()}
        />
      ) : null}
      <View style={styles.doors}>
        {[DOORS.slice(0, 3), DOORS.slice(3)].map((row) => (
          <View key={row[0]?.label} style={styles.row}>
            {row.map((d) => (
              <DestinationTile
                key={d.label}
                glyph={d.glyph}
                label={t(d.label)}
                onPress={() => router.navigate(d.to)}
              />
            ))}
          </View>
        ))}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  // the painted window spans the gutter and its stone dissolves into the night, no hard frame
  window: { alignSelf: 'stretch', height: 220 },
  doors: { gap: 13 },
  row: { flexDirection: 'row', gap: 13 },
});
