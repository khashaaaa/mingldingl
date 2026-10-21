import { t } from '@/lib/i18n';
import { patchMe, useOnboarding } from '../Onboarding';
import { ChooseOnce } from './ChooseOnce';

/** Step 2. Set once; the hint says so before the choice is made. */
export default function Gender() {
  const { me } = useOnboarding();
  return (
    <ChooseOnce
      title={t('onboarding.genderTitle')}
      hint={t('onboarding.genderHint')}
      action={t('common.continue')}
      chosen={me.profile?.gender ?? null}
      write={(gender) => patchMe({ gender })}
      choices={[
        {
          value: 'Male',
          glyph: 'male',
          title: t('onboarding.genderMale'),
          body: t('onboarding.genderMaleHint'),
        },
        {
          value: 'Female',
          glyph: 'female',
          title: t('onboarding.genderFemale'),
          body: t('onboarding.genderFemaleHint'),
        },
      ]}
    />
  );
}
