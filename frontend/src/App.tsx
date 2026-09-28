import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useBootstrapAuth } from "@/hooks/use-bootstrap-auth";
import { queryClient } from "@/lib/query";
import { router } from "@/router";

function BootstrapGate({ children }: { children: ReactNode }) {
  const ready = useBootstrapAuth();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BootstrapGate>
          <RouterProvider router={router} />
        </BootstrapGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}