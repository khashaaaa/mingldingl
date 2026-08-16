import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Spinner, TextArea } from 'tamagui';
import { useIcebreaker } from '../../hooks/useIcebreaker';
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

export default function IcebreakerScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const {
    question, isLoading, submitAnswer,
    hasResponded, isWaitingForPartner, isComplete, myAnswer, partnerAnswer, droppedItem,
    submitError, clearSubmitError,
  } = useIcebreaker(matchId);
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [dropToastVisible, setDropToastVisible] = useState(true);
  const [failedAlert, setFailedAlert] = useState(false);

  useEffect(() => {
    if (submitError) {
      setSelected(null);
      setFailedAlert(true);
    }
  }, [submitError]);

  if (isLoading) return (
    <View style={styles.centered}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <Spinner color="$gold" />
    </View>
  );

  if (!question) return (
    <View style={styles.centered}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <Text style={styles.emoji}>🤷</Text>
      <Text style={styles.completionTitle}>{i18n.t('no_icebreaker')}</Text>
      <GameButton variant="primary" onPress={() => router.back()}>{i18n.t('back_to_chat')}</GameButton>
    </View>
  );

  if (isComplete) {
    const isMatch = myAnswer === partnerAnswer;
    return (
      <View style={styles.centered}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} />
        <Text style={styles.emoji}>{isMatch ? '🎉' : '💬'}</Text>
        <AppCard style={styles.completionCard}>
          <Text style={styles.completionTitle}>{i18n.t('icebreaker_revealed')}</Text>
          <Text style={styles.questionText}>{question.questionText}</Text>
          <Text style={styles.matchCount}>{i18n.t('you_said', { answer: myAnswer })}</Text>
          <Text style={styles.matchCount}>{i18n.t('they_said', { answer: partnerAnswer })}</Text>
          {isMatch && <Text style={styles.ptsEarned}>{i18n.t('you_matched')}</Text>}
        </AppCard>
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

  if (hasResponded || isWaitingForPartner) {
    return (
      <View style={styles.centered}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} />
        <Spinner color="$gold" />
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
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={`⚔️ ${i18n.t('break_ice')}`} />

      <View style={styles.body}>
        <AppCard style={styles.questionCard}>
          <Text style={styles.questionText}>{question.questionText}</Text>
        </AppCard>

        {question.type === 'OpenText' ? (
          <View style={styles.textAnswerWrap}>
            <TextArea
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholder={i18n.t('icebreaker_answer_placeholder')}
              maxLength={200}
              numberOfLines={4}
              backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
              fontFamily={FONTS.body as any}
              placeholderTextColor={COLORS.textDim as any}
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

      {/* points=0: this fires the instant the answer is tapped, before the
          server round-trip resolves, so the real award (only known once
          both participants have answered) can't be shown here yet — same
          pattern already used by the quiz screen's equivalent toast. */}
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
  questionCard: {
    marginBottom: 24,
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
  textAnswerWrap: {
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
  matchCount: {
    color: COLORS.gold,
    fontSize: 16,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
  ptsEarned: {
    color: COLORS.textDim,
    fontSize: 14,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
});
