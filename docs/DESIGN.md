# Utility Bills — Дизайн-система

Визуальный язык, стили и UI-компоненты приложения.

---

## Философия

1. **Сдержанность** — минимум цвета, много воздуха.
2. **Иерархия через размеры и вес** — не через яркие цвета.
3. **Плавные движения** — микроанимации, без резких переходов.

Референсы: Linear, Vercel, Notion, shadcn/ui.

---

## Цвета

Палитра — из Netvision 2.1 (`docs/Netvision_Design_Standard/tokens.json`); значения светлой, comfort и тёмной заданы в `frontend/src/index.css`. Тема переключается атрибутом `data-theme` на `<html>`.

### Базовая семантика

| Токен | light | comfort | dark |
|---|---|---|---|
| `--background` | `#f4f6f8` | `#e9e5da` | `#151c25` |
| `--foreground` | `#202c3b` | `#333b37` | `#e4eaf2` |
| `--card` / `--popover` | `#ffffff` | `#f5f1e7` | `#1e2834` |
| `--muted` | `#edf1f5` | `#e6e1d5` | `#293646` |
| `--muted-foreground` | `#536274` | `#5d655d` | `#afbccd` |
| `--border` / `--input` | `#d8dfe7` | `#ccc9ba` | `#394959` |

Маппинг Netvision → shadcn: `canvas → background`, `surface → card/popover`, `soft → muted`, `text → foreground`, `line → border/input`, `muted → muted-foreground`.

### Акценты

| Токен | light / comfort | dark |
|---|---|---|
| `--primary` (emerald) | `oklch(0.55 0.17 160)` | `oklch(0.7 0.16 160)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` |
| `--accent` | `oklch(0.96 0.02 160)` | `oklch(0.28 0.04 160)` |
| `--destructive` | `oklch(0.58 0.22 20)` | `oklch(0.7 0.19 20)` |
| `--brand-panel` | `color-mix(in oklab, var(--primary) 80%, black)` | `var(--primary)` |

Emerald-акцент намеренно взят не из Netvision (там синий) — это решение проекта. Comfort наследует тот же `--primary` из `:root`. `--brand-panel` — фон брендовой панели сплэша: в светлых темах темнее `--primary`, чтобы текст проходил §7 (6.63:1), в тёмной — сам `--primary` (7.99:1).

### Статусы: парные токены

Каждый статус — пара «фон + текст», применять только вместе (Netvision §2).

| Смысл | Токены | light | comfort | dark |
|---|---|---|---|---|
| Норма | `--success` / `--success-bg` | `#246442` / `#e5f3ea` | `#345e3b` / `#e0eadb` | `#a0d7b3` / `#253c31` |
| Предупреждение | `--warning` / `--warning-bg` | `#79500c` / `#fff0d5` | `#775017` / `#efe1c2` | `#edc880` / `#403728` |
| Критическое | `--critical` / `--critical-bg` | `#a4323d` / `#fce9eb` | `#943c38` / `#eedbd6` | `#f4acb4` / `#442f39` |

Статусы начислений (`StatusBadge`): `pending` → muted, `partial` → warning, `paid` → success, `overdue` → critical, `cancelled` → muted + line-through.

### Графики

- `--chart-1` — Коммунальные
- `--chart-2` — Налоги
- `--chart-3` — Страховки
- `--chart-4` — Прочее
- `--chart-5` — Резерв

Значения различаются по темам: light/comfort — `oklch(0.62 0.17 150)`, `(0.65 0.15 240)`, `(0.7 0.15 50)`, `(0.6 0.2 310)`, `(0.65 0.18 20)`; dark — `oklch(0.7 0.16 150)`, `(0.72 0.15 240)`, `(0.75 0.15 50)`, `(0.68 0.2 310)`, `(0.72 0.18 20)`. Графики берут цвета из `CATEGORY_COLORS` (`var(--chart-N)`), хардкода HSL нет.

---

## Типографика

**Шрифт:** system-ui — стек `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Без внешних шрифтов (Netvision §3).

| Элемент | Классы | Размер |
|---|---|---|
| H1 страницы | `text-[1.75rem] leading-9 sm:text-[2rem] sm:leading-10 font-semibold tracking-tight` | 32/40 px, узкое окно 28/36 px |
| H1 сплэш-экрана (вход/регистрация) | `text-[1.75rem] leading-9 font-semibold tracking-tight` | 28/36 px |
| H2 секции | `text-lg font-semibold` | 18 px |
| H3 карточки | `text-base font-semibold` | 16 px |
| Body | `text-sm` | 14 px |
| Label | `text-xs` | 12 px |

**Правила:**
- `tabular-nums` — обязательно для чисел.
- `tracking-tight` — для H1.
- `uppercase tracking-wide text-xs text-muted-foreground` — для ярлыков.

### Соответствие Netvision 2.1 §3

- Шрифт: `system-ui`, без внешних — **соответствует**.
- H1: 32/40 px (28/36 на узком окне) — **соответствует**.
- H2: 18/27 px — **соответствует**.

---

## Радиусы, тени и размеры контролов

Компонентные токены Netvision (§11):

| Токен | Значение | Применение |
|---|---|---|
| `--radius-control` | 12 px | Кнопки, input, select-триггер |
| `--radius-popup` | 12 px | Панели: dropdown, select, popover, dialog, палитра |
| `--radius-option` | 6 px | Пункт списка, статус-бейдж |
| `--control-height` | 2.75rem (44 px) | Input, Select-триггер, Button `default` |
| `--option-min-height` | 2.75rem (44 px) | Минимальная высота пункта панели |
| `--popup-padding` | 6 px | Отступ панели |
| `--popup-gap` | 8 px | Зазор внутри панели |
| `--popup-max-height` | 320 px | Предел высоты панели (внутренняя прокрутка) |
| `--popup-shadow` | `0 8px 24px rgb(0 0 0 / 0.12)` | Тень перекрывающего слоя |

Шкала shadcn (`--radius` 12 px → `--radius-sm` 8, `--radius-md` 10, `--radius-lg` 12, `--radius-xl` 16) сохранена для легаси-примитивов `ui/*`; в новом коде использовать токены выше.

**Тени:** только у перекрывающих слоёв (`--popup-shadow`), карточки без теней. Фокус у shadcn-примитивов — `ring-[3px] ring-ring/50`.

---

## Spacing и сетка

| Контекст | Отступ |
|---|---|
| Padding страницы | `px-4` / `px-8` |
| Padding карточки | `p-5` |
| Зазор между секциями | `space-y-6` |
| Зазор между карточками | `gap-4` |

**Сетки:**
- KPI: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- Графики: `grid-cols-1 lg:grid-cols-3 gap-4`
- Объекты: `grid-cols-1 md:grid-cols-2 gap-3`
- Быстрые действия: `grid-cols-2 lg:grid-cols-4 gap-3`

**Максимальная ширина:** `max-w-7xl mx-auto` (1280 px).

---

## Компоненты

### Button

Варианты: `default` / `outline` / `ghost` / `destructive` / `link`.
Размеры: `default` → `h-[var(--control-height)]` (44 px), `sm` (h-8), `xs` (h-6), `lg` (h-10), `icon` (size-9). Радиус у всех — `rounded-[var(--radius-control)]`.

Иконка слева: `<Plus className="size-4 mr-2" />`.

### Input / Select

- `Input` → `h-[var(--control-height)]` (44 px), `rounded-[var(--radius-control)]`.
- `SelectTrigger` → 44 px в размере `default`, `h-8` в `sm`, `rounded-[var(--radius-control)]`.
- Кнопки в одной строке с полем — тоже 44 px: иначе разъезжаются нижние края (§4).

### Card

Структура: `Card` → `CardHeader` → `CardTitle` (text-base) → `CardContent`.
Padding `p-5`, border 1 px, без тени.

### Формы

React Hook Form + Zod + shadcn Form.
- Label сверху, опциональные — с `(опц.)`.
- Ошибки под полем, `text-destructive text-xs`.
- Кнопки: «Отмена» слева, «Сохранить» справа.

### Dialog

- `sm:max-w-md` — обычные, `sm:max-w-lg` — формы с двумя колонками
- Радиус `--radius-popup`, тень `--popup-shadow`; паддинг `p-6` и `gap-4` — свои, `max-height` не ограничивается (формы выше 320 px).

### Раскрывающиеся панели (dropdown / select / popover / палитра)

- Радиус `--radius-popup`, тень `--popup-shadow`, отступ панели `--popup-padding`.
- Пункт: `rounded-[var(--radius-option)]`, не ниже `--option-min-height` (44 px).
- `--popup-max-height` 320 px с внутренней прокруткой. У `select` предел живёт на вьюпорте: Radix ставит на контент inline `max-height`, который класс не перебьёт. Высоту вьюпорта **не** привязывать к высоте триггера — иначе видно один пункт.
- Палитра Ctrl+K: те же токены плюс `[&_[cmdk-input]]:h-[var(--control-height)]` и `[&_[cmdk-group]]:px-[var(--popup-padding)]`.

### StatusBadge

`rounded-[var(--radius-option)]` (6 px) + парные токены статуса, `border-transparent`. Там, где сущность не из словаря начислений (статус приглашения, статус счётчика), применять прямые токены: словарь `StatusBadge` описывает только `pending/partial/paid/overdue/cancelled`.

### EmptyState

Иконка `size-6` в квадрате muted + заголовок `font-medium` + описание + опциональная CTA-кнопка.

### Skeleton

KPI `h-28` · Список `h-14` × 3–4 · График `h-72` · Таблица `h-16` × 5.
Размер скелетона = размер реального контента (нет layout shift).

---

## Темы

- Три темы: `light` / `comfort` / `dark`, плюс `system` (разрешается в light/dark по настройке ОС; comfort включается только явно).
- Источник темы — атрибут `data-theme` на `<html>`. Класс `.dark` сохранён как алиас для обратной совместимости.
- Zustand + persist в `localStorage` (`utility-bills-theme`); inline-скрипт в `index.html` ставит тему до первой отрисовки, чтобы не было вспышки.
- `color-scheme: light` / `dark` — нативные чекбоксы, скроллбары и автозаполнение следуют теме (§11).
- Палитры light/comfort — из Netvision, тёмная — отдельная палитра, не «инверсия». Не чистый чёрный: `#151c25`.
- Графики адаптируются через `var(--chart-*)`.

---

## Адаптивность

| Breakpoint | Что меняется |
|---|---|
| `sm` (640) | KPI 2-в-ряд |
| `md` (768) | Появляется поиск, 2-колоночные списки |
| `lg` (1024) | Sidebar вместо bottom-nav, KPI 4-в-ряд |
| `xl` (1280) | Максимальная ширина |

- ≥ lg: sidebar слева (w-64).
- < lg: bottom-nav снизу (4 иконки).
- `pb-24 lg:pb-8` — не уходить под bottom-nav.

---

## Анимации

Duration: 150–200 мс hover, 250 мс появление.
Анимируем: `background-color`, `color`, `border-color`, `opacity`, `transform`.

Тосты (sonner): top-right, автоскрытие 4 сек, максимум 2.

---

## Иконки (lucide-react)

| Размер | Применение |
|---|---|
| `size-3` | Badges, meta |
| `size-4` | Кнопки, nav |
| `size-5` | Header, KPI |
| `size-6` | EmptyState |
| `size-8` | Декоративные |

Только outline, не filled.

---

## Do's and Don'ts

**Правильно:**
- `tabular-nums` для чисел
- `text-muted-foreground` для второстепенного
- `rounded-xl` для карточек
- `border` вместо `shadow`
- Skeleton вместо спиннера
- EmptyState с иконкой и CTA

**Неправильно:**
- Больше 3 цветов на экране
- `shadow-xl` на карточках
- Filled-иконки рядом с outline
- Кликабельные `<div>` (только `<button>` / `<Link>`)
- `!important`
- Хардкод цветов — только токены

---

## Соответствие Netvision 2.1

| § | Тема | Статус |
|---|---|---|
| §2 | Три темы, нейтральные KPI | ✅ три темы, парные статус-токены, карточки KPI нейтральные |
| §3 | Шрифты и размеры | ✅ system-ui без внешних, H1 32/28, KPI 32/28, tabular-nums |
| §4 | Единые контролы | ✅ 44 px, radius-control 12 px, кнопки в строке с полем выровнены |
| §5 | Сетка и радиусы | ✅ шаг 4 px, радиусы 12/6, без декоративных градиентов |
| §7 | Доступность | ✅ контраст сплэша 6.63/7.99, фокус на примитивах |
| §11 | Раскрывающиеся панели | ✅ popup-токены, пункты 44 px, max-height 320 px |

## Сознательные исключения

Зафиксированы комментариями в коде:

- `components/QuickActions.tsx` — 4 различимых цвета для быстрых действий (визуальный код для узнаваемости).
- `lib/property.ts` — 4 цвета для типов объектов: смысл категориальный, а не статусный (§1 запрещает цвет статуса без смысла).

## Известные долги

- `text-white` в `ui/button.tsx` и `ui/badge.tsx` (destructive-варианты) — белым по `--destructive`, который в тёмной теме светлый (`oklch(0.7 0.19 20)`); контраст под вопросом. Не входило в миграцию.
- `?new=1` из палитры команд не работает: `ChargesPage` и `PropertiesPage` не читают `searchParams`, поэтому диалог создания не открывается.

---

## Стек

Tailwind v4 · shadcn/ui · Radix UI · lucide-react · Recharts · system-ui · sonner · cmdk

---

**Дата:** Октябрь 2026
**Версия:** 0.1.0
