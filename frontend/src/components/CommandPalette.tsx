import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Receipt,
  Settings,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { propertiesApi } from "@/api/properties";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useThemeStore } from "@/hooks/use-theme";
import { useAuthStore } from "@/store/auth";
import { PROPERTY_ICONS, PROPERTY_LABELS } from "@/lib/property";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useThemeStore();
  const [search, setSearch] = useState("");

  // Сбрасываем поиск при закрытии
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const properties = useQuery({
    queryKey: ["properties", "for-palette"],
    queryFn: () => propertiesApi.list(),
    enabled: open,
  });

  const run = (action: () => void) => {
    onOpenChange(false);
    // Небольшая задержка, чтобы диалог закрылся и потом произошла навигация
    setTimeout(action, 100);
  };

  // Фильтрация объектов по строке поиска
  const filteredProperties = (properties.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Команда или объект..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>

        <CommandGroup heading="Навигация">
          <CommandItem onSelect={() => run(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 size-4" />
            <span>Дашборд</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/properties"))}>
            <Building2 className="mr-2 size-4" />
            <span>Объекты</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/charges"))}>
            <Receipt className="mr-2 size-4" />
            <span>Платежи</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/reports"))}>
            <BarChart3 className="mr-2 size-4" />
            <span>Отчёты</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/settings"))}>
            <Settings className="mr-2 size-4" />
            <span>Настройки</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Действия">
          <CommandItem
            onSelect={() => run(() => navigate("/properties?new=1"))}
          >
            <Plus className="mr-2 size-4" />
            <span>Новый объект</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => navigate("/charges?new=1"))}
          >
            <Plus className="mr-2 size-4" />
            <span>Новое начисление</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() =>
                setTheme(theme === "dark" ? "light" : "dark"),
              )
            }
          >
            {theme === "dark" ? (
              <Sun className="mr-2 size-4" />
            ) : (
              <Moon className="mr-2 size-4" />
            )}
            <span>
              Переключить тему на{" "}
              {theme === "dark" ? "светлую" : "тёмную"}
            </span>
            <CommandShortcut>⌘⇧L</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {filteredProperties.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Объекты">
              {filteredProperties.slice(0, 8).map((p) => {
                const Icon = PROPERTY_ICONS[p.type];
                return (
                  <CommandItem
                    key={p.id}
                    onSelect={() =>
                      run(() => navigate(`/properties/${p.id}`))
                    }
                  >
                    <Icon className="mr-2 size-4" />
                    <span>{p.name}</span>
                    <CommandShortcut>
                      {PROPERTY_LABELS[p.type]}
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Аккаунт">
          <CommandItem
            onSelect={() =>
              run(() => {
                logout();
                navigate("/login");
              })
            }
          >
            <LogOut className="mr-2 size-4" />
            <span>Выйти</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}