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
import { ACCENT, LEADING, FONTS, FONT_SIZES, INK, SPACE } from '../lib/theme';
import { StateBlock } from './ui/StateBlock';
import { CardEyebrow } from './ui/CardEyebrow';
import { useScrollTail } from '../hooks/useScrollTail';
import { goBack } from '../lib/navigation';

interface Props {
  slug: string;
  /** Names the page the way the link to it does, instead of the stored page's own title. */
  titleKey?: string;
}

export function ContentPageScreen({ slug, titleKey }: Props) {
  const tail = useScrollTail();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: page, isLoading, isError, refetch } = useContentPage(slug);
  const localized = page ? selectContentPageLocale(page, locale) : null;

  return (
    <View style={styles.container}>
      <HeaderBar title={titleKey ? i18n.t(titleKey) : localized?.title ?? ''} onBack={() => goBack(router)} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
        {isLoading && <Waiting />}
        {isError && (
          <StateBlock
            tone="danger"
            icon="alert-circle-outline"
            title={i18n.t('error_boundary_title')}
            body={i18n.t('error_boundary_message')}
          >
            <GameButton variant="ink" onPress={() => refetch()}>
              {i18n.t('error_boundary_retry')}
            </GameButton>
          </StateBlock>
        )}
        {page && formatDate(page.updatedAt) ? (
          <Text style={styles.updatedAt}>
            {i18n.t('content_last_updated', { date: formatDate(page.updatedAt) })}
          </Text>
        ) : null}
        {localized && toSections(localized.body).map((section, i) => (
          <View key={i} style={styles.section}>
            {section.heading ? <CardEyebrow color={ACCENT.base}>{section.heading}</CardEyebrow> : null}
            {section.text ? <Text style={styles.body}>{section.text}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface Section {
  heading: string | null;
  text: string;
}

/**
 * Authored pages are plain text: blocks split by a blank line, a block whose first line is all
 * capitals being a titled section. Setting that line as an eyebrow is what separates the sections;
 * as body text the capitals read as one more paragraph.
 */
export function toSections(body: string): Section[] {
  return body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
    const [first, ...rest] = block.split('\n');
    const isHeading = rest.length > 0 && /\p{L}/u.test(first) && first === first.toLocaleUpperCase();
    return isHeading ? { heading: first.trim(), text: rest.join('\n').trim() } : { heading: null, text: block };
  });
}

const styles = StyleSheet.create({
  section: { marginBottom: SPACE.xl },
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
