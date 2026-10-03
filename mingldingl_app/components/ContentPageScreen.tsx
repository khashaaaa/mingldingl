import { useRef } from 'react';
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
import { ACCENT, LEADING, FONTS, FONT_SIZES, INK, LINE, SPACE, TRACKING } from '../lib/theme';
import { StateBlock } from './ui/StateBlock';
import { SectionDivider } from './ui/SectionDivider';
import { Tap } from './ui/Tap';
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
  const sections = localized ? toSections(localized.body) : [];
  const headed = sections.filter((section) => section.heading);
  // Where each titled section and its heading start, for the chapter list's jumps — to the heading,
  // so the section's own rule does not land stacked under the header's.
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});
  const headingOffsets = useRef<Record<number, number>>({});

  return (
    <View style={styles.container}>
      <HeaderBar title={titleKey ? i18n.t(titleKey) : localized?.title ?? ''} onBack={() => goBack(router)} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
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
        {/* A long page opens on its own chapter list: the guides ran nine sections of unbroken
            prose with nothing but a small eyebrow between them, and no way to reach the fifth but
            to read through four. The list is the page's own headings, so it needs no copy. */}
        {headed.length >= CHAPTER_LIST_FROM ? (
          <View style={styles.chapters}>
            {sections.map((section, i) => section.heading ? (
              <Tap
                key={i}
                accessibilityRole="button"
                accessibilityLabel={section.heading}
                onPress={() => scroll.current?.scrollTo({ y: (offsets.current[i] ?? 0) + (headingOffsets.current[i] ?? 0) - SPACE.md, animated: true })}
              >
                <Text style={styles.chapter}>{section.heading}</Text>
              </Tap>
            ) : null)}
          </View>
        ) : null}
        {sections.map((section, i) => (
          <View key={i} style={styles.section} onLayout={(e) => { offsets.current[i] = e.nativeEvent.layout.y; }}>
            {section.heading ? (
              <>
                {i > 0 ? <SectionDivider tint={ACCENT.base} /> : null}
                <Text style={styles.heading} onLayout={(e) => { headingOffsets.current[i] = e.nativeEvent.layout.y; }}>{section.heading}</Text>
              </>
            ) : null}
            {section.text ? section.text.split(/\n+/).map((paragraph, j) => (
              <Text key={j} style={styles.body}>{paragraph.trim()}</Text>
            )) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Pages with at least this many titled sections open on a list of them. */
const CHAPTER_LIST_FROM = 4;

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
  section: { marginBottom: SPACE.xl, gap: SPACE.md },
  heading: {
    // Authored in capitals (that is how `toSections` finds them), and kept so — lowercasing would
    // also lower the names inside them — but in the display face and tracked, not a 10pt eyebrow.
    fontFamily: FONTS.display, fontSize: FONT_SIZES.md, lineHeight: LEADING.md, color: ACCENT.base,
    letterSpacing: TRACKING.wide, marginTop: SPACE.sm,
  },
  chapters: { marginBottom: SPACE.xl, borderTopWidth: 1, borderColor: LINE.hairline },
  chapter: {
    fontFamily: FONTS.body, fontSize: FONT_SIZES.md, lineHeight: LEADING.md, color: INK.primary,
    paddingVertical: SPACE.sm, borderBottomWidth: 1, borderColor: LINE.hairline,
  },
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
