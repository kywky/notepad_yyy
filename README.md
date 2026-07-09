# notepad_yyy

一个手机端文本编辑器。当前版本使用 Vite、React、TypeScript、CodeMirror 和 Capacitor 构建。

## Run

```sh
npm install
npm run dev
```

Open:

```txt
http://localhost:5173/
```

## Build

```sh
npm run build
```

The production files are generated in:

```txt
dist/
```

## Preview Production Build

```sh
npm run preview -- --port 4173
```

Open:

```txt
http://localhost:4173/
```

## Share To Another Environment

For source development, copy the project without `node_modules/` and run:

```sh
npm install
npm run build
```

For static deployment, build first and serve the `dist/` directory with any static file server.

## Build Android APK

This project is configured with Capacitor Android.

Sync the web build into the Android project:

```sh
npm run android:sync
```

Build a debug APK when Android SDK and Java are available:

```sh
npm run android:apk
```

The APK will be generated at:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

If the local machine does not have Java and Android SDK installed, push the repo to GitHub and run
the `Android APK` workflow. Download the generated `notepad-plus-web-debug-apk` artifact from the
workflow run.
