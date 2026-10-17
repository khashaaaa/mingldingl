import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { useGetAlly } from '@/lib/api/generated/engine';
import { t, tCount } from '@/lib/i18n';
import { allyLink } from '@/lib/links';
import { Scene } from '../common/Scene';

/** Invite an Ally (Figma 33:2411): your call, how many answered, and the share. */
export default function Allies() {
  const ally = useGetAlly().data;
  return (
    <Scene
      header={<RoomHeader title={t('room.allies')} onBack={() => router.back()} />}
      footer={
        <Button
          label={t('ally.share')}
          disabled={!ally}
          onPress={() =>
            ally &&
            Share.share({ message: t('ally.message', { code: ally.code, link: allyLink(ally.code) }) }).catch(
              () => {},
            )
          }
          block
        />
      }
    >
      <View style={styles.column}>
        <Art name="ally_horn" style={styles.art} fit="cover" />
        <Txt variant="displayL" engraved align="center" accessibilityRole="header">
          {t('ally.title')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary" align="center">
          {t('ally.body')}
        </Txt>
        {ally ? (
          <>
            <View style={styles.code} accessible accessibilityLabel={ally.code}>
              <Txt variant="numberL" color="textAccent" selectable>
                {ally.code}
              </Txt>
            </View>
            <Txt variant="labelS" color="textSecondary">
              {(ally.answered > 0 ? tCount('ally.answered', ally.answered) : t('ally.none')).toUpperCase()}
            </Txt>
          </>
        ) : null}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space7 },
  art: { width: 140, height: 140 },
  code: {
    paddingHorizontal: 21,
    paddingVertical: dimension.space3,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
  },
});
