import { ScoreHUD } from '../progression/ScoreHUD';
import { HeaderBar } from './HeaderBar';
import { useScoreDetail } from '../../hooks/useScoreDetail';

interface Props {
  title: string;
  showScore?: boolean;
  onBack?: () => void;
  showBack?: boolean;
}

export function GameHeader({ title, showScore = false, onBack, showBack = false }: Props) {
  const { data: scoreDetail } = useScoreDetail();
  return (
    <HeaderBar
      title={title}
      showBack={showBack}
      onBack={onBack}
      right={showScore && scoreDetail ? (
        <ScoreHUD score={scoreDetail.totalScore ?? 0} tier={(scoreDetail.gemTier ?? undefined) as string | undefined} streak={scoreDetail.currentStreak} />
      ) : undefined}
    />
  );
}
