import { Outlet } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 px-4 lg:px-8 py-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}