# Notepad+ Project Handoff

Last updated: 2026-07-15

## 中文快速交接

当前项目已经从网页版 PWA 调整为以 Android APK 为主要交付目标的轻量文本编辑器。

目前已完成：

- 多标签文本编辑、语法高亮、搜索替换和常用行操作
- Android 系统文件选择、另存为和原文件直接覆盖保存
- 从文件管理器“打开方式”以及其他应用“分享”进入 Notepad+
- 移动端返回键、软键盘、小屏布局和底部工具栏适配
- 图标桌面悬停说明、手机长按中文说明以及“更多编辑操作”菜单
- GitHub Actions 自动构建 APK、发布 `debug-latest` 并自动更新版本号
- 卓易通兼容测试配置：`targetSdk 35` 和可复用测试签名缓存

当前基线提交是 `4a8f55c`。旧 APK 与这版测试签名不同，在卓易通中需要先卸载旧版一次再安装。当前 APK 仍属于测试包，正式发布前必须改成 GitHub Secrets 管理的永久 release 签名。

下一步优先做真机和卓易通完整测试，然后处理正式签名、保存提示、大文件保护和编码检测。

## 1. Project Summary

Notepad+ is a lightweight mobile text editor inspired by Notepad++. The main delivery target is an Android APK rather than a browser/PWA product.

Project principles:

- Keep the interface compact and leave most of the screen to the editor.
- Prefer practical editing and file operations over decorative or complex features.
- Support phones first, including small screens, soft keyboards, and Android back behavior.
- Avoid cloud accounts, AI features, plugin marketplaces, and other heavy functionality for now.

Repository:

```txt
https://github.com/kywky/notepad_yyy.git
```

Local project path:

```txt
/data/data/com.termux/files/home/test/nodeyyy
```

Current baseline commit:

```txt
4a8f55c Add mobile tooltips and compatibility build
```

## 2. Technology Stack

- React 19 and TypeScript
- Vite 7
- CodeMirror 6
- Capacitor 8 Android shell
- Lucide React icons
- GitHub Actions for APK builds

Android configuration:

- Application ID: `com.kywky.notepadyyy`
- Application name: `Notepad+`
- Minimum SDK: 24
- Compile SDK: 36
- Target SDK: 35
- Current package type: debug/compatibility test APK

## 3. Main Source Files

```txt
src/App.tsx
```

Main application state, tabs, editor commands, search, file operations, mobile panels, back handling, keyboard handling, tooltips, and the mobile More menu.

```txt
src/components/CodeEditor.tsx
```

CodeMirror initialization, themes, language extensions, editor commands, selections, and cursor reporting.

```txt
src/lib/session.ts
```

Session persistence, document model, settings model, and native document URI persistence.

```txt
src/lib/nativeFiles.ts
```

TypeScript bridge for native Android file open, save, direct write, and incoming shared files.

```txt
android/app/src/main/java/com/kywky/notepadyyy/NotepadFilesPlugin.java
```

Custom Capacitor Android plugin based on the Android Storage Access Framework.

```txt
android/app/src/main/AndroidManifest.xml
```

Android activity configuration, soft keyboard resize behavior, and Open With/Share intent filters.

```txt
.github/workflows/android-apk.yml
```

GitHub Actions APK build, test signing key cache, artifact upload, and `debug-latest` release publishing.

## 4. Completed Features

### Editor

- Multiple documents and tabs
- Document sidebar
- Syntax highlighting for plain text, JavaScript, TypeScript, HTML, CSS, JSON, Markdown, Python, XML, and shell files
- Search and replace
- Regex, case-sensitive, and whole-word search
- Undo and redo
- Word wrap
- Font size and tab size settings
- Duplicate and delete line
- Move line up and down
- Uppercase and lowercase conversion
- Line sorting
- Duplicate-line removal
- Trailing-space cleanup
- Session persistence in local storage

### Mobile UI

- Compact top toolbar and editor-first layout
- Mobile quick actions and bottom editor actions
- Android back button closes search, command panel, More panel, and document sidebar before exiting
- Soft keyboard resize handling using `adjustResize` and `visualViewport`
- Bottom editor bar hides while the soft keyboard is open
- Long-press icon descriptions on touch devices
- Desktop icon descriptions through normal hover titles
- Low-frequency edit operations grouped into a Chinese-labeled More menu

### Android File Support

- Open files through Android's system file picker
- Save files through Android's system save dialog
- Persist document URIs where the provider allows it
- Save an opened file directly back to its original URI
- Save As through `Ctrl+Shift+S` and the command list
- Fall back to Save As if the original URI is no longer writable
- Receive text files through Android Open With
- Receive shared text or shared text-file streams
- No broad storage permission is requested

### Browser/PWA Cleanup

- PWA install prompts removed
- Service Worker registration removed
- Web manifest and PWA cache files removed
- APK name and UI use `Notepad+`, without `Web` branding
- Browser development mode remains available as a fallback environment

## 5. Data and Saving Behavior

Each document stores:

- ID
- File name
- Text content
- Language mode
- Dirty state
- Creation/update timestamps
- Optional Android `nativeUri`

Behavior:

- A file opened through Android stores its URI in the session.
- Normal Save writes directly to that URI.
- A new document opens the Android Save As dialog on first save.
- Save As updates the document with the newly selected URI.
- If URI permission is lost, the app informs the user and opens Save As.
- Browser development mode downloads files using Blob URLs.

The current local-storage key is:

```txt
notepad-plus-session-v1
```

The old `notepad-plus-web-session-v1` key is read as a migration fallback.

## 6. Local Development

Install dependencies:

```sh
npm install
```

Start the Vite development server:

```sh
npm run dev
```

Build the frontend:

```sh
npm run build
```

Build and sync frontend assets into Android:

```sh
npm run android:sync
```

Local APK command:

```sh
npm run android:apk
```

The current Termux environment does not have Java/Android SDK configured, so local Gradle APK builds fail unless `java` and `JAVA_HOME` are installed. GitHub Actions is the normal APK build route.

## 7. GitHub Actions and APK Delivery

Every push to `main` runs the `Android APK` workflow.

Workflow behavior:

- Uses Node.js 22 and Java 21
- Installs Android platform/build tools 36
- Runs `npm ci`
- Runs `npm run android:sync`
- Runs `./gradlew assembleDebug`
- Uploads artifact `notepad-plus-debug-apk`
- Updates release tag `debug-latest`
- Sets `versionCode` to the GitHub run number
- Sets `versionName` to `0.3.<run number>`

Latest APK URL:

```txt
https://github.com/kywky/notepad_yyy/releases/download/debug-latest/app-debug.apk
```

Local downloaded APK:

```txt
/data/data/com.termux/files/home/notepad_yyy_apk/app-debug.apk
```

SHA-256 for the build produced from commit `4a8f55c`:

```txt
ba6e862e078ab9128d2a46bdd2428c6d5ff95afb8037e09034102a0aecfbd870
```

## 8. Signing and HarmonyOS/Zhuoyi Compatibility

The APK is currently a compatibility test build, not a production release.

The workflow caches `~/.android/debug.keystore` with cache key:

```txt
notepad-plus-debug-keystore-v1
```

This gives test builds a reusable signature while the GitHub Actions cache exists. APKs built before this signing setup use a different signature.

For Zhuoyi/卓易通 testing:

1. Back up any important text from the old installation.
2. Uninstall the APK installed before commit `4a8f55c` once.
3. Install the APK built from `4a8f55c` or later as a fresh install.
4. Future compatibility test APKs should update normally while the signing cache is retained.

Important limitation:

- GitHub Actions cache is not a permanent production signing solution.
- Cache deletion or expiration can change the test signature.
- A proper release keystore stored in GitHub Secrets is required before public distribution.
- HarmonyOS NEXT does not natively run arbitrary Android APKs; final compatibility still depends on Zhuoyi's container rules.

## 9. Download Troubleshooting

In Termux, direct `curl` downloads from GitHub Release CDN have occasionally failed with TLS errors even when the GitHub API works.

Primary download:

```sh
curl -fL --retry 5 -o app-debug.apk \
  https://github.com/kywky/notepad_yyy/releases/download/debug-latest/app-debug.apk
```

Node.js fallback:

```sh
node -e "const fs=require('fs'); fetch('https://github.com/kywky/notepad_yyy/releases/download/debug-latest/app-debug.apk').then(r=>{if(!r.ok)throw new Error(String(r.status));return r.arrayBuffer()}).then(b=>fs.writeFileSync('app-debug.apk',Buffer.from(b)))"
```

Validation:

```sh
sha256sum app-debug.apk
unzip -t app-debug.apk
```

## 10. Known Limitations

- The APK still uses a Capacitor WebView internally; the visible PWA/browser behavior has been removed.
- The JavaScript bundle is about 886 KB because all CodeMirror language packages are bundled together.
- No automated browser or Android UI tests exist.
- Long-press tooltips and the More menu still require broad real-device testing.
- Large files have no size limit and can consume too much memory.
- Files are decoded and written as UTF-8; other encodings are not detected.
- Incoming Open With permissions may be temporary depending on the sending application/provider.
- Shared binary or invalid files are not rejected explicitly.
- Save success currently has no lightweight toast notification.
- Most UI command text is still English outside the mobile More menu and touch descriptions.
- Production release signing is not configured.

## 11. Recommended Next Work

Priority order:

1. Test the current APK on Android and 卓易通: fresh install, update, open, direct save, Save As, Share, back button, and soft keyboard.
2. Replace cached debug signing with a permanent release keystore stored in GitHub Secrets.
3. Add small non-blocking save/error notifications instead of browser alerts.
4. Add a configurable large-file warning and disable expensive syntax highlighting for large files.
5. Detect unsupported/binary files before loading them into the editor.
6. Add encoding selection or at minimum UTF-8/UTF-8 BOM detection.
7. Translate remaining command and search UI text into Chinese consistently.
8. Add focused unit tests for search, session migration, and file-state transitions.

Avoid adding cloud sync, user accounts, AI functions, a plugin marketplace, or other high-complexity features until the core APK workflow is stable.

## 12. Continuation Checklist

At the start of the next session:

```sh
cd /data/data/com.termux/files/home/test/nodeyyy
git status --short
git log --oneline -5
npm run build
```

Before pushing:

```sh
git diff --check
npm run android:sync
```

Push with the configured GitHub SSH key:

```sh
GIT_SSH_COMMAND='ssh -i /data/data/com.termux/files/home/.ssh/id_ed25519_github -o IdentitiesOnly=yes' \
git push origin main
```

After pushing, verify the latest GitHub Actions run and check that the `debug-latest` APK release was updated.
