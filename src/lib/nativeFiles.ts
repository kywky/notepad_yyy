import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type NativeTextFile = {
  cancelled?: boolean;
  name?: string;
  content?: string;
  uri?: string;
};

type SaveTextFileOptions = {
  fileName: string;
  content: string;
  mimeType?: string;
};

type SaveTextFileResult = {
  cancelled?: boolean;
  uri?: string;
};

type WriteTextFileOptions = {
  uri: string;
  content: string;
};

type NotepadFilesPlugin = {
  openTextFile: () => Promise<NativeTextFile>;
  saveTextFile: (options: SaveTextFileOptions) => Promise<SaveTextFileResult>;
  writeTextFile: (options: WriteTextFileOptions) => Promise<{ uri: string }>;
  addListener: (
    eventName: "openFile",
    listenerFunc: (file: NativeTextFile) => void
  ) => Promise<PluginListenerHandle>;
};

const NotepadFiles = registerPlugin<NotepadFilesPlugin>("NotepadFiles");

export function hasNativeFilePicker() {
  return Capacitor.getPlatform() === "android";
}

export async function openNativeTextFile() {
  if (!hasNativeFilePicker()) {
    return null;
  }

  const result = await NotepadFiles.openTextFile();
  if (result.cancelled || !result.name || result.content === undefined) {
    return null;
  }

  return {
    name: result.name,
    content: result.content,
    uri: result.uri
  };
}

export async function listenForNativeOpenFile(listener: (file: NativeTextFile) => void) {
  if (!hasNativeFilePicker()) {
    return null;
  }

  return NotepadFiles.addListener("openFile", listener);
}

export async function saveNativeTextFile(options: SaveTextFileOptions) {
  if (!hasNativeFilePicker()) {
    return null;
  }

  const result = await NotepadFiles.saveTextFile({
    ...options,
    mimeType: options.mimeType ?? "text/plain"
  });

  return result.cancelled ? null : result;
}

export async function writeNativeTextFile(options: WriteTextFileOptions) {
  if (!hasNativeFilePicker()) {
    return null;
  }

  return NotepadFiles.writeTextFile(options);
}
