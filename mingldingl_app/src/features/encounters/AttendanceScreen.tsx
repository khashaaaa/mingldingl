import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  answerAttendance,
  getGetEncounterQueryKey,
  useGetBond,
  useGetEncounter,
} from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t, tError, tVenue } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { when } from './NextStep';

const ANSWERS = [
  { value: 'Met', glyph: 'pledge', title: 'attendance.met', hint: 'attendance.metHint' },
  { value: 'NoShow', glyph: 'close', title: 'attendance.noShow', hint: 'attendance.noShowHint' },
  { value: 'CouldNotGo', glyph: 'turn', title: 'attendance.couldNotGo', hint: 'attendance.couldNotGoHint' },
] as const;

/**
 * "Did they come?" (Figma 33:1845): asked of both after the meeting's hour. Private; only a
 * pattern of no-shows ever costs anything.
 */
export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const name = useGetBond(id).data?.other.name ?? '';
  const meeting = useGetEncounter(id).data?.meeting?.current;
  const [answer, setAnswer] = useState<(typeof ANSWERS)[number]['value'] | null>(null);
  const [busy, setBusy] = useState(false);
  const header = <RoomHeader title={t('room.encounter')} onBack={() => router.back()} />;
  if (!meeting) return <Scene header={header}>{null}</Scene>;

  const send = async () => {
    if (!answer) return;
    setBusy(true);
    try {
      const view = await answerAttendance(id, meeting.id, { answer });
      client.setQueryData(getGetEncounterQueryKey(id), view);
      feedback('press');
      toast('info', t('attendance.kept'));
      if (view.meeting?.current?.canRate) router.replace(`/rate/${id}`);
      else router.back();
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Scene
      header={header}
      footer={
        <Button label={t('attendance.answer')} onPress={send} disabled={!answer} loading={busy} block />
      }
    >
      <Txt variant="displayL" engraved accessibilityRole="header">
        {t('step.attendance.title', { name })}
      </Txt>
      <Txt variant="voiceM" color="textSecondary">
        {t('attendance.body', { when: when(meeting.at), venue: tVenue(meeting.venue) })}
      </Txt>
      <View style={styles.choices}>
        {ANSWERS.map((a, i) => (
          <Reveal key={a.value} order={i + 1}>
            <ChoiceCard
              glyph={a.glyph}
              title={t(a.title)}
              body={t(a.hint)}
              selected={answer === a.value}
              onPress={() => setAnswer(a.value)}
            />
          </Reveal>
        ))}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({ choices: { gap: dimension.space3 } });
