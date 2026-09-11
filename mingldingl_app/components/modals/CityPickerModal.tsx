import { useEffect, useState } from 'react';
import { Tap } from '../ui/Tap';
import { Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { FONTS, FONT_SIZES, INK, LINE, RADIUS, SPACE, SURFACE, TRACKING } from '../../lib/theme';
import { scrimStyle } from './DialogSurface';
import { AppModal } from './AppModal';

interface Props {
  visible: boolean;
  provinces: string[];
  ulaanbaatarDistricts: string[];
  onSelect: (city: string) => void;
  onDismiss: () => void;
}

export function CityPickerModal({ visible, provinces, ulaanbaatarDistricts, onSelect, onDismiss }: Props) {
  const [showingDistricts, setShowingDistricts] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setShowingDistricts(false);
  }, [visible]);

  const ulaanbaatarLabel = i18n.t('ulaanbaatar');
  const rows = showingDistricts ? ulaanbaatarDistricts : [...provinces, ulaanbaatarLabel];

  function handlePress(item: string) {
    if (!showingDistricts && item === ulaanbaatarLabel) {
      setShowingDistricts(true);
      return;
    }
    onSelect(item);
  }

  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Tap style={scrimStyle('sheet', 'bottom')} feedback="none" onPress={onDismiss}>
        <Tap style={styles.sheet} feedback="none" onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {showingDistricts ? i18n.t('select_district') : i18n.t('select_city')}
          </Text>
          <FlatList
            data={rows}
            keyExtractor={(c) => c}
            style={styles.list}
            renderItem={({ item }) => (
              <Tap style={styles.row} onPress={() => handlePress(item)}>
                <Text style={styles.rowText}>{item}</Text>
              </Tap>
            )}
          />
          <GameButton
            variant="ghost"
            style={[styles.cancelWrap, { paddingBottom: SPACE.lg + insets.bottom }]}
            onPress={showingDistricts ? () => setShowingDistricts(false) : onDismiss}
          >
            {i18n.t('back')}
          </GameButton>
        </Tap>
      </Tap>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: SURFACE.panel,
    borderTopWidth: 1,
    borderColor: LINE.edge,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    maxHeight: '70%',
    paddingTop: SPACE.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    letterSpacing: TRACKING.eyebrow,
    textAlign: 'center',
    marginBottom: SPACE.sm,
    textTransform: 'uppercase',
  },
  list: { maxHeight: '100%' },
  cancelWrap: { padding: SPACE.lg },
  row: {
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.xxl,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE.raised,
  },
  rowText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, color: INK.primary },
});
