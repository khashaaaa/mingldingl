import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { YStack, XStack } from 'tamagui';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { StepScaffold } from './StepScaffold';
import { OATH_VALUES, OATH_SIGILS, OATH_NAME_KEYS, OATH_DESC_KEYS } from '../OathSigil';
import type { Oath } from '../../models/user';

interface Props {
  initialOath: Oath | null;
  loading: boolean;
  error?: string | null;
  onSubmit: (oath: Oath) => void;
  onBack: () => void;
}

export function OathStep({ initialOath, loading, error, onSubmit, onBack }: Props) {
  const [selected, setSelected] = useState<Oath | null>(initialOath);

  return (
    <StepScaffold>
      <YStack flex={1} padding="$6" gap="$4">
      <Text style={styles.heading}>{i18n.t('oath_step_heading')}</Text>
      <Text style={styles.help}>{i18n.t('oath_step_help')}</Text>

      <View style={styles.cardList}>
        {OATH_VALUES.map((oath) => {
          const isSelected = selected === oath;
          return (
            <TouchableOpacity
              key={oath}
              activeOpacity={0.85}
              onPress={() => setSelected(oath)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t(OATH_NAME_KEYS[oath])}
              style={isSelected ? styles.selectedGlow : undefined}
            >
              <AppCard
                tint={isSelected ? COLORS.gold : undefined}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <Image source={OATH_SIGILS[oath]} style={[styles.glyphImg, !isSelected && styles.glyphImgDim]} />
                <View style={styles.cardText}>
                  <Text style={styles.cardName}>{i18n.t(OATH_NAME_KEYS[oath])}</Text>
                  <Text style={styles.cardDesc}>{i18n.t(OATH_DESC_KEYS[oath])}</Text>
                </View>
              </AppCard>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <XStack gap="$3" marginTop="auto">
        <GameButton variant="ghost" flex={1} disabled={loading} onPress={onBack}>
          {i18n.t('back')}
        </GameButton>
        <GameButton
          variant="primary" flex={2}
          disabled={!selected || loading}
          loading={loading}
          onPress={() => selected && onSubmit(selected)}
        >
          {i18n.t('complete_profile')}
        </GameButton>
      </XStack>
      </YStack>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  heading: { color: COLORS.text, fontSize: 22, fontFamily: FONTS.display },
  help: { color: COLORS.textDim, fontSize: 13, fontFamily: FONTS.body, lineHeight: 19 },
  cardList: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  cardSelected: { borderColor: COLORS.gold, borderWidth: 2 },
  selectedGlow: {
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
    borderRadius: RADIUS.md,
  },
  glyphImg: { width: 34, height: 34 },
  glyphImgDim: { opacity: 0.45 },
  cardText: { flex: 1, gap: 3 },
  cardName: { fontSize: 16, fontFamily: FONTS.bodyBold, color: COLORS.text },
  cardDesc: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim, lineHeight: 18 },
  error: { color: COLORS.emberLight, fontSize: 13, fontFamily: FONTS.body },
});
