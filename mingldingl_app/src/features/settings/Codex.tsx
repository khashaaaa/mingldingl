import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FillArt } from '@/design/components/Art';
import { InkLink } from '@/design/components/InkLink';
import { Cascade } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetCodex, useGetCodexPage } from '@/lib/api/generated/engine';
import { t, useLocale } from '@/lib/i18n';
import { hasLegalPages, openLegal } from '@/lib/links';
import { Scene } from '../common/Scene';

/** The engine keeps Mongolian only where a native speaker wrote it; anything else reads in English. */
const codexLocale = (l: string) => (l === 'mn' ? 'mn' : 'en');

/** The Codex (Figma 35:1254): the guides, each a title and the line under it. */
export default function Codex() {
  const locale = codexLocale(useLocale());
  const pages = useGetCodex({ locale }).data?.filter((p) => p.kind === 'guide');
  return (
    <Scene header={<RoomHeader title={t('room.codex')} onBack={router.back} />}>
      <View style={styles.rows}>
        <Cascade>
          {pages?.map((p) => (
            <Row
              key={p.slug}
              title={p.title}
              subtitle={p.summary}
              onPress={() => router.push(`/codex/${p.slug}`)}
            />
          ))}
        </Cascade>
      </View>
    </Scene>
  );
}

/** A Codex page on parchment (35:1348); the terms read the same way under Help & Legal (35:1410). */
export function CodexPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = codexLocale(useLocale());
  const page = useGetCodexPage(slug, { locale }).data;
  const legal = page?.kind === 'legal';
  return (
    <Scene
      centered={legal}
      header={<RoomHeader title={t(legal ? 'room.legal' : 'room.codex')} onBack={router.back} />}
    >
      {page ? (
        <View style={styles.page}>
          <FillArt name="parchment" />
          <Txt variant="displayM" color="textOnParchment" accessibilityRole="header">
            {page.title}
          </Txt>
          <Txt variant="bodyL" color="textOnParchment">
            {page.body}
          </Txt>
        </View>
      ) : null}
      {legal && hasLegalPages ? (
        <View>
          <InkLink label={t('legal.privacy')} onPress={() => openLegal('privacy')} />
          <InkLink label={t('legal.terms')} onPress={() => openLegal('terms')} />
        </View>
      ) : null}
    </Scene>
  );
}

const styles = StyleSheet.create({
  rows: { marginHorizontal: -dimension.sizeGutter, marginTop: -dimension.space4 },
  page: {
    gap: dimension.space3,
    paddingHorizontal: dimension.sizeGutter,
    paddingTop: 22,
    paddingBottom: 22,
    overflow: 'hidden',
  },
});
