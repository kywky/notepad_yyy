import { Capacitor, registerPlugin } from "@capacitor/core";

type OpenTextFileResult = {
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

type NotepadFilesPlugin = {
  openTextFile: () => Promise<OpenTextFileResult>;
  saveTextFile: (options: SaveTextFileOptions) => Promise<SaveTextFileResult>;
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
