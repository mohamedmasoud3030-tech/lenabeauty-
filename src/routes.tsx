import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import Layout from "./ui/layout/Layout";
import { RequireAdmin, RequireAuth } from "./route-guards";
import { PageLoader } from "./shared/components/PageLoader";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PosInvoicesPage = lazy(() => import("./pages/PosInvoicesPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsSettingsPage = lazy(() => import("./pages/NotificationsSettingsPage"));

// صفحات الموظفين والحضور
const PayrollPageEnhanced = lazy(() => import("./pages/PayrollPageEnhanced"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const AdvancesPage = lazy(() => import("./pages/AdvancesPage"));
const StaffAnalyticsPage = lazy(() => import("./pages/StaffAnalyticsPage"));

// صفحات الإعدادات المتقدمة
const BrandingSettingsPage = lazy(() => import("./pages/BrandingSettingsPage"));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/pos" element={<Suspense fallback={<PageLoader />}><PosInvoicesPage /></Suspense>} />
          <Route path="/services" element={<Suspense fallback={<PageLoader />}><ServicesPage /></Suspense>} />
          <Route path="/appointments" element={<Suspense fallback={<PageLoader />}><AppointmentsPage /></Suspense>} />
          <Route path="/customers" element={<Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>} />
          <Route path="/employees" element={<Suspense fallback={<PageLoader />}><EmployeesPage /></Suspense>} />
          <Route path="/inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />
          <Route path="/expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />

          {/* صفحات الموظفين */}
          <Route path="/payroll" element={<Suspense fallback={<PageLoader />}><PayrollPageEnhanced /></Suspense>} />
          <Route path="/attendance" element={<Suspense fallback={<PageLoader />}><AttendancePage /></Suspense>} />
          <Route path="/advances" element={<Suspense fallback={<PageLoader />}><AdvancesPage /></Suspense>} />
          <Route path="/staff-analytics" element={<Suspense fallback={<PageLoader />}><StaffAnalyticsPage /></Suspense>} />

          <Route element={<RequireAdmin />}>
            <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            <Route path="/notifications" element={<Suspense fallback={<PageLoader />}><NotificationsSettingsPage /></Suspense>} />
            <Route path="/branding" element={<Suspense fallback={<PageLoader />}><BrandingSettingsPage /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
