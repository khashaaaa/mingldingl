import { ScoreHUD } from '../progression/ScoreHUD';
import { HeaderBar } from './HeaderBar';
import type { Icon } from './Icon';
import type { GlyphName } from './Glyph';
import { useScoreDetail } from '../../hooks/useScoreDetail';

interface Props {
  title: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  glyph?: GlyphName;
  showScore?: boolean;
  onBack?: () => void;
  showBack?: boolean;
}

export function GameHeader({ title, icon, glyph, showScore = false, onBack, showBack = false }: Props) {
  const { data: scoreDetail } = useScoreDetail();
  return (
    <HeaderBar
      title={title}
      icon={icon}
      glyph={glyph}
      showBack={showBack}
      onBack={onBack}
      right={showScore && scoreDetail ? (
        <ScoreHUD score={scoreDetail.totalScore ?? 0} tier={(scoreDetail.gemTier ?? undefined) as string | undefined} streak={scoreDetail.currentStreak} />
      ) : undefined}
    />
  );
}
