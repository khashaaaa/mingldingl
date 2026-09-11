import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { HeaderBar } from './ui/HeaderBar';
import { GameButton } from './ui/GameButton';
import { Waiting } from './ui/Waiting';
import { useContentPage } from '../hooks/useContentPage';
import { selectContentPageLocale } from '../models/content';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../lib/formatDate';
import { LEADING, FONTS, FONT_SIZES, INK, SPACE } from '../lib/theme';
import { StateBlock } from './ui/StateBlock';
import { useScrollTail } from '../hooks/useScrollTail';

interface Props {
  slug: string;
}

export function ContentPageScreen({ slug }: Props) {
  const tail = useScrollTail();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: page, isLoading, isError, refetch } = useContentPage(slug);
  const localized = page ? selectContentPageLocale(page, locale) : null;

  return (
    <View style={styles.container}>
      <HeaderBar title={localized?.title ?? ''} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
        {isLoading && <Waiting />}
        {isError && (
          <StateBlock
            tone="danger"
            icon="alert-circle-outline"
            title={i18n.t('error_boundary_title')}
            body={i18n.t('error_boundary_message')}
          >
            <GameButton variant="ghost" onPress={() => refetch()}>
              {i18n.t('error_boundary_retry')}
            </GameButton>
          </StateBlock>
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
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: SPACE.xl, paddingBottom: SPACE.scrollTail },
  updatedAt: {
    color: INK.dim,
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.body,
    marginBottom: SPACE.md,
  },
  body: {
    color: INK.primary,
    fontSize: FONT_SIZES.md,
    lineHeight: LEADING.md,
    fontFamily: FONTS.body,
  },
});
