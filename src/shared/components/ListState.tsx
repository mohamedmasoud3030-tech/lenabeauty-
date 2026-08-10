import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ScreenState } from "./ScreenState";

interface ListStateProps {
  /** Show the loading state (e.g. `loading && rows.length === 0`). */
  loading: boolean;
  /** Error message — when set (and not loading), shows the error state. */
  error: string | null;
  /** Show the empty state when there is nothing to display. */
  empty?: boolean;
  onRetry: () => void;
  loadingTitle?: string;
  errorTitle?: string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /** When provided, renders inside a table row (desktop table lists). */
  colSpan?: number;
  compact?: boolean;
}

/**
 * ListState — the app-wide loading/error/empty pattern for data lists.
 *
 * Renders exactly one ScreenState depending on the list state, either as a
 * plain block (mobile card lists) or wrapped in a table row (desktop tables).
 * Every page uses this instead of duplicating the same ternary chain, so the
 * three states stay consistent and fully translated app-wide.
 */
export function ListState({
  loading,
  error,
  empty = false,
  onRetry,
  loadingTitle,
  errorTitle,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  colSpan,
  compact = false,
}: ListStateProps) {
  const { t } = useTranslation();

  let content: ReactNode = null;
  if (loading) {
    content = <ScreenState state="loading" title={loadingTitle || t("Loading")} compact={compact} />;
  } else if (error) {
    content = (
      <ScreenState
        state="error"
        title={errorTitle || t("Failed to load data")}
        description={t("Something went wrong while loading. Try again.")}
        actionLabel="Retry"
        onAction={onRetry}
        errorDetail={error}
        compact={compact}
      />
    );
  } else if (empty) {
    content = (
      <ScreenState
        state="empty"
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        compact={compact}
      />
    );
  }

  if (!content) return null;

  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-6 py-16 text-center">
          {content}
        </td>
      </tr>
    );
  }

  return <>{content}</>;
}

export default ListState;
