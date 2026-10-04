import { ScoreHUD } from '../progression/ScoreHUD';
import { HeaderBar } from './HeaderBar';
import { Tap } from './Tap';
import { useScoreDetail } from '../../hooks/useScoreDetail';
import { useGoTo } from '../../hooks/useGoTo';
import { i18n } from '../../lib/i18n';
import { SPACE } from '../../lib/theme';

interface Props {
  title: string;
}

/** The badge is small; the tap reaches a little past it so a thumb need not aim. */
const HIT_SLOP = { top: SPACE.sm, bottom: SPACE.sm, left: SPACE.sm, right: SPACE.sm };

/** A tab's header: no way back (a tab is a root), and the points badge where a stack screen has its control. */
export function GameHeader({ title }: Props) {
  const { data: scoreDetail } = useScoreDetail();
  const go = useGoTo();
  const score = scoreDetail?.totalScore ?? 0;
  return (
    <HeaderBar
      title={title}
      showBack={false}
      right={scoreDetail ? (
        // The points open The Ascent, where they are explained: tier, the next stone, the deeds.
        <Tap
          testID="score-hud-link"
          onPress={() => go('/progression')}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('score_hud_open', { score: score.toLocaleString() })}
        >
          <ScoreHUD score={score} tier={(scoreDetail.gemTier ?? undefined) as string | undefined} streak={scoreDetail.currentStreak} />
        </Tap>
      ) : undefined}
    />
  );
}
