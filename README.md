# TG Media Saver

[![License: MIT](https://img.shields.io/badge/License-MIT-229ed9.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-229ed9.svg)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/Telegram-Web-229ed9.svg)](https://web.telegram.org)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-229ed9.svg)](https://developer.chrome.com/docs/extensions/mv3)

Сохраняйте **фото, видео, GIF и голосовые сообщения** из [Telegram Web](https://web.telegram.org)
(клиенты `/k/` и `/z/`) — в том числе из каналов с включённым **«Запретить сохранение контента»**.

Оригинальная независимая реализация. Не аффилирована с Telegram.

> ⚠️ **Ответственное использование.** Инструмент работает только с тем, что ваш аккаунт и так
> видит в Telegram. Используйте его лишь для контента, на который у вас есть права (ваши файлы,
> разрешённые материалы). Соблюдайте условия использования Telegram и авторские права владельцев.

---

## Возможности

- ⬇ кнопка сохранения прямо на видео/фото **в ленте** чата.
- Плавающая ⬇ кнопка слева внизу — сохраняет последнее загруженное медиа, показывает **настоящее
  имя файла и размер**.
- Большие файлы пишутся **напрямую на диск** через File System Access API (где доступно),
  иначе — сборка в Blob и обычное скачивание.
- Корректные имена и расширения файлов (берутся из дескриптора потока Telegram).
- Обходит строгий Content-Security-Policy Telegram (инжект как content script, а не в мир страницы).
- **Никаких разрешений** сверх работы на `web.telegram.org`; ничего не собирает и никуда не отправляет.

## Два режима установки

Один и тот же код распространяется в двух видах. **Используйте один режим за раз**
(иначе кнопки задвоятся).

| Режим | Для кого | Как ставить |
|---|---|---|
| **1. Userscript** | Tampermonkey / Violentmonkey | [инструкция ниже](#режим-1-userscript) |
| **2. Расширение Chrome (MV3)** | Chrome / Edge / Brave / Chromium 111+ | [инструкция ниже](#режим-2-расширение-chrome) |

---

## Режим 1: Userscript

1. Установите [Tampermonkey](https://www.tampermonkey.net/) или
   [Violentmonkey](https://violentmonkey.github.io/).
2. **Chrome (Manifest V3):** в `chrome://extensions` → Tampermonkey → включите
   **«Allow user scripts»** («запуск кода, не проверенного Google»). Без этого тумблера
   пользовательские скрипты в Chrome молча не запускаются.
3. Установите скрипт одним из способов:
   - **в один клик:** откройте
     [`tg-media-saver.user.js`](https://raw.githubusercontent.com/eiler2005/tg-media-saver/main/tg-media-saver.user.js)
     — Tampermonkey предложит установку (автообновление уже вшито через `@updateURL`);
   - **вручную:** создайте новый скрипт и вставьте содержимое
     [`tg-media-saver.user.js`](./tg-media-saver.user.js).
4. Жёстко обновите вкладку Telegram (Cmd/Ctrl+Shift+R).

## Режим 2: Расширение Chrome

Требуется Chrome/Chromium **111+** (ради `content_scripts` `"world": "MAIN"`).

**Вариант A — из исходников (load unpacked):**

1. Склонируйте репозиторий и соберите (см. [Сборка](#сборка-из-исходников)):
   ```bash
   git clone https://github.com/eiler2005/tg-media-saver.git
   cd tg-media-saver
   ./scripts/build.sh
   ```
2. Откройте `chrome://extensions`, включите **Developer mode** (справа сверху).
3. Нажмите **Load unpacked** и выберите папку [`extension/`](./extension)
   (ту, где лежит `manifest.json`).
4. Жёстко обновите вкладку Telegram (Cmd/Ctrl+Shift+R).

**Вариант B — готовый zip:** после `./scripts/build.sh` появится
`dist/tg-media-saver-extension.zip` — его можно загрузить в Chrome Web Store
(см. [Публикация](#публикация-в-chrome-web-store)) или распаковать и поставить как в варианте A.

Расширение инжектится браузером как MAIN-world content script, поэтому **не блокируется CSP**
страницы и **не требует** тамперманкиевского тумблера «Allow user scripts».

---

## Как пользоваться

1. Откройте Telegram Web и **воспроизведите** видео/аудио (или откройте фото) — страница должна
   реально загрузить медиа.
2. Нажмите ⬇ **на самом медиа** в ленте — либо плавающую ⬇ кнопку **слева внизу**.
3. Файл сохранится с настоящим именем; прогресс показывается в процентах над плавающей кнопкой.

Кнопка появляется только когда страница действительно получила медиа. Если видео **не играет** —
значит, Telegram не отдаёт поток (см. [Troubleshooting](#troubleshooting)).

### Консольные хелперы

В DevTools → Console доступны:

- `tgSaver.status()` — что поймано последним;
- `tgSaver.downloadLast()` — вручную скачать последнее пойманное медиа;
- `tgSaver.debug(true)` — подробное логирование.

---

## Сборка из исходников

Единый источник кода — [`src/content.js`](./src/content.js). Сборка генерирует оба
дистрибутива (нужны `bash`, `python3`, `zip`; для иконок — `uv`):

```bash
./scripts/build.sh
```

Результат:

- `tg-media-saver.user.js` — userscript (версия подставляется из `extension/manifest.json`);
- `extension/content.js` — копия `src/content.js` для расширения;
- `dist/tg-media-saver-extension.zip` — zip расширения для магазина (manifest в корне архива).

Иконки (если меняли дизайн в [`assets/icon.svg`](./assets/icon.svg) или
[`scripts/make_icons.py`](./scripts/make_icons.py)):

```bash
uv run --with pillow python scripts/make_icons.py
```

> После правок в `src/content.js` всегда запускайте `./scripts/build.sh`, чтобы обновить
> `tg-media-saver.user.js` и `extension/content.js` (это сгенерированные файлы).

## Публикация в Chrome Web Store

1. Аккаунт разработчика (разово $5): `chrome.google.com/webstore/devconsole`.
2. Иконки уже есть (`extension/icons/`, для витрины — `assets/icon128.png`).
3. Подготовьте скриншоты 1280×800 и описание.
4. Загрузите `dist/tg-media-saver-extension.zip` → заполните листинг → отправьте на ревью.

> ⚠️ **Важно про модерацию.** Ключевая функция — сохранение из каналов с «запретом сохранения» —
> это обход ограничения, выставленного владельцем канала. Такие расширения нередко **отклоняют
> или позже удаляют** из Chrome Web Store (политики про обход ограничений / авторские права /
> ToS сервисов). К этому стоит быть готовым. Запасные пути: Firefox Add-ons (обычно лояльнее),
> userscript на Greasy Fork, или самостоятельная раздача unpacked-расширения через этот репозиторий.

---

## Troubleshooting

- **Нет кнопок / нет логов `[TG Media Saver]`.**
  - Userscript: включён ли скрипт в Tampermonkey? В Chrome включён ли тумблер **«Allow user scripts»**?
  - Расширение: включено ли оно в `chrome://extensions`? Chrome ≥ 111?
- **Видео не играет, в консоли `FetchEvent … rejected`, `ERR_NETWORK_CHANGED`,
  `[MP-SERVICE] worker task error`.** Сломан конвейер Telegram (часто после смены сети/VPN),
  а не расширение. Лечение: стабилизировать сеть → закрыть другие вкладки `web.telegram.org` →
  Cmd+Shift+R. Не помогло → DevTools → Application → Service Workers → **Unregister** → reload
  (**не** включать «Bypass for network»). Ядерно → Storage → **Clear site data** → перелогин.
- **Кнопка есть, но скачивание не стартует.** Откройте DevTools → Console → фильтр
  `TG Media Saver` и посмотрите ошибку. Убедитесь, что медиа реально воспроизводится.

## Как это работает (кратко)

- Telegram Web имеет строгий CSP, блокирующий инжект в мир страницы. Оба режима обходят это:
  userscript — через isolated world (`@grant unsafeWindow`), расширение — через браузерный
  MAIN-world content script.
- `/k/` отдаёт медиа через свой **Service Worker** по адресу `/k/stream/<urlencoded JSON>`.
  Этот JSON-дескриптор содержит настоящие `fileName`, `size`, `mimeType`, `dcId`.
- Чтобы получить байты, `fetch` должен выполняться **в контексте страницы** (тогда его
  перехватывает Service Worker). Поэтому все сетевые вызовы идут через `page.fetch`
  (`unsafeWindow.fetch` / `window.fetch`).
- Ссылки на медиа находятся опросом `currentSrc` у `<video>`/`<audio>` (DOM общий для обоих миров).
- Скачивание — HTTP `Range`-запросами по кускам, затем стриминг на диск (File System Access)
  или склейка в Blob.

Подробности для разработчиков и AI-агентов — в [`AGENTS.md`](./AGENTS.md).

## Структура проекта

```
tg-media-saver/
├── README.md                  # этот файл
├── AGENTS.md                  # контекст для разработчиков и AI-агентов
├── LICENSE                    # MIT
├── CHANGELOG.md
├── .gitignore
├── tg-media-saver.user.js     # сгенерированный userscript (ставится в Tampermonkey)
├── src/
│   ├── content.js             # ЕДИНЫЙ источник логики
│   └── userscript.meta.js     # шапка userscript (шаблон с __VERSION__)
├── extension/
│   ├── manifest.json          # MV3-манифест (иконки, popup, content script)
│   ├── content.js             # сгенерированная копия src/content.js
│   ├── popup.html / popup.css # подсказка по кнопке на панели
│   └── icons/                 # icon16/48/128.png
├── assets/
│   ├── icon.svg               # векторный исходник иконки
│   └── icon128.png / icon512.png
├── scripts/
│   ├── build.sh               # сборка обоих дистрибутивов + zip
│   └── make_icons.py          # генерация PNG-иконок (Pillow через uv)
└── dist/                      # артефакты сборки (в git не коммитится)
```

## Вклад

Багрепорты и идеи — в [Issues](https://github.com/eiler2005/tg-media-saver/issues).
PR приветствуются: правьте [`src/content.js`](./src/content.js) и запускайте `./scripts/build.sh`.

## Лицензия

[MIT](./LICENSE) © Denis Ermilov. Независимая реализация; не является производной какого-либо
существующего скрипта.

---

### English summary

**TG Media Saver** saves photos, videos, GIFs and voice messages from Telegram Web
(`web.telegram.org`, `/k/` and `/z/` clients), including channels with "restrict saving content"
enabled. It ships as both a **Tampermonkey userscript** and a **Chrome MV3 extension** built from
a single source ([`src/content.js`](./src/content.js)). It runs as a content script to bypass
Telegram's strict CSP and fetches media in the page context so Telegram's Service Worker serves
the bytes. MIT licensed, original implementation, not affiliated with Telegram. Use responsibly —
only save content you have the rights to.
