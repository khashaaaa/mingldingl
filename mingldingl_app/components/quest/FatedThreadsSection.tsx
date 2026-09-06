import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { usePendingShips } from '../../hooks/usePendingShips';
import { i18n } from '../../lib/i18n';
import { COLORS, FILL, FONTS, FONT_SIZES, ICON_SIZES, LINE, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { Icon } from '../ui/Icon';

export function FatedThreadsSection() {
  const { pendingShips, respond } = usePendingShips();

  if (pendingShips.length === 0) return null;

  return (
    <View style={styles.section}>
      <CardEyebrow color={COLORS.gold}>{i18n.t('fated_threads_title')}</CardEyebrow>
      {pendingShips.map((ship) => (
        <AppCard key={ship.shipId} style={styles.card}>
          <Icon name="bow-arrow" size={ICON_SIZES.lg} color={COLORS.gold} />
          <Text style={styles.message}>
            {i18n.t('ship_prompt_message', { weaver: ship.weaverDisplayName })}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.pass]}
              onPress={() => respond({ shipId: ship.shipId, accept: false })}
            >
              <Text style={styles.passText}>{i18n.t('ship_pass')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.accept]}
              onPress={() => respond({ shipId: ship.shipId, accept: true })}
            >
              <Text style={styles.acceptText}>{i18n.t('ship_accept')}</Text>
            </TouchableOpacity>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md, marginBottom: SPACE.lg },
  card: { padding: SPACE.lg, gap: SPACE.md },
  message: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.text, lineHeight: LINE_HEIGHTS.md },
  actions: { flexDirection: 'row', gap: SPACE.md },
  btn: { flex: 1, paddingVertical: SPACE.md, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1 },
  pass: { borderColor: LINE.edge, backgroundColor: COLORS.panelRaised },
  passText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  accept: { borderColor: COLORS.gold, backgroundColor: FILL.gold },
  acceptText: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
});
