import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface Props {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  onPress: () => void;
  tint?: string;
}

export function QuestBanner({ icon, title, onPress, tint = COLORS.gold }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.row, { borderColor: tint + '88' }]}>
        <View style={[styles.medallion, { borderColor: tint }]}>
          <Icon name={icon} size={16} color={tint} />
        </View>
        <Text style={[styles.title, { color: tint }]} numberOfLines={2}>{title}</Text>
        <Text style={[styles.chevron, { color: tint }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
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
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: 14 },
  chevron: { fontFamily: FONTS.display, fontSize: 18 },
});
