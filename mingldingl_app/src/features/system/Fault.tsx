import * as Sentry from '@sentry/react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Button } from '@/design/components/Button';
import { StateBlock } from '@/design/components/StateBlock';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

/**
 * The path falters (Figma 36:614): a screen in the world threw while drawing. The fault goes to
 * Sentry; "Return to the Hearth" clears it and goes home (Seek until the Hearth is built).
 */
export function Fault({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <Scene
      centered
      footer={
        <Button
          block
          kind="plain"
          label={t('fault.home')}
          onPress={() => {
            // Leave the broken screen first, so clearing the fault draws home rather than it again.
            router.replace('/seek');
            setTimeout(retry, 0);
          }}
        />
      }
    >
      <StateBlock kind="error" title={t('state.errorTitle')} body={t('fault.body')} />
    </Scene>
  );
}
