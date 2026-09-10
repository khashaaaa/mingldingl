import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../../lib/api/apiClient';
import { getApiErrorMessage } from '../../lib/api/errors';
import { i18n } from '../../lib/i18n';
import { REPORT_REASONS, reportReasonKey, type ReportReason } from '../../models/report';
import { COLORS, FONT_SIZES, FONTS, ICON_SIZES, LINE, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';
import { GameButton } from '../ui/GameButton';
import { Icon } from '../ui/Icon';
import { SheetModal } from './SheetModal';
import { AlertModal } from './AlertModal';

interface Props {
  visible: boolean;
  reportedUserId: string;
  /** The conversation this came from, when there is one. Town Square reports have none. */
  matchId?: string;
  onClose: () => void;
  /** Fired once the report is filed. The reported user is blocked and the match ended by then. */
  onReported?: () => void;
}

const MAX_DETAILS = 1000;

/**
 * The one way to report someone, shared by every screen another person can be seen from. Filing a
 * report also blocks them and ends any live conversation — the engine does both in the same write,
 * so this never leaves a reported person able to keep messaging while the queue is worked.
 */
export function ReportUserSheet({ visible, reportedUserId, matchId, onClose, onReported }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function reset() {
    setReason(null);
    setDetails('');
    setSubmitting(false);
  }

  async function submit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.reports.create(reportedUserId, reason, details.trim() || undefined, matchId);
      reset();
      onClose();
      setSent(true);
      onReported?.();
    } catch (err) {
      setSubmitting(false);
      setFailure(getApiErrorMessage(err, i18n.t('report_failed_body')));
    }
  }

  return (
    <>
      <SheetModal
        visible={visible}
        onClose={() => { reset(); onClose(); }}
      >
        <Text style={styles.title}>{i18n.t('report_sheet_title')}</Text>
        <Text style={styles.intro}>{i18n.t('report_sheet_intro')}</Text>

        <ScrollView style={styles.reasons} keyboardShouldPersistTaps="handled">
          {REPORT_REASONS.map((option) => {
            const selected = reason === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.reason, selected && styles.reasonSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setReason(option)}
              >
                <Icon
                  name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                  size={ICON_SIZES.sm}
                  color={selected ? COLORS.gold : COLORS.textDim}
                />
                <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                  {i18n.t(reportReasonKey(option))}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.detailsLabel}>{i18n.t('report_details_label')}</Text>
        <TextInput
          style={styles.details}
          value={details}
          onChangeText={setDetails}
          placeholder={i18n.t('report_details_placeholder')}
          placeholderTextColor={COLORS.textDim}
          multiline
          maxLength={MAX_DETAILS}
          accessibilityLabel={i18n.t('report_details_label')}
        />

        <GameButton
          variant="danger"
          icon="flag"
          disabled={!reason || submitting}
          loading={submitting}
          onPress={submit}
        >
          {i18n.t('report_submit')}
        </GameButton>
        <GameButton variant="ghost" onPress={() => { reset(); onClose(); }}>
          {i18n.t('back')}
        </GameButton>
      </SheetModal>

      <AlertModal
        visible={sent}
        title={i18n.t('report_sent_title')}
        message={i18n.t('report_sent_body')}
        onDismiss={() => setSent(false)}
      />

      <AlertModal
        visible={failure !== null}
        tone="warning"
        title={i18n.t('report_failed_title')}
        message={failure ?? ''}
        onDismiss={() => setFailure(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: COLORS.gold,
    textAlign: 'center', marginBottom: SPACE.xs,
  },
  intro: {
    fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim,
    lineHeight: LINE_HEIGHTS.md, textAlign: 'center', marginBottom: SPACE.md,
  },
  reasons: { maxHeight: 260, alignSelf: 'stretch' },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonSelected: { borderColor: LINE.edge, backgroundColor: COLORS.panel },
  reasonLabel: {
    fontFamily: FONTS.body, fontSize: FONT_SIZES.md, lineHeight: LINE_HEIGHTS.md,
    color: COLORS.textDim, flexShrink: 1,
  },
  reasonLabelSelected: { color: COLORS.text },
  detailsLabel: {
    fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, lineHeight: LINE_HEIGHTS.xs,
    color: COLORS.textDim, alignSelf: 'flex-start', marginTop: SPACE.md,
  },
  details: {
    alignSelf: 'stretch',
    minHeight: 72,
    marginTop: SPACE.xs,
    marginBottom: SPACE.md,
    padding: SPACE.sm,
    borderWidth: 1,
    borderColor: LINE.edge,
    borderRadius: RADIUS.sm,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.md,
    textAlignVertical: 'top',
  },
});
