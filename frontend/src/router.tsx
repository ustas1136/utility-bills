import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/PublicOnlyRoute";
import { ChargeDetailPage } from "@/pages/ChargeDetailPage";
import { ChargesPage } from "@/pages/ChargesPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { MeterDetailPage } from "@/pages/MeterDetailPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { PropertyDetailPage } from "@/pages/PropertyDetailPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "properties", element: <PropertiesPage /> },
          { path: "properties/:id", element: <PropertyDetailPage /> },
          { path: "meters/:id", element: <MeterDetailPage /> },
          { path: "charges", element: <ChargesPage /> },
          { path: "charges/:id", element: <ChargeDetailPage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);