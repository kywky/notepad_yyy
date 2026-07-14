# Notepad+

一个面向手机 APK 的轻量文本编辑器。当前版本使用 Vite、React、TypeScript、CodeMirror 和 Capacitor 构建。

## Local Development

```sh
npm install
npm run dev
```

Open in a local browser while developing:

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

For Android use, build the APK and copy the generated APK to the target phone.

## Build Android APK

This project is configured with Capacitor Android.
The APK uses Android's system file picker for opening and saving text files.
It can also receive text files from Android "Open with" and "Share" flows.
Files opened through the system picker can be saved back directly; use Save As to choose a new location.
The GitHub workflow builds a target SDK 35 compatibility test APK with a reusable test signing key.
Uninstall APKs built before this signing setup once before installing the new compatibility build.

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
the `Android APK` workflow. Download the generated `notepad-plus-debug-apk` artifact from the
workflow run.
