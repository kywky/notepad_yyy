import {
  LanguageDescription,
  defaultHighlightStyle,
  syntaxHighlighting
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";

const languageLabels: Record<string, string> = {
  c: "C", cc: "C++", cpp: "C++", cxx: "C++", h: "C/C++", hpp: "C++",
  cs: "C#", css: "CSS", go: "Go", html: "HTML", htm: "HTML", java: "Java",
  js: "JavaScript", jsx: "JavaScript JSX", json: "JSON", kt: "Kotlin", kts: "Kotlin",
  lua: "Lua", md: "Markdown", php: "PHP", py: "Python", rb: "Ruby", rs: "Rust",
  sh: "Shell", sql: "SQL", swift: "Swift", toml: "TOML", ts: "TypeScript",
  tsx: "TypeScript JSX", vue: "Vue", xml: "XML", yaml: "YAML", yml: "YAML"
};

export const syntaxHighlightingExtension = syntaxHighlighting(defaultHighlightStyle, {
  fallback: true
});

export function languageLabel(fileName: string): string {
  const normalized = fileName.toLowerCase();
  if (normalized === "dockerfile") return "Dockerfile";
  if (normalized === "makefile") return "Makefile";
  const extension = normalized.includes(".") ? normalized.split(".").pop() ?? "" : "";
  return languageLabels[extension] ?? "普通文本";
}

export async function loadLanguageExtension(fileName: string): Promise<Extension> {
  const { languages } = await import("@codemirror/language-data");
  const description: LanguageDescription | null = LanguageDescription.matchFilename(languages, fileName);
  return description ? description.load() : [];
}
