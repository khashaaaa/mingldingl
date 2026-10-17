import { t } from '@/lib/i18n';
import { patchMe, useOnboarding } from '../Onboarding';
import { ChooseOnce } from './ChooseOnce';

/** Step 5. Bond, Fate or Kinship — sworn once. */
export default function Oath() {
  const { me } = useOnboarding();
  return (
    <ChooseOnce
      title={t('onboarding.oathTitle')}
      hint={t('onboarding.oathHint')}
      action={t('onboarding.swear')}
      chosen={me.profile?.oath ?? null}
      write={(oath) => patchMe({ oath })}
      choices={[
        { value: 'Bond', glyph: 'knot', title: t('oath.Bond'), body: t('oath.BondHint') },
        { value: 'Fate', glyph: 'knot', title: t('oath.Fate'), body: t('oath.FateHint') },
        { value: 'Kinship', glyph: 'knot', title: t('oath.Kinship'), body: t('oath.KinshipHint') },
      ]}
    />
  );
}
