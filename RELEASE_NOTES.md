# Release Notes (fork)

Источник форка: https://github.com/Stolkmeister/gsd-ui  
Репозиторий форка: https://github.com/ai4bordon/gsd-ui

## Релиз: Fork compatibility update

Этот релиз фокусируется на совместимости `.planning`-структур из реальных проектов, улучшении парсеров, исправлении навигации и усилении документации.

## Ключевые изменения относительно upstream

### 1) Парсинг и модель данных
- Исправлен watcher для `.planning` (dot-folder root), чтобы live-обновления работали стабильно.
- Milestones теперь объединяются из:
  - `.planning/ROADMAP.md`
  - `.planning/milestones/*/ROADMAP.md`
- Добавлена синхронизация milestones между Roadmap и Requirements.
- Добавлены производные фазы для milestones, присутствующих только в Requirements.
- Улучшен fallback-парсинг roadmap для EN/RU (`Phase/Goal`, `Фаза/Цель`).
- Улучшен парсинг Requirements (milestone секции, traceability refs).
- Исправлена нормализация `fulfilledByPlans` и формат ссылок на планы.

### 2) Decisions / Velocity / Research
- Decisions извлекаются из `*-SUMMARY.md` как из таблиц, так и из списков.
- Velocity получает fallback-метрики из summary, если в `STATE.md` нет агрегатов.
- Добавлен устойчивый парсинг duration (`22m`, `3m 52s`, `12min`, `00:06:00` и т.п.).
- Исправлено обновление Research-индекса при изменениях phase-файлов.
- `SUMMARY.md` в `.planning/research/` подсвечивается как `Research Summary`.

### 3) UI/UX и навигация
- Исправлены breadcrumbs для документов, открытых из Research (`Research -> ...`).
- Добавлен бейдж текущего пути проекта в сайдбаре (`PROJECT PATH`).

### 4) Документация
- Синхронизированы `README.md` и `README.ru.md` (единая структура и содержание на EN/RU).
- Добавлена явная ссылка на upstream в начале README.
- Добавлен `DEVELOPMENT.md` для сценариев сопровождения форка.

### 5) Автотесты
Добавлены тесты:
- `server/parsers/summary.test.ts`
- `server/parsers/roadmap.test.ts`
- `server/parsers/requirements.test.ts`
- `server/state.test.ts`

Запуск:

```bash
bun test
```

## Проверка платформы
- Протестировано на **Windows 10**.

## Что важно для пользователей
- Установка из форка:

```bash
bun install -g github:ai4bordon/gsd-ui
```

- Для локальных изменений перед публикацией: см. `DEVELOPMENT.md`.
