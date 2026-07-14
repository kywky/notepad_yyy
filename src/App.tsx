import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Command,
  Copy,
  Ellipsis,
  FilePlus2,
  FileText,
  FolderOpen,
  List,
  Moon,
  PanelLeft,
  Redo2,
  Regex,
  Replace,
  Save,
  Search,
  Settings2,
  SortAsc,
  Sun,
  Trash2,
  Type,
  Undo2,
  WholeWord,
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
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import CodeEditor, { type CodeEditorHandle, type CursorInfo } from "./components/CodeEditor";
import { detectLanguage, languageOptions, type LanguageId } from "./lib/languages";
import {
  createDocument,
  loadSession,
  saveSession,
  type EditorDocument,
  type EditorSettings,
  type PersistedSession
} from "./lib/session";
import {
  findMatches,
  replaceAll as replaceAllText,
  replaceOne,
  type SearchOptions
} from "./lib/search";
import { APP_NAME } from "./lib/platform";
import {
  hasNativeFilePicker,
  listenForNativeOpenFile,
  openNativeTextFile,
  saveNativeTextFile,
  writeNativeTextFile,
  type NativeTextFile
} from "./lib/nativeFiles";

type IconButtonProps = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => unknown;
  active?: boolean;
  disabled?: boolean;
};

type AppCommand = {
  id: string;
  label: string;
  run: () => void;
};

const initialSession = loadSession();

const initialCursor: CursorInfo = {
  line: 1,
  column: 1,
  offset: 0,
  selectionLength: 0
};

const initialSearch: SearchOptions = {
  query: "",
  replaceWith: "",
  matchCase: false,
  regex: false,
  wholeWord: false
};

const iconDescriptions: Record<string, string> = {
  "Backup session": "备份会话",
  "Close commands": "关闭",
  "Close search": "关闭搜索",
  Commands: "命令列表",
  "Delete line": "删除当前行",
  Documents: "文档列表",
  "Duplicate line": "复制当前行",
  "Export all": "导出全部文档",
  Find: "查找替换",
  Lowercase: "转换为小写",
  "Match case": "区分大小写",
  "Move line down": "当前行下移",
  "Move line up": "当前行上移",
  "More actions": "更多编辑操作",
  New: "新建文档",
  Open: "打开文件",
  Redo: "重做",
  "Regular expression": "正则表达式",
  "Remove duplicate lines": "去除重复行",
  Replace: "替换",
  "Restore backup": "恢复备份",
  Save: "保存文件",
  "Sort lines": "行排序",
  Theme: "切换主题",
  "Trim trailing spaces": "清理行尾空格",
  Undo: "撤销",
  Uppercase: "转换为大写",
  "Whole word": "全词匹配",
  "Word wrap": "自动换行"
};

function IconButton({ label, icon: Icon, onClick, active, disabled }: IconButtonProps) {
  const description = iconDescriptions[label] ?? label;
  const pressTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  function clearPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" || disabled) {
      return;
    }

    clearPressTimer();
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
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
        aria-label={description}
        className={`icon-button${active ? " is-active" : ""}`}
        disabled={disabled}
        onClick={handleClick}
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={clearPressTimer}
        onPointerDown={handlePointerDown}
        onPointerLeave={clearPressTimer}
        onPointerUp={clearPressTimer}
        title={description}
        type="button"
      >
        <Icon size={17} strokeWidth={2} />
      </button>
      {tooltip
        ? createPortal(
            <div
              className="touch-tooltip"
              role="status"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              {description}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="toolbar-group" role="group" aria-label={label}>
      <span className="toolbar-label">{label}</span>
      {children}
    </div>
  );
}

function readFiles(files: FileList | File[]): Promise<EditorDocument[]> {
  return Promise.all(
    Array.from(files).map(async (file) =>
      createDocument({
        name: file.name,
        content: await file.text(),
        dirty: false,
        language: detectLanguage(file.name)
      })
    )
  );
}

function downloadText(fileName: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function lineCount(content: string) {
  return content.length === 0 ? 1 : content.split(/\r\n|\r|\n/).length;
}

function detectEol(content: string) {
  if (content.includes("\r\n")) {
    return "CRLF";
  }

  if (content.includes("\r")) {
    return "CR";
  }

  return "LF";
}

function App() {
  const [documents, setDocuments] = useState<EditorDocument[]>(initialSession.documents);
  const [activeId, setActiveId] = useState(initialSession.activeId);
  const [settings, setSettings] = useState<EditorSettings>(initialSession.settings);
  const [cursor, setCursor] = useState(initialCursor);
  const [searchOptions, setSearchOptions] = useState(initialSearch);
  const [commandOpen, setCommandOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const settingsRef = useRef(settings);
  const commandOpenRef = useRef(commandOpen);
  const moreOpenRef = useRef(moreOpen);
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocument = useMemo(() => {
    return documents.find((document) => document.id === activeId) ?? documents[0];
  }, [activeId, documents]);

  const activeLanguageLabel =
    languageOptions.find((language) => language.id === activeDocument.language)?.label ?? "Plain Text";

  const searchResult = useMemo(() => {
    try {
      return {
        matches: findMatches(activeDocument.content, searchOptions),
        error: ""
      };
    } catch (error) {
      return {
        matches: [],
        error: error instanceof Error ? error.message : "Invalid search"
      };
    }
  }, [activeDocument.content, searchOptions]);

  const status = useMemo(
    () => ({
      lines: lineCount(activeDocument.content),
      characters: activeDocument.content.length,
      eol: detectEol(activeDocument.content),
      sessionSize: new Blob([JSON.stringify({ documents, activeId, settings })]).size
    }),
    [activeDocument.content, activeId, documents, settings]
  );

  useEffect(() => {
    saveSession({ documents, activeId, settings });
  }, [activeId, documents, settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.title = `${activeDocument.dirty ? "* " : ""}${activeDocument.name} - ${APP_NAME}`;
  }, [activeDocument.dirty, activeDocument.name, settings.theme]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    commandOpenRef.current = commandOpen;
  }, [commandOpen]);

  useEffect(() => {
    moreOpenRef.current = moreOpen;
  }, [moreOpen]);

  useEffect(() => {
    let active = true;
    let removeListener: (() => Promise<void>) | null = null;

    void listenForNativeOpenFile((file) => {
      if (active) {
        addNativeDocument(file);
      }
    })
      .then((handle) => {
        if (!handle) {
          return;
        }

        if (!active) {
          void handle.remove();
          return;
        }

        removeListener = () => handle.remove();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void removeListener?.();
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateKeyboardState = () => {
      setKeyboardOpen(window.innerHeight - viewport.height > 140);
    };

    updateKeyboardState();
    viewport.addEventListener("resize", updateKeyboardState);
    viewport.addEventListener("scroll", updateKeyboardState);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardState);
      viewport.removeEventListener("scroll", updateKeyboardState);
    };
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, notepadRoot: true }, "");
    window.history.pushState({ notepadBackGuard: true }, "");

    const handlePopState = () => {
      const currentSettings = settingsRef.current;

      if (currentSettings.searchOpen) {
        updateSettings({ searchOpen: false });
        window.history.pushState({ notepadBackGuard: true }, "");
        return;
      }

      if (commandOpenRef.current) {
        setCommandOpen(false);
        window.history.pushState({ notepadBackGuard: true }, "");
        return;
      }

      if (moreOpenRef.current) {
        setMoreOpen(false);
        window.history.pushState({ notepadBackGuard: true }, "");
        return;
      }

      if (currentSettings.sidebarOpen) {
        updateSettings({ sidebarOpen: false });
        window.history.pushState({ notepadBackGuard: true }, "");
        return;
      }

      window.history.back();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;

      if (!modifier) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          void saveActiveDocumentAs();
        } else {
          void saveActiveDocument();
        }
      }

      if (key === "o") {
        event.preventDefault();
        void openFromDevice();
      }

      if (key === "n") {
        event.preventDefault();
        newDocument();
      }

      if (key === "f") {
        event.preventDefault();
        updateSettings({ searchOpen: true });
      }

      if (key === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!documents.some((document) => document.dirty)) {
        return;
      }

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

  function updateActiveContent(content: string) {
    updateDocument(activeId, { content, dirty: true });
  }

  function activateDocument(id: string) {
    setActiveId(id);

    if (window.matchMedia("(max-width: 820px)").matches) {
      updateSettings({ sidebarOpen: false });
    }
  }

  function newDocument() {
    const nextIndex =
      documents.reduce((highest, document) => {
        const match = document.name.match(/^Untitled-(\d+)\.txt$/);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0) + 1;

    const document = createDocument({ name: `Untitled-${nextIndex}.txt`, dirty: false });
    setDocuments((current) => [...current, document]);
    setActiveId(document.id);
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  async function openFiles(files: FileList | File[]) {
    const nextDocuments = await readFiles(files);

    if (nextDocuments.length === 0) {
      return;
    }

    setDocuments((current) => [...current, ...nextDocuments]);
    setActiveId(nextDocuments[0].id);
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  async function openFromDevice() {
    if (!hasNativeFilePicker()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const file = await openNativeTextFile();
      if (!file) {
        return;
      }

      addNativeDocument(file);
    } catch {
      window.alert("Could not open file.");
    }
  }

  function addNativeDocument(file: NativeTextFile) {
    if (!file.name || file.content === undefined) {
      return;
    }

    const document = createDocument({
      name: file.name,
      content: file.content,
      dirty: false,
      language: detectLanguage(file.name),
      nativeUri: file.uri
    });
    setDocuments((current) => [...current, document]);
    setActiveId(document.id);
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  async function saveTextOutput(fileName: string, content: string, type = "text/plain;charset=utf-8") {
    if (hasNativeFilePicker()) {
      try {
        const mimeType = type.split(";")[0] || "text/plain";
        const result = await saveNativeTextFile({ fileName, content, mimeType });
        return { saved: Boolean(result), uri: result?.uri };
      } catch {
        window.alert("Could not save file.");
        return { saved: false };
      }
    }

    downloadText(fileName, content, type);
    return { saved: true };
  }

  async function saveActiveDocument() {
    if (activeDocument.nativeUri && hasNativeFilePicker()) {
      try {
        await writeNativeTextFile({
          uri: activeDocument.nativeUri,
          content: activeDocument.content
        });
        updateDocument(activeDocument.id, { dirty: false });
        return;
      } catch {
        window.alert("The original file is unavailable. Choose a new save location.");
      }
    }

    await saveActiveDocumentAs();
  }

  async function saveActiveDocumentAs() {
    const result = await saveTextOutput(
      activeDocument.name || "Untitled.txt",
      activeDocument.content
    );
    if (result.saved) {
      updateDocument(activeDocument.id, {
        dirty: false,
        nativeUri: result.uri ?? activeDocument.nativeUri
      });
    }
  }

  async function exportAllDocuments() {
    const content = documents
      .map((document) =>
        [
          `===== ${document.name} =====`,
          `Language: ${document.language}`,
          `Updated: ${new Date(document.updatedAt).toLocaleString()}`,
          "",
          document.content
        ].join("\n")
      )
      .join("\n\n");

    await saveTextOutput(`notepad-plus-documents-${Date.now()}.txt`, content);
  }

  async function backupSession() {
    const backup: PersistedSession & { exportedAt: string } = {
      documents,
      activeId,
      settings,
      exportedAt: new Date().toISOString()
    };

    await saveTextOutput(
      `notepad-plus-backup-${Date.now()}.json`,
      JSON.stringify(backup, null, 2),
      "application/json"
    );
  }

  async function restoreSession(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<PersistedSession>;
      const nextDocuments = Array.isArray(parsed.documents) ? parsed.documents : [];

      if (nextDocuments.length === 0 || !parsed.activeId || !parsed.settings) {
        window.alert("Backup file is not valid.");
        return;
      }

      if (!window.confirm("Restore this backup? Current session will be replaced.")) {
        return;
      }

      setDocuments(nextDocuments);
      setActiveId(
        nextDocuments.some((document) => document.id === parsed.activeId)
          ? parsed.activeId
          : nextDocuments[0].id
      );
      setSettings((current) => ({ ...current, ...parsed.settings }));
    } catch {
      window.alert("Could not read backup file.");
    }
  }

  function handleBackupInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      void restoreSession(file);
      event.currentTarget.value = "";
    }
  }

  function closeDocument(id: string) {
    const document = documents.find((item) => item.id === id);

    if (!document) {
      return;
    }

    if (document.dirty && !window.confirm(`Close ${document.name} without saving?`)) {
      return;
    }

    if (documents.length === 1) {
      const nextDocument = createDocument({ name: "Untitled-1.txt" });
      setDocuments([nextDocument]);
      setActiveId(nextDocument.id);
      return;
    }

    const index = documents.findIndex((item) => item.id === id);
    const nextDocuments = documents.filter((item) => item.id !== id);
    setDocuments(nextDocuments);

    if (activeId === id) {
      setActiveId(nextDocuments[Math.max(0, index - 1)]?.id ?? nextDocuments[0].id);
    }
  }

  function renameDocument(id: string) {
    const document = documents.find((item) => item.id === id);
    if (!document) {
      return;
    }

    const name = window.prompt("File name", document.name)?.trim();
    if (!name) {
      return;
    }

    updateDocument(id, { name, language: detectLanguage(name) });
  }

  function changeLanguage(language: LanguageId) {
    updateDocument(activeDocument.id, { language });
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) {
      void openFiles(event.currentTarget.files);
      event.currentTarget.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.dataTransfer.files.length > 0) {
      void openFiles(event.dataTransfer.files);
    }
  }

  function selectMatch(match: { from: number; to: number }) {
    editorRef.current?.selectRange(match.from, match.to);
  }

  function findNext() {
    const matches = searchResult.matches;
    if (matches.length === 0) {
      return;
    }

    const selection = editorRef.current?.getSelection();
    const start = selection && selection.to > selection.from ? selection.to : cursor.offset;
    const next = matches.find((match) => match.from >= start) ?? matches[0];
    selectMatch(next);
  }

  function findPrevious() {
    const matches = searchResult.matches;
    if (matches.length === 0) {
      return;
    }

    const selection = editorRef.current?.getSelection();
    const start = selection && selection.to > selection.from ? selection.from : cursor.offset;
    const previous = [...matches].reverse().find((match) => match.to <= start) ?? matches[matches.length - 1];
    selectMatch(previous);
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
  }

  function replaceAll() {
    if (!searchOptions.query || searchResult.error) {
      return;
    }

    updateActiveContent(replaceAllText(activeDocument.content, searchOptions));
  }

  function transformSelection(transform: (value: string) => string, useWholeDocument = false) {
    const selection = editorRef.current?.getSelection();
    if (!selection) {
      return;
    }

    const hasSelection = selection.to > selection.from;
    if (!hasSelection && !useWholeDocument) {
      return;
    }

    const from = hasSelection ? selection.from : 0;
    const to = hasSelection ? selection.to : activeDocument.content.length;
    const text = activeDocument.content.slice(from, to);
    editorRef.current?.replaceRange(from, to, transform(text));
  }

  function getSelectedLineRange() {
    const selection = editorRef.current?.getSelection();
    if (!selection) {
      return null;
    }

    const content = activeDocument.content;
    const start = content.lastIndexOf("\n", Math.max(0, selection.from - 1)) + 1;
    const selectedEnd = selection.to > selection.from ? selection.to - 1 : selection.to;
    const nextBreak = content.indexOf("\n", Math.max(0, selectedEnd));
    const end = nextBreak === -1 ? content.length : nextBreak;

    return { start, end };
  }

  function duplicateLine() {
    const range = getSelectedLineRange();
    if (!range) {
      return;
    }

    const block = activeDocument.content.slice(range.start, range.end);
    const insertAt = range.end;
    const insert = `${insertAt < activeDocument.content.length ? "\n" : ""}${block}`;
    editorRef.current?.replaceRange(insertAt, insertAt, insert);
  }

  function deleteLine() {
    const range = getSelectedLineRange();
    if (!range) {
      return;
    }

    const content = activeDocument.content;
    const to = range.end < content.length ? range.end + 1 : range.end;
    const from = range.start === to && range.start > 0 ? range.start - 1 : range.start;
    editorRef.current?.replaceRange(from, to, "");
  }

  function moveLine(direction: "up" | "down") {
    const range = getSelectedLineRange();
    if (!range) {
      return;
    }

    const content = activeDocument.content;
    const blockEnd = range.end < content.length ? range.end + 1 : range.end;
    const block = content.slice(range.start, blockEnd);

    if (direction === "up") {
      if (range.start === 0) {
        return;
      }

      const previousStart = content.lastIndexOf("\n", range.start - 2) + 1;
      const previous = content.slice(previousStart, range.start);
      editorRef.current?.replaceRange(previousStart, blockEnd, block + previous);
      return;
    }

    if (blockEnd >= content.length) {
      return;
    }

    const nextEndIndex = content.indexOf("\n", blockEnd);
    const nextEnd = nextEndIndex === -1 ? content.length : nextEndIndex + 1;
    const next = content.slice(blockEnd, nextEnd);
    editorRef.current?.replaceRange(range.start, nextEnd, next + block);
  }

  function trimTrailingWhitespace() {
    updateActiveContent(activeDocument.content.replace(/[ \t]+$/gm, ""));
  }

  function sortSelectedLines() {
    transformSelection((value) => value.split(/\r\n|\r|\n/).sort().join("\n"), true);
  }

  function removeDuplicateLines() {
    transformSelection((value) => {
      const seen = new Set<string>();
      return value
        .split(/\r\n|\r|\n/)
        .filter((line) => {
          if (seen.has(line)) {
            return false;
          }
          seen.add(line);
          return true;
        })
        .join("\n");
    }, true);
  }

  function runMoreAction(action: () => unknown) {
    action();
    setMoreOpen(false);
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      findNext();
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      findPrevious();
    }
  }

  const commands = useMemo<AppCommand[]>(
    () => [
      { id: "new", label: "New document", run: newDocument },
      { id: "open", label: "Open file", run: openFromDevice },
      { id: "save", label: "Save current document", run: saveActiveDocument },
      { id: "save-as", label: "Save current document as", run: saveActiveDocumentAs },
      { id: "export-all", label: "Export all documents", run: exportAllDocuments },
      { id: "backup", label: "Backup session", run: backupSession },
      { id: "restore", label: "Restore session", run: () => backupInputRef.current?.click() },
      { id: "find", label: "Find and replace", run: () => updateSettings({ searchOpen: true }) },
      { id: "wrap", label: "Toggle word wrap", run: () => updateSettings({ lineWrapping: !settings.lineWrapping }) },
      { id: "duplicate-line", label: "Duplicate line", run: duplicateLine },
      { id: "delete-line", label: "Delete line", run: deleteLine },
      { id: "move-line-up", label: "Move line up", run: () => moveLine("up") },
      { id: "move-line-down", label: "Move line down", run: () => moveLine("down") },
      { id: "sort-lines", label: "Sort lines", run: sortSelectedLines },
      { id: "remove-duplicates", label: "Remove duplicate lines", run: removeDuplicateLines },
      { id: "trim-spaces", label: "Trim trailing spaces", run: trimTrailingWhitespace }
    ],
    [activeDocument, activeId, documents, settings]
  );

  const filteredCommands = useMemo(() => {
    const query = commandFilter.trim().toLowerCase();
    if (!query) {
      return commands;
    }

    return commands.filter((command) => command.label.toLowerCase().includes(query));
  }, [commandFilter, commands]);

  function runCommand(command: AppCommand) {
    command.run();
    setCommandOpen(false);
    setCommandFilter("");
    setTimeout(() => editorRef.current?.focus(), 0);
  }

  function handleCommandKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setCommandOpen(false);
    }

    if (event.key === "Enter" && filteredCommands[0]) {
      event.preventDefault();
      runCommand(filteredCommands[0]);
    }
  }

  const currentMatchLabel =
    searchResult.error || !searchOptions.query
      ? searchResult.error
      : `${searchResult.matches.length} match${searchResult.matches.length === 1 ? "" : "es"}`;

  return (
    <div
      className={`app-shell${keyboardOpen ? " keyboard-open" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        multiple
        onChange={handleFileInput}
        type="file"
      />
      <input
        ref={backupInputRef}
        accept="application/json,.json"
        className="hidden-file-input"
        onChange={handleBackupInput}
        type="file"
      />

      <header className="topbar">
        <div className="title-row">
          <div className="brand">
            <FileText size={19} strokeWidth={2} />
            <span>{APP_NAME}</span>
          </div>
          <div className="active-file-chip" title={activeDocument.name}>
            <span>{activeDocument.dirty ? "*" : ""}</span>
            <strong>{activeDocument.name}</strong>
          </div>
          <div className="top-actions">
            <IconButton
              active={commandOpen}
              icon={Command}
              label="Commands"
              onClick={() => setCommandOpen(true)}
            />
            <IconButton
              active={settings.theme === "dark"}
              icon={settings.theme === "dark" ? Moon : Sun}
              label="Theme"
              onClick={() =>
                updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })
              }
            />
          </div>
        </div>

        <div className="toolbar">
          <ToolbarGroup label="File">
            <IconButton icon={PanelLeft} label="Documents" onClick={() => updateSettings({ sidebarOpen: !settings.sidebarOpen })} active={settings.sidebarOpen} />
            <IconButton icon={FilePlus2} label="New" onClick={newDocument} />
            <IconButton icon={FolderOpen} label="Open" onClick={openFromDevice} />
            <IconButton icon={Save} label="Save" onClick={saveActiveDocument} />
            <IconButton icon={Copy} label="Export all" onClick={exportAllDocuments} />
            <IconButton icon={Save} label="Backup session" onClick={backupSession} />
            <IconButton icon={FolderOpen} label="Restore backup" onClick={() => backupInputRef.current?.click()} />
          </ToolbarGroup>

          <ToolbarGroup label="Edit">
            <IconButton icon={Undo2} label="Undo" onClick={() => editorRef.current?.undo()} />
            <IconButton icon={Redo2} label="Redo" onClick={() => editorRef.current?.redo()} />
            <IconButton icon={Copy} label="Duplicate line" onClick={duplicateLine} />
            <IconButton icon={Trash2} label="Delete line" onClick={deleteLine} />
            <IconButton icon={ArrowUp} label="Move line up" onClick={() => moveLine("up")} />
            <IconButton icon={ArrowDown} label="Move line down" onClick={() => moveLine("down")} />
            <IconButton icon={ChevronUp} label="Uppercase" onClick={() => transformSelection((value) => value.toUpperCase())} />
            <IconButton icon={ChevronDown} label="Lowercase" onClick={() => transformSelection((value) => value.toLowerCase())} />
            <IconButton icon={SortAsc} label="Sort lines" onClick={sortSelectedLines} />
            <IconButton icon={List} label="Trim trailing spaces" onClick={trimTrailingWhitespace} />
            <IconButton icon={List} label="Remove duplicate lines" onClick={removeDuplicateLines} />
          </ToolbarGroup>

          <ToolbarGroup label="Search">
            <IconButton
              active={settings.searchOpen}
              icon={Search}
              label="Find"
              onClick={() => updateSettings({ searchOpen: !settings.searchOpen })}
            />
            <IconButton
              active={Boolean(searchOptions.replaceWith)}
              icon={Replace}
              label="Replace"
              onClick={() => updateSettings({ searchOpen: true })}
            />
          </ToolbarGroup>

          <ToolbarGroup label="View">
            <IconButton
              active={settings.lineWrapping}
              icon={WrapText}
              label="Word wrap"
              onClick={() => updateSettings({ lineWrapping: !settings.lineWrapping })}
            />
            <label className="compact-field" title="Font size">
              <Type size={16} strokeWidth={2} />
              <input
                aria-label="Font size"
                max={24}
                min={11}
                onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
                type="number"
                value={settings.fontSize}
              />
            </label>
            <label className="compact-field" title="Tab size">
              <Settings2 size={16} strokeWidth={2} />
              <input
                aria-label="Tab size"
                max={8}
                min={2}
                onChange={(event) => updateSettings({ tabSize: Number(event.target.value) })}
                type="number"
                value={settings.tabSize}
              />
            </label>
          </ToolbarGroup>

          <ToolbarGroup label="Language">
            <select
              aria-label="Language"
              className="language-select"
              onChange={(event) => changeLanguage(event.target.value as LanguageId)}
              value={activeDocument.language}
            >
              {languageOptions.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </ToolbarGroup>
        </div>

        <div className="mobile-quickbar" aria-label="Main actions">
          <IconButton
            active={settings.sidebarOpen}
            icon={PanelLeft}
            label="Documents"
            onClick={() => updateSettings({ sidebarOpen: !settings.sidebarOpen })}
          />
          <IconButton icon={FilePlus2} label="New" onClick={newDocument} />
          <IconButton icon={FolderOpen} label="Open" onClick={openFromDevice} />
          <IconButton icon={Save} label="Save" onClick={saveActiveDocument} />
          <IconButton icon={Command} label="Commands" onClick={() => setCommandOpen(true)} />
          <IconButton
            active={settings.searchOpen}
            icon={Search}
            label="Find"
            onClick={() => updateSettings({ searchOpen: !settings.searchOpen })}
          />
          <IconButton
            active={settings.lineWrapping}
            icon={WrapText}
            label="Word wrap"
            onClick={() => updateSettings({ lineWrapping: !settings.lineWrapping })}
          />
          <select
            aria-label="Language"
            className="mobile-language-select"
            onChange={(event) => changeLanguage(event.target.value as LanguageId)}
            value={activeDocument.language}
          >
            {languageOptions.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {settings.searchOpen ? (
        <section className="search-panel" aria-label="Find and replace">
          <div className="search-fields">
            <input
              autoFocus
              onChange={(event) =>
                setSearchOptions((current) => ({ ...current, query: event.target.value }))
              }
              onKeyDown={handleSearchKeyDown}
              placeholder="Find"
              type="text"
              value={searchOptions.query}
            />
            <input
              onChange={(event) =>
                setSearchOptions((current) => ({ ...current, replaceWith: event.target.value }))
              }
              placeholder="Replace"
              type="text"
              value={searchOptions.replaceWith}
            />
          </div>

          <div className="search-actions">
            <IconButton
              active={searchOptions.matchCase}
              icon={CaseSensitive}
              label="Match case"
              onClick={() =>
                setSearchOptions((current) => ({ ...current, matchCase: !current.matchCase }))
              }
            />
            <IconButton
              active={searchOptions.regex}
              icon={Regex}
              label="Regular expression"
              onClick={() => setSearchOptions((current) => ({ ...current, regex: !current.regex }))}
            />
            <IconButton
              active={searchOptions.wholeWord}
              icon={WholeWord}
              label="Whole word"
              onClick={() =>
                setSearchOptions((current) => ({ ...current, wholeWord: !current.wholeWord }))
              }
            />
            <button className="text-button" onClick={findPrevious} type="button">
              Previous
            </button>
            <button className="text-button" onClick={findNext} type="button">
              Next
            </button>
            <button className="text-button" onClick={replaceCurrent} type="button">
              Replace
            </button>
            <button className="text-button" onClick={replaceAll} type="button">
              All
            </button>
            <span className={`search-count${searchResult.error ? " is-error" : ""}`}>
              {currentMatchLabel}
            </span>
            <IconButton icon={X} label="Close search" onClick={() => updateSettings({ searchOpen: false })} />
          </div>
        </section>
      ) : null}

      {commandOpen ? (
        <section className="command-panel" aria-label="Commands">
          <button
            aria-label="Close commands"
            className="command-scrim"
            onClick={() => setCommandOpen(false)}
            type="button"
          />
          <div className="command-dialog" role="dialog" aria-modal="true">
            <div className="command-input-row">
              <Command size={18} strokeWidth={2} />
              <input
                autoFocus
                onChange={(event) => setCommandFilter(event.target.value)}
                onKeyDown={handleCommandKeyDown}
                placeholder="Type a command"
                type="text"
                value={commandFilter}
              />
              <button
                aria-label="Close commands"
                className="command-close"
                onClick={() => setCommandOpen(false)}
                type="button"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div className="command-list">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((command) => (
                  <button
                    className="command-item"
                    key={command.id}
                    onClick={() => runCommand(command)}
                    type="button"
                  >
                    {command.label}
                  </button>
                ))
              ) : (
                <div className="command-empty">No commands</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {moreOpen ? (
        <section className="more-panel" aria-label="更多编辑操作">
          <button
            aria-label="关闭更多操作"
            className="more-scrim"
            onClick={() => setMoreOpen(false)}
            type="button"
          />
          <div className="more-sheet" role="dialog" aria-modal="true">
            <div className="more-header">
              <strong>更多编辑操作</strong>
              <IconButton icon={X} label="Close commands" onClick={() => setMoreOpen(false)} />
            </div>
            <div className="more-actions">
              <button onClick={() => runMoreAction(() => transformSelection((value) => value.toUpperCase()))} type="button">
                <ChevronUp size={18} />
                <span>转换为大写</span>
              </button>
              <button onClick={() => runMoreAction(() => transformSelection((value) => value.toLowerCase()))} type="button">
                <ChevronDown size={18} />
                <span>转换为小写</span>
              </button>
              <button onClick={() => runMoreAction(duplicateLine)} type="button">
                <Copy size={18} />
                <span>复制当前行</span>
              </button>
              <button className="is-danger" onClick={() => runMoreAction(deleteLine)} type="button">
                <Trash2 size={18} />
                <span>删除当前行</span>
              </button>
              <button onClick={() => runMoreAction(() => moveLine("up"))} type="button">
                <ArrowUp size={18} />
                <span>当前行上移</span>
              </button>
              <button onClick={() => runMoreAction(() => moveLine("down"))} type="button">
                <ArrowDown size={18} />
                <span>当前行下移</span>
              </button>
              <button onClick={() => runMoreAction(sortSelectedLines)} type="button">
                <SortAsc size={18} />
                <span>行排序</span>
              </button>
              <button onClick={() => runMoreAction(removeDuplicateLines)} type="button">
                <List size={18} />
                <span>去除重复行</span>
              </button>
              <button onClick={() => runMoreAction(trimTrailingWhitespace)} type="button">
                <List size={18} />
                <span>清理行尾空格</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <main className={`workspace${settings.sidebarOpen ? " has-sidebar" : ""}`}>
        {settings.sidebarOpen ? (
          <button
            aria-label="Close documents"
            className="drawer-scrim"
            onClick={() => updateSettings({ sidebarOpen: false })}
            type="button"
          />
        ) : null}

        {settings.sidebarOpen ? (
          <aside className="sidebar" aria-label="Documents">
            <div className="sidebar-header">
              <span>Documents</span>
              <div className="sidebar-actions">
                <button className="small-button" onClick={newDocument} type="button">
                  New
                </button>
                <button
                  aria-label="Close documents"
                  className="sidebar-close"
                  onClick={() => updateSettings({ sidebarOpen: false })}
                  type="button"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>
            </div>
            <div className="document-list">
              {documents.map((document) => (
                <button
                  className={`document-item${document.id === activeId ? " is-active" : ""}`}
                  key={document.id}
                  onClick={() => activateDocument(document.id)}
                  onDoubleClick={() => renameDocument(document.id)}
                  title={document.name}
                  type="button"
                >
                  <FileText size={15} strokeWidth={2} />
                  <span>{document.name}</span>
                  {document.dirty ? <span className="dirty-dot" /> : null}
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="editor-pane">
          <div className="tab-strip" role="tablist" aria-label="Open documents">
            {documents.map((document) => (
              <button
                className={`tab${document.id === activeId ? " is-active" : ""}`}
                key={document.id}
                onClick={() => setActiveId(document.id)}
                onDoubleClick={() => renameDocument(document.id)}
                role="tab"
                type="button"
              >
                <span className="tab-title">{document.dirty ? `* ${document.name}` : document.name}</span>
                <span
                  className="tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeDocument(document.id);
                  }}
                  role="button"
                  title="Close"
                >
                  <X size={13} strokeWidth={2.2} />
                </span>
              </button>
            ))}
          </div>

          <CodeEditor
            ref={editorRef}
            content={activeDocument.content}
            fontSize={settings.fontSize}
            language={activeDocument.language}
            lineWrapping={settings.lineWrapping}
            onChange={updateActiveContent}
            onCursorChange={setCursor}
            tabSize={settings.tabSize}
            theme={settings.theme}
          />
        </section>
      </main>

      <footer className="statusbar">
        <span>{activeDocument.name}</span>
        <span>{activeLanguageLabel}</span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span>{status.lines} lines</span>
        <span>{status.characters} chars</span>
        <span>{cursor.selectionLength} selected</span>
        <span>{status.eol}</span>
        <span>UTF-8</span>
        <span>{Math.ceil(status.sessionSize / 1024)} KB</span>
        <span>{settings.lineWrapping ? "Wrap" : "No wrap"}</span>
      </footer>

      <nav className="mobile-actionbar" aria-label="Editor actions">
        <IconButton icon={Undo2} label="Undo" onClick={() => editorRef.current?.undo()} />
        <IconButton icon={Redo2} label="Redo" onClick={() => editorRef.current?.redo()} />
        <IconButton icon={Command} label="Commands" onClick={() => setCommandOpen(true)} />
        <IconButton
          active={moreOpen}
          icon={Ellipsis}
          label="More actions"
          onClick={() => setMoreOpen(true)}
        />
      </nav>
    </div>
  );
}

export default App;
