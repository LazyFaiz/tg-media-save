# TG Media Saver

[![CI](https://github.com/eiler2005/tg-media-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/eiler2005/tg-media-saver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-229ed9.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.1-229ed9.svg)](./CHANGELOG.md)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-229ed9.svg)](https://developer.chrome.com/docs/extensions/mv3)

**English → [README.md](./README.md)**

Сохраняйте **фото, видео, GIF и голосовые сообщения** из [Telegram Web](https://web.telegram.org)
(клиенты `/k/` и `/z/`) — в том числе из каналов с **«Запретить сохранение контента»**.
Один источник, два режима: userscript для Tampermonkey и расширение Chrome MV3.
Не аффилировано с Telegram.

> ⚠️ **Ответственное использование.** Инструмент работает только с тем, что ваш аккаунт и так
> видит в Telegram. Используйте его лишь для контента, на который у вас есть права. Соблюдайте
> условия использования Telegram и авторские права владельцев.

## Возможности

- ⬇ кнопка сохранения прямо на видео/фото **в ленте** + плавающая ⬇ (слева внизу).
- Настоящие **имена и размеры** файлов — из дескриптора потока Telegram.
- Большие файлы пишутся **напрямую на диск** (File System Access API), с фолбэком в память.
- Обходит строгий CSP Telegram; **без разрешений** сверх `web.telegram.org`; ничего не собирает.

## Установка

### Режим 1 — Userscript (Tampermonkey / Violentmonkey)

1. Установите [Tampermonkey](https://www.tampermonkey.net/) или [Violentmonkey](https://violentmonkey.github.io/).
2. **Chrome (MV3):** включите **«Allow user scripts»** у Tampermonkey в `chrome://extensions`.
3. Установка — **в один клик:** откройте
   [`tg-media-saver.user.js`](https://raw.githubusercontent.com/eiler2005/tg-media-saver/main/tg-media-saver.user.js);
   или **вручную:** вставьте его содержимое в новый скрипт.
4. Жёстко обновите Telegram (Cmd/Ctrl+Shift+R).

### Режим 2 — Расширение Chrome (MV3, Chrome 111+)

1. Откройте `chrome://extensions` и включите **Developer mode**.
2. Нажмите **Load unpacked** и выберите папку [`extension/`](./extension) (ту, где
   `manifest.json`). Для сборки из исходников см.
   [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#building-from-source).
3. Жёстко обновите Telegram (Cmd/Ctrl+Shift+R).

> Используйте **один режим за раз** (иначе кнопки задвоятся). Расширение не блокируется CSP
> страницы и не требует тумблера «Allow user scripts».

## Как пользоваться

1. **Воспроизведите** видео/аудио (или откройте фото), чтобы страница загрузила медиа.
2. Нажмите ⬇ **на медиа** — или плавающую ⬇ слева внизу.
3. Файл сохранится с настоящим именем; прогресс — в процентах.

Консольные хелперы: `tgSaver.status()`, `tgSaver.downloadLast()`, `tgSaver.debug(true)`.

## Документация

- [Архитектура](./docs/ARCHITECTURE.md) — как работает (диаграммы), конвейер сборки, структура проекта.
- [Тесты](./test/README.md) — что и как проверяется (`npm test`, без зависимостей).
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — нет кнопок, ошибки Service Worker и т.п.
- [AGENTS.md](./AGENTS.md) — заметки для разработчиков и AI-агентов.
- [Changelog](./CHANGELOG.md).

## Вклад

Багрепорты и идеи — в [Issues](https://github.com/eiler2005/tg-media-saver/issues).
PR приветствуются: правьте [`src/content.js`](./src/content.js), запускайте `./scripts/build.sh`
и убедитесь, что `npm test` проходит.

## Лицензия

[MIT](./LICENSE)
