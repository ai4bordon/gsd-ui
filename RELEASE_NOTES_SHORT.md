# Короткие Release Notes

Источник форка: https://github.com/Stolkmeister/gsd-ui  
Репозиторий форка: https://github.com/ai4bordon/gsd-ui

## Что нового
- Исправлены live-обновления `.planning` (watcher) и обновление Research при изменениях phase-файлов.
- Milestones теперь корректно собираются из `ROADMAP.md` + `.planning/milestones/*/ROADMAP.md` и синхронизируются с Requirements.
- Улучшены парсеры roadmap/requirements/summary (EN+RU форматы, traceability, decisions из таблиц и списков).
- Velocity теперь корректно считается даже без агрегатов в `STATE.md` (fallback из summary + устойчивый парсинг duration).
- Исправлены breadcrumbs для документов из Research и добавлен бейдж текущего пути проекта в сайдбаре.
- Синхронизированы README на EN/RU и добавлены автотесты парсеров/state.

## Проверено
- Windows 10
