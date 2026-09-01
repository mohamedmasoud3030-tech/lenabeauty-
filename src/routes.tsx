import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import Layout from "./ui/layout/Layout";
import { RequireAdmin, RequireAuth } from "./route-guards";
import { PageLoader } from "./shared/components/PageLoader";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardCompatPage"));
const ActionCenterPage = lazy(() => import("./pages/ActionCenterPage"));
const PosInvoicesPage = lazy(() => import("./pages/PosInvoicesPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage"));
const PackagesPage = lazy(() => import("./pages/PackagesPage"));
const CustomerExperiencePage = lazy(() => import("./pages/CustomerExperiencePage"));
const ForecastingPage = lazy(() => import("./pages/ForecastingPage"));
const AccountingPage = lazy(() => import("./pages/AccountingPage"));
const AdvancedAutomationPage = lazy(() => import("./pages/AdvancedAutomationPage"));

const PASSWORD_RESET_ROUTE = "/reset-password";

const PayrollPageEnhanced = lazy(() => import("./pages/PayrollPageEnhanced"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const AdvancesPage = lazy(() => import("./pages/AdvancesPage"));
const StaffAnalyticsPage = lazy(() => import("./pages/StaffAnalyticsPage"));

function NotFoundRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to="/dashboard"
      replace
      state={{ navigationNotice: "not-found", attemptedPath: location.pathname }}
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
      <Route path={PASSWORD_RESET_ROUTE} element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/action-center" element={<Suspense fallback={<PageLoader />}><ActionCenterPage /></Suspense>} />
          <Route path="/pos" element={<Suspense fallback={<PageLoader />}><PosInvoicesPage /></Suspense>} />
          <Route path="/services" element={<Suspense fallback={<PageLoader />}><ServicesPage /></Suspense>} />
          <Route path="/appointments" element={<Suspense fallback={<PageLoader />}><AppointmentsPage /></Suspense>} />
          <Route path="/customers" element={<Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>} />
          <Route path="/gift-cards" element={<Suspense fallback={<PageLoader />}><GiftCardsPage /></Suspense>} />
          <Route path="/packages" element={<Suspense fallback={<PageLoader />}><PackagesPage /></Suspense>} />
          <Route path="/inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />

          <Route element={<RequireAdmin />}>
            <Route path="/employees" element={<Suspense fallback={<PageLoader />}><EmployeesPage /></Suspense>} />
            <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            <Route path="/customer-experience" element={<Suspense fallback={<PageLoader />}><CustomerExperiencePage /></Suspense>} />
            <Route path="/forecasting" element={<Suspense fallback={<PageLoader />}><ForecastingPage /></Suspense>} />
            <Route path="/expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
            <Route path="/payroll" element={<Suspense fallback={<PageLoader />}><PayrollPageEnhanced /></Suspense>} />
            <Route path="/attendance" element={<Suspense fallback={<PageLoader />}><AttendancePage /></Suspense>} />
            <Route path="/advances" element={<Suspense fallback={<PageLoader />}><AdvancesPage /></Suspense>} />
            <Route path="/staff-analytics" element={<Suspense fallback={<PageLoader />}><StaffAnalyticsPage /></Suspense>} />
            <Route path="/accounting" element={<Suspense fallback={<PageLoader />}><AccountingPage /></Suspense>} />
            <Route path="/advanced-automation" element={<Suspense fallback={<PageLoader />}><AdvancedAutomationPage /></Suspense>} />
            <Route path="/branding" element={<Navigate to="/settings?tab=branding" replace />} />
            <Route path="/notifications" element={<Navigate to="/settings?tab=notifications" replace />} />
            <Route path="/payment-gateway" element={<Navigate to="/settings?tab=payments" replace />} />
          </Route>

          <Route path="*" element={<NotFoundRedirect />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
