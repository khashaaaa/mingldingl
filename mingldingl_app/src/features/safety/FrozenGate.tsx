import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import { Frost } from '@/design/components/Frost';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { setFireOverride } from '@/design/world/rooms';
import { ApiError } from '@/lib/api/client';
import { letIn, useGetBlocks } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { getLocale, t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/** The Frozen Gate (Figma 35:617 / 35:692): those you cast out, frost over the room, the chain below. */
export default function FrozenGate() {
  const blocked = useGetBlocks().data;
  useEffect(() => setFireOverride('Out'), []);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', {
      day: 'numeric',
      month: 'long',
    });

  return (
    <>
      <Scene header={<RoomHeader title={t('room.frozenGate')} onBack={() => router.back()} />}>
        {blocked && blocked.length === 0 ? (
          <View style={styles.empty}>
            <Txt variant="displayL" engraved align="center" accessibilityRole="header">
              {t('gate.emptyTitle')}
            </Txt>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {t('gate.emptyBody')}
            </Txt>
          </View>
        ) : blocked ? (
          <>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {t('gate.lede')}
            </Txt>
            <View style={styles.rows}>
              {blocked.map((b) => (
                <View key={b.accountId} style={styles.row}>
                  <AvatarFrame
                    state={b.portrait?.url ? 'revealed' : 'sealed'}
                    photo={
                      b.portrait
                        ? { id: b.portrait.id, url: b.portrait.url, thumbHash: b.portrait.thumbHash }
                        : null
                    }
                    label={b.name}
                    size={48}
                  />
                  <View style={styles.text}>
                    <Txt variant="displayS">{b.name}</Txt>
                    <Txt variant="bodyS" color="textSecondary">
                      {t('gate.castOutOn', { date: date(b.castOutAt) })}
                    </Txt>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('gate.letIn')} ${b.name}`}
                    hitSlop={12}
                    onPressIn={() => feedback('press')}
                    onPress={() =>
                      letIn(b.accountId).catch((e) =>
                        toast(
                          'error',
                          e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'),
                        ),
                      )
                    }
                  >
                    <Txt variant="labelS" color="textSecondary">
                      {t('gate.letIn').toUpperCase()}
                    </Txt>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Scene>
      <Frost opacity={FROST} />
      <Art name="gate_chain" style={styles.chain} />
    </>
  );
}

/** How strongly the frost lies once it has crept in (Figma). */
const FROST = 0.62;

const styles = StyleSheet.create({
  // Figma 35:692 sets it high in the room, well above the chain
  empty: { gap: dimension.space4, alignItems: 'center', marginTop: dimension.space8 + dimension.space7 },
  rows: { marginHorizontal: -dimension.sizeGutter },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingVertical: dimension.space3,
    paddingHorizontal: dimension.sizeGutter,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  text: { flex: 1, gap: 2 },
  chain: { position: 'absolute', left: 0, right: 0, bottom: 40, height: 150, width: '100%' },
});
