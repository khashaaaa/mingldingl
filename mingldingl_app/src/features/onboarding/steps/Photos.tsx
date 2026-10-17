import { useState } from 'react';
import { Button } from '@/design/components/Button';
import { Txt } from '@/design/components/Txt';
import { t } from '@/lib/i18n';
import { errorText, StepScene, useOnboarding } from '../Onboarding';
import { PortraitGrid } from '../PortraitGrid';
import { usePortraits } from '../usePortraits';

/** Step 3. Continue opens once the engine counts enough portraits. */
export default function Photos() {
  const { advance, photosMin, photosMax } = useOnboarding();
  const p = usePortraits(photosMax);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const have = p.photos.length;

  const next = async () => {
    setBusy(true);
    const e = await advance(async () => undefined);
    setBusy(false);
    if (e) setError(errorText(e));
  };

  return (
    <StepScene
      title={t('onboarding.photosTitle')}
      hint={t('onboarding.photosHint')}
      footer={
        <Button
          block
          label={t('common.continue')}
          onPress={next}
          disabled={have < photosMin}
          loading={busy}
        />
      }
    >
      <PortraitGrid
        portraits={p}
        max={photosMax}
        note={
          have > photosMin
            ? t('photos.counterMet', { have, max: photosMax })
            : t('photos.counter', { have, need: photosMin, max: photosMax })
        }
      />
      {error ? (
        <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </StepScene>
  );
}
