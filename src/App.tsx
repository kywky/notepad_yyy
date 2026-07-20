import {
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FilePlus2,
  FileText,
  History,
  Home,
  FolderOpen,
  FolderTree,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Redo2,
  Save,
  Search,
  Sun,
  Undo2,
  WrapText,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type PointerEvent
} from "react";
import { createPortal } from "react-dom";
import CodeEditor, {
  type CodeEditorHandle,
  type CursorInfo
} from "./components/CodeEditor";
import { languageLabel } from "./lib/languages";
import {
  createDocument,
  loadSession,
  saveSession,
  type EditorDocument,
  type EditorSettings
} from "./lib/session";
import {
  findMatches,
  replaceAll as replaceAllText,
  replaceOne,
  type SearchMatch,
  type SearchOptions
} from "./lib/search";
import { APP_NAME } from "./lib/platform";
import {
  hasNativeFilePicker,
  listenForNativeOpenFile,
  openNativeDirectory,
  openNativeTextFile,
  readNativeTextFile,
  exitNativeApp,
  saveNativeTextFile,
  writeNativeTextFile,
  type NativeDirectoryFile,
  type NativeTextFile
} from "./lib/nativeFiles";

type IconButtonProps = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => unknown;
  active?: boolean;
  disabled?: boolean;
};

type DirectoryEntry = {
  key: string;
  name: string;
  path: string;
  uri?: string;
  file?: File;
};

const initialSession = loadSession();
const initialCursor: CursorInfo = { line: 1, column: 1, offset: 0, selectionLength: 0 };
const initialSearch: SearchOptions = {
  query: "",
  replaceWith: "",
  matchCase: false,
  regex: false,
  wholeWord: false
};

function IconButton({ label, icon: Icon, onClick, active, disabled }: IconButtonProps) {
  const pressTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  function clearPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" || disabled) return;
    clearPressTimer();
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    setTooltip(null);
    longPressRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    pressTimerRef.current = window.setTimeout(() => {
      longPressRef.current = true;
      setTooltip({
        left: Math.min(window.innerWidth - 64, Math.max(64, rect.left + rect.width / 2)),
        top: rect.top > 48 ? rect.top - 38 : rect.bottom + 8
      });
      navigator.vibrate?.(12);
      hideTimerRef.current = window.setTimeout(() => setTooltip(null), 1400);
    }, 420);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (longPressRef.current) {
      event.preventDefault();
      longPressRef.current = false;
      return;
    }
    onClick();
  }

  return (
    <>
      <button
        aria-label={label}
        className={`icon-button${active ? " is-active" : ""}`}
        disabled={disabled}
        onClick={handleClick}
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={clearPressTimer}
        onPointerDown={handlePointerDown}
        onPointerLeave={clearPressTimer}
        onPointerUp={clearPressTimer}
        title={label}
        type="button"
      >
        <Icon size={18} strokeWidth={2} />
      </button>
      {tooltip
        ? createPortal(
            <div className="touch-tooltip" role="status" style={tooltip}>
              {label}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function readFiles(files: FileList | File[]): Promise<EditorDocument[]> {
  return Promise.all(
    Array.from(files).map(async (file) =>
      createDocument({ name: file.name, content: await file.text(), dirty: false })
    )
  );
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function lineCount(content: string) {
  return content.length === 0 ? 1 : content.split(/\r\n|\r|\n/).length;
}

function detectEol(content: string) {
  if (content.includes("\r\n")) return "CRLF";
  if (content.includes("\r")) return "CR";
  return "LF";
}

function App() {
  const [screen, setScreen] = useState<"home" | "editor">("home");
  const [documents, setDocuments] = useState<EditorDocument[]>(initialSession.documents);
  const [activeId, setActiveId] = useState(initialSession.activeId);
  const [settings, setSettings] = useState<EditorSettings>(initialSession.settings);
  const [cursor, setCursor] = useState(initialCursor);
  const [searchOptions, setSearchOptions] = useState(initialSearch);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [directoryName, setDirectoryName] = useState("目录");
  const [directoryFiles, setDirectoryFiles] = useState<DirectoryEntry[]>([]);
  const [directoryTruncated, setDirectoryTruncated] = useState(false);
  const [openingPath, setOpeningPath] = useState("");
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeId) ?? documents[0],
    [activeId, documents]
  );

  const recentDocuments = useMemo(
    () => [...documents].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 5),
    [documents]
  );

  const searchResult = useMemo(() => {
    try {
      return { matches: findMatches(activeDocument.content, searchOptions), error: "" };
    } catch (error) {
      return {
        matches: [] as SearchMatch[],
        error: error instanceof Error ? error.message : "查找内容无效"
      };
    }
  }, [activeDocument.content, searchOptions]);

  const status = useMemo(
    () => ({
      lines: lineCount(activeDocument.content),
      characters: activeDocument.content.length,
      eol: detectEol(activeDocument.content)
    }),
    [activeDocument.content]
  );

  const activeLanguage = useMemo(
    () => languageLabel(activeDocument.name),
    [activeDocument.name]
  );

  useEffect(() => saveSession({ documents, activeId, settings }), [activeId, documents, settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.title = screen === "home"
      ? APP_NAME
      : `${activeDocument.dirty ? "* " : ""}${activeDocument.name} - ${APP_NAME}`;
  }, [activeDocument.dirty, activeDocument.name, screen, settings.theme]);

  useEffect(() => {
    directoryInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  useEffect(() => {
    setActiveSearchIndex(-1);
  }, [activeDocument.id, searchOptions.query, searchOptions.matchCase]);

  useEffect(() => {
    let active = true;
    let removeListener: (() => Promise<void>) | null = null;
    void listenForNativeOpenFile((file) => active && addNativeDocument(file))
      .then((handle) => {
        if (!handle) return;
        if (!active) void handle.remove();
        else removeListener = () => handle.remove();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      void removeListener?.();
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(window.innerHeight - viewport.height > 140);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const handleNativeBack = () => {
      if (searchOpen) {
        setSearchOpen(false);
      } else if (sidebarOpen) {
        setSidebarOpen(false);
      } else if (screen === "editor") {
        setScreen("home");
      } else {
        void exitNativeApp();
      }
    };
    window.addEventListener("notepadNativeBack", handleNativeBack);
    return () => window.removeEventListener("notepadNativeBack", handleNativeBack);
  }, [screen, searchOpen, sidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void (event.shiftKey ? saveActiveDocumentAs() : saveActiveDocument());
      } else if (key === "o") {
        event.preventDefault();
        void openFromDevice();
      } else if (key === "n") {
        event.preventDefault();
        newDocument();
      } else if (key === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!documents.some((document) => document.dirty)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [documents]);

  function updateSettings(patch: Partial<EditorSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateDocument(id: string, patch: Partial<EditorDocument>) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === id ? { ...document, ...patch, updatedAt: Date.now() } : document
      )
    );
  }

  function newDocument() {
    const count = documents.filter((document) => document.name.startsWith("新建文本")).length + 1;
    const document = createDocument({ name: `新建文本-${count}.txt` });
    setDocuments((current) => [...current, document]);
    setActiveId(document.id);
    setScreen("editor");
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  async function openFiles(files: FileList | File[]) {
    const opened = await readFiles(files);
    if (opened.length === 0) return;
    setDocuments((current) => [...current, ...opened]);
    setActiveId(opened[0].id);
    setScreen("editor");
  }

  function setDirectory(entries: DirectoryEntry[], name: string, truncated: boolean) {
    setDirectoryName(name || "目录");
    setDirectoryFiles(entries.sort((left, right) => left.path.localeCompare(right.path)));
    setDirectoryTruncated(truncated);
    setSidebarOpen(true);
    setScreen("editor");
  }

  async function openDirectory() {
    if (!hasNativeFilePicker()) {
      directoryInputRef.current?.click();
      return;
    }

    try {
      const directory = await openNativeDirectory();
      if (!directory) return;
      const entries = (directory.files ?? []).map((file: NativeDirectoryFile) => ({
        key: `native:${file.uri}`,
        name: file.name,
        path: file.path,
        uri: file.uri
      }));
      setDirectory(entries, directory.name ?? "目录", Boolean(directory.truncated));
    } catch {
      window.alert("无法读取该目录。");
    }
  }

  async function openDirectoryEntry(entry: DirectoryEntry) {
    const existing = documents.find((document) => document.sourcePath === entry.key);
    if (existing) {
      setActiveId(existing.id);
      setScreen("editor");
      if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(false);
      return;
    }

    setOpeningPath(entry.key);
    try {
      const nativeFile = entry.uri ? await readNativeTextFile(entry.uri) : null;
      const content = entry.file ? await entry.file.text() : nativeFile?.content;
      if (content === undefined) throw new Error("File content is unavailable");
      const document = createDocument({
        name: entry.name,
        content,
        dirty: false,
        nativeUri: entry.uri,
        sourcePath: entry.key
      });
      setDocuments((current) => [...current, document]);
      setActiveId(document.id);
      setScreen("editor");
      if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(false);
    } catch {
      window.alert("无法作为文本打开该文件。");
    } finally {
      setOpeningPath("");
    }
  }

  async function openFromDevice() {
    if (!hasNativeFilePicker()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const file = await openNativeTextFile();
      if (file) addNativeDocument(file);
    } catch {
      window.alert("无法打开该文件。请确认它是可读取的文本文件。");
    }
  }

  function addNativeDocument(file: NativeTextFile) {
    if (!file.name || file.content === undefined) return;
    const sourcePath = file.uri ? `native:${file.uri}` : undefined;
    const existing = sourcePath
      ? documents.find((document) => document.sourcePath === sourcePath)
      : undefined;
    if (existing) {
      setActiveId(existing.id);
      setScreen("editor");
      return;
    }
    const document = createDocument({
      name: file.name,
      content: file.content,
      dirty: false,
      nativeUri: file.uri,
      sourcePath
    });
    setDocuments((current) => [...current, document]);
    setActiveId(document.id);
    setScreen("editor");
  }

  function openRecent(document: EditorDocument) {
    setActiveId(document.id);
    setScreen("editor");
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  async function saveAs(fileName: string, content: string) {
    if (!hasNativeFilePicker()) {
      downloadText(fileName, content);
      return { saved: true, uri: undefined as string | undefined };
    }
    try {
      const result = await saveNativeTextFile({ fileName, content, mimeType: "text/plain" });
      return { saved: Boolean(result), uri: result?.uri };
    } catch {
      window.alert("保存失败。");
      return { saved: false, uri: undefined as string | undefined };
    }
  }

  async function saveActiveDocument() {
    if (activeDocument.nativeUri && hasNativeFilePicker()) {
      try {
        await writeNativeTextFile({ uri: activeDocument.nativeUri, content: activeDocument.content });
        updateDocument(activeDocument.id, { dirty: false });
        return;
      } catch {
        window.alert("原文件无法写入，请重新选择保存位置。");
      }
    }
    await saveActiveDocumentAs();
  }

  async function saveActiveDocumentAs() {
    const result = await saveAs(activeDocument.name || "新建文本.txt", activeDocument.content);
    if (result.saved) {
      updateDocument(activeDocument.id, {
        dirty: false,
        nativeUri: result.uri ?? activeDocument.nativeUri
      });
    }
  }

  function closeDocument(id: string) {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    if (document.dirty && !window.confirm(`“${document.name}”尚未保存，仍然关闭吗？`)) return;
    if (documents.length === 1) {
      const replacement = createDocument({ name: "新建文本-1.txt" });
      setDocuments([replacement]);
      setActiveId(replacement.id);
      return;
    }
    const index = documents.findIndex((item) => item.id === id);
    const next = documents.filter((item) => item.id !== id);
    setDocuments(next);
    if (activeId === id) setActiveId(next[Math.max(0, index - 1)]?.id ?? next[0].id);
  }

  function renameDocument(id: string) {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const name = window.prompt("文件名", document.name)?.trim();
    if (name) updateDocument(id, { name });
  }

  function findNext() {
    const matches = searchResult.matches;
    if (matches.length === 0) return;
    const selection = editorRef.current?.getSelection();
    const start = selection && selection.to > selection.from ? selection.to : cursor.offset;
    const index = matches.findIndex((match) => match.from >= start);
    const nextIndex = index >= 0 ? index : 0;
    setActiveSearchIndex(nextIndex);
    editorRef.current?.selectRange(matches[nextIndex].from, matches[nextIndex].to);
  }

  function findPrevious() {
    const matches = searchResult.matches;
    if (matches.length === 0) return;
    const selection = editorRef.current?.getSelection();
    const start = selection && selection.to > selection.from ? selection.from : cursor.offset;
    let index = -1;
    for (let current = matches.length - 1; current >= 0; current -= 1) {
      if (matches[current].to <= start) {
        index = current;
        break;
      }
    }
    const previousIndex = index >= 0 ? index : matches.length - 1;
    setActiveSearchIndex(previousIndex);
    editorRef.current?.selectRange(matches[previousIndex].from, matches[previousIndex].to);
  }

  function replaceCurrent() {
    const selection = editorRef.current?.getSelection();
    if (!selection || selection.from === selection.to) {
      findNext();
      return;
    }
    const match = searchResult.matches.find(
      (item) => item.from === selection.from && item.to === selection.to
    );
    if (!match) {
      findNext();
      return;
    }
    editorRef.current?.replaceRange(match.from, match.to, replaceOne(match.text, searchOptions));
    setActiveSearchIndex(-1);
  }

  function replaceAll() {
    if (!searchOptions.query || searchResult.error) return;
    updateDocument(activeDocument.id, {
      content: replaceAllText(activeDocument.content, searchOptions),
      dirty: true
    });
    setActiveSearchIndex(-1);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) void openFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  }

  function handleDirectoryInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length > 0) {
      const visibleFiles = files.slice(0, 500);
      const firstPath = visibleFiles[0].webkitRelativePath || visibleFiles[0].name;
      const name = firstPath.split("/")[0] || "目录";
      setDirectory(
        visibleFiles.map((file) => {
          const path = file.webkitRelativePath || file.name;
          return {
            key: `web:${path}:${file.lastModified}`,
            name: file.name,
            path: path.startsWith(`${name}/`) ? path.slice(name.length + 1) : path,
            file
          };
        }),
        name,
        files.length > visibleFiles.length
      );
    }
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) void openFiles(event.dataTransfer.files);
  }

  const matchLabel = searchResult.error
    ? searchResult.error
    : `${searchResult.matches.length} 个匹配`;

  if (screen === "home") {
    return (
      <div className="home-screen">
        <input ref={fileInputRef} className="hidden-file-input" multiple onChange={handleFileInput} type="file" />
        <input ref={directoryInputRef} className="hidden-file-input" multiple onChange={handleDirectoryInput} type="file" />
        <button
          aria-label="切换明暗主题"
          className="home-theme-button"
          onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
          type="button"
        >
          {settings.theme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <main className="home-content">
          <section className="home-hero">
            <img alt="" className="home-logo" src="/icons/icon.svg" />
            <div>
              <p className="home-eyebrow">轻量文本编辑器</p>
              <h1>{APP_NAME}</h1>
              <p className="home-subtitle">简单、快速，随时开始编辑。</p>
            </div>
          </section>

          <section className="home-actions" aria-label="开始">
            <button className="home-action is-primary" onClick={newDocument} type="button">
              <span className="home-action-icon"><FilePlus2 size={23} /></span>
              <span><strong>新建</strong><small>创建一个空白文本</small></span>
              <ChevronRight size={19} />
            </button>
            <button className="home-action" onClick={() => void openFromDevice()} type="button">
              <span className="home-action-icon"><FolderOpen size={23} /></span>
              <span><strong>打开</strong><small>从设备选择文本文件</small></span>
              <ChevronRight size={19} />
            </button>
            <button className="home-action" onClick={() => void openDirectory()} type="button">
              <span className="home-action-icon"><FolderTree size={23} /></span>
              <span><strong>打开文件夹</strong><small>浏览文件夹中的文本</small></span>
              <ChevronRight size={19} />
            </button>
          </section>

          <section className="recent-section">
            <div className="recent-heading"><span><History size={17} />打开最近</span><small>{recentDocuments.length} 个项目</small></div>
            <div className="recent-list">
              {recentDocuments.map((document) => (
                <button key={document.id} onClick={() => openRecent(document)} type="button">
                  <FileText size={18} />
                  <span><strong>{document.name}</strong><small>{document.dirty ? "有未保存的修改" : "最近编辑"}</small></span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`app-shell${searchOpen ? " search-open" : ""}${keyboardOpen ? " keyboard-open" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} className="hidden-file-input" multiple onChange={handleFileInput} type="file" />
      <input
        ref={directoryInputRef}
        className="hidden-file-input"
        multiple
        onChange={handleDirectoryInput}
        type="file"
      />

      <header className="topbar">
        <div className="title-row">
          <button className="brand brand-button" onClick={() => setScreen("home")} type="button"><Home size={17} /><span>{APP_NAME}</span></button>
          <div className="active-file" title={activeDocument.name}>
            {activeDocument.dirty ? "* " : ""}{activeDocument.name}
          </div>
          <IconButton
            icon={settings.theme === "dark" ? Moon : Sun}
            label="切换明暗主题"
            onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
          />
        </div>

        <div className="main-toolbar" aria-label="常用操作">
          <IconButton icon={FilePlus2} label="新建文本" onClick={newDocument} />
          <IconButton icon={FolderOpen} label="打开任意文本文件" onClick={openFromDevice} />
          <IconButton icon={FolderTree} label="打开目录" onClick={openDirectory} />
          <IconButton
            active={sidebarOpen}
            icon={PanelLeft}
            label={sidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
            onClick={() => setSidebarOpen((current) => !current)}
          />
          <IconButton icon={Save} label="保存文件" onClick={saveActiveDocument} />
          <span className="toolbar-separator" />
          <IconButton icon={Undo2} label="撤销" onClick={() => editorRef.current?.undo()} />
          <IconButton icon={Redo2} label="重做" onClick={() => editorRef.current?.redo()} />
          <IconButton active={searchOpen} icon={Search} label="查找和替换" onClick={() => setSearchOpen(!searchOpen)} />
          <label
            className={`wrap-toggle${settings.lineWrapping ? " is-active" : ""}`}
            title={settings.lineWrapping ? "自动换行已开启" : "自动换行已关闭，可左右滚动"}
          >
            <WrapText size={17} strokeWidth={2} />
            <span>换行</span>
            <input
              aria-label="自动换行"
              checked={settings.lineWrapping}
              onChange={(event) => updateSettings({ lineWrapping: event.target.checked })}
              type="checkbox"
            />
          </label>
          <span className="toolbar-separator" />
          <IconButton
            disabled={settings.fontSize <= 11}
            icon={Minus}
            label="减小字体"
            onClick={() => updateSettings({ fontSize: Math.max(11, settings.fontSize - 1) })}
          />
          <span className="font-size-label">{settings.fontSize}</span>
          <IconButton
            disabled={settings.fontSize >= 32}
            icon={Plus}
            label="增大字体"
            onClick={() => updateSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
          />
        </div>
      </header>

      {searchOpen ? (
        <section className="search-panel" aria-label="查找替换">
          <div className="search-inputs">
            <input
              autoFocus
              onChange={(event) => setSearchOptions((current) => ({ ...current, query: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && (event.shiftKey ? findPrevious() : findNext())}
              placeholder="查找内容"
              type="text"
              value={searchOptions.query}
            />
            <input
              onChange={(event) => setSearchOptions((current) => ({ ...current, replaceWith: event.target.value }))}
              placeholder="替换为"
              type="text"
              value={searchOptions.replaceWith}
            />
          </div>
          <div className="search-actions">
            <button
              className={searchOptions.matchCase ? "is-active" : ""}
              onClick={() => setSearchOptions((current) => ({ ...current, matchCase: !current.matchCase }))}
              type="button"
            >
              区分大小写
            </button>
            <button onClick={findPrevious} type="button"><ChevronLeft size={16} />上一个</button>
            <button onClick={findNext} type="button">下一个<ChevronRight size={16} /></button>
            <button onClick={replaceCurrent} type="button">替换</button>
            <button onClick={replaceAll} type="button">全部替换</button>
            <span className={searchResult.error ? "search-count is-error" : "search-count"}>{matchLabel}</span>
            <IconButton icon={X} label="关闭查找" onClick={() => setSearchOpen(false)} />
          </div>
        </section>
      ) : null}

      <div className="workspace">
        {sidebarOpen ? (
          <>
            <button
              aria-label="关闭侧边栏"
              className="sidebar-scrim"
              onClick={() => setSidebarOpen(false)}
              type="button"
            />
            <aside className="sidebar" aria-label="目录文件">
              <div className="sidebar-header">
                <span title={directoryName}>{directoryName}</span>
                <IconButton icon={FolderTree} label="选择目录" onClick={openDirectory} />
                <IconButton icon={X} label="隐藏侧边栏" onClick={() => setSidebarOpen(false)} />
              </div>
              <div className="sidebar-files">
                {directoryFiles.length === 0 ? (
                  <button className="choose-directory" onClick={openDirectory} type="button">
                    <FolderTree size={17} />选择目录
                  </button>
                ) : directoryFiles.map((file) => (
                  <button
                    className="directory-file"
                    disabled={openingPath === file.key}
                    key={file.key}
                    onClick={() => void openDirectoryEntry(file)}
                    title={file.path}
                    type="button"
                  >
                    <FileCode2 size={15} />
                    <span>{file.path}</span>
                  </button>
                ))}
              </div>
              {directoryTruncated ? <div className="sidebar-note">仅显示前 500 个文件</div> : null}
            </aside>
          </>
        ) : null}

        <section className="editor-workspace">
          <div className="tab-strip" role="tablist" aria-label="打开的文件">
            {documents.map((document) => (
              <button
                className={`tab${document.id === activeId ? " is-active" : ""}`}
                key={document.id}
                onClick={() => setActiveId(document.id)}
                onDoubleClick={() => renameDocument(document.id)}
                role="tab"
                type="button"
              >
                <span>{document.dirty ? `* ${document.name}` : document.name}</span>
                <span
                  className="tab-close"
                  onClick={(event) => { event.stopPropagation(); closeDocument(document.id); }}
                  role="button"
                  title="关闭"
                >
                  <X size={13} />
                </span>
              </button>
            ))}
          </div>

          <main className="editor-pane">
            <CodeEditor
              ref={editorRef}
              activeSearchIndex={activeSearchIndex}
              content={activeDocument.content}
              fileName={activeDocument.name}
              fontSize={settings.fontSize}
              lineWrapping={settings.lineWrapping}
              onChange={(content) => updateDocument(activeDocument.id, { content, dirty: true })}
              onCursorChange={setCursor}
              onFontSizeChange={(fontSize) => updateSettings({ fontSize })}
              searchMatches={searchResult.matches}
              theme={settings.theme}
            />
          </main>
        </section>
      </div>

      <footer className="statusbar">
        <span>Ln {cursor.line}, Col {cursor.column}</span>
        <span>{activeLanguage}</span>
        <span>{settings.lineWrapping ? "自动换行" : "左右滚动"}</span>
        <span>{status.lines} 行</span>
        <span>{status.characters} 字符</span>
        <span>{status.eol}</span>
        <span>UTF-8</span>
        <span>{activeDocument.dirty ? "未保存" : "已保存"}</span>
      </footer>
    </div>
  );
}

export default App;
