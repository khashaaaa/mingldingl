import { useState } from 'react';
import { Button } from '@/design/components/Button';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { Txt } from '@/design/components/Txt';
import type { GlyphName } from '@/design/glyphs';
import type { MeView } from '@/lib/api/generated/model';
import { errorText, StepScene, useOnboarding } from '../Onboarding';

export type Choice = { value: string; glyph: GlyphName; title: string; body: string };

/**
 * A choice made once (gender, oath): pick a card, the engine records it, and from then on the
 * chosen card shows and the others cannot be picked — coming back to the step only moves forward.
 */
export function ChooseOnce({
  title,
  hint,
  action,
  choices,
  chosen,
  write,
}: {
  title: string;
  hint: string;
  action: string;
  choices: Choice[];
  chosen: string | null;
  write: (value: string) => Promise<MeView>;
}) {
  const { advance } = useOnboarding();
  const [pick, setPick] = useState(chosen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    if (!pick) return;
    setBusy(true);
    const e = await advance(() => write(pick));
    setBusy(false);
    if (e) setError(errorText(e));
  };

  return (
    <StepScene
      title={title}
      hint={hint}
      footer={<Button block label={action} onPress={next} disabled={!pick} loading={busy} />}
    >
      {choices.map((c) => (
        <ChoiceCard
          key={c.value}
          glyph={c.glyph}
          title={c.title}
          body={c.body}
          selected={pick === c.value}
          onPress={() => {
            if (chosen) return;
            setPick(c.value);
            setError(null);
          }}
        />
      ))}
      {error ? (
        <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </StepScene>
  );
}
