import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIcebreaker } from '../../hooks/useIcebreaker';
import { AppCard } from '../../components/ui/AppCard';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { TextField } from '../../components/ui/TextField';
import { LootToast } from '../../components/modals/LootToast';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FILL, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, LINE_HEIGHTS, RADIUS, SPACE, tint } from '../../lib/theme';
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
      <ActivityIndicator color={COLORS.gold} />
    </View>
  );

  if (!question) return (
    <View style={styles.centered}>
      <Icon name="help-circle-outline" size={ICON_SIZES.huge} color={INK.muted} />
      <Text style={styles.completionTitle}>{i18n.t('no_icebreaker')}</Text>
      <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (isComplete) {
    const isMatch = myAnswer === partnerAnswer;
    return (
      <View style={styles.centered}>
        <Icon name={isMatch ? 'party-popper' : 'message-text'} size={ICON_SIZES.huge} color={COLORS.gold} />
        <AppCard style={styles.completionCard}>
          <Text style={styles.completionTitle}>{i18n.t('icebreaker_revealed')}</Text>
          <Text style={styles.questionText}>{question.questionText}</Text>
          <Text style={styles.matchCount}>{i18n.t('you_said', { answer: myAnswer })}</Text>
          <Text style={styles.matchCount}>{i18n.t('they_said', { answer: partnerAnswer })}</Text>
          {isMatch && <Text style={styles.ptsEarned}>{i18n.t('you_matched')}</Text>}
        </AppCard>
        <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
      </View>
    );
  }

  if (hasResponded || isWaitingForPartner) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} />
        <Text style={styles.completionTitle}>{i18n.t('waiting_partner')}</Text>
        <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
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
    <View style={styles.screen}>
      <ScreenHeader title={i18n.t('break_ice')} />

      {/* The submit button sits at the bottom of a non-scrolling body, so it owns the navigation
          bar inset itself — a bare SPACE.xxl left it half-swallowed by a three-button bar. */}
      <View style={[styles.body, { paddingBottom: tail }]}>
        <AppCard style={styles.questionCard}>
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
                <TouchableOpacity
                  key={i}
                  disabled={selected !== null}
                  onPress={() => handleSelect(opt)}
                  style={[styles.option, isSelected ? styles.optionSelected : styles.optionDefault]}
                >
                  <Text style={[styles.optionText, isSelected ? styles.optionTextSelected : styles.optionTextDefault]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

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
  body: {
    flex: 1,
    paddingHorizontal: SPACE.gutter,
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
    color: COLORS.text,
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.bodyBold,
    lineHeight: LINE_HEIGHTS.title,
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
    borderTopColor: tint(COLORS.goldBright, 0.35),
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.gutter,
    alignItems: 'center',
  },
  optionDefault: {
    backgroundColor: COLORS.panelRaised,
    borderLeftColor: LINE.edge,
    borderRightColor: LINE.edge,
    borderBottomColor: LINE.edge,
  },
  optionSelected: {
    backgroundColor: FILL.gold,
    borderLeftColor: COLORS.gold,
    borderRightColor: COLORS.gold,
    borderBottomColor: COLORS.gold,
  },
  optionText: {
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.bodyMedium,
    textAlign: 'center',
  },
  optionTextDefault: {
    color: COLORS.text,
  },
  optionTextSelected: {
    color: COLORS.goldBright,
  },
  completionCard: {
    padding: SPACE.lg,
    alignItems: 'center',
    gap: SPACE.md,
    marginVertical: SPACE.lg,
    width: '100%',
  },
  completionTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  matchCount: {
    color: COLORS.gold,
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
  ptsEarned: {
    color: COLORS.textDim,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
});
