# Notepad+ 项目交接文档

更新时间：2026-07-17

## 项目目标

这是一个安卓端轻量日志与文本编辑器，参考 Notepad++ 的核心使用方式，但主动减少复杂功能。

主要使用场景：

- 查看手机上的日志文件
- 文件可能没有后缀，或者使用未知后缀
- 简单修改日志或文本内容
- 查找、替换并高亮匹配结果
- 新建和保存普通文本文件

当前不计划加入云同步、账号、插件系统、AI、复杂语法分析、工程目录或高级代码重构功能。

## 当前基线

仓库：

```txt
https://github.com/kywky/notepad_yyy.git
```

本地目录：

```txt
/data/data/com.termux/files/home/test/nodeyyy
```

安卓包名：

```txt
com.kywky.notepadyyy
```

技术栈：

- React 19
- TypeScript
- Vite
- CodeMirror 6
- Capacitor 8
- Lucide 图标

Android 配置：

- minSdk 24
- compileSdk 36
- targetSdk 35
- GitHub Actions 自动构建兼容测试 APK

## 已保留功能

### 文件

- 新建文本
- Android 系统文件选择器打开文件
- 不限制文件后缀和 MIME 类型
- 支持未知后缀、无后缀和 `application/octet-stream`
- 支持 Android“打开方式”
- 支持从其他应用分享文字或文件
- 保存到原文件
- 另存为新位置
- 原文件权限失效时自动回退到另存为
- 浏览器开发模式使用下载文件作为保存兜底

### 编辑

- 多标签文档
- 行号
- 撤销和重做
- 自动换行
- 字体大小调整
- 明暗主题
- 光标行列、行数、字符数、换行格式和保存状态
- 会话自动保存和恢复

### 查找替换

- 普通文本查找
- 区分大小写
- 上一个和下一个匹配
- 替换当前匹配
- 全部替换
- 所有匹配结果高亮
- 当前匹配使用更明显的高亮颜色

### 手机体验

- 紧凑顶部工具栏
- 图标桌面悬停说明
- 手机长按图标显示中文说明
- Android 返回键优先关闭查找面板
- 软键盘弹出时隐藏状态栏，为编辑区让出空间
- 横向滚动工具栏和标签栏

## 已删除的复杂功能

- 命令面板
- 文档侧边栏
- 会话备份和恢复入口
- 导出全部文档
- 手动语言选择
- JavaScript、HTML、CSS、JSON、Markdown、Python、XML 等语法插件
- 自动补全
- 代码折叠
- 括号匹配
- 多光标和矩形选择
- 大小写转换
- 行排序
- 去除重复行
- 行上移和下移
- 清理行尾空格
- 底部复杂操作栏和更多菜单

移除后，前端 JavaScript 构建体积从约 886 KB 降到约 504 KB，CSS 从约 14.5 KB 降到约 6.1 KB。

## 关键文件

```txt
src/App.tsx
```

主界面、标签、文件操作、查找替换、快捷键、主题和移动端行为。

```txt
src/components/CodeEditor.tsx
```

精简后的 CodeMirror 配置和查找结果装饰高亮。

```txt
src/lib/session.ts
```

文档和设置模型、会话持久化、Android 文件 URI。

```txt
src/lib/search.ts
```

查找和替换纯函数。

```txt
src/lib/nativeFiles.ts
```

前端与 Android 原生文件插件之间的桥接。

```txt
android/app/src/main/java/com/kywky/notepadyyy/NotepadFilesPlugin.java
```

Android 文件选择、读取、保存、直接写回和分享接收。

## 文档数据模型

每个标签保存：

- `id`
- `name`
- `content`
- `nativeUri`，可选
- `dirty`
- `createdAt`
- `updatedAt`

编辑器设置只保留：

- `theme`
- `lineWrapping`
- `fontSize`

旧会话中多余的语言、侧栏和搜索设置字段会被忽略。

## 开发和构建

安装依赖：

```sh
npm install
```

开发服务器：

```sh
npm run dev
```

前端构建：

```sh
npm run build
```

同步 Android：

```sh
npm run android:sync
```

本地 APK：

```sh
npm run android:apk
```

当前 Termux 没有配置 Java 和 Android SDK，通常使用 GitHub Actions 打包。

最新 APK：

```txt
https://github.com/kywky/notepad_yyy/releases/download/debug-latest/app-debug.apk
```

本机下载位置：

```txt
/data/data/com.termux/files/home/notepad_yyy_apk/app-debug.apk
```

## 卓易通注意事项

- 当前是兼容测试 APK，不是正式 release 包。
- targetSdk 已降到 35。
- GitHub Actions 使用缓存测试签名，旧签名 APK 需要卸载一次。
- 后续正式分发必须使用 GitHub Secrets 保存永久 release 签名。
- 鸿蒙 NEXT 是否可用仍取决于卓易通自身的 APK 兼容和安装策略。

## 已知限制

- 所有文件都按 UTF-8 文本读取，二进制文件可能显示乱码。
- 暂未检测 GBK、UTF-16 等编码。
- 暂未对超大日志文件做内存保护。
- 文件内容一次性读入内存，不适合数百 MB 的日志。
- 尚无自动化 UI 测试。
- 查找只保留普通文本和区分大小写，没有正则表达式。
- 测试签名依赖 GitHub Actions cache，不适合作为长期正式签名。

## 推荐下一步

1. 在普通 Android 和卓易通中测试任意后缀文件打开。
2. 测试无后缀日志、较大日志、直接保存和另存为。
3. 增加文件大小提示，例如超过 20 MB 时提醒用户。
4. 增加 UTF-8 BOM、UTF-16 和 GBK 编码检测。
5. 使用轻量 toast 替代 `window.alert`。
6. 配置永久 release 签名。
7. 添加搜索和会话迁移单元测试。

## 下一次会话检查

```sh
cd /data/data/com.termux/files/home/test/nodeyyy
git status --short
git log --oneline -5
npm run build
```

提交前：

```sh
git diff --check
npm run android:sync
```

推送：

```sh
GIT_SSH_COMMAND='ssh -i /data/data/com.termux/files/home/.ssh/id_ed25519_github -o IdentitiesOnly=yes' \
git push origin main
```
