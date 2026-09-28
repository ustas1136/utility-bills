import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query";
import { router } from "@/router";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}