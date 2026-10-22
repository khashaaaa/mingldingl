import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FadedArt } from '@/design/components/FadedArt';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { withAlpha } from '@/design/effects';
import { color, dimension } from '@/design/tokens';
import { feedback } from '@/lib/feedback';
import { type StringKey, t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

type Room = 'gate' | 'tavern' | 'longRoad' | 'hearth' | 'forge' | 'hall' | 'deep';

/** Where each carved room sits on the 350×560 atlas (Figma 28:168, marker centres) and where it leads. */
const ROOMS: { key: Room; name: StringKey; x: number; y: number; to: Href }[] = [
  { key: 'gate', name: 'room.gate', x: 175, y: 56, to: '/allies' },
  { key: 'tavern', name: 'room.tavern', x: 70, y: 168, to: '/seek' },
  { key: 'longRoad', name: 'room.longRoad', x: 280, y: 168, to: '/quests' },
  { key: 'hearth', name: 'room.hearth', x: 175, y: 280, to: '/hearth' },
  { key: 'forge', name: 'room.forge', x: 70, y: 392, to: '/missions' },
  { key: 'hall', name: 'room.hall', x: 292, y: 392, to: '/hall' },
  { key: 'deep', name: 'room.deep', x: 175, y: 504, to: '/encounter-log' },
];
const W = 350;
const H = 560;
const SLOT = 160;

/** The Hold (Figma 28:109): the seven rooms carved into the mountain, "you are here", a tap to go. */
export default function Hold() {
  const { at } = useLocalSearchParams<{ at?: string }>();
  const here: Room = ROOMS.some((r) => r.key === at) ? (at as Room) : 'hearth';
  const [scale, setScale] = useState(0);
  return (
    <Scene header={<RoomHeader title={t('room.hold')} onBack={() => router.back()} />}>
      <View
        style={styles.atlas}
        accessibilityLabel={t('hold.atlas')}
        onLayout={(e) => setScale(e.nativeEvent.layout.width / W)}
      >
        <FadedArt name="hold_atlas" />
        {scale > 0 &&
          ROOMS.map((r) => {
            const on = r.key === here;
            return (
              // A slot centred on the room; the marker sits in its middle, as wide as its name.
              <View
                key={r.key}
                pointerEvents="box-none"
                style={[styles.slot, { left: r.x * scale - SLOT / 2, top: r.y * scale - 12 }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(r.name)}
                  accessibilityState={{ selected: on }}
                  hitSlop={8}
                  onPressIn={() => feedback('press')}
                  onPress={() => (on ? router.back() : router.navigate(r.to))}
                  // Never wider than keeps it centred on its room inside the atlas; a long name
                  // (Mongolian) takes a second line instead of running off the edge.
                  style={[
                    styles.marker,
                    { maxWidth: Math.min(SLOT, 2 * Math.min(r.x, W - r.x) * scale) },
                    on && styles.here,
                  ]}
                >
                  <Txt
                    variant="labelS"
                    color={on ? 'textInverse' : 'textPrimary'}
                    align="center"
                    numberOfLines={2}
                  >
                    {t(r.name).toUpperCase()}
                  </Txt>
                </Pressable>
              </View>
            );
          })}
      </View>
      <Txt variant="voiceM" color="textSecondary" align="center">
        {t(`hold.at.${here}`)}
      </Txt>
    </Scene>
  );
}

const styles = StyleSheet.create({
  atlas: { width: '100%', aspectRatio: W / H, overflow: 'hidden' },
  slot: { position: 'absolute', width: SLOT, alignItems: 'center' },
  marker: {
    paddingHorizontal: dimension.space2,
    paddingVertical: 3,
    backgroundColor: withAlpha(color.bgSunken, 0.85),
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
  },
  here: { backgroundColor: color.accentGold },
});
