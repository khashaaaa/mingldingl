import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { Spinner } from 'tamagui';
import { useRouter } from 'expo-router';
import { ScreenHeader } from './ui/ScreenHeader';
import { TiledBackdrop } from './ui/TiledBackdrop';
import { GameButton } from './ui/GameButton';
import { useContentPage } from '../hooks/useContentPage';
import { selectContentPageLocale } from '../models/content';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { COLORS, FONTS } from '../lib/theme';

const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

interface Props {
  slug: string;
}

// Shared by terms.tsx, privacy.tsx, and guides.tsx — all three are the same
// shape (fetch one admin-editable page by slug, render title + body), so
// this is the one place that shape lives rather than duplicated three times.
export function ContentPageScreen({ slug }: Props) {
  const locale = useLocaleStore((s) => s.locale); // re-render on language switch — see store/localeStore.ts
  const router = useRouter();
  const { data: page, isLoading, isError, refetch } = useContentPage(slug);
  const localized = page ? selectContentPageLocale(page, locale) : null;

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={localized?.title ?? ''} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <Spinner color="$gold" />}
        {isError && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>{i18n.t('error_boundary_title')}</Text>
            <Text style={styles.errorMessage}>{i18n.t('error_boundary_message')}</Text>
            <GameButton variant="ghost" onPress={() => refetch()}>
              {i18n.t('error_boundary_retry')}
            </GameButton>
          </View>
        )}
        {page && formatDate(page.updatedAt) ? (
          <Text style={styles.updatedAt}>
            {i18n.t('content_last_updated', { date: formatDate(page.updatedAt) })}
          </Text>
        ) : null}
        {localized && <Text style={styles.body}>{localized.body}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  updatedAt: {
    color: COLORS.textDim,
    fontSize: 12,
    fontFamily: FONTS.body,
    marginBottom: 12,
  },
  errorWrap: { gap: 12, paddingVertical: 20, alignItems: 'flex-start' },
  errorTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: FONTS.displayBlack,
  },
  errorMessage: {
    color: COLORS.textDim,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  body: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.body,
  },
});
