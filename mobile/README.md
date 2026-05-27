# Мобильное приложение «Бункер» (Android)

Нативная оболочка на [Capacitor](https://capacitorjs.com): при запуске показывается интро с логотипом и заставкой **БУНКЕР**, затем открывается основной сайт.

## Что внутри

1. **Экран логотипа** — `resources/app_logo.jpg`, подпись «Инициализация протокола»
2. **Заставка БУНКЕР** — стиль как на сайте (шрифт Russo One, янтарный акцент)
3. **Основной сайт** — `https://bunker-public.onrender.com/` (настраивается в `www/config.js`)
4. **Иконка APK** — знак радиации (`resources/icon-radiation.png`)

## Требования

- [Node.js](https://nodejs.org/) 18+
- [Android Studio](https://developer.android.com/studio) с Android SDK
- Переменная `ANDROID_HOME` (обычно ставится вместе со Studio)

## Установка

```bash
cd mobile
npm install
npx cap add android
npm run assets
npx cap sync android
```

## Сборка APK (debug)

```bash
cd mobile
npm run build:android
```

APK будет здесь: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## Release-сборка

1. Создайте keystore (один раз):
   ```bash
   keytool -genkey -v -keystore bunker-release.keystore -alias bunker -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Пропишите подпись в `android/app/build.gradle` (см. [документацию Android](https://developer.android.com/studio/publish/app-signing))
3. `cd android && .\gradlew assembleRelease`

## Настройки

| Файл | Назначение |
|------|------------|
| `www/config.js` | URL сайта, длительность интро |
| `capacitor.config.json` | ID приложения, разрешённые домены |
| `resources/icon.png` | Исходник иконки (1024×1024) |
| `resources/splash.png` | Исходник splash для нативного экрана |

После смены иконки или splash:
```bash
npm run assets
npx cap sync android
```

## Gradle: таймаут при скачивании

Если ошибка `SocketTimeoutException` при загрузке `gradle-8.11.1-*.zip`:

1. В проекте уже увеличены таймауты и используется облегчённый `gradle-8.11.1-bin.zip` (~130 МБ).
2. **File → Sync Project with Gradle Files** в Android Studio (или перезапустите Studio).
3. Если снова таймаут — скачайте архив вручную в браузере:
   - https://services.gradle.org/distributions/gradle-8.11.1-bin.zip
4. Положите zip в папку (создаётся после первой неудачной попытки Sync):
   ```
   %USERPROFILE%\.gradle\wrapper\dists\gradle-8.11.1-bin\<случайная_папка>\gradle-8.11.1-bin.zip
   ```
   Имя подпапки с хешем смотрите в `mobile\android\.gradle` или в сообщении Gradle в Build.
5. **Не распаковывайте** — только `.zip` в эту папку, затем снова Sync.

При VPN/прокси: **File → Settings → Appearance & Behavior → System Settings → HTTP Proxy**.

## Открыть в Android Studio

```bash
npm run open:android
```

Запуск на эмуляторе или телефоне — кнопка Run (▶) в Studio.
