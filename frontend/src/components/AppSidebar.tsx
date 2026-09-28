import {
  BarChart3,
  Building2,
  LayoutDashboard,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard, end: true },
  { to: "/properties", label: "Объекты", icon: Building2 },
  { to: "/charges", label: "Платежи", icon: Receipt },
  { to: "/reports", label: "Отчёты", icon: BarChart3 },
  { to: "/settings", label: "Настройки", icon: Settings },
];

export function AppSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r bg-card">
      <div className="h-16 flex items-center gap-2 px-6 border-b">
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
          <Wallet className="size-5" />
        </div>
        <span className="font-semibold">Utility Bills</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t text-xs text-muted-foreground">
        v0.1.0 · personal project
      </div>
    </aside>
  );
}