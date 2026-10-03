import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, INK, LEADING, LINE, RADIUS, SPACE, SURFACE } from '../../lib/theme';
import type { components } from '../../lib/api/api.generated';

type Trial = components['schemas']['BondTrialResponse'];

/**
 * This week's shared trial: two marks, one per side, because neither person can pass it alone.
 * The claim button only appears once both are full, and pays both of them.
 */
export function BondTrialCard({ trial, onClaim, isClaiming }: { trial: Trial; onClaim: () => void; isClaiming: boolean }) {
  const target = trial.target ?? 1;
  const kind = trial.kind === 'rite' ? 'rite' : 'exchange';
  return (
    <AppCard style={styles.card}>
      <CardEyebrow>{i18n.t('trial_eyebrow')}</CardEyebrow>
      <Text style={styles.title}>{i18n.t(`trial_${kind}_title`)}</Text>
      <Text style={styles.body}>{i18n.t(`trial_${kind}_body`, { target })}</Text>
      {kind === 'exchange' ? (
        <View style={styles.sides}>
          <Side label={i18n.t('trial_you')} held={trial.myProgress ?? 0} target={target} />
          <Side label={i18n.t('trial_them')} held={trial.theirProgress ?? 0} target={target} />
        </View>
      ) : null}
      {trial.claimed ? (
        <Text style={styles.done}>{i18n.t('trial_claimed')}</Text>
      ) : trial.complete ? (
        <GameButton variant="primary" size="compact" icon="sword-cross" onPress={onClaim} loading={isClaiming}>
          {i18n.t('trial_claim', { reward: trial.reward ?? 0 })}
        </GameButton>
      ) : (
        <Text style={styles.hint}>{i18n.t('trial_reward', { reward: trial.reward ?? 0 })}</Text>
      )}
    </AppCard>
  );
}

function Side({ label, held, target }: { label: string; held: number; target: number }) {
  const pct = Math.max(0, Math.min(1, held / target));
  return (
    <View style={styles.side}>
      <View style={styles.sideHead}>
        <Text style={styles.sideLabel}>{label}</Text>
        <Text style={styles.sideCount}>{held}/{target}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, gap: SPACE.sm },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.primary },
  body: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, lineHeight: LEADING.sm, color: INK.dim },
  sides: { gap: SPACE.sm, marginVertical: SPACE.xs },
  side: { gap: SPACE.hair },
  sideHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sideLabel: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim },
  sideCount: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.sm, color: INK.primary },
  track: { height: 6, borderRadius: RADIUS.sm, backgroundColor: SURFACE.raised, borderWidth: 1, borderColor: LINE.edge, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: ACCENT.base },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.muted },
  done: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: ACCENT.base },
});
