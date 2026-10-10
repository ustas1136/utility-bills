import { useState } from "react";

/**
 * Декоративный фон сплэш-экранов: числа и символы, медленно всплывающие снизу
 * вверх. Только LoginPage и RegisterPage — пустые маркетинговые экраны, где нет
 * контента, которому фон может помешать.
 *
 * Сознательное исключение из Netvision 2.1: §1 («нейтральная основа») и §9
 * («исключение — причину и владельцу»). Причина и владелец зафиксированы в
 * docs/DESIGN.md. §5 запрещает декоративные градиенты и тяжёлые тени — фон их
 * не использует.
 *
 * Правила безопасности для декоративного слоя (§7):
 * - `aria-hidden` — слой отсутствует в дереве доступности целиком;
 * - `pointer-events: none` — не перехватывает клики и фокус;
 * - `z-index: 0` и размещение до контента — контент всегда сверху;
 * - анимация только `transform`/`opacity`, гасится `prefers-reduced-motion`
 *   в `index.css`.
 *
 * Паспорт компонента: декоративный фон, без пропсов кроме `count`, без
 * состояния-данных и без запросов.
 */

const SYMBOLS = [
  "₽", "$", "€", "₸",
  "kWh", "м³", "Гкал",
  "5.45", "8.20", "100.00", "1 234.56", "2 380.50",
  "500 ₽", "1 200 ₽", "3 800 ₽",
];

/**
 * Базовая прозрачность. Оба конца анимации заданы в кейфреймах `float-up`
 * (`index.css`): 0.03 → 0.06. Инлайн-значение здесь — то, что отрисуется,
 * если анимация отключена системной настройкой `prefers-reduced-motion`.
 */
const OPACITY_START = 0.03;

interface FloatingNumber {
  id: number;
  text: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}

export function FloatingNumbers({ count = 28 }: { count?: number }) {
  /*
   * Позиции, размеры и тайминги случайны, но обязаны быть вычислены ровно один
   * раз: иначе каждый ререндер формы пересобирал бы слой и фон «прыгал».
   *
   * Lazy-инициализатор `useState`, а не `useMemo` из наброска: `Math.random()`
   * — нечистая функция, и правило `react-hooks/purity` (ошибка в этом репо)
   * обоснованно её запрещает в теле рендера. `useMemo` здесь вдобавок не даёт
   * нужной гарантии: React вправе сбросить кэш и пересчитать значение в любой
   * момент, а ленивый инициализатор выполняется один раз за жизнь компонента.
   * Внешнее поведение при этом ровно то, которое требовалось.
   */
  const [items] = useState<FloatingNumber[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      text: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      left: Math.random() * 100,
      top: 60 + Math.random() * 40, // старт в нижней части экрана
      size: 12 + Math.random() * 6, // 12–18 px
      delay: Math.random() * 40, // 0–40 s
      duration: 40 + Math.random() * 20, // 40–60 s
    })),
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {items.map((item) => (
        <span
          key={item.id}
          /*
           * Цвет — токен, а не `text-primary-foreground` из наброска: сплэш
           * состоит из двух колонок, и белые цифры на светлом фоне колонки с
           * формой дали бы контраст 1:1. `text-foreground` читается во всех
           * трёх темах, а невидимость обеспечивает прозрачность 0.03–0.06.
           */
          className="absolute font-mono text-foreground select-none"
          style={{
            left: `${item.left}%`,
            top: `${item.top}%`,
            fontSize: `${item.size}px`,
            opacity: OPACITY_START,
            animation: `float-up ${item.duration}s ${item.delay}s linear infinite`,
          }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}
