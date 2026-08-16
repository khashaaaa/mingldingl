import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

interface Props {
  icon: string;
  title: string;
  onPress: () => void;
  tint?: string;
}

// A quest-log entry row: wax-seal icon medallion, title, chevron.
export function QuestBanner({ icon, title, onPress, tint = COLORS.gold }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.row, { borderColor: tint + '88' }]}>
        <View style={[styles.medallion, { borderColor: tint }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={[styles.title, { color: tint }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.chevron, { color: tint }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: COLORS.panel,
  },
  medallion: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 15 },
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: 14 },
  chevron: { fontFamily: FONTS.display, fontSize: 18 },
});
