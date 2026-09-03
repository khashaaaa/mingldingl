import { useEffect, useState } from 'react';
import { Modal, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE, overlay } from '../../lib/theme';

interface Props {
  visible: boolean;
  provinces: string[];
  ulaanbaatarDistricts: string[];
  onSelect: (city: string) => void;
  onDismiss: () => void;
}

export function CityPickerModal({ visible, provinces, ulaanbaatarDistricts, onSelect, onDismiss }: Props) {
  const [showingDistricts, setShowingDistricts] = useState(false);

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {showingDistricts ? i18n.t('select_district') : i18n.t('select_city')}
          </Text>
          <FlatList
            data={rows}
            keyExtractor={(c) => c}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => handlePress(item)}>
                <Text style={styles.rowText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <GameButton
            variant="ghost"
            style={styles.cancelWrap}
            onPress={showingDistricts ? () => setShowingDistricts(false) : onDismiss}
          >
            {i18n.t('back')}
          </GameButton>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: overlay(0.6), justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.panel,
    borderTopWidth: 1,
    borderColor: COLORS.bronze,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    maxHeight: '70%',
    paddingTop: SPACE.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.md,
    color: COLORS.textDim,
    letterSpacing: 2,
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
    borderBottomColor: COLORS.panelRaised,
  },
  rowText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, color: COLORS.text },
});
