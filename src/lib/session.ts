export type ThemeMode = "light" | "dark";

export type EditorDocument = {
  id: string;
  name: string;
  content: string;
  nativeUri?: string;
  sourcePath?: string;
  contentUnavailable?: boolean;
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
};

export type EditorSettings = {
  theme: ThemeMode;
  lineWrapping: boolean;
  fontSize: number;
};

export type PersistedSession = {
  documents: EditorDocument[];
  activeId: string;
  settings: EditorSettings;
};

const STORAGE_KEY = "notepad-plus-session-v1";
const LEGACY_STORAGE_KEY = "notepad-plus-web-session-v1";
export const LARGE_FILE_THRESHOLD = 750_000;

export const defaultSettings: EditorSettings = {
  theme: "light",
  lineWrapping: true,
  fontSize: 14
};

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDocument(options: {
  name?: string;
  content?: string;
  dirty?: boolean;
  nativeUri?: string;
  sourcePath?: string;
}): EditorDocument {
  const name = options.name ?? "Untitled.txt";
  const now = Date.now();

  return {
    id: createId(),
    name,
    content: options.content ?? "",
    nativeUri: options.nativeUri,
    sourcePath: options.sourcePath,
    contentUnavailable: false,
    dirty: options.dirty ?? false,
    createdAt: now,
    updatedAt: now
  };
}

export function loadSession(): PersistedSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      const document = createDocument({ name: "Untitled-1.txt" });
      return { documents: [document], activeId: document.id, settings: defaultSettings };
    }

    const parsed = JSON.parse(raw) as PersistedSession;
    const documents = Array.isArray(parsed.documents) ? parsed.documents : [];

    if (documents.length === 0) {
      const document = createDocument({ name: "Untitled-1.txt" });
      return { documents: [document], activeId: document.id, settings: defaultSettings };
    }

    const activeId = documents.some((document) => document.id === parsed.activeId)
      ? parsed.activeId
      : documents[0].id;

    return {
      documents,
      activeId,
      settings: { ...defaultSettings, ...parsed.settings }
    };
  } catch {
    const document = createDocument({ name: "Untitled-1.txt" });
    return { documents: [document], activeId: document.id, settings: defaultSettings };
  }
}

export function saveSession(session: PersistedSession): void {
  const persistableDocuments = session.documents
    .filter((document) => document.content.length < LARGE_FILE_THRESHOLD || Boolean(document.nativeUri))
    .map((document) => document.content.length >= LARGE_FILE_THRESHOLD
      ? { ...document, content: "", contentUnavailable: true, dirty: false }
      : { ...document, contentUnavailable: false });
  const documents = persistableDocuments.length > 0
    ? persistableDocuments
    : [createDocument({ name: "新建文本-1.txt" })];
  const activeId = documents.some((document) => document.id === session.activeId)
    ? session.activeId
    : documents[0].id;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, documents, activeId }));
  } catch {
    // Mobile storage quotas are small; editing must continue if recovery data cannot be saved.
  }
}
