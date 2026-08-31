import type { ReactNode } from 'react';
import { HeaderBar } from './HeaderBar';

interface Props {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: Props) {
  return <HeaderBar title={title} onBack={onBack} right={right} />;
}
