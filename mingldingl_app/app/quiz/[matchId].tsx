import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
import { COLORS, FILL, FONTS, FONT_SIZES, RADIUS, SPACE, tint } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function QuizScreen() {
  useLocaleStore((s) => s.locale);
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const {
    quiz, isLoading, isLoadError, refetchQuiz, currentQuestion, answeredCount,
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

  if (isLoadError) return (
    <View style={styles.centered}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <Icon name="wifi-off" size={32} color={COLORS.bronze} />
      <Text style={styles.completionTitle}>{i18n.t('quiz_load_error')}</Text>
      <GameButton variant="primary" onPress={() => refetchQuiz()}>{i18n.t('retry')}</GameButton>
      <GameButton variant="ghost" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (!quiz) return (
    <View style={styles.centered}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <Icon name="help-circle-outline" size={32} color={COLORS.bronze} />
      <Text style={styles.completionTitle}>{i18n.t('no_quiz')}</Text>
      <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (allAnswered) {
    return (
      <View style={styles.centered}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} />
        <Icon name={isWaitingForPartner ? 'brain' : 'trophy'} size={32} color={COLORS.gold} />
        <AppCard style={styles.completionCard}>
          <Text style={styles.completionTitle}>
            {isWaitingForPartner ? i18n.t('waiting_match') : i18n.t('compat_revealed')}
          </Text>
          {!isWaitingForPartner && (
            <Text style={styles.scoreEarned}>{i18n.t('percent_compatible', { pct: compatibility })}</Text>
          )}
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
      <ScreenHeader title={quiz.title} />

      <View style={styles.body}>
        <View style={styles.progressBar}>
          {quiz.questions.map((_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, { backgroundColor: i < answeredCount ? COLORS.gold : COLORS.bronze }]}
            />
          ))}
        </View>

        {/* Long questions and long Mongolian options overflowed a fixed-height body with no
            way to reach the answers below the fold. */}
        <ScrollView contentContainerStyle={styles.bodyScroll} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
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
    paddingHorizontal: SPACE.gutter,
  },
  bodyScroll: { paddingBottom: SPACE.xxl, flexGrow: 1 },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
    gap: SPACE.lg,
  },
  progressBar: {
    flexDirection: 'row',
    gap: SPACE.xs,
    marginBottom: SPACE.xl,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: RADIUS.pill,
  },
  questionCard: {
    marginBottom: SPACE.xxl,
  },
  questionMeta: {
    color: COLORS.textDim,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
    marginBottom: SPACE.md,
  },
  questionText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.bodyBold,
    lineHeight: 30,
    textAlign: 'center',
  },
  options: {
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
    borderLeftColor: COLORS.bronze,
    borderRightColor: COLORS.bronze,
    borderBottomColor: COLORS.bronze,
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
  scoreEarned: {
    color: COLORS.gold,
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  completionSub: {
    color: COLORS.textDim,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
});
