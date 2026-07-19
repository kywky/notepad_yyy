import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo as redoCommand,
  undo as undoCommand
} from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  type Extension
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type MutableRefObject
} from "react";
import type { ThemeMode } from "../lib/session";
import {
  loadLanguageExtension,
  syntaxHighlightingExtension
} from "../lib/languages";

export type CursorInfo = {
  line: number;
  column: number;
  offset: number;
  selectionLength: number;
};

export type TextMatch = { from: number; to: number };

export type CodeEditorHandle = {
  focus: () => void;
  selectRange: (from: number, to: number) => void;
  replaceRange: (from: number, to: number, text: string) => void;
  getSelection: () => TextMatch;
  undo: () => boolean;
  redo: () => boolean;
};

type CodeEditorProps = {
  content: string;
  fileName: string;
  theme: ThemeMode;
  lineWrapping: boolean;
  fontSize: number;
  searchMatches: TextMatch[];
  activeSearchIndex: number;
  onChange: (content: string) => void;
  onCursorChange: (cursor: CursorInfo) => void;
  onFontSizeChange: (fontSize: number) => void;
};

type SearchHighlight = TextMatch & { active: boolean };

function syncWrappedContentWidth(view: EditorView, lineWrapping: boolean) {
  const content = view.contentDOM;
  if (!lineWrapping) {
    content.style.removeProperty("width");
    content.style.removeProperty("max-width");
    content.style.removeProperty("flex");
    return;
  }

  view.scrollDOM.scrollLeft = 0;
  const contentLeft = content.getBoundingClientRect().left;
  const scrollerRight = view.scrollDOM.getBoundingClientRect().right;
  const viewport = window.visualViewport;
  const viewportRight = viewport
    ? viewport.offsetLeft + viewport.width
    : window.innerWidth;
  const visibleRight = Math.min(scrollerRight, viewportRight, window.innerWidth);
  const availableWidth = Math.max(1, Math.floor(visibleRight - contentLeft - 8));
  const width = `${availableWidth}px`;
  if (content.style.width === width) return;

  content.style.width = width;
  content.style.maxWidth = width;
  content.style.flex = `0 0 ${width}`;
  view.requestMeasure();
}

const setSearchHighlights = StateEffect.define<SearchHighlight[]>();
const searchHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setSearchHighlights)) {
        next = Decoration.set(
          effect.value
            .filter((match) => match.to > match.from && match.from >= 0 && match.to <= transaction.state.doc.length)
            .map((match) =>
              Decoration.mark({ class: match.active ? "cm-search-hit-active" : "cm-search-hit" }).range(
                match.from,
                match.to
              )
            ),
          true
        );
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field)
});

function editorTheme(theme: ThemeMode, fontSize: number): Extension {
  const dark = theme === "dark";
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        minHeight: "0",
        minWidth: "0",
        width: "100%",
        color: dark ? "#dce5ef" : "#17202b",
        backgroundColor: dark ? "#121820" : "#ffffff",
        fontSize: `${fontSize}px`
      },
      ".cm-scroller": {
        fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
        lineHeight: "1.55",
        minHeight: "0",
        minWidth: "0",
        overflowX: "auto",
        overflowY: "auto",
        touchAction: "pan-x pan-y"
      },
      ".cm-content": { minHeight: "100%", caretColor: dark ? "#f3f7fb" : "#111827" },
      ".cm-line": { padding: "0 8px" },
      ".cm-gutters": {
        backgroundColor: dark ? "#18212f" : "#eef2f6",
        color: dark ? "#8896a8" : "#667386",
        borderRight: `1px solid ${dark ? "#263547" : "#d7dde5"}`
      },
      ".cm-activeLine, .cm-activeLineGutter": {
        backgroundColor: dark ? "#1d2a3a" : "#eef7f1"
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: `${dark ? "#355a7e" : "#b8d7ff"} !important`
      },
      ".cm-search-hit": { backgroundColor: dark ? "#705d18" : "#fff1a8", borderRadius: "2px" },
      ".cm-search-hit-active": {
        backgroundColor: dark ? "#b06f1b" : "#ffc96b",
        outline: `1px solid ${dark ? "#e7b85a" : "#c87500"}`,
        borderRadius: "2px"
      },
      "&.cm-focused": { outline: "none" }
    },
    { dark }
  );
}

function extensions(
  propsRef: MutableRefObject<CodeEditorProps>,
  theme: Compartment,
  wrapping: Compartment,
  language: Compartment,
  applyingExternal: MutableRefObject<boolean>
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    searchHighlightField,
    syntaxHighlightingExtension,
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorState.tabSize.of(2),
    EditorView.updateListener.of((update) => {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      const selectionLength = update.state.selection.ranges.reduce(
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
        propsRef.current.onChange(update.state.doc.toString());
      }
    }),
    theme.of(editorTheme(propsRef.current.theme, propsRef.current.fontSize)),
    wrapping.of(propsRef.current.lineWrapping ? EditorView.lineWrapping : []),
    language.of([])
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
      theme: new Compartment(),
      wrapping: new Compartment(),
      language: new Compartment()
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current) return;
    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: propsRef.current.content,
        extensions: extensions(
          propsRef,
          compartments.theme,
          compartments.wrapping,
          compartments.language,
          applyingExternal
        )
      }),
      parent: hostRef.current
    });
    const view = viewRef.current;
    const resizeObserver = new ResizeObserver(() => {
      syncWrappedContentWidth(view, propsRef.current.lineWrapping);
    });
    resizeObserver.observe(view.scrollDOM);
    const gutters = view.scrollDOM.querySelector<HTMLElement>(".cm-gutters");
    if (gutters) resizeObserver.observe(gutters);
    const viewport = window.visualViewport;
    const handleViewportChange = () => {
      syncWrappedContentWidth(view, propsRef.current.lineWrapping);
    };
    viewport?.addEventListener("resize", handleViewportChange);
    viewport?.addEventListener("scroll", handleViewportChange);

    let pinchStartDistance = 0;
    let pinchStartFontSize = propsRef.current.fontSize;
    let lastPinchFontSize = pinchStartFontSize;
    const touchDistance = (event: TouchEvent) => {
      const first = event.touches[0];
      const second = event.touches[1];
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    };
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      pinchStartDistance = touchDistance(event);
      pinchStartFontSize = propsRef.current.fontSize;
      lastPinchFontSize = pinchStartFontSize;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinchStartDistance <= 0) return;
      event.preventDefault();
      const scale = touchDistance(event) / pinchStartDistance;
      const nextFontSize = Math.max(11, Math.min(32, Math.round(pinchStartFontSize * scale)));
      if (nextFontSize !== lastPinchFontSize) {
        lastPinchFontSize = nextFontSize;
        propsRef.current.onFontSizeChange(nextFontSize);
      }
    };
    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchStartDistance = 0;
    };
    view.scrollDOM.addEventListener("touchstart", handleTouchStart, { passive: false });
    view.scrollDOM.addEventListener("touchmove", handleTouchMove, { passive: false });
    view.scrollDOM.addEventListener("touchend", handleTouchEnd);
    view.scrollDOM.addEventListener("touchcancel", handleTouchEnd);

    syncWrappedContentWidth(view, propsRef.current.lineWrapping);
    propsRef.current.onCursorChange({ line: 1, column: 1, offset: 0, selectionLength: 0 });
    return () => {
      resizeObserver.disconnect();
      viewport?.removeEventListener("resize", handleViewportChange);
      viewport?.removeEventListener("scroll", handleViewportChange);
      view.scrollDOM.removeEventListener("touchstart", handleTouchStart);
      view.scrollDOM.removeEventListener("touchmove", handleTouchMove);
      view.scrollDOM.removeEventListener("touchend", handleTouchEnd);
      view.scrollDOM.removeEventListener("touchcancel", handleTouchEnd);
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [compartments]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === props.content) return;
    applyingExternal.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: props.content },
      selection: EditorSelection.cursor(Math.min(props.content.length, view.state.selection.main.head))
    });
    applyingExternal.current = false;
  }, [props.content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: compartments.theme.reconfigure(editorTheme(props.theme, props.fontSize))
    });
    syncWrappedContentWidth(view, props.lineWrapping);
    view.requestMeasure();
    const frame = window.requestAnimationFrame(() => {
      syncWrappedContentWidth(view, props.lineWrapping);
      view.requestMeasure();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compartments.theme, props.fontSize, props.lineWrapping, props.theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: compartments.wrapping.reconfigure(props.lineWrapping ? EditorView.lineWrapping : [])
    });
    syncWrappedContentWidth(view, props.lineWrapping);
    const frame = window.requestAnimationFrame(() => {
      syncWrappedContentWidth(view, props.lineWrapping);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compartments.wrapping, props.lineWrapping]);

  useEffect(() => {
    let active = true;
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({ effects: compartments.language.reconfigure([]) });
    void loadLanguageExtension(props.fileName)
      .then((extension) => {
        if (active && viewRef.current === view) {
          view.dispatch({ effects: compartments.language.reconfigure(extension) });
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [compartments.language, props.fileName]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: setSearchHighlights.of(
        props.searchMatches.map((match, index) => ({ ...match, active: index === props.activeSearchIndex }))
      )
    });
  }, [props.activeSearchIndex, props.searchMatches]);

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    selectRange: (from, to) => {
      const view = viewRef.current;
      if (!view) return;
      const safeFrom = Math.max(0, Math.min(from, view.state.doc.length));
      const safeTo = Math.max(0, Math.min(to, view.state.doc.length));
      view.dispatch({
        selection: { anchor: safeFrom, head: safeTo },
        effects: EditorView.scrollIntoView(safeTo, { y: "center" })
      });
      view.focus();
    },
    replaceRange: (from, to, text) => {
      const view = viewRef.current;
      if (!view) return;
      const safeFrom = Math.max(0, Math.min(from, view.state.doc.length));
      const safeTo = Math.max(0, Math.min(to, view.state.doc.length));
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
    undo: () => (viewRef.current ? undoCommand(viewRef.current) : false),
    redo: () => (viewRef.current ? redoCommand(viewRef.current) : false)
  }));

  return (
    <div
      className={`editor-host ${props.lineWrapping ? "is-wrapping" : "is-no-wrap"}`}
      ref={hostRef}
    />
  );
});

CodeEditor.displayName = "CodeEditor";
export default CodeEditor;
