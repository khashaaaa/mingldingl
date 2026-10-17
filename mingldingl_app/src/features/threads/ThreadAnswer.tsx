import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { ApiError } from '@/lib/api/client';
import {
  answerThread,
  getGetThreadInvitationsQueryKey,
  useGetThreadInvitations,
} from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Moment } from '../campaign/RetireScreen';
import { Scene } from '../common/Scene';

/** A thread woven for you (from the Quest Log's Fated Threads row): yes or no, privately. */
export default function ThreadAnswer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const th = useGetThreadInvitations().data?.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const header = <RoomHeader title={t('room.threads')} onBack={() => router.back()} />;
  if (!th)
    return (
      <Scene header={header} centered>
        <StateBlock kind="empty" title={t('thread.cut')} body="" />
      </Scene>
    );
  if (th.myAnswer)
    return (
      <Scene header={header} centered>
        <StateBlock kind="waiting" title={t('thread.saidYesTitle')} body={t('thread.saidYesBody')} />
      </Scene>
    );
  const answer = async (yes: boolean) => {
    setBusy(true);
    try {
      await answerThread(id, { yes });
      feedback(yes ? 'sealStamp' : 'press');
      await client.invalidateQueries({ queryKey: getGetThreadInvitationsQueryKey() });
      if (!yes) router.back();
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
      centered
      footer={
        <>
          <Button label={t('thread.yes')} onPress={() => answer(true)} loading={busy} block />
          <InkLink label={t('thread.no')} onPress={() => answer(false)} />
        </>
      }
    >
      <Moment
        art="honour_thread_weaver"
        title={t('thread.title', { name: th.weaver })}
        body={t('thread.body', { name: th.weaver })}
      />
    </Scene>
  );
}
