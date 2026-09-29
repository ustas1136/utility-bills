import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";

import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/ui/sonner";
import { useGlobalHotkey } from "@/hooks/use-global-hotkey";
import { useThemeStore } from "@/hooks/use-theme";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, setTheme } = useThemeStore();

  // Ctrl+K / ⌘K — открыть палитру команд
  useGlobalHotkey({
    key: "k",
    meta: true,
    handler: useCallback(() => setPaletteOpen(true), []),
  });

  // Ctrl+Shift+L / ⌘+Shift+L — переключить тему
  useGlobalHotkey({
    key: "l",
    meta: true,
    shift: true,
    handler: useCallback(
      () => setTheme(theme === "dark" ? "light" : "dark"),
      [theme, setTheme],
    ),
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 px-4 lg:px-8 py-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}