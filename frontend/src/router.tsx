import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { ChargesPage } from "@/pages/ChargesPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "properties", element: <PropertiesPage /> },
      { path: "charges", element: <ChargesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);