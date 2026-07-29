import { HashRouter } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AppRoutes } from "./routes";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./shared/components/Toast";
import { ConfirmProvider } from "./shared/components/ConfirmDialog";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import { NetworkStatus } from "./shared/components/NetworkStatus";
import { DesktopShellBanner } from "./shared/components/DesktopShellBanner";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NetworkStatus />
        <AppProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                <div className="p-3 sm:p-4">
                  <DesktopShellBanner />
                </div>
                <HashRouter>
                  <AppRoutes />
                </HashRouter>
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
