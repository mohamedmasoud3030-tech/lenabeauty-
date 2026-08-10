import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 via-background to-background p-6">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-destructive/20 bg-card shadow-2xl overflow-hidden">
        <div className="bg-destructive/10 border-b border-destructive/20 px-10 py-8 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-destructive/20 flex items-center justify-center text-destructive shadow-inner">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-destructive">{t('Something went wrong')}</h2>
            <p className="text-[10px] font-bold text-destructive/70 uppercase tracking-widest">{t('Error')}</p>
          </div>
        </div>

        <div className="p-10 space-y-8">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('An unexpected error occurred. Try refreshing the page or contact support if the problem persists.')}
            </p>
            {error && (
              <div className="bg-muted/50 rounded-xl p-4 border border-border/50 overflow-auto max-h-[200px]">
                <code className="text-[10px] font-mono text-muted-foreground break-words">
                  {error.message}
                </code>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 group relative h-14 rounded-[1.5rem] bg-primary font-bold text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <RefreshCw className="h-5 w-5 relative z-10" />
              <span className="relative z-10">{t('Reload Page')}</span>
            </button>
            <button
              onClick={onReset}
              className="flex-1 h-14 rounded-[1.5rem] border border-border bg-card font-bold text-foreground shadow-lg hover:bg-muted transition-all"
            >
              {t('Try Again')}
            </button>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full h-12 rounded-[1.5rem] border border-border bg-muted/30 font-medium text-muted-foreground hover:bg-muted transition-all"
          >
            {t('Go Home')}
          </button>
        </div>
      </div>
    </div>
  );
}
