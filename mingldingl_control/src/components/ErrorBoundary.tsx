import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            This page hit an unexpected error and couldn't render. Reloading usually fixes it.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
