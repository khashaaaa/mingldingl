import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Spinner } from 'tamagui';
import { useQuiz } from '../../hooks/useQuiz';
import { AppCard } from '../../components/ui/AppCard';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { LootToast } from '../../components/modals/LootToast';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function QuizScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const {
    quiz, isLoading, currentQuestion, answeredCount,
    submitAnswer, allAnswered, isWaitingForPartner, compatibility, droppedItem, awarded,
    submitError, clearSubmitError,
  } = useQuiz(matchId);
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [dropToastVisible, setDropToastVisible] = useState(true);
  const [failedAlert, setFailedAlert] = useState(false);

  useEffect(() => {
    setSelectedIndex(null);
  }, [answeredCount]);

  useEffect(() => {
    if (submitError) {
      setSelectedIndex(null);
      setFailedAlert(true);
    }
  }, [submitError]);

  if (isLoading) return (
    <View style={styles.centered}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <Spinner color="$gold" />
    </View>
  );

  if (!quiz) return (
    <View style={styles.centered}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <Text style={styles.emoji}>🤷</Text>
      <Text style={styles.completionTitle}>{i18n.t('no_quiz')}</Text>
      <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (allAnswered) {
    return (
      <View style={styles.centered}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} />
        <Text style={styles.emoji}>{isWaitingForPartner ? '🧠' : '🏆'}</Text>
        <AppCard style={styles.completionCard}>
          <Text style={styles.completionTitle}>
            {isWaitingForPartner ? i18n.t('waiting_match') : i18n.t('compat_revealed')}
          </Text>
          {!isWaitingForPartner && (
            <Text style={styles.scoreEarned}>{i18n.t('percent_compatible', { pct: compatibility })}</Text>
          )}
          {/* Only known right after this session's own submission (submit.data) —
              a remount that finds hasResponded already true via the status
              query has no reliable value to show, so the line is omitted
              rather than displaying a guessed/stale number. */}
          {awarded > 0 && <Text style={styles.completionSub}>{i18n.t('xp_earned', { points: awarded })}</Text>}
        </AppCard>
        {isWaitingForPartner && <Spinner color="$gold" />}
        <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
        {droppedItem && dropToastVisible && (
          <LootToast
            title={i18n.t('loot_found')}
            points={0}
            item={droppedItem}
            visible
            onDismiss={() => setDropToastVisible(false)}
          />
        )}
      </View>
    );
  }

  const q = currentQuestion;
  if (!q) return null;

  function handleSelect(i: number) {
    if (selectedIndex !== null) return;
    setSelectedIndex(i);
    setToastVisible(true);
    submitAnswer(q!.id, q!.options[i]);
  }

  function handleDismissFailure() {
    setFailedAlert(false);
    clearSubmitError();
  }

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={`🧠 ${quiz.title}`} />

      <View style={styles.body}>
        <View style={styles.progressBar}>
          {quiz.questions.map((_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, { backgroundColor: i < answeredCount ? COLORS.gold : COLORS.bronze }]}
            />
          ))}
        </View>

        <AppCard style={styles.questionCard}>
          <Text style={styles.questionMeta}>{i18n.t('question_of', { n: answeredCount + 1, total: quiz.questions.length })}</Text>
          <Text style={styles.questionText}>{q.text}</Text>
        </AppCard>

        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const isSelected = selectedIndex === i;
            return (
              <TouchableOpacity
                key={i}
                disabled={selectedIndex !== null}
                onPress={() => handleSelect(i)}
                style={[styles.option, isSelected ? styles.optionSelected : styles.optionDefault]}
              >
                <Text style={[styles.optionText, isSelected ? styles.optionTextSelected : styles.optionTextDefault]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
    backgroundColor: COLORS.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  questionCard: {
    marginBottom: 24,
  },
  questionMeta: {
    color: COLORS.textDim,
    fontSize: 13,
    fontFamily: FONTS.body,
    marginBottom: 10,
  },
  questionText: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: FONTS.bodyBold,
    lineHeight: 30,
    textAlign: 'center',
  },
  options: {
    gap: 12,
    marginTop: 'auto',
  },
  option: {
    borderWidth: 1,
    borderTopColor: 'rgba(245,168,60,0.35)',
    borderRadius: RADIUS.sm,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optionDefault: {
    backgroundColor: COLORS.panelRaised,
    borderLeftColor: COLORS.bronze,
    borderRightColor: COLORS.bronze,
    borderBottomColor: COLORS.bronze,
  },
  optionSelected: {
    backgroundColor: 'rgba(217,127,31,0.2)',
    borderLeftColor: COLORS.gold,
    borderRightColor: COLORS.gold,
    borderBottomColor: COLORS.gold,
  },
  optionText: {
    fontSize: 16,
    fontFamily: FONTS.bodyMedium,
    textAlign: 'center',
  },
  optionTextDefault: {
    color: COLORS.text,
  },
  optionTextSelected: {
    color: COLORS.goldBright,
  },
  emoji: {
    fontSize: 48,
  },
  completionCard: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
    width: '100%',
  },
  completionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  scoreEarned: {
    color: COLORS.gold,
    fontSize: 20,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  completionSub: {
    color: COLORS.textDim,
    fontSize: 14,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
});
