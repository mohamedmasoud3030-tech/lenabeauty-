import { HashRouter } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AppRoutes } from "./routes";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./shared/components/Toast";
import { ConfirmProvider } from "./shared/components/ConfirmDialog";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import { NetworkStatus } from "./shared/components/NetworkStatus";
import { PwaUpdatePrompt } from "./shared/components/PwaUpdatePrompt";

// Global CSS is owned solely by src/main.tsx (see the cascade-order contract
// documented there). This component must not import stylesheets.

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NetworkStatus />
        <PwaUpdatePrompt />
        <AppProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
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
