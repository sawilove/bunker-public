# База данных для аккаунтов (Neon + Render free)

Аккаунты, статистика и аватарки хранятся в **PostgreSQL**.  
На бесплатном Render диск не сохраняется — БД нужна обязательно.

Рекомендуем **Neon** (бесплатный тариф, без карты).

---

## Шаг 1. Создать базу в Neon

1. Зайдите на [https://neon.tech](https://neon.tech) и зарегистрируйтесь.
2. **New Project** → имя, например `bunker`.
3. Region — ближайший к пользователям (например `Frankfurt`).
4. После создания откройте проект → **Dashboard**.

---

## Шаг 2. Скопировать строку подключения

1. На Dashboard нажмите **Connect**.
2. Вкладка **Connection string**.
3. Выберите **Node.js** (или любой — строка одна).
4. Скопируйте URL вида:

   ```
   postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

Это значение для переменной **`DATABASE_URL`**.

---

## Шаг 3. Добавить переменные на Render

1. [dashboard.render.com](https://dashboard.render.com) → ваш сервис **bunker-public** (Web Service).
2. **Environment** → **Add Environment Variable**:

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | вставьте строку из Neon целиком |
   | `AUTH_SECRET` | длинная случайная строка (см. ниже) |
   | `CORS_ORIGIN` | URL GitHub Pages, например `https://ВАШ-ЛОГИН.github.io,https://ВАШ-ЛОГИН.github.io/Bunker` |

3. **Save Changes** — сервис перезапустится.

**AUTH_SECRET** (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

---

## Шаг 4. Задеплоить код

Закоммитьте и запушьте репозиторий (файлы `db.js`, обновлённый `user-store.js`, зависимости `pg` и `dotenv`).

Render подтянет коммит и выполнит `npm install` + `node server.js`.

В логах должно быть:

```
Database: connected
Server running on port ...
```

Если видите `Database init failed` — проверьте `DATABASE_URL` (без лишних пробелов, с `sslmode=require`).

---

## Шаг 5. Проверка

1. Откройте `https://ваш-сервис.onrender.com/api/auth/me` — ответ `401` (нормально).
2. На сайте → **Вход и регистрация** → создайте аккаунт.
3. Перезапустите сервис на Render (Manual Deploy) и снова войдите — аккаунт должен остаться.

Таблица `users` создаётся автоматически при первом запуске.

---

## Локальная разработка

1. Скопируйте `.env.example` в `.env` в корне репозитория.
2. Вставьте тот же `DATABASE_URL` из Neon (можно ту же БД для тестов).
3. Запуск:

   ```bash
   npm install
   node server.js
   ```

Файл `.env` в git не попадает (см. `.gitignore`).

---

## Что хранится в БД

| Поле | Описание |
|------|----------|
| nickname | Никнейм |
| password_hash | Хеш пароля |
| bio | О себе |
| avatar_webp | Аватар (webp, до ~256×256) |
| games_played | Сыграно игр |
| bunker_survivals | Раз остался в бункере |
| premium | Премиум (вручную в БД: `true` / `false`) |
| dev | Разработчик (вручную в БД: `true` / `false`) |

### Выдать премиум или статус разработчика

В Neon → **SQL Editor**:

```sql
UPDATE users SET premium = true WHERE nickname_lower = 'никнейм';
UPDATE users SET dev = true WHERE nickname_lower = 'никнейм';
```

Аватар отдаётся по адресу: `https://ваш-api.onrender.com/api/avatars/<id пользователя>`.

---

## Альтернативы Neon

Подойдёт любой PostgreSQL с URL в формате `postgresql://...`:

- [Supabase](https://supabase.com) → Project Settings → Database → Connection string
- [Railway](https://railway.app) → PostgreSQL plugin

Достаточно подставить строку в `DATABASE_URL` на Render.
