import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useActivitySuggestions } from '../../hooks/useActivitySuggestions';
import { useMatches } from '../../hooks/useMatches';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { useAuthStore } from '../../store/authStore';
import { AlertModal } from '../../components/modals/AlertModal';
import { AppCard } from '../../components/ui/AppCard';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { i18n } from '../../lib/i18n';
import { signal } from '../../lib/world/feedback';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, RADIUS, SPACE, circle, overlay } from '../../lib/theme';
import { useScrollTail } from '../../hooks/useScrollTail';


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

  const session = useAuthStore((s) => s.session);
  const { pickPhoto, uploadPhoto, uploading } = usePhotoUpload(session?.user.id);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadFailedAlert, setUploadFailedAlert] = useState(false);
  const [rateFailedAlert, setRateFailedAlert] = useState(false);

  useEffect(() => {
    if (rateError) setRateFailedAlert(true);
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
      <ActivityIndicator color={COLORS.gold} />
    </View>
  );

  if (error || !suggestions || suggestions.length === 0) return (
    <View style={styles.centered}>
      <Icon name="calendar" size={ICON_SIZES.huge} color={INK.muted} />
      <Text style={styles.title}>{i18n.t('no_date_ideas')}</Text>
      <Text style={styles.subtitle}>{i18n.t('keep_chatting')}</Text>
      <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (completed) {
    return (
      <View style={styles.centered}>
        <Icon name={rated ? 'party-popper' : 'map-marker'} size={ICON_SIZES.md} color={COLORS.ember} />
        <AppCard style={styles.completionCard}>
          <Text style={styles.title}>{i18n.t('both_in')}</Text>
          <Text style={styles.subtitle}>{completed.title}</Text>
        </AppCard>
        {completed.business && (
          <GameButton variant="ghost" icon="shield-alert-outline" onPress={handleShareSafetyInfo}>
            {i18n.t('share_safety_info')}
          </GameButton>
        )}
        {rated ? (
          <Text style={styles.thanks}>{i18n.t('thanks_for_rating')}</Text>
        ) : (
          <View style={styles.rateRow}>
            <TouchableOpacity
              style={styles.momentPhoto}
              disabled={uploading}
              onPress={handleAddMomentPhoto}
            >
              {localPhotoUri ? (
                <Image source={{ uri: localPhotoUri }} style={styles.momentPhotoImage} />
              ) : (
                <Icon name="image-plus" size={ICON_SIZES.xl} color={COLORS.textDim} />
              )}
              {uploading && (
                <View style={styles.momentPhotoOverlay}>
                  <ActivityIndicator color={COLORS.gold} size="small" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.momentHint}>{i18n.t('moment_photo_hint')}</Text>
            <Text style={styles.rateLabel}>{i18n.t('rate_your_date')}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.starTouchable}
                  disabled={isRating || uploading}
                  onPress={() => rateBusiness(n, uploadedPhotoUrl)}
                >
                  <Icon name="star" size={ICON_SIZES.md} color={COLORS.gold} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
        <AlertModal
          visible={uploadFailedAlert}
          tone="warning"
          title={i18n.t('photo_upload_failed_title')}
          message={i18n.t('photo_upload_failed_body')}
          onDismiss={() => setUploadFailedAlert(false)}
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
      <ScreenHeader title={i18n.t('plan_encounter')} />

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: tail }]}>
        {partnerPledged && !suggestions.some((s) => s.myConfirmed) && (
          <View style={styles.partnerPledgedBanner}>
            <Icon name="hand-heart" size={ICON_SIZES.md} color={COLORS.gold} />
            <Text style={styles.partnerPledgedText}>{i18n.t('pledge_partner_first')}</Text>
          </View>
        )}
        {suggestions.map((s) => (
          <AppCard key={s.id} style={styles.card}>
            <View style={styles.sealRow}>
              <View style={styles.seal}><Icon name="candle" size={ICON_SIZES.md} color={COLORS.ember} /></View>
              <Text style={styles.cardTitle}>{s.title}</Text>
            </View>
            {s.business && (
              <Text style={styles.cardMeta}>
                {s.business.name} · {s.business.district} · {s.business.averageRating.toFixed(1)}
              </Text>
            )}
            <View style={styles.confirmWrap}>
              <GameButton
                variant="ghost"
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
  list: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.scrollTail },
  card: { padding: SPACE.lg },
  sealRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.sm },
  seal: {
    ...circle(34),
    backgroundColor: COLORS.panelRaised,
    borderWidth: 2, borderColor: COLORS.ember,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: COLORS.text, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold },
  cardMeta: { color: COLORS.textDim, fontSize: FONT_SIZES.md, marginBottom: SPACE.md, fontFamily: FONTS.body },
  confirmWrap: { marginTop: SPACE.xs, gap: SPACE.sm },
  pledgeLockedText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim, textAlign: 'center' },
  partnerPledgedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brass, backgroundColor: COLORS.panel,
  },
  partnerPledgedText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
  title: { color: COLORS.text, fontSize: FONT_SIZES.title, fontFamily: FONTS.display, textAlign: 'center' },
  subtitle: { color: COLORS.textDim, fontSize: FONT_SIZES.md, textAlign: 'center', fontFamily: FONTS.body },
  completionCard: { alignItems: 'center', gap: SPACE.sm, width: '100%' },
  rateRow: { alignItems: 'center', gap: SPACE.md },
  momentPhoto: {
    width: 72, height: 72, borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: LINE.edge,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  momentPhotoImage: { width: '100%', height: '100%' },
  momentPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: overlay(0.55), alignItems: 'center', justifyContent: 'center',
  },
  momentHint: { color: COLORS.textDim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body, textAlign: 'center', maxWidth: 220 },
  rateLabel: { color: COLORS.gold, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyMedium, marginTop: SPACE.sm },
  stars: { flexDirection: 'row', gap: SPACE.xs },
  starTouchable: { padding: SPACE.sm },
  thanks: { color: COLORS.gold, fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyMedium },
});
