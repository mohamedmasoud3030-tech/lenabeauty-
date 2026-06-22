import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import Layout from "./ui/layout/Layout";
import { RequireAdmin, RequireAuth } from "./route-guards";
import { PageLoader } from "./shared/components/PageLoader";

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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/pos" element={<Suspense fallback={<PageLoader />}><PosInvoicesPage /></Suspense>} />
          <Route path="/services" element={<Suspense fallback={<PageLoader />}><ServicesPage /></Suspense>} />
          <Route path="/appointments" element={<Suspense fallback={<PageLoader />}><AppointmentsPage /></Suspense>} />
          <Route path="/customers" element={<Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>} />
          <Route path="/employees" element={<Suspense fallback={<PageLoader />}><EmployeesPage /></Suspense>} />
          <Route path="/inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />
          <Route path="/expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />

          <Route element={<RequireAdmin />}>
            <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
