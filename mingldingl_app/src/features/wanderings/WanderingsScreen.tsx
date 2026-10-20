import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SectionLabel } from '@/design/components/Banner';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetWanderings } from '@/lib/api/generated/engine';
import type { WanderingRowView } from '@/lib/api/generated/model';
import { type StringKey, t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

/** A row's right-hand word: where it stands, or when it is best. */
export function wanderingMeta(w: { state: string; season: string }): string | undefined {
  if (w.state === 'kept') return t('wander.state.kept');
  if (w.state === 'sealed') return t('wander.state.sealed');
  if (w.state === 'asked' || w.state === 'askedOfMe') return t('wander.state.asked');
  if (w.state === 'going') return t('wander.state.going');
  return w.season === 'any' ? undefined : t(`wander.season.${w.season}` as StringKey);
}

/**
 * The Wanderings (Figma 260:2881): side roads for two, off the Campaign. Offrail — any, or none.
 * First roads open after the pair's first kept meeting, trusted roads after the second.
 */
export default function WanderingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useGetWanderings(id).data;
  const header = <RoomHeader title={t('room.wanderings')} onBack={() => router.back()} />;
  if (!view) return <Scene header={header}>{null}</Scene>;
  const road = (r: string) => view.items.filter((w) => w.road === r);
  const rows = (items: WanderingRowView[]) =>
    items.map((w) => (
      <Row
        key={w.key}
        title={w.title}
        subtitle={w.line}
        meta={wanderingMeta(w)?.toUpperCase()}
        onPress={() => router.push(`/wanderings/${id}/${w.key}` as never)}
      />
    ));
  return (
    <Scene header={header}>
      {/* Figma 260:2881: what these roads are, before the roads */}
      <Txt variant="voiceM" color={view.firstOpen ? 'textAccent' : 'textSecondary'} style={styles.lede}>
        {view.firstOpen ? t('wander.lede') : t('wander.sealedLede')}
      </Txt>
      <View style={styles.rows}>
        <SectionLabel text={t('wander.first')} />
        {rows(road('first'))}
        <SectionLabel text={t('wander.trusted')} />
        {rows(road('trusted'))}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  lede: { paddingTop: dimension.space2, marginBottom: dimension.space3 },
  rows: { marginHorizontal: -dimension.sizeGutter },
});
