import { HashRouter } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AppRoutes } from "./routes";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./shared/components/Toast";
import { NotificationServiceProvider } from "./shared/hooks/useNotificationService";
import { ConfirmProvider } from "./shared/components/ConfirmDialog";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import { NetworkStatus } from "./shared/components/NetworkStatus";
import { PwaUpdatePrompt } from "./shared/components/PwaUpdatePrompt";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NetworkStatus />
        <PwaUpdatePrompt />
        <AppProvider>
          <AuthProvider>
            <ToastProvider>
              <NotificationServiceProvider>
                <ConfirmProvider>
                <HashRouter>
                  <AppRoutes />
                </HashRouter>
                </ConfirmProvider>
              </NotificationServiceProvider>
            </ToastProvider>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
