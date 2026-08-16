import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { usePendingShips } from '../../hooks/usePendingShips';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

// Each pending ship names only the Weaver (the friend who nominated this
// user) — the engine's PendingShipResponse deliberately never surfaces
// anything about the other slot, so the prompt can't be used to identify
// who the mystery match might be before the user opts in.
export function FatedThreadsSection() {
  const { pendingShips, respond } = usePendingShips();

  if (pendingShips.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{i18n.t('fated_threads_title')}</Text>
      {pendingShips.map((ship) => (
        <View key={ship.shipId} style={styles.card}>
          <Text style={styles.medallion}>🏹</Text>
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
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // No paddingHorizontal here — activity.tsx's ScrollView container already
  // applies 20px, and this section renders inline in that same scroll list
  // alongside QuestBoard, which doesn't add its own inset either.
  section: { gap: 10, marginBottom: 16 },
  heading: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.gold, letterSpacing: 2 },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: 16,
    gap: 10,
  },
  medallion: { fontSize: 22 },
  message: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1 },
  pass: { borderColor: COLORS.bronze, backgroundColor: COLORS.panelRaised },
  passText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textDim },
  accept: { borderColor: COLORS.gold, backgroundColor: 'rgba(217,127,31,0.15)' },
  acceptText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.gold },
});
