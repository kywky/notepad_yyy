import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo as redoCommand,
  undo as undoCommand
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type MutableRefObject
} from "react";
import { getLanguageExtension, type LanguageId } from "../lib/languages";
import type { ThemeMode } from "../lib/session";

export type CursorInfo = {
  line: number;
  column: number;
  offset: number;
  selectionLength: number;
};

export type CodeEditorHandle = {
  focus: () => void;
  selectRange: (from: number, to: number) => void;
  replaceRange: (from: number, to: number, text: string) => void;
  getSelection: () => { from: number; to: number };
  getCursorOffset: () => number;
  undo: () => boolean;
  redo: () => boolean;
  selectAll: () => void;
};

type CodeEditorProps = {
  content: string;
  language: LanguageId;
  theme: ThemeMode;
  lineWrapping: boolean;
  fontSize: number;
  tabSize: number;
  onChange: (content: string) => void;
  onCursorChange: (cursor: CursorInfo) => void;
};

function editorTheme(theme: ThemeMode, fontSize: number): Extension {
  const dark = theme === "dark";
  const colors = dark
    ? {
        background: "#121820",
        foreground: "#dce5ef",
        gutter: "#18212f",
        gutterText: "#8896a8",
        activeLine: "#1d2a3a",
        selection: "#355a7e",
        border: "#263547"
      }
    : {
        background: "#ffffff",
        foreground: "#17202b",
        gutter: "#eef2f6",
        gutterText: "#667386",
        activeLine: "#eef7f1",
        selection: "#b8d7ff",
        border: "#d7dde5"
      };

  return EditorView.theme(
    {
      "&": {
        height: "100%",
        color: colors.foreground,
        backgroundColor: colors.background,
        fontSize: `${fontSize}px`
      },
      ".cm-scroller": {
        fontFamily:
          '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
        lineHeight: "1.55",
        overflow: "auto"
      },
      ".cm-content": {
        caretColor: dark ? "#f3f7fb" : "#111827",
        minHeight: "100%"
      },
      ".cm-line": {
        padding: "0 8px"
      },
      ".cm-gutters": {
        backgroundColor: colors.gutter,
        color: colors.gutterText,
        borderRight: `1px solid ${colors.border}`
      },
      ".cm-activeLine": {
        backgroundColor: colors.activeLine
      },
      ".cm-activeLineGutter": {
        backgroundColor: colors.activeLine,
        color: colors.foreground
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: `${colors.selection} !important`
      },
      "&.cm-focused": {
        outline: "none"
      },
      ".cm-foldGutter span": {
        cursor: "pointer"
      }
    },
    { dark }
  );
}

function buildExtensions(
  propsRef: MutableRefObject<CodeEditorProps>,
  compartments: {
    language: Compartment;
    theme: Compartment;
    wrapping: Compartment;
    tabSize: Compartment;
  },
  applyingExternal: MutableRefObject<boolean>
): Extension[] {
  const props = propsRef.current;

  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap
    ]),
    EditorView.updateListener.of((update) => {
      const state = update.state;
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      const selectionLength = state.selection.ranges.reduce(
        (total, range) => total + Math.abs(range.to - range.from),
        0
      );

      if (update.selectionSet || update.docChanged) {
        propsRef.current.onCursorChange({
          line: line.number,
          column: head - line.from + 1,
          offset: head,
          selectionLength
        });
      }

      if (update.docChanged && !applyingExternal.current) {
        propsRef.current.onChange(state.doc.toString());
      }
    }),
    compartments.language.of(getLanguageExtension(props.language)),
    compartments.theme.of(editorTheme(props.theme, props.fontSize)),
    compartments.wrapping.of(props.lineWrapping ? EditorView.lineWrapping : []),
    compartments.tabSize.of(EditorState.tabSize.of(props.tabSize))
  ];
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>((props, ref) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const propsRef = useRef(props);
  const applyingExternal = useRef(false);

  propsRef.current = props;

  const compartments = useMemo(
    () => ({
      language: new Compartment(),
      theme: new Compartment(),
      wrapping: new Compartment(),
      tabSize: new Compartment()
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: propsRef.current.content,
      extensions: buildExtensions(propsRef, compartments, applyingExternal)
    });

    viewRef.current = new EditorView({
      state,
      parent: hostRef.current
    });

    propsRef.current.onCursorChange({ line: 1, column: 1, offset: 0, selectionLength: 0 });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [compartments]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const current = view.state.doc.toString();
    if (current === props.content) {
      return;
    }

    applyingExternal.current = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: props.content },
      selection: EditorSelection.cursor(Math.min(props.content.length, view.state.selection.main.head))
    });
    applyingExternal.current = false;
  }, [props.content]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.language.reconfigure(getLanguageExtension(props.language))
    });
  }, [compartments.language, props.language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.theme.reconfigure(editorTheme(props.theme, props.fontSize))
    });
  }, [compartments.theme, props.fontSize, props.theme]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.wrapping.reconfigure(props.lineWrapping ? EditorView.lineWrapping : [])
    });
  }, [compartments.wrapping, props.lineWrapping]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.tabSize.reconfigure(EditorState.tabSize.of(props.tabSize))
    });
  }, [compartments.tabSize, props.tabSize]);

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    selectRange: (from, to) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const docLength = view.state.doc.length;
      const safeFrom = Math.max(0, Math.min(from, docLength));
      const safeTo = Math.max(0, Math.min(to, docLength));

      view.dispatch({
        selection: { anchor: safeFrom, head: safeTo },
        effects: EditorView.scrollIntoView(safeTo, { y: "center" })
      });
      view.focus();
    },
    replaceRange: (from, to, text) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const docLength = view.state.doc.length;
      const safeFrom = Math.max(0, Math.min(from, docLength));
      const safeTo = Math.max(0, Math.min(to, docLength));
      const cursor = safeFrom + text.length;

      view.dispatch({
        changes: { from: safeFrom, to: safeTo, insert: text },
        selection: EditorSelection.cursor(cursor),
        effects: EditorView.scrollIntoView(cursor, { y: "center" })
      });
      view.focus();
    },
    getSelection: () => {
      const selection = viewRef.current?.state.selection.main;
      return selection ? { from: selection.from, to: selection.to } : { from: 0, to: 0 };
    },
    getCursorOffset: () => viewRef.current?.state.selection.main.head ?? 0,
    undo: () => (viewRef.current ? undoCommand(viewRef.current) : false),
    redo: () => (viewRef.current ? redoCommand(viewRef.current) : false),
    selectAll: () => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      view.focus();
    }
  }));

  return <div className="editor-host" ref={hostRef} />;
});

CodeEditor.displayName = "CodeEditor";

export default CodeEditor;
