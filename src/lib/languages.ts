import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { xml } from "@codemirror/lang-xml";
import type { Extension } from "@codemirror/state";

export type LanguageId =
  | "plaintext"
  | "javascript"
  | "typescript"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "python"
  | "xml"
  | "shell";

export type LanguageOption = {
  id: LanguageId;
  label: string;
  extensions: string[];
};

export const languageOptions: LanguageOption[] = [
  { id: "plaintext", label: "Plain Text", extensions: [] },
  { id: "javascript", label: "JavaScript", extensions: ["js", "mjs", "cjs", "jsx"] },
  { id: "typescript", label: "TypeScript", extensions: ["ts", "tsx"] },
  { id: "html", label: "HTML", extensions: ["html", "htm"] },
  { id: "css", label: "CSS", extensions: ["css", "scss", "less"] },
  { id: "json", label: "JSON", extensions: ["json", "jsonc"] },
  { id: "markdown", label: "Markdown", extensions: ["md", "markdown"] },
  { id: "python", label: "Python", extensions: ["py", "pyw"] },
  { id: "xml", label: "XML", extensions: ["xml", "svg"] },
  { id: "shell", label: "Shell", extensions: ["sh", "bash", "zsh"] }
];

export function detectLanguage(fileName: string): LanguageId {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension || extension === fileName.toLowerCase()) {
    return "plaintext";
  }

  return (
    languageOptions.find((language) => language.extensions.includes(extension))?.id ?? "plaintext"
  );
}

export function getLanguageExtension(language: LanguageId): Extension {
  switch (language) {
    case "javascript":
      return javascript({ jsx: true });
    case "typescript":
      return javascript({ jsx: true, typescript: true });
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
      return markdown();
    case "python":
      return python();
    case "xml":
      return xml();
    default:
      return [];
  }
}
