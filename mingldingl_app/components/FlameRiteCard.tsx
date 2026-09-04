import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppCard } from './ui/AppCard';
import { AlertModal } from './modals/AlertModal';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import { COLORS, FILL, FONTS, FONT_SIZES, ICON_SIZES, LINE_HEIGHTS, RADIUS, SPACE } from '../lib/theme';
import { Icon } from './ui/Icon';

export interface FlameRiteState {
  matchId: string;
  proposedByUserId: string | null;
  proposedAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  durationMinutes: number;
}

interface Props {
  matchId?: string;
  state: FlameRiteState;
  currentUserId: string;
}

export default function FlameRiteCard({ matchId, state, currentUserId }: Props) {
  const id = matchId ?? state.matchId;
  const router = useRouter();
  const [actionFailedAlert, setActionFailedAlert] = useState(false);

  const onError = () => setActionFailedAlert(true);
  const propose = useMutation({
    mutationFn: () => apiClient.video.ritePropose(id),
    meta: { invalidates: [queryKeys.matches] },
    onError,
  });
  const accept = useMutation({
    mutationFn: () => apiClient.video.riteAccept(id),
    meta: { invalidates: [queryKeys.matches] },
    onError,
  });
  const decline = useMutation({
    mutationFn: () => apiClient.video.riteDecline(id),
    meta: { invalidates: [queryKeys.matches] },
    onError,
  });

  if (!currentUserId) return null;

  const proposedByMe = !!state.proposedByUserId && state.proposedByUserId === currentUserId;
  const proposedByThem = !!state.proposedByUserId && state.proposedByUserId !== currentUserId;

  let content: React.ReactNode;
  if (state.completedAt) {
    content = (
      <View style={styles.completeRow}>
        <Icon name="fire" size={ICON_SIZES.lg} color={COLORS.ember} />
        <Text style={styles.completeText}>{i18n.t('rite_complete')}</Text>
      </View>
    );
  } else if (state.acceptedAt) {
    content = (
      <AppCard style={styles.card}>
        <Text style={styles.title}>{i18n.t('rite_title')}</Text>
        <Text style={styles.body}>{i18n.t('rite_ready')}</Text>
        <TouchableOpacity
          style={[styles.btn, styles.joinBtn]}
          onPress={() => router.push(`/video/${id}`)}
        >
          <Text style={styles.joinText}>{i18n.t('start_video_call')}</Text>
        </TouchableOpacity>
      </AppCard>
    );
  } else if (proposedByMe) {
    content = (
      <AppCard style={styles.card}>
        <Text style={styles.title}>{i18n.t('rite_title')}</Text>
        <Text style={styles.body}>{i18n.t('rite_waiting')}</Text>
      </AppCard>
    );
  } else if (proposedByThem) {
    content = (
      <AppCard style={styles.card}>
        <Text style={styles.title}>{i18n.t('rite_title')}</Text>
        <Text style={styles.body}>{i18n.t('rite_incoming')}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.declineBtn]}
            disabled={decline.isPending}
            onPress={() => decline.mutate()}
          >
            <Text style={styles.declineText}>{i18n.t('rite_decline_cta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.acceptBtn]}
            disabled={accept.isPending}
            onPress={() => accept.mutate()}
          >
            <Text style={styles.acceptText}>{i18n.t('rite_accept_cta')}</Text>
          </TouchableOpacity>
        </View>
      </AppCard>
    );
  } else {
    content = (
      <AppCard style={styles.card}>
        <Text style={styles.title}>{i18n.t('rite_title')}</Text>
        <Text style={styles.body}>{i18n.t('rite_explainer', { minutes: state.durationMinutes })}</Text>
        <TouchableOpacity
          style={[styles.btn, styles.proposeBtn]}
          disabled={propose.isPending}
          onPress={() => propose.mutate()}
        >
          <Text style={styles.proposeText}>{i18n.t('rite_propose_cta')}</Text>
        </TouchableOpacity>
      </AppCard>
    );
  }

  return (
    <>
      {content}
      <AlertModal
        visible={actionFailedAlert}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setActionFailedAlert(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.gutter, marginTop: SPACE.sm, marginBottom: SPACE.sm, padding: SPACE.lg, gap: SPACE.sm },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.gold, letterSpacing: 1 },
  body: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, lineHeight: LINE_HEIGHTS.md },
  actions: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.xs },
  btn: { paddingVertical: SPACE.md, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1 },
  proposeBtn: { borderColor: COLORS.gold, backgroundColor: FILL.gold, marginTop: SPACE.xs },
  proposeText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
  declineBtn: { flex: 1, borderColor: COLORS.bronze, backgroundColor: COLORS.panelRaised },
  declineText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  acceptBtn: { flex: 1, borderColor: COLORS.gold, backgroundColor: FILL.gold },
  acceptText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
  joinBtn: { borderColor: COLORS.gold, backgroundColor: FILL.gold, marginTop: SPACE.xs },
  joinText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginHorizontal: SPACE.gutter,
    marginTop: SPACE.sm,
    marginBottom: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: FILL.gold,
    alignSelf: 'flex-start',
  },
  completeText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm, color: COLORS.gold, letterSpacing: 0.5 },
});
