# Utility Bills — Дизайн-система

Визуальный язык, стили и UI-компоненты приложения.

---

## Философия

1. **Сдержанность** — минимум цвета, много воздуха.
2. **Иерархия через размеры и вес** — не через яркие цвета.
3. **Плавные движения** — микроанимации, без резких переходов.

Референсы: Linear, Vercel, Notion, shadcn/ui.

---

## Цвета (OKLCH)

### Базовая семантика

| Токен | Светлая | Тёмная |
|---|---|---|
| `--background` | `oklch(0.985 0 0)` | `oklch(0.14 0.01 260)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.96 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.18 0.015 260)` |
| `--muted` | `oklch(0.965 0.005 260)` | `oklch(0.24 0.015 260)` |
| `--muted-foreground` | `oklch(0.55 0.02 260)` | `oklch(0.7 0.02 260)` |
| `--border` | `oklch(0.92 0.005 260)` | `oklch(0.28 0.01 260)` |

### Акценты

| Токен | Светлая | Тёмная |
|---|---|---|
| `--primary` (emerald) | `oklch(0.55 0.17 160)` | `oklch(0.7 0.16 160)` |
| `--accent` | `oklch(0.96 0.02 160)` | `oklch(0.28 0.04 160)` |
| `--destructive` (rose) | `oklch(0.58 0.22 20)` | `oklch(0.7 0.19 20)` |
| `--success` | `oklch(0.62 0.17 150)` | `oklch(0.7 0.16 150)` |
| `--warning` (amber) | `oklch(0.75 0.15 70)` | `oklch(0.78 0.15 70)` |

### Графики

- `--chart-1` — Коммунальные
- `--chart-2` — Налоги
- `--chart-3` — Страховки
- `--chart-4` — Прочее
- `--chart-5` — Резерв

### Статусы

- `pending` — slate
- `partial` — amber
- `paid` — emerald
- `overdue` — rose
- `cancelled` — muted + line-through

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

## Радиусы и тени

| Токен | Значение | Применение |
|---|---|---|
| `--radius` | 12 px | Базовый |
| `--radius-sm` | 8 px | Маленькие |
| `--radius-md` | 10 px | Badges, tooltip |
| `--radius-lg` | 12 px | Кнопки, inputs |
| `--radius-xl` | 16 px | Карточки, диалоги |

**Тени:** минимальные. Focus ring `ring-2 ring-ring ring-offset-2`, Dialog `shadow-lg`, карточки без теней.

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
Размеры: `sm` (h-9) / `default` (h-10) / `lg` (h-11) / `icon` (h-10 w-10).

Иконка слева: `<Plus className="size-4 mr-2" />`.

### Card

Структура: `Card` → `CardHeader` → `CardTitle` (text-base) → `CardContent`.
Padding `p-5`, border 1 px, без тени.

### Формы

React Hook Form + Zod + shadcn Form.
- Label сверху, опциональные — с `(опц.)`.
- Ошибки под полем, `text-destructive text-xs`.
- Кнопки: «Отмена» слева, «Сохранить» справа.

### Dialog

- `sm:max-w-md` — обычные
- `sm:max-w-lg` — формы с двумя колонками

### EmptyState

Иконка `size-6` в квадрате muted + заголовок `font-medium` + описание + опциональная CTA-кнопка.

### Skeleton

KPI `h-28` · Список `h-14` × 3–4 · График `h-72` · Таблица `h-16` × 5.
Размер скелетона = размер реального контента (нет layout shift).

---

## Тёмная тема

- Три режима: light / dark / system.
- Zustand + persist в `localStorage`.
- Класс `dark` на `<html>`.
- Отдельная палитра OKLCH, не «инверсия».
- Не чистый чёрный — `oklch(0.14 0.01 260)`.
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

## Стек

Tailwind v4 · shadcn/ui · Radix UI · lucide-react · Recharts · system-ui · sonner · cmdk

---

**Дата:** Октябрь 2026
**Версия:** 0.1.0
