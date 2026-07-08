import { detectLanguage, type LanguageId } from "./languages";

export type ThemeMode = "light" | "dark";

export type EditorDocument = {
  id: string;
  name: string;
  content: string;
  language: LanguageId;
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
};

export type EditorSettings = {
  theme: ThemeMode;
  lineWrapping: boolean;
  fontSize: number;
  tabSize: number;
  sidebarOpen: boolean;
  searchOpen: boolean;
};

export type PersistedSession = {
  documents: EditorDocument[];
  activeId: string;
  settings: EditorSettings;
};

const STORAGE_KEY = "notepad-plus-web-session-v1";

export const defaultSettings: EditorSettings = {
  theme: "light",
  lineWrapping: false,
  fontSize: 14,
  tabSize: 2,
  sidebarOpen: true,
  searchOpen: false
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
  language?: LanguageId;
}): EditorDocument {
  const name = options.name ?? "Untitled.txt";
  const now = Date.now();

  return {
    id: createId(),
    name,
    content: options.content ?? "",
    language: options.language ?? detectLanguage(name),
    dirty: options.dirty ?? false,
    createdAt: now,
    updatedAt: now
  };
}

export function loadSession(): PersistedSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
