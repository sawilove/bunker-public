# Бункер

Настольная игра в браузере: ведущий + игроки по коду сессии.

## Локальный запуск

```bash
npm install
node server.js
```

Откройте http://localhost:3000

## Переподключение

- **Ведущий** — при обновлении страницы сохраняется `hostId` в `localStorage`, сессия и игра продолжаются.
- **Игрок** — при входе выдаётся постоянный `playerId`; после перезагрузки страницы игрок автоматически возвращается в ту же сессию (пока не нажал «Покинуть сессию» и его не выгнали).

## GitHub Pages + сервер в интернете

GitHub Pages отдаёт только статику (HTML/JS/CSS). **WebSocket-сервер** (`server.js`) нужно разместить отдельно (Render, Railway, Fly.io и т.д.).

### 1. Статика на GitHub Pages

1. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Запушьте в `main` — workflow `.github/workflows/pages.yml` соберёт папку `public/` в сайт.
3. Откройте `https://<user>.github.io/<repo>/` — должна открыться главная с кнопками «Ведущий» / «Игрок».

Если раньше в Pages был выбран branch **/ (root)** — там нет `index.html`, страница пустая. Переключите на **GitHub Actions**.

### 2. Сервер API (Render)

1. Залейте репозиторий на GitHub.
2. [Render](https://render.com) → New → Web Service → этот репозиторий.
3. Build: `npm install`, Start: `node server.js`.
4. Создайте бесплатную PostgreSQL в [Neon](https://neon.tech) — пошагово: **[docs/DATABASE.md](docs/DATABASE.md)**.
5. В Environment на Render добавьте:
   - `DATABASE_URL` — строка подключения из Neon
   - `AUTH_SECRET` — случайная длинная строка
   - `CORS_ORIGIN` = `https://<user>.github.io` (и при необходимости `https://<user>.github.io/<repo>`)

Скопируйте URL сервиса, например `https://bunker-api.onrender.com`.

### 3. Связать фронт с сервером

В `public/config.js` на GitHub (или локально перед пушем):

```js
window.BUNKER_CONFIG = {
  wsUrl: "https://bunker-api.onrender.com",
  apiUrl: "https://bunker-api.onrender.com",
};
```

Закоммитьте и снова задеплойте Pages.

### 4. Картинки сценариев

Положите PNG в `resources/scenarios/` (или `public/scenarios/`). Workflow при деплое копирует их в `scenarios/` на Pages.

## Структура

- `server.js` — Express + Socket.IO, игровая логика
- `public/` — интерфейс ведущего и игроков
- `game-data.js` — сценарии и пулы характеристик
