import { useState, useEffect } from 'react';
import { Tap } from '../../components/ui/Tap';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIcebreaker } from '../../hooks/useIcebreaker';
import { useAndroidKeyboardHeight } from '../../hooks/useAndroidKeyboardHeight';
import { AppCard } from '../../components/ui/AppCard';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { TextField } from '../../components/ui/TextField';
import { LootToast } from '../../components/modals/LootToast';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Waiting } from '../../components/ui/Waiting';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { LEADING, ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, RADIUS, SPACE, SURFACE, tint } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';
import { Icon } from '../../components/ui/Icon';
import { useScrollTail } from '../../hooks/useScrollTail';

export default function IcebreakerScreen() {
  useLocaleStore((s) => s.locale);
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const {
    question, isLoading, submitAnswer,
    hasResponded, isWaitingForPartner, isComplete, myAnswer, partnerAnswer,
    submitError, clearSubmitError,
  } = useIcebreaker(matchId);
  const router = useRouter();
  const tail = useScrollTail();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useAndroidKeyboardHeight();
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [failedAlert, setFailedAlert] = useState(false);

  useEffect(() => {
    if (submitError) {
      setSelected(null);
      setFailedAlert(true);
    }
  }, [submitError]);

  if (isLoading) return (
    <View style={styles.centered}>
      <Waiting />
    </View>
  );

  if (!question) return (
    <StateBlock icon="help-circle-outline" title={i18n.t('no_icebreaker')}>
      <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </StateBlock>
  );

  if (isComplete) {
    const isMatch = myAnswer === partnerAnswer;
    return (
      <View style={styles.centered}>
        <Icon name={isMatch ? 'party-popper' : 'message-text'} size={ICON_SIZES.huge} color={ACCENT.base} />
        <AppCard style={styles.completionCard}>
          <Text style={styles.completionTitle}>{i18n.t('icebreaker_revealed')}</Text>
          <Text style={styles.questionText}>{question.questionText}</Text>
          <Text style={styles.matchCount}>{i18n.t('you_said', { answer: myAnswer })}</Text>
          <Text style={styles.matchCount}>{i18n.t('they_said', { answer: partnerAnswer })}</Text>
          {isMatch && <Text style={styles.ptsEarned}>{i18n.t('you_matched')}</Text>}
        </AppCard>
        <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
      </View>
    );
  }

  if (hasResponded || isWaitingForPartner) {
    return (
      <View style={styles.centered}>
        <Waiting />
        <Text style={styles.completionTitle}>{i18n.t('waiting_partner')}</Text>
        <GameButton variant="ink" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
      </View>
    );
  }

  function handleSelect(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    setToastVisible(true);
    submitAnswer(opt);
  }

  function handleDismissFailure() {
    setFailedAlert(false);
    clearSubmitError();
  }

  return (
    <View
      style={[styles.screen, Platform.OS === 'android' && {
        // Edge-to-edge does not resize the window for the keyboard, so the open-text field and its
        // submit button sat underneath it. Pad by the measured keyboard instead, adding back the
        // navigation bar the event's height stops at — the chat composer's rule
        // (`hooks/useAndroidKeyboardHeight.ts`).
        paddingBottom: keyboardHeight > 0 ? keyboardHeight + insets.bottom : 0,
      }]}
    >
      <HeaderBar title={i18n.t('break_ice')} />

      {/* Scrolls so a long question plus the open-text field can both be reached with the keyboard
          up; `flexGrow` keeps the answers pinned to the bottom when everything fits. The submit
          button owns the navigation bar inset itself via `tail`. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: keyboardHeight > 0 ? SPACE.lg : tail }]}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard hero style={styles.questionCard}>
          <Text style={styles.questionText}>{question.questionText}</Text>
        </AppCard>

        {question.type === 'OpenText' ? (
          <View style={styles.textAnswerWrap}>
            <TextField
              multiline
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholder={i18n.t('icebreaker_answer_placeholder')}
              maxLength={200}
              numberOfLines={4}
            />
            <GameButton
              variant="primary"
              disabled={selected !== null || textAnswer.trim().length === 0}
              onPress={() => handleSelect(textAnswer.trim())}
            >
              {i18n.t('submit_answer')}
            </GameButton>
          </View>
        ) : (
          <View style={styles.options}>
            {question.options.map((opt, i) => {
              const isSelected = selected === opt;
              return (
                <Tap
                  key={i}
                  disabled={selected !== null}
                  onPress={() => handleSelect(opt)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: selected !== null }}
                  style={[styles.option, isSelected ? styles.optionSelected : styles.optionDefault]}
                >
                  <Text style={[styles.optionText, isSelected ? styles.optionTextSelected : styles.optionTextDefault]}>
                    {opt}
                  </Text>
                </Tap>
              );
            })}
          </View>
        )}
      </ScrollView>

      <LootToast
        title={i18n.t('answer_submitted')}
        points={0}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      <AlertModal
        visible={failedAlert}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={handleDismissFailure}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: SPACE.gutter,
    // Room for the question card's corner knots, which sit 6pt above its top edge — flush against
    // the top of the scroll, the ScrollView clipped them flat.
    paddingTop: SPACE.sm,
  },
  centered: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
    gap: SPACE.lg,
  },
  questionCard: {
    // AppCard carries no padding of its own, and the ulzii corner knots sit on its border — a
    // long Mongolian question ran flush into both.
    padding: SPACE.lg,
    marginBottom: SPACE.xxl,
  },
  questionText: {
    color: INK.primary,
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.bodyBold,
    lineHeight: LEADING.title,
    textAlign: 'center',
  },
  options: {
    gap: SPACE.md,
    marginTop: 'auto',
  },
  textAnswerWrap: {
    gap: SPACE.md,
    marginTop: 'auto',
  },
  option: {
    borderWidth: 1,
    borderTopColor: tint(ACCENT.bright, 0.35),
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.gutter,
    alignItems: 'center',
  },
  optionDefault: {
    backgroundColor: SURFACE.raised,
    borderLeftColor: LINE.edge,
    borderRightColor: LINE.edge,
    borderBottomColor: LINE.edge,
  },
  optionSelected: {
    backgroundColor: ACCENT.soft,
    borderLeftColor: ACCENT.base,
    borderRightColor: ACCENT.base,
    borderBottomColor: ACCENT.base,
  },
  optionText: {
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.bodyMedium,
    textAlign: 'center',
  },
  optionTextDefault: {
    color: INK.primary,
  },
  optionTextSelected: {
    color: ACCENT.bright,
  },
  completionCard: {
    padding: SPACE.lg,
    alignItems: 'center',
    gap: SPACE.md,
    marginVertical: SPACE.lg,
    width: '100%',
  },
  completionTitle: {
    color: INK.primary,
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  matchCount: {
    color: ACCENT.base,
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
  ptsEarned: {
    color: INK.dim,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
});
