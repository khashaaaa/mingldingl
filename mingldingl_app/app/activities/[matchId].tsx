import { useEffect, useRef, useState } from 'react';
import { Tap } from '../../components/ui/Tap';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { StateBlock } from '../../components/ui/StateBlock';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { queryClient } from '../../lib/api/queryClient';
import { useActivitySuggestions } from '../../hooks/useActivitySuggestions';
import { useMatches } from '../../hooks/useMatches';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { AlertModal } from '../../components/modals/AlertModal';
import { AppCard } from '../../components/ui/AppCard';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Waiting } from '../../components/ui/Waiting';
import { i18n } from '../../lib/i18n';
import { signal } from '../../lib/world/feedback';
import { queryKeys } from '../../lib/api/queryKeys';
import { useLocaleStore } from '../../store/localeStore';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, RADIUS, SCRIM, SPACE, SURFACE, overlay } from '../../lib/theme';
import { useScrollTail } from '../../hooks/useScrollTail';

const STAR_COUNT = 5;
/** The platform's minimum touch target, in pt. */
const STAR_TARGET = 44;

export default function ActivitiesScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const {
    suggestions, partnerPledged, isLoading, error,
    confirmDate, isConfirming, confirmingId, completed,
    rated, rateBusiness, isRating, rateError,
  } = useActivitySuggestions(matchId);

  const { data: matches } = useMatches();
  const match = matches?.find((m) => m.matchId === matchId);
  const riteLocked = (match?.flameRiteRequired ?? true) && !match?.flameRiteCompletedAt;

  const { pickPhoto, uploadPhoto, uploading, lastError, clearLastError } = usePhotoUpload();
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadFailedAlert, setUploadFailedAlert] = useState(false);
  const [rateFailedAlert, setRateFailedAlert] = useState(false);
  // The stars a rating is being sent with — drawn filled up to it while the request is in flight,
  // so the tap visibly lands before `rated` swaps the row for its thanks.
  const [pendingStars, setPendingStars] = useState(0);

  useEffect(() => {
    if (rateError) {
      setRateFailedAlert(true);
      setPendingStars(0);
    }
  }, [rateError]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function handleShareSafetyInfo() {
    if (!completed?.business) return;

    const message: string = i18n.t('safety_check_share_message', {
      activity: completed.title,
      district: completed.business.district,
    });
    Share.share({ message });
  }

  async function handleAddMomentPhoto() {
    const [uri] = await pickPhoto(1);
    if (!uri || !mountedRef.current) return;
    setLocalPhotoUri(uri);
    const url = await uploadPhoto(uri);
    if (!mountedRef.current) return;
    if (url) {
      setUploadedPhotoUrl(url);
    } else {
      setLocalPhotoUri(null);
      setUploadFailedAlert(true);
    }
  }

  if (isLoading) return (
    <View style={styles.centered}>
      <Waiting />
    </View>
  );

  // A failed load is a wrong, not an empty list — it used to share the "no date ideas yet" state
  // below, which told someone to keep chatting when the real answer was to try again.
  if (error) return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('plan_encounter')} />
      <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('screen_load_error')}>
        <GameButton variant="ink" onPress={() => queryClient.invalidateQueries({ queryKey: queryKeys.activitySuggestions(matchId) })}>
          {i18n.t('retry')}
        </GameButton>
        <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
      </StateBlock>
    </View>
  );

  if (!suggestions || suggestions.length === 0) return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('plan_encounter')} />
      <StateBlock
        icon="calendar"
        title={i18n.t('no_date_ideas')}
        body={i18n.t('keep_chatting')}
      >
        <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
      </StateBlock>
    </View>
  );

  if (completed) {
    const starsDisabled = isRating || uploading;
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.completedContent, { paddingBottom: tail }]}>
          <Icon name={rated ? 'party-popper' : 'map-marker'} size={ICON_SIZES.hero} color={ACCENT.base} />
          <AppCard style={styles.completionCard}>
            <Text style={styles.title}>{i18n.t('both_in')}</Text>
            <Text style={styles.subtitle}>{completed.title}</Text>
          </AppCard>
          {completed.business && (
            <GameButton variant="ink" icon="shield-alert-outline" onPress={handleShareSafetyInfo}>
              {i18n.t('share_safety_info')}
            </GameButton>
          )}
          {rated ? (
            <Text style={styles.thanks}>{i18n.t('thanks_for_rating')}</Text>
          ) : (
            <View style={styles.rateRow}>
              <Tap
                style={styles.momentPhoto}
                disabled={uploading}
                onPress={handleAddMomentPhoto}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('moment_photo_hint')}
                accessibilityState={{ disabled: uploading, busy: uploading }}
              >
                {localPhotoUri ? (
                  <Image source={{ uri: localPhotoUri }} style={styles.momentPhotoImage} />
                ) : (
                  <Icon name="image-plus" size={ICON_SIZES.xl} color={INK.dim} />
                )}
                {uploading && (
                  <View style={styles.momentPhotoOverlay}>
                    <Waiting size={ICON_SIZES.md} />
                  </View>
                )}
              </Tap>
              <Text style={styles.momentHint} importantForAccessibility="no" accessibilityElementsHidden>
                {i18n.t('moment_photo_hint')}
              </Text>
              <Text style={styles.rateLabel} accessibilityRole="header">{i18n.t('rate_your_date')}</Text>
              <View style={styles.stars}>
                {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((n) => {
                  const filled = n <= pendingStars;
                  return (
                    <Tap
                      key={n}
                      style={styles.starTouchable}
                      disabled={starsDisabled}
                      onPress={() => { setPendingStars(n); rateBusiness(n, uploadedPhotoUrl); }}
                      accessibilityRole="button"
                      accessibilityLabel={i18n.t('stars_of_five', { count: n })}
                      accessibilityState={{ disabled: starsDisabled, selected: filled }}
                    >
                      <Icon name={filled ? 'star' : 'star-outline'} size={ICON_SIZES.xl} color={ACCENT.base} />
                    </Tap>
                  );
                })}
              </View>
            </View>
          )}
          <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
        </ScrollView>
        <AlertModal
          visible={uploadFailedAlert}
          tone="warning"
          title={i18n.t('photo_upload_failed_title')}
          message={lastError ?? i18n.t('photo_upload_failed_body')}
          onDismiss={() => { setUploadFailedAlert(false); clearLastError(); }}
        />
        <AlertModal
          visible={rateFailedAlert}
          tone="warning"
          title={i18n.t('action_failed_title')}
          message={i18n.t('action_failed_body')}
          onDismiss={() => setRateFailedAlert(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('plan_encounter')} />

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: tail }]}>
        {partnerPledged && !suggestions.some((s) => s.myConfirmed) && (
          <View style={styles.partnerPledgedBanner}>
            <Icon name="hand-heart" size={ICON_SIZES.md} color={ACCENT.base} />
            <Text style={styles.partnerPledgedText}>{i18n.t('pledge_partner_first')}</Text>
          </View>
        )}
        {suggestions.map((s) => (
          <AppCard key={s.id} style={styles.card}>
            <View style={styles.titleRow}>
              {/* A list row's mark, in gold — the wax seal means "binds", and the ember means
                  something went wrong; a suggestion is neither. */}
              <Icon name="candle" size={ICON_SIZES.md} color={ACCENT.base} />
              <Text style={styles.cardTitle}>{s.title}</Text>
            </View>
            {s.business && (
              <Text style={styles.cardMeta}>
                {s.business.name} · {s.business.district} · {s.business.averageRating.toFixed(1)}
              </Text>
            )}
            <View style={styles.confirmWrap}>
              <GameButton
                variant="ink"
                loading={confirmingId === s.id}
                disabled={s.myConfirmed || riteLocked || isConfirming}
                onPress={() => { signal('pledgeKept'); confirmDate(s.id); }}
              >
                {s.myConfirmed ? i18n.t('pledge_waiting') : i18n.t('pledge_encounter')}
              </GameButton>
              {riteLocked && !s.myConfirmed && (
                <Text style={styles.pledgeLockedText}>{i18n.t('pledge_locked')}</Text>
              )}
              {s.myConfirmed && !s.isComplete && (
                <Text style={styles.pledgeLockedText}>{i18n.t('pledge_status_waiting')}</Text>
              )}
            </View>
          </AppCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
    gap: SPACE.lg,
  },
  completedContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
    gap: SPACE.lg,
  },
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.scrollTail },
  card: { padding: SPACE.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  cardTitle: { flex: 1, color: INK.primary, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold },
  cardMeta: { color: INK.dim, fontSize: FONT_SIZES.md, marginBottom: SPACE.md, fontFamily: FONTS.body },
  confirmWrap: { marginTop: SPACE.xs, gap: SPACE.sm },
  pledgeLockedText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim, textAlign: 'center' },
  partnerPledgedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: METAL.brass, backgroundColor: SURFACE.panel,
  },
  partnerPledgedText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: ACCENT.base },
  title: { color: INK.primary, fontSize: FONT_SIZES.title, fontFamily: FONTS.display, textAlign: 'center' },
  subtitle: { color: INK.dim, fontSize: FONT_SIZES.md, textAlign: 'center', fontFamily: FONTS.body },
  completionCard: { alignItems: 'center', gap: SPACE.sm, width: '100%' },
  rateRow: { alignItems: 'center', gap: SPACE.md },
  momentPhoto: {
    width: 72, height: 72, borderRadius: RADIUS.md,
    backgroundColor: SURFACE.raised, borderWidth: 1, borderColor: LINE.edge,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  momentPhotoImage: { width: '100%', height: '100%' },
  momentPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: overlay(SCRIM.veil), alignItems: 'center', justifyContent: 'center',
  },
  momentHint: { color: INK.dim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body, textAlign: 'center', maxWidth: 220 },
  rateLabel: { color: ACCENT.base, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyMedium, marginTop: SPACE.sm },
  stars: { flexDirection: 'row', gap: SPACE.hair },
  // 44pt, the platform's minimum target — the old 16px glyph in 8px of padding was a 32px one.
  starTouchable: { minWidth: STAR_TARGET, minHeight: STAR_TARGET, alignItems: 'center', justifyContent: 'center' },
  thanks: { color: ACCENT.base, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyMedium },
});
