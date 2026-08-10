import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logger } from '../logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * When this value changes (e.g. the current route path), the boundary
   * automatically clears its error state so navigating away from a crashed
   * screen recovers the shell without a full reload.
   */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  reportId: string | null;
}

/**
 * Short, non-sensitive correlation id shown to users so support can match
 * a report to developer logs. This is NOT a security token — it only needs
 * to be unique enough to correlate, so a monotonic timestamp + counter is
 * used instead of a pseudorandom generator (which SonarCloud flags as a
 * security hotspot). Crypto.getRandomValues is preferred when available.
 */
let reportCounter = 0;
function createReportId(): string {
  // Crypto is available in all supported browsers and in the jsdom test env.
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  // Deterministic fallback: monotonic timestamp + in-process counter.
  // No Math.random() — avoids the insecure-prng security hotspot entirely.
  reportCounter += 1;
  const time = Date.now().toString(16).padStart(8, '0');
  const count = reportCounter.toString(16).padStart(4, '0');
  return `${time}${count}`.toUpperCase().slice(-12);
}

/**
 * Reduce a raw error to a short, non-sensitive fingerprint for logs only.
 * Strips message text from the user-facing surface while keeping enough
 * context (name + first 8 chars of a hash of the message) for developers.
 */
function fingerprint(error: Error): { name: string; digest: string } {
  const name = error?.name || 'Error';
  const raw = error?.message || '';
  let digest = '00000000';
  try {
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      // eslint-disable-next-line no-bitwise
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    digest = (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    digest = '00000000';
  }
  return { name, digest };
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, reportId: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, reportId: createReportId() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Developer-only diagnostics. The raw message/stack never reaches the UI.
    // No customer data is logged here — only the error fingerprint + route.
    const { name, digest } = fingerprint(error);
    logger.error('ErrorBoundary caught', {
      name,
      digest,
      reportId: this.state.reportId,
      route: typeof location !== 'undefined' ? location.pathname : undefined,
      componentStack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, reportId: null });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, reportId: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          reportId={this.state.reportId}
          onReset={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({
  reportId,
  onReset,
}: {
  reportId: string | null;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  const goHome = () => {
    // Soft-retry the boundary first so the shell can recover, then navigate.
    onReset();
    if (typeof window !== 'undefined') {
      // HashRouter lives under #/, so send the user to the dashboard route.
      window.location.hash = '#/dashboard';
    }
  };

  return (
    <div
      role="alert"
      className="w-full min-h-[60vh] flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card shadow-sm overflow-hidden">
        <div className="bg-destructive/5 border-b border-destructive/15 px-5 py-5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-base font-bold text-foreground">{t('Something went wrong')}</h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('An unexpected error occurred. Try refreshing the page or contact support if the problem persists.')}
          </p>

          {reportId && (
            <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t('Report ID')}
              </p>
              <p className="text-xs font-mono text-foreground mt-0.5 break-all">{reportId}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('If the problem persists, contact support with this number.')}
              </p>
            </div>
          )}

          {/* One retry action + one navigation recovery action — no duplicates. */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={goHome}
              className="h-11 rounded-xl border border-border bg-card font-bold text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              {t('Back to Dashboard')}
            </button>
            <button
              type="button"
              onClick={() => {
                onReset();
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('Reload Page')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
