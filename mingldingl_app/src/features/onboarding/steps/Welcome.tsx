import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { useGetAppStatus } from '@/lib/api/generated/engine';
import type { StringKey } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { errorText, patchMe, StepScene, useOnboarding } from '../Onboarding';

const FIRST_STEPS: [StringKey, StringKey][] = [
  ['welcome.seek', 'welcome.seekHint'],
  ['welcome.codex', 'welcome.codexHint'],
  ['welcome.hearth', 'welcome.hearthHint'],
];

/**
 * Step 6. The seal and the first things to do. Entering writes `welcomed`; the engine's answer
 * moves the gate into the world. Figma 23:973: under the seal, what finishing paid.
 */
export default function Welcome() {
  const { advance } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const paid = useGetAppStatus().data?.finishedPoints ?? 0;
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    setBusy(true);
    const e = await advance(() => patchMe({ welcomed: true }));
    setBusy(false);
    if (e) setError(errorText(e));
  };

  return (
    <StepScene
      centered
      footer={<Button block label={t('onboarding.enterHearth')} onPress={enter} loading={busy} />}
    >
      <View style={styles.head}>
        <Art name="seal_wax" fit="contain" style={styles.seal} />
        {paid > 0 ? (
          <Txt variant="displayXL" color="textAccent" engraved align="center">
            {`+${paid}`}
          </Txt>
        ) : null}
        <Txt variant="voiceL" color="textSecondary" align="center" accessibilityRole="header">
          {t('onboarding.welcomeTitle')}
        </Txt>
      </View>
      <View>
        {FIRST_STEPS.map(([title, hint]) => (
          <View key={title} style={styles.row}>
            <Txt variant="displayS">{t(title)}</Txt>
            <Txt variant="bodyS" color="textSecondary">
              {t(hint)}
            </Txt>
          </View>
        ))}
      </View>
      {error ? (
        <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </StepScene>
  );
}

const styles = StyleSheet.create({
  // Figma 23:973: seal 64, then the points and the line, 14 apart
  head: { alignItems: 'center', gap: 14, paddingVertical: dimension.space4 },
  seal: { width: 64, height: 64 },
  row: {
    gap: dimension.space1,
    paddingVertical: dimension.space3,
    paddingHorizontal: dimension.space5,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
});
