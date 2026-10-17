import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Button } from '@/design/components/Button';
import { Input } from '@/design/components/Input';
import { Txt } from '@/design/components/Txt';
import { createMe } from '@/lib/api/generated/engine';
import { getLocale, t } from '@/lib/i18n';
import { errorText, patchMe, StepScene, useDraft, useOnboarding } from '../Onboarding';

/** "14031995" → "14 · 03 · 1995", built as the digits arrive. */
export const formatBorn = (digits: string) =>
  [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(' · ');

/** Day-month-year digits → ISO date, or null when the day does not exist (31 · 02). */
export function parseBorn(digits: string): string | null {
  if (!/^\d{8}$/.test(digits)) return null;
  const [d, m, y] = [Number(digits.slice(0, 2)), Number(digits.slice(2, 4)), Number(digits.slice(4))];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

/** Whole years between `iso` and `today` (the engine checks again on Ulaanbaatar's date). */
export function ageOn(iso: string, today = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const age = today.getFullYear() - y;
  const before = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  return before ? age - 1 : age;
}

const isoToDigits = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;

/**
 * Step 1. The first visit creates the character; coming back to it later only renames — the birth
 * date is set once, so it shows but does not edit.
 */
export default function NameAge() {
  const { me, advance } = useOnboarding();
  const existing = me.profile;
  const [name, setName] = useDraft('name', existing?.name ?? '');
  const bornRef = useRef<TextInput>(null);
  const [born, setBorn] = useDraft('born', existing ? isoToDigits(existing.birthDate) : '');
  const [error, setError] = useState<{ field: 'name' | 'born'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (!name.trim()) return setError({ field: 'name', text: t('onboarding.nameRequired') });
    const birthDate = parseBorn(born);
    if (!birthDate || ageOn(birthDate) > 99)
      return setError({ field: 'born', text: t('onboarding.bornInvalid') });
    if (!existing && ageOn(birthDate) < 18) return setError({ field: 'born', text: t('onboarding.ageRule') });
    setBusy(true);
    const locale = getLocale() === 'mn' ? 'mn' : 'en';
    const e = await advance(() =>
      existing ? patchMe({ name: name.trim() }) : createMe({ name: name.trim(), birthDate, locale }),
    );
    setBusy(false);
    if (e)
      setError({
        field: e.code === 'profile.age' || e.code === 'profile.born' ? 'born' : 'name',
        text: errorText(e),
      });
  };

  return (
    <StepScene
      title={t('onboarding.nameTitle')}
      hint={t('onboarding.nameHint')}
      footer={<Button block label={t('common.continue')} onPress={next} loading={busy} />}
    >
      <Input
        label={t('onboarding.nameLabel')}
        value={name}
        onChangeText={(s) => {
          setName(s);
          setError(null);
        }}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        maxLength={40}
        returnKeyType="next"
        // Next moves to Born and keeps the keyboard up; focusing it scrolls it out from under the
        // keyboard (on a short screen it sits below the lifted Continue button).
        submitBehavior="submit"
        onSubmitEditing={() => (existing ? next() : bornRef.current?.focus())}
        error={error?.field === 'name' ? error.text : null}
      />
      <Input
        ref={bornRef}
        label={t('onboarding.bornLabel')}
        value={formatBorn(born)}
        onChangeText={(s) => {
          setBorn(s.replace(/\D/g, '').slice(0, 8));
          setError(null);
        }}
        placeholder={t('onboarding.bornPlaceholder')}
        keyboardType="number-pad"
        disabled={!!existing}
        returnKeyType="done"
        onSubmitEditing={next}
        error={error?.field === 'born' ? error.text : null}
      />
      {error?.field === 'born' ? null : (
        <Txt variant="bodyS" color="textSecondary">
          {t('onboarding.ageRule')}
        </Txt>
      )}
    </StepScene>
  );
}
