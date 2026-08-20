/**
 * NotificationServiceProvider — provides the app-wide notification service
 * wired to the real toast channel.
 */

import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { NotificationService } from "../../domain/notification";
import { createNotificationService } from "../../infrastructure/notification";
import { useToast } from "../components/Toast";
import { useTranslation } from "react-i18next";

const NotificationServiceContext = createContext<NotificationService | null>(null);

export function NotificationServiceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { showToast } = useToast();
  const { i18n } = useTranslation();

  const service = useMemo(
    () =>
      createNotificationService({
        showToast: (title, message, level) => showToast(level ?? "info", title, message),
        getLanguage: () => (i18n.language === "ar" ? "ar" : "en"),
        testMode: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <NotificationServiceContext.Provider value={service}>
      {children}
    </NotificationServiceContext.Provider>
  );
}

/**
 * Fallback no-op service so pages render safely even when the provider
 * is absent (e.g. isolated tests). Dispatches resolve as skipped — the
 * notification pipeline must never break a business flow.
 */
let noOpService: NotificationService | null = null;
function getNoOpService(): NotificationService {
  noOpService ??= createNotificationService({
    showToast: () => undefined,
    testMode: true,
  });
  return noOpService;
}

export function useNotificationService(): NotificationService {
  const ctx = useContext(NotificationServiceContext);
  return ctx ?? getNoOpService();
}

export default useNotificationService;
