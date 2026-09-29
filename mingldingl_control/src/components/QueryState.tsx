import { cn } from '@/lib/utils';

export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return <p className={cn('text-muted-foreground text-sm', className)}>{label}</p>;
}

// Every failed load offers the retry: a bare "Couldn't load" left an admin reloading the whole
// page, which also threw away any filter or page number they were on.
export function LoadError({ what, onRetry, className }: { what: string; onRetry: () => unknown; className?: string }) {
  return (
    <p className={cn('text-destructive text-sm', className)}>
      Couldn't load {what}.{' '}
      <button type="button" className="underline" onClick={() => onRetry()}>
        Try again
      </button>
    </p>
  );
}
