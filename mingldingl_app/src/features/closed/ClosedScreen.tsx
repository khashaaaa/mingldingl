import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useBelongs } from '@/lib/belongs';
import type { ClosedWhy } from '@/lib/gate';
import { t } from '@/lib/i18n';
import { openStore, SUPPORT_EMAIL, storeUrl, writeToKeepers } from '@/lib/links';
import { signOutLocally } from '@/lib/session';
import { Scene } from '../common/Scene';

/** Why the gate is shut decides the screen; the gate itself reopens it when the reason clears. */
export default function ClosedScreen() {
  const belongs = useBelongs();
  const why: ClosedWhy = belongs.group === 'closed' ? belongs.why : 'maintenance';
  return SCREENS[why]();
}

const SCREENS: Record<ClosedWhy, () => React.ReactElement> = {
  suspended: () => (
    <Scene
      footer={
        SUPPORT_EMAIL ? (
          <Button block kind="plain" label={t('closed.writeKeepers')} onPress={writeToKeepers} />
        ) : undefined
      }
    >
      <Column>
        <Art name="seal_wax" style={styles.seal} fit="contain" />
        <Txt variant="titleRoom" color="textDanger" align="center" accessibilityRole="header">
          {t('closed.suspendedTitle')}
        </Txt>
        <Body text={t('closed.suspendedBody')} />
      </Column>
    </Scene>
  ),
  // Signing out locally is all "return" needs: with no session the gate shows the Gate again.
  deleted: () => (
    <Scene footer={<Button block label={t('closed.returnToGate')} onPress={signOutLocally} />}>
      <Column>
        <Title text={t('closed.deletedTitle')} />
        <Body text={t('closed.deletedBody')} />
      </Column>
    </Scene>
  ),
  update: () => (
    <Scene footer={storeUrl() ? <Button block label={t('closed.update')} onPress={openStore} /> : undefined}>
      <Column>
        <Title text={t('closed.updateTitle')} />
        <Body text={t('closed.updateBody')} />
      </Column>
    </Scene>
  ),
  maintenance: () => (
    <Scene>
      <Column>
        <Title text={t('closed.maintenanceTitle')} />
        <Body text={t('closed.maintenanceBody')} />
      </Column>
    </Scene>
  ),
};

/** Figma's closed frames start their column 200 pt below the top of the screen, not centred. */
const COLUMN_TOP = 200;

function Column({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="closed-column"
      style={[styles.column, { paddingTop: Math.max(0, COLUMN_TOP - insets.top - dimension.space3) }]}
    >
      {children}
    </View>
  );
}

function Title({ text }: { text: string }) {
  return (
    <Txt variant="displayL" engraved align="center" accessibilityRole="header">
      {text}
    </Txt>
  );
}

function Body({ text }: { text: string }) {
  return (
    <Txt variant="voiceM" color="textSecondary" align="center" style={styles.body}>
      {text}
    </Txt>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: dimension.space4 },
  seal: { width: 64, height: 64 },
  // centred as a block: Txt stretches centred text, which with a max width hugs the left edge
  body: { maxWidth: 320, alignSelf: 'center' },
});
