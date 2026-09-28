import { Bell, LogOut, Search, User } from "lucide-react";
import { Link } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth";

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center gap-3 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 lg:px-6">
      <div className="lg:hidden flex items-center gap-2">
        <div className="size-7 rounded-md bg-primary" />
        <span className="font-semibold text-sm">Utility Bills</span>
      </div>

      <button className="hidden md:flex items-center gap-2 px-3 h-9 min-w-72 rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted transition-colors">
        <Search className="size-4" />
        Поиск
        <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <Bell className="size-5" />
          </Link>
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium">
                {user?.full_name ?? "Профиль"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.email ?? "не авторизован"}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <User className="mr-2 size-4" />
                Настройки
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}