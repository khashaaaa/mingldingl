import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

/** Report sent (Figma 31:686): the report sealed in its casket. */
export default function ReportSent() {
  const toLog = () => router.dismissTo('/quests');
  return (
    <Scene
      header={<RoomHeader title={t('room.report')} onBack={toLog} />}
      centered
      footer={<Button kind="plain" label={t('report.back')} onPress={toLog} block />}
    >
      <Art name="report_casket" style={styles.art} fit="contain" />
      <Txt variant="displayL" engraved align="center" accessibilityRole="header">
        {t('report.sentTitle')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary" align="center">
        {t('report.sentBody')}
      </Txt>
    </Scene>
  );
}

const styles = StyleSheet.create({ art: { width: 200, height: 170 } });
