import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Spinner } from 'tamagui';
import { useActivitySuggestions } from '../../hooks/useActivitySuggestions';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { useAuthStore } from '../../store/authStore';
import { AlertModal } from '../../components/modals/AlertModal';
import { AppCard } from '../../components/ui/AppCard';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function ActivitiesScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const {
    suggestions, isLoading, error,
    confirmDate, isConfirming, completed,
    rated, rateBusiness, isRating, rateError,
  } = useActivitySuggestions(matchId);

  // The "memorable moment" photo — optional, attached to the star rating so
  // other daters browsing this business can see what a date there actually
  // looked like, not just an aggregate number.
  const session = useAuthStore((s) => s.session);
  const { pickPhoto, uploadPhoto, uploading } = usePhotoUpload(session?.user.id);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadFailedAlert, setUploadFailedAlert] = useState(false);
  const [rateFailedAlert, setRateFailedAlert] = useState(false);

  useEffect(() => {
    if (rateError) setRateFailedAlert(true);
  }, [rateError]);

  async function handleAddMomentPhoto() {
    const [uri] = await pickPhoto(1);
    if (!uri) return;
    setLocalPhotoUri(uri);
    const url = await uploadPhoto(uri);
    if (url) {
      setUploadedPhotoUrl(url);
    } else {
      setLocalPhotoUri(null); // upload failed — clear the optimistic local preview
      setUploadFailedAlert(true);
    }
  }

  if (isLoading) return (
    <View style={styles.centered}>
      <Spinner color="$gold" />
    </View>
  );

  if (error || !suggestions || suggestions.length === 0) return (
    <View style={styles.centered}>
      <Text style={styles.emoji}>🗓️</Text>
      <Text style={styles.title}>{i18n.t('no_date_ideas')}</Text>
      <Text style={styles.subtitle}>{i18n.t('keep_chatting')}</Text>
      <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (completed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emoji}>{rated ? '🎉' : '📍'}</Text>
        <AppCard style={styles.completionCard}>
          <Text style={styles.title}>{i18n.t('both_in')}</Text>
          <Text style={styles.subtitle}>{completed.title}</Text>
        </AppCard>
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
                <Icon name="image-plus" size={22} color={COLORS.textDim} />
              )}
              {uploading && (
                <View style={styles.momentPhotoOverlay}>
                  <Spinner color="$gold" size="small" />
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
                  <Text style={styles.star}>⭐</Text>
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
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={`📍 ${i18n.t('plan_encounter')}`} />

      <ScrollView contentContainerStyle={styles.list}>
        {suggestions.map((s) => (
          <AppCard key={s.id} style={styles.card}>
            <View style={styles.sealRow}>
              <View style={styles.seal}><Text style={styles.sealIcon}>🕯️</Text></View>
              <Text style={styles.cardTitle}>{s.title}</Text>
            </View>
            {s.business && (
              <Text style={styles.cardMeta}>
                {s.business.name} · {s.business.district} · ⭐ {s.business.averageRating.toFixed(1)}
              </Text>
            )}
            <View style={styles.confirmWrap}>
              <GameButton
                variant="ghost"
                loading={isConfirming}
                disabled={s.myConfirmed}
                onPress={() => confirmDate(s.id)}
              >
                {s.myConfirmed ? i18n.t('pledge_waiting') : i18n.t('pledge_encounter')}
              </GameButton>
            </View>
          </AppCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 14, paddingBottom: 40 },
  card: { padding: 16 },
  sealRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  seal: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.panelRaised,
    borderWidth: 1.5, borderColor: COLORS.ember,
    alignItems: 'center', justifyContent: 'center',
  },
  sealIcon: { fontSize: 15 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontFamily: FONTS.bodyBold },
  cardMeta: { color: COLORS.textDim, fontSize: 13, marginBottom: 12, fontFamily: FONTS.body },
  confirmWrap: { marginTop: 4 },
  emoji: { fontSize: 48 },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONTS.display, textAlign: 'center' },
  subtitle: { color: COLORS.textDim, fontSize: 14, textAlign: 'center', fontFamily: FONTS.body },
  completionCard: { alignItems: 'center', gap: 6, width: '100%' },
  rateRow: { alignItems: 'center', gap: 10 },
  momentPhoto: {
    width: 72, height: 72, borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.bronze,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  momentPhotoImage: { width: '100%', height: '100%' },
  momentPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,11,16,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  momentHint: { color: COLORS.textDim, fontSize: 12, fontFamily: FONTS.body, textAlign: 'center', maxWidth: 220 },
  rateLabel: { color: COLORS.gold, fontSize: 15, fontFamily: FONTS.bodyMedium, marginTop: 6 },
  stars: { flexDirection: 'row', gap: 4 },
  starTouchable: { padding: 8 },
  star: { fontSize: 30, opacity: 0.9 },
  thanks: { color: COLORS.gold, fontSize: 16, fontFamily: FONTS.bodyMedium },
});
