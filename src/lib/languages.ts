import {
  LanguageDescription,
  defaultHighlightStyle,
  syntaxHighlighting
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";

export const syntaxHighlightingExtension = syntaxHighlighting(defaultHighlightStyle, {
  fallback: true
});

export function detectLanguage(fileName: string): LanguageDescription | null {
  return LanguageDescription.matchFilename(languages, fileName);
}

export function languageLabel(fileName: string): string {
  return detectLanguage(fileName)?.name ?? "普通文本";
}

export async function loadLanguageExtension(fileName: string): Promise<Extension> {
  const description = detectLanguage(fileName);
  return description ? description.load() : [];
}
