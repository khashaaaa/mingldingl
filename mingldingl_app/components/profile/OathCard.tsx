import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { AlertModal } from '../modals/AlertModal';
import { SheetModal } from '../modals/SheetModal';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { GameButton } from '../ui/GameButton';
import OathSigil, { OATH_VALUES, OATH_SIGILS, OATH_NAME_KEYS, OATH_DESC_KEYS } from '../OathSigil';
import { useSwearOath } from '../../hooks/useOath';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, LINE, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';
import type { CloseThen } from '../modals/SheetModal';
import type { GemTier, Oath } from '../../models/user';

interface Props {
  oath: Oath | null;
  oathProven: boolean;
  encountersHeld: number | null;
  encountersNeeded: number | null;
  gemTier: GemTier;
  style?: StyleProp<ViewStyle>;
}

/** The sworn-oath card on the character sheet, and the picker it opens. */
export function OathCard({ oath, oathProven, encountersHeld, encountersNeeded, gemTier, style }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [showError, setShowError] = useState(false);
  // Swearing a different oath clears OathProven and restarts the vow, and the reward for proving it
  // is never paid a second time — so a proven oath is only traded away on purpose.
  const [pendingOath, setPendingOath] = useState<Oath | null>(null);
  const { swear, isSwearing, swearError } = useSwearOath();

  useEffect(() => {
    if (swearError) setShowError(true);
  }, [swearError]);

  // Routed through closeThen so the error alert can never try to present over the sheet
  // while it is still dismissing.
  function handleSwear(closeThen: CloseThen, next: Oath) {
    closeThen(() => (oathProven ? setPendingOath(next) : swear(next)));
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setPickerVisible(true)}>
        <AppCard tier={gemTier} textured style={style}>
          <CardEyebrow>{i18n.t('oath_title')}</CardEyebrow>
          {oath ? (
            <View style={styles.oathRow}>
              <OathSigil
                oath={oath}
                proven={oathProven}
                size="md"
                progress={
                  encountersHeld != null && encountersNeeded != null
                    ? { held: encountersHeld, needed: encountersNeeded }
                    : null
                }
              />
            </View>
          ) : (
            <Text style={styles.oathPrompt}>{i18n.t('oath_prompt_banner')}</Text>
          )}
        </AppCard>
      </TouchableOpacity>

      <SheetModal visible={pickerVisible} onClose={() => setPickerVisible(false)}>
        {(closeThen) => (
          <>
            <Text style={styles.sheetTitle}>{i18n.t('oath_step_heading')}</Text>
            {OATH_VALUES.map((option) => {
              const isCurrent = oath === option;
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.85}
                  disabled={isSwearing}
                  onPress={() => (isCurrent ? setPickerVisible(false) : handleSwear(closeThen, option))}
                  style={[styles.option, isCurrent && styles.optionCurrent]}
                >
                  <Image
                    source={OATH_SIGILS[option]}
                    style={[styles.optionSigil, !isCurrent && styles.optionSigilDim]}
                  />
                  <View style={styles.optionText}>
                    <Text style={styles.optionName}>{i18n.t(OATH_NAME_KEYS[option])}</Text>
                    <Text style={styles.optionDesc}>{i18n.t(OATH_DESC_KEYS[option])}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.sheetHelp}>{i18n.t('oath_step_help')}</Text>
            <GameButton variant="ghost" onPress={() => setPickerVisible(false)}>
              {i18n.t('back')}
            </GameButton>
          </>
        )}
      </SheetModal>

      <AlertModal
        visible={pendingOath !== null}
        tone="warning"
        destructive
        title={i18n.t('oath_reswear_title')}
        message={i18n.t('oath_reswear_body')}
        confirmLabel={i18n.t('oath_reswear_confirm')}
        isConfirming={isSwearing}
        onConfirm={() => {
          if (pendingOath) swear(pendingOath);
          setPendingOath(null);
        }}
        onDismiss={() => setPendingOath(null)}
      />

      <AlertModal
        visible={showError}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setShowError(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  oathRow: { marginTop: SPACE.hair },
  oathPrompt: { fontSize: FONT_SIZES.md, color: COLORS.gold, fontFamily: FONTS.body, lineHeight: LINE_HEIGHTS.md },
  sheetTitle: { fontSize: FONT_SIZES.xl, fontFamily: FONTS.display, color: COLORS.text, marginBottom: SPACE.hair },
  sheetHelp: { fontSize: FONT_SIZES.sm, color: COLORS.textDim, fontFamily: FONTS.body, lineHeight: LINE_HEIGHTS.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
    backgroundColor: COLORS.panelRaised,
  },
  optionCurrent: { borderColor: COLORS.gold, borderWidth: 2 },
  optionSigil: { width: 30, height: 30 },
  optionSigilDim: { opacity: 0.5 },
  optionText: { flex: 1, gap: SPACE.hair },
  optionName: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold, color: COLORS.text },
  optionDesc: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.body, color: COLORS.textDim, lineHeight: LINE_HEIGHTS.sm },
});
