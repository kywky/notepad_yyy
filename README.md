# Notepad+

一个面向安卓手机的轻量日志与文本编辑器，目标是提供类似 Notepad++ 的核心体验，但不加入复杂功能。

当前保留的核心能力：

- 打开任意文件名、任意后缀或无后缀的文本/日志文件
- 多标签查看和编辑
- 新建、保存、另存为、原文件覆盖保存
- 撤销、重做和自动换行
- 查找、替换、全部替换和所有匹配结果高亮
- 行号、光标位置、行数和字符数显示
- 明暗主题和字体大小调整
- Android“打开方式”和“分享”进入应用

当前项目状态、架构、打包流程、卓易通注意事项和后续计划见：

[项目交接文档](docs/PROJECT_HANDOFF.md)

## 本地开发

```sh
npm install
npm run dev
```

开发地址：

```txt
http://localhost:5173/
```

## 前端构建

```sh
npm run build
```

输出目录：

```txt
dist/
```

## 预览构建

```sh
npm run preview -- --port 4173
```

预览地址：

```txt
http://localhost:4173/
```

## Android APK

项目使用 Capacitor Android。文件选择器不按后缀过滤，未知后缀和无后缀日志也可以选择打开。

同步网页资源到 Android：

```sh
npm run android:sync
```

安装 Java 和 Android SDK 后可本地打包：

```sh
npm run android:apk
```

APK 输出位置：

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

当前 Termux 未配置 Java 和 Android SDK，通常通过 GitHub Actions 自动构建 APK。

最新测试 APK：

```txt
https://github.com/kywky/notepad_yyy/releases/download/debug-latest/app-debug.apk
```
