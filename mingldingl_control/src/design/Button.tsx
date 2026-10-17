import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { art } from './art';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'brass' | 'outline' | 'quiet' };

export function Button({ kind = 'outline', className, style, ...rest }: Props) {
  const brass = kind === 'brass' ? ({ '--brass': `url(${art.brass})`, ...style } as CSSProperties) : style;
  return (
    <button
      type="button"
      {...rest}
      className={['btn', kind !== 'outline' && `btn-${kind}`, className].filter(Boolean).join(' ')}
      style={brass}
    />
  );
}
