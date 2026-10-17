import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import { Button } from '@/design/components/Button';
import { Reveal } from '@/design/components/Reveal';
import { SealBreak } from '@/design/components/SealBreak';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetBond, useGetMe } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { BondHeader } from '../bonds/BondHeader';
import { Scene } from '../common/Scene';

/** A seal breaks (Figma 31:184), under the bond's own header: the portrait it gave, the broken wax, what is yours now. */
export default function SealBroken() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bond = useGetBond(id).data;
  const myGender = useGetMe().data?.profile?.gender;
  if (!bond || bond.seals < 1) return <Scene centered>{null}</Scene>;
  const n = Math.min(bond.seals, 4);
  const shown = bond.other.portraits[n >= 4 ? 0 : n - 1] ?? bond.other.portraits[0];
  const title =
    n === 1
      ? t('ceremony.sealTitle1')
      : n === 2
        ? t('ceremony.sealTitle2')
        : n === 3
          ? t(myGender === 'Female' ? 'ceremony.sealTitle3His' : 'ceremony.sealTitle3Her')
          : t('ceremony.sealTitle4');
  const reached = bond.sealLadder[n - 1] ?? 0;
  const first = bond.other.portraits[0];
  return (
    <Scene
      header={
        <BondHeader
          name={bond.other.name}
          status={t('bond.sealsBroken', { n: bond.seals })}
          portrait={first ? { id: first.id, url: first.url, thumbHash: first.thumbHash } : null}
          sealed={false}
        />
      }
      footer={<Button kind="plain" label={t('ceremony.backToLetters')} onPress={() => router.back()} block />}
    >
      <View style={styles.column}>
        {/* The wax gives first; what it kept bleeds in after. */}
        <Reveal delay={FACE_AT} rise={0}>
          <AvatarFrame
            state="revealed"
            photo={shown ? { id: shown.id, url: shown.url, thumbHash: shown.thumbHash } : null}
            label={bond.other.name}
            size={172.8}
          />
        </Reveal>
        <SealBreak size={64} delay={BREAK_AT} onBreak={broke} />
        <Reveal delay={TEXT_AT}>
          <Txt variant="displayL" color="textAccent" engraved align="center" accessibilityRole="header">
            {title}
          </Txt>
        </Reveal>
        <Reveal delay={TEXT_AT} order={1}>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {bond.nextSealAt
              ? t('ceremony.sealBody', { n: reached, next: bond.nextSealAt })
              : t('ceremony.sealBodyLast', { n: reached })}
          </Txt>
        </Reveal>
      </View>
    </Scene>
  );
}

// After the room has travelled in, so the break is seen whole.
const BREAK_AT = 450;
const FACE_AT = 950;
const TEXT_AT = 1250;
const broke = () => feedback('sealBreak');

// Figma 31:184 sets the column 70 below the header, not centred in the space.
const COLUMN_TOP = 70;

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: dimension.space4, paddingTop: COLUMN_TOP - dimension.space3 },
});
