import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { TextArea } from '@/design/components/TextArea';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { report } from '@/lib/api/generated/engine';
import { type StringKey, t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

const REASONS = ['rude', 'money', 'notWhoTheyClaim', 'under18', 'other'] as const;
const NOTE_MAX = 1000;

/** Report this traveller (Figma 31:590): what happened, an optional word for the keepers. */
export default function ReportScreen() {
  const { id, bond } = useLocalSearchParams<{ id: string; bond?: string }>();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await report({ accountId: id, bondId: bond ?? null, reason, note: note.trim() || null });
      router.replace('/report-sent');
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Scene
      header={<RoomHeader title={t('room.report')} onBack={() => router.back()} />}
      footer={<Button label={t('report.send')} onPress={send} disabled={!reason} loading={busy} block />}
    >
      <Txt variant="displayM" engraved accessibilityRole="header">
        {t('report.what')}
      </Txt>
      <View style={styles.rows}>
        {REASONS.map((r) => (
          <PickRow
            key={r}
            label={t(`report.${r}` as StringKey)}
            selected={reason === r}
            onPress={() => setReason(r)}
          />
        ))}
      </View>
      <TextArea label={t('report.more')} value={note} onChangeText={setNote} maxLength={NOTE_MAX} />
    </Scene>
  );
}

const styles = StyleSheet.create({ rows: { marginHorizontal: -dimension.sizeGutter } });
