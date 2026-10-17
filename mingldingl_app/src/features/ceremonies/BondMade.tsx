import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Reveal } from '@/design/components/Reveal';
import { SealStamp } from '@/design/components/SealStamp';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetBond, useListMyPhotos } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { shouldAskToRing } from '@/lib/push';
import { Scene } from '../common/Scene';

/** "A bond is made" (Figma 36:3): your face beside their sealed one, the wax stamped between. */
export default function BondMade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bond = useGetBond(id).data;
  const mine = useListMyPhotos().data?.[0] ?? null;
  if (!bond) return <Scene centered>{null}</Scene>;
  const theirs = bond.other.portraits[0];
  return (
    <Scene
      centered
      footer={
        <>
          <Button label={t('ceremony.bondWrite')} onPress={() => leave(`/bond/${id}`)} block />
          <InkLink label={t('ceremony.later')} onPress={() => leave(null)} />
        </>
      }
    >
      <View style={styles.pair}>
        <Reveal rise={0}>
          <AvatarFrame state="mine" photo={mine} label={t('photo.portrait')} size={96} />
        </Reveal>
        <Reveal rise={0} order={1} style={styles.overlap}>
          <AvatarFrame
            state="sealed"
            photo={theirs ? { id: theirs.id, thumbHash: theirs.thumbHash } : null}
            label={t('seek.sealedPortrait', { name: bond.other.name })}
            size={96}
          />
        </Reveal>
      </View>
      <SealStamp size={56} delay={STAMP_AT} onLand={stamped} />
      <Reveal delay={TEXT_AT}>
        <Txt variant="displayXL" color="textAccent" engraved align="center" accessibilityRole="header">
          {t('ceremony.bondTitle')}
        </Txt>
      </Reveal>
      <Reveal delay={TEXT_AT} order={1}>
        <Txt variant="voiceL" color="textSecondary" align="center">
          {t('ceremony.bondBody', { name: bond.other.name })}
        </Txt>
      </Reveal>
    </Scene>
  );
}

// The two faces arrive, then the wax is stamped between them, then the words.
const STAMP_AT = 650;
const TEXT_AT = 1100;
const stamped = () => feedback('sealStamp');

/** The first bond is when "May we ring for you?" is asked (it then goes where the person chose). */
async function leave(to: string | null) {
  const ask = await shouldAskToRing().catch(() => false);
  if (ask) router.replace((to ? `/ring?next=${encodeURIComponent(to)}` : '/ring') as Href);
  else if (to) router.replace(to as Href);
  else router.back();
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row' },
  overlap: { marginLeft: -dimension.space4 },
});
