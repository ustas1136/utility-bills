Задача для DSH: Применить Netvision Design Standard 2.1 к utility-bills
Готовый task-документ. Можно сохранить как docs/NETVISION-MIGRATION.md и скармливать DSH поблочно.

Ключевое решение перед началом
Netvision — это другой подход к дизайну, не просто набор цветов:

Аспект	Netvision 2.1	Utility Bills (сейчас)
Формат цветов	hex	OKLCH
Переключение темы	data-theme на <html>	.dark class
Количество тем	3: light / comfort / dark	2: light / dark
Акцент в light	синий #245db3	emerald oklch(0.55 0.17 160)
Высота контролов	2.75 rem (44 px) единая	h-9 / h-10 / h-11
Radius	control + popup + option	sm/md/lg/xl + base
Status-цвета	парные (fg + bg)	только fg
Три стратегии миграции:

Стратегия	Что делаем	Риск
A. Полный ребрендинг	Взять все цвета Netvision, включая синий accent	Высокий — цвет бренда меняется
B. Гибрид (рекомендую)	Взять структуру (3 темы, data-theme, control/radius/popup токены, парные статусы), сохранить emerald как наш акцент	Средний
C. Добавить comfort тему	Оставить всё как есть + добавить третью тёплую тему	Низкий
По умолчанию идём по стратегии B.

Блок A. Backup
Задача для DSH (скопировать в чат)
text
Сделай полный бэкап проекта перед миграцией на Netvision Design Standard.

Шаги:

1. Убедись, что рабочее дерево чистое: git status.
   Если есть незакоммиченные изменения — останови работу 
   и сообщи мне.

2. Создай архив всего проекта вне git-репозитория:
   tar -czf ~/utility-bills-backup-$(date +%Y%m%d-%H%M).tar.gz \
       --exclude=node_modules \
       --exclude=.venv \
       --exclude=__pycache__ \
       --exclude=dist \
       --exclude=.git \
       -C ~/projects utility-bills

3. Запиши путь к архиву в отдельный файл:
   echo "$(date '+%Y-%m-%d %H:%M:%S') — backup for Netvision migration" \
     >> ~/utility-bills-backups.log
   ls -la ~/utility-bills-backup-*.tar.gz >> ~/utility-bills-backups.log

4. Создай git-ветку для миграции:
   git checkout -b netvision-migration
   git push -u origin netvision-migration

5. Создай git-тег текущего состояния (точка отката):
   git tag pre-netvision-migration
   git push origin pre-netvision-migration

6. Покажи мне:
   - ls -la ~/utility-bills-backup-*.tar.gz
   - git branch
   - git tag -l
   - git log --oneline -3

Никаких изменений в коде в этом блоке не делай.
Что должно получиться
□ Архив ~/utility-bills-backup-YYYYMMDD-HHMM.tar.gz (~5–10 MB)
□ Ветка netvision-migration создана и запушена
□ Тег pre-netvision-migration создан и запушен
□ git status — чистый
Проверка отката
Если что-то пойдёт не так:

bash
# Откат к состоянию до миграции (сохраняя текущие изменения в отдельной ветке)
git checkout main
git branch -D netvision-migration
# или полный откат:
git checkout pre-netvision-migration
git checkout -b recovery
Или из архива:

bash
cd ~/projects
rm -rf utility-bills
tar -xzf ~/utility-bills-backup-YYYYMMDD-HHMM.tar.gz
cd utility-bills
Блок B. Анализ и mapping
Задача для DSH
text
Проанализируй стандарт Netvision 2.1 и наш текущий дизайн, 
составь план миграции. Код в этом блоке НЕ меняй.

Прочитай:
- docs/Netvision_Design_Standard/tokens.json
- docs/Netvision_Design_Standard/tokens.css
- docs/Netvision_Design_Standard/DESIGN.md (все разделы)
- frontend/src/index.css
- frontend/src/hooks/use-theme.ts
- frontend/src/components/StatusBadge.tsx
- frontend/src/components/ThemeToggle.tsx
- frontend/src/components/ui/button.tsx (для понимания вариантов)
- frontend/src/components/ui/dialog.tsx (для понимания popup)

Составь три таблицы:

═══ Таблица 1. Mapping токенов ═══

| Netvision | Наш текущий токен | Решение |
|---|---|---|
| --canvas | --background | ... |
| --surface | --card | ... |
| --soft | --muted | ... |
| --text | --foreground | ... |
| --muted | --muted-foreground | ... |
| --line | --border | ... |
| --accent | --primary | ... |
| --accent-soft | --accent (shadcn) | ... |
| --on-accent | --primary-foreground | ... |
| --success/--success-bg | ??? | ... |
| --warning/--warning-bg | ??? | ... |
| --critical/--critical-bg | --destructive | ... |

═══ Таблица 2. Что меняем в index.css ═══

Три колонки: было / станет / зачем.

Учти, что мы хотим СОХРАНИТЬ emerald как accent. Значит:
- Цвета --background, --card, --muted, --border берём из Netvision light/dark
- Цвет --primary оставляем наш emerald
- Добавляем третью тему comfort с палитрой из Netvision
- Добавляем парные статусные цвета (--success-bg, --warning-bg, --critical-bg)

═══ Таблица 3. Что меняем в коде ═══

| Файл | Что меняем |
|---|---|
| frontend/src/index.css | ... |
| frontend/src/hooks/use-theme.ts | ... |
| frontend/src/components/ThemeToggle.tsx | ... |
| frontend/src/components/StatusBadge.tsx | ... |
| frontend/src/components/ui/dialog.tsx | ... |
| tailwind.config (или @theme inline) | ... |

В конце — короткий вывод (5-7 предложений):
- Какие файлы затронем (список)
- Сколько строк примерно изменим
- Есть ли риски сломать shadcn-компоненты
- Что рекомендую делать в первую очередь

Никаких изменений в файлах.
Что делать после
Проверьте вывод DSH. Если стратегия кажется разумной — approve и переходите к блоку C. Если что-то смущает — обсудим.

Блок C. Применение
Задача для DSH
text
Применяем Netvision Design Standard к frontend. Стратегия B (гибрид):
сохраняем emerald как accent, берём структуру и палитры Netvision.

═══ Шаг 1. Переписать frontend/src/index.css ═══

Целевая структура:

1. @import "tailwindcss", "tw-animate-css", "@fontsource-variable/inter" — 
   без изменений.

2. @custom-variant dark — заменить на три варианта:
   @custom-variant dark (&:is([data-theme="dark"] *));
   @custom-variant comfort (&:is([data-theme="comfort"] *));
   
3. @theme inline — добавить новые цветовые токены:
   --color-success, --color-success-bg
   --color-warning, --color-warning-bg
   --color-critical, --color-critical-bg
   Плюс существующие --color-background, --card, --primary и т.д.
   Новые radius-токены:
   --radius-control, --radius-popup, --radius-option
   Новые popup-токены:
   --popup-padding, --popup-gap, --popup-max-height, --popup-shadow
   --control-height

4. :root — базовые значения (можно оставить как есть).
   Плюс добавить:
   --radius-control: 12px
   --radius-popup: 12px
   --radius-option: 6px
   --control-height: 2.75rem
   --popup-padding: 6px
   --popup-gap: 8px
   --popup-max-height: 320px
   --popup-shadow: 0 8px 24px rgb(0 0 0 / 0.12)

5. [data-theme="light"] — светлая тема. Скопировать палитру 
   Netvision light, НО заменить --primary на наш emerald:
   --background: #f4f6f8          (было oklch(...))
   --foreground: #202c3b
   --card: #ffffff
   --muted: #edf1f5
   --muted-foreground: #536274
   --border: #d8dfe7
   --primary: oklch(0.55 0.17 160)    ← сохранить наш emerald
   --primary-foreground: #ffffff
   --success: #246442
   --success-bg: #e5f3ea
   --warning: #79500c
   --warning-bg: #fff0d5
   --critical: #a4323d
   --critical-bg: #fce9eb

6. [data-theme="comfort"] — новая тёплая тема. Взять палитру 
   Netvision comfort полностью, заменить accent на наш emerald:
   --background: #e9e5da
   --foreground: #333b37
   --card: #f5f1e7
   --muted: #e6e1d5
   --muted-foreground: #5d655d
   --border: #ccc9ba
   --primary: oklch(0.55 0.17 160)
   --primary-foreground: #ffffff
   --success: #345e3b
   --success-bg: #e0eadb
   --warning: #775017
   --warning-bg: #efe1c2
   --critical: #943c38
   --critical-bg: #eedbd6

7. [data-theme="dark"] — тёмная. Взять палитру Netvision dark, 
   accent оставить emerald (наш тёмный emerald):
   --background: #151c25
   --foreground: #e4eaf2
   --card: #1e2834
   --muted: #293646
   --muted-foreground: #afbccd
   --border: #394959
   --primary: oklch(0.7 0.16 160)     ← наш тёмный emerald
   --primary-foreground: #172333
   --success: #a0d7b3
   --success-bg: #253c31
   --warning: #edc880
   --warning-bg: #403728
   --critical: #f4acb4
   --critical-bg: #442f39

8. Сохранить блок @layer base { body { ... } } — но убрать 
   font-family: var(--font-sans) → заменить на "Inter Variable".
   Убрать background/color — они придут из body.

9. Дополнительно: сохранить --radius: 0.75rem для shadcn 
   (у него своя система). Наши --radius-control и т.д. — 
   отдельные токены, не конфликтуют.

═══ Шаг 2. Обновить use-theme.ts ═══

- Тип Theme: "light" | "comfort" | "dark" | "system"
- applyTheme:
  - для "system" определять как раньше (media query)
  - ставить атрибут data-theme на document.documentElement
  - убрать класс dark
- Функция setTheme — не менять.
- Инициализация — при первом рендере поставить data-theme.

═══ Шаг 3. Обновить ThemeToggle.tsx ═══

- Добавить третий пункт меню «Комфорт» (иконка Palette из lucide).
- Порядок: Светлая / Комфорт / Тёмная / Системная.
- При выборе ставить соответствующую тему.
- Иконки: Sun / Palette / Moon / Monitor.

═══ Шаг 4. Обновить StatusBadge.tsx ═══

Заменить хардкод bg-amber-100 / text-amber-800 на CSS-переменные:
- pending:   bg-[var(--muted)] text-[var(--muted-foreground)]
- partial:   bg-[var(--warning-bg)] text-[var(--warning)]
- paid:      bg-[var(--success-bg)] text-[var(--success)]
- overdue:   bg-[var(--critical-bg)] text-[var(--critical)]
- cancelled: bg-[var(--muted)] text-[var(--muted-foreground)] line-through

Проверить, что цвет читается на светлой/комфорт/тёмной темах.

═══ Шаг 5. Обновить popup компоненты (мягко) ═══

В frontend/src/components/ui/dropdown-menu.tsx, dialog.tsx, popover.tsx:
- Заменить rounded-md → rounded-[var(--radius-popup)]
- Заменить shadow-lg → shadow-[var(--popup-shadow)]
- Заменить max-h-96 → max-h-[var(--popup-max-height)] (для dropdown)

Если это ломает типы или тесты — откатить этот шаг, 
оставить дефолт shadcn.

═══ Шаг 6. Обновить tailwind @theme inline ═══

Проверить, что новые CSS-переменные доступны как утилиты:
- bg-success-bg, text-success, bg-warning-bg, text-warning
- bg-critical-bg, text-critical
- rounded-control, rounded-popup, rounded-option
- h-control (2.75rem)

Если что-то не работает — добавить в @theme inline:
  --color-success-bg: var(--success-bg);
  --color-warning-bg: var(--warning-bg);
  --color-critical-bg: var(--critical-bg);
  --radius-control: var(--radius-control);
  --radius-popup: var(--radius-popup);
  --radius-option: var(--radius-option);

═══ Шаг 7. Проверка ═══

1. npm run build — должен быть успешным.
2. npm run lint — без новых ошибок (warnings можно).
3. Открой dev-сервер и попроси меня проверить визуально.

НЕ коммить ничего до моего approve.
Что проверяем после
□ npm run build — зелёный
□ npm run lint — без новых ошибок
□ Все страницы открываются
□ Переключение тем работает (3 варианта)
□ Comfort тема выглядит тёплой и приятной
□ StatusBadge — цвета читаются во всех темах
□ Dropdown/Popover/Dialog — не сломаны
Скриншоты приложить:

Dashboard в light

Dashboard в comfort

Dashboard в dark

Charges с badges статусов (все три темы)

Коммит
text
git add .
git commit -m "feat(frontend): adopt Netvision Design Standard 2.1 
(structural: 3 themes, popup tokens, paired status colors)"
git push
Блок D. Отчёт в HTML
Задача для DSH
text
Создай подробный HTML-отчёт о миграции на Netvision Design Standard.

Файл: docs/NETVISION-MIGRATION-REPORT.html

Структура отчёта:

1. Заголовок + дата + версия проекта

2. Что сделано (summary):
   - Стратегия миграции: гибрид (сохранили emerald, взяли структуру)
   - Затронуто файлов: N
   - Строк изменено: +X / -Y
   - Новых CSS-токенов: N
   - Новых тем: 1 (comfort)

3. Diff по index.css:
   - Секция "Было" (наш старый index.css)
   - Секция "Стало" (новый index.css)
   - Подсветка изменений

4. Скриншоты 3 тем (light / comfort / dark):
   - Dashboard
   - Charges со статусами
   Каждый скриншот — в блоке 800x500, кликабельный (полный размер)

5. Mapping-таблица токенов:
   | Netvision | Наш токен | Значение |

6. Что НЕ взяли из Netvision и почему:
   - Синий accent → сохранили emerald (бренд)
   - Хеш-манифест → не нужен для личного проекта
   - Список остального

7. Rollback инструкция:
   git checkout pre-netvision-migration
   или распаковать из архива

8. Финальный чек-лист:
   - [x] Backup создан
   - [x] Ветка netvision-migration
   - [x] index.css обновлён
   - [x] use-theme.ts с 3 темами
   - [x] ThemeToggle с Palette
   - [x] StatusBadge с парными цветами
   - [x] npm run build зелёный
   - [x] npm run lint без новых ошибок
   - [x] Скриншоты 3 тем
   - [x] PR в main

Дизайн отчёта:
- Тёмная тема по умолчанию
- Emerald акцент (как в проекте)
- Inter шрифт через @fontsource или локально
- Sticky sidebar со scroll-spy
- Кнопка «Печать в PDF» (window.print())
- Адаптив: на мобильном sidebar → сверху
- Цветовая палитра как в проекте (светлая + тёмная)

Проверь:
- Валидный HTML5
- Нет внешних CDN (всё локально)
- Открывается в браузере без ошибок
- Кнопка печати работает

После создания открой его через explorer.exe для проверки:
explorer.exe docs/NETVISION-MIGRATION-REPORT.html
Что должно получиться
□ docs/NETVISION-MIGRATION-REPORT.html (~50–100 KB)
□ Открывается в браузере
□ Содержит скриншоты 3 тем
□ Есть кнопка печати
□ Sticky sidebar
□ Адаптив
Финальный коммит и merge
Задача для DSH
text
Всё готово. Финальные шаги:

1. Проверь, что все изменения закоммичены:
   git status

2. Запуш ветку:
   git push origin netvision-migration

3. Создай Pull Request в main через gh CLI, 
   если gh установлен и авторизован:
   gh pr create \
     --title "Netvision Design Standard 2.1 migration" \
     --body "Стратегия: гибрид. Сохранили emerald как accent, 
   взяли структуру Netvision: 3 темы (light/comfort/dark), 
   data-theme, radius-control/popup/option, popup-токены, 
   парные статусные цвета. Подробности в 
   docs/NETVISION-MIGRATION-REPORT.html"
   
   Если gh не установлен — просто выведи URL:
   https://github.com/ustas1136/utility-bills/compare/main...netvision-migration

4. Покажи финальную статистику:
   - git log --oneline pre-netvision-migration..HEAD
   - git diff --stat pre-netvision-migration..HEAD
После merge в main:

bash
git checkout main
git pull
git branch -d netvision-migration
git push origin --delete netvision-migration
git tag -d pre-netvision-migration    # тег больше не нужен
git push origin --delete pre-netvision-migration
Архив бэкапа можно удалить через неделю, если всё стабильно:

bash
rm ~/utility-bills-backup-*.tar.gz
Общий чек-лист миграции
□ A. Backup — архив, ветка, тег созданы
□ B. Анализ — mapping-таблица составлена, план утверждён
□ C. Применение:
□ index.css — 3 темы, data-theme, popup-токены
□ use-theme.ts — 3 темы
□ ThemeToggle.tsx — пункт «Комфорт»
□ StatusBadge.tsx — парные цвета
□ Popup компоненты — radius-popup
□ @theme inline — новые утилиты
□ npm run build — зелёный
□ npm run lint — чисто
□ Визуально проверить все 3 темы
□ D. Отчёт — HTML сгенерирован, открывается в браузере
□ Merge — PR в main, CI зелёный, ветка удалена
Предполагаемые риски
Риск	Вероятность	Митигация
shadcn компоненты сломаются из-за смены data-theme	Средняя	Проверка после каждого шага блока C
Тёмная тема станет хуже (Netvision палитра ≠ наша)	Средняя	Скриншоты + откат при необходимости
Tailwind @theme inline не подхватит новые токены	Низкая	Проверка через npm run build
comfort тема выглядит непривычно	Низкая	Это опционально; можно скрыть из UI
Тесты frontend сломаются	Низкая	У нас их нет, только lint
Если что-то пойдёт не так
Откат на лету (до commit):

bash
git restore .
Откат после commit в ветке:

bash
git reset --hard HEAD~1
Полный откат к состоянию до миграции:

bash
git checkout main
git branch -D netvision-migration
git checkout pre-netvision-migration
Из архива (ядерный вариант):

bash
cd ~/projects
rm -rf utility-bills
tar -xzf ~/utility-bills-backup-YYYYMMDD-HHMM.tar.gz
cd utility-bills
