import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { PageLoader } from "@/components/PageLoader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/PublicOnlyRoute";

// ── Ленивые страницы ────────────────────────────────────────
// Каждая — в отдельный чанк, грузится по требованию.

const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const PropertiesPage = lazy(() =>
  import("@/pages/PropertiesPage").then((m) => ({
    default: m.PropertiesPage,
  })),
);
const PropertyDetailPage = lazy(() =>
  import("@/pages/PropertyDetailPage").then((m) => ({
    default: m.PropertyDetailPage,
  })),
);
const MeterDetailPage = lazy(() =>
  import("@/pages/MeterDetailPage").then((m) => ({
    default: m.MeterDetailPage,
  })),
);
const ChargesPage = lazy(() =>
  import("@/pages/ChargesPage").then((m) => ({ default: m.ChargesPage })),
);
const ChargeDetailPage = lazy(() =>
  import("@/pages/ChargeDetailPage").then((m) => ({
    default: m.ChargeDetailPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);
const TariffsPage = lazy(() =>
  import("@/pages/TariffsPage").then((m) => ({ default: m.TariffsPage })),
);

// Обёртка: кладёт страницу в Suspense с общим лоадером
function page(element: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: page(<LoginPage />) },
      { path: "/register", element: page(<RegisterPage />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: page(<DashboardPage />) },
          { path: "properties", element: page(<PropertiesPage />) },
          {
            path: "properties/:id",
            element: page(<PropertyDetailPage />),
          },
          { path: "meters/:id", element: page(<MeterDetailPage />) },
          { path: "charges", element: page(<ChargesPage />) },
          {
            path: "charges/:id",
            element: page(<ChargeDetailPage />),
          },
          { path: "reports", element: page(<ReportsPage />) },
          { path: "settings", element: page(<SettingsPage />) },
          { path: "*", element: page(<NotFoundPage />) },
                    { path: "charges", element: page(<ChargesPage />) },
          {
            path: "charges/:id",
            element: page(<ChargeDetailPage />),
          },
          { path: "tariffs", element: page(<TariffsPage />) },   // ← новое
          { path: "reports", element: page(<ReportsPage />) },
        ],
      },
    ],
  },
]);