import type { Monaco } from "@monaco-editor/react";
import { useEffect, useState } from "react";

export const BW_MONACO_THEME = "bikapi-bw";

function currentEditorTheme() {
  return document.documentElement.dataset.theme === "bw" ? BW_MONACO_THEME : "vs-dark";
}

export function useEditorTheme() {
  const [theme, setTheme] = useState(currentEditorTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(currentEditorTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    setTheme(currentEditorTheme());
    return () => observer.disconnect();
  }, []);

  return {
    isBlackAndWhite: theme === BW_MONACO_THEME,
    theme,
  };
}

export function defineBikApiMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme(BW_MONACO_THEME, {
    base: "vs",
    inherit: false,
    rules: [
      { token: "", foreground: "000000", background: "FFFFFF" },
      { token: "string.key.json", foreground: "000000", fontStyle: "bold" },
      { token: "string.value.json", foreground: "000000" },
      { token: "string", foreground: "000000" },
      { token: "number", foreground: "000000" },
      { token: "keyword", foreground: "000000", fontStyle: "bold" },
      { token: "keyword.json", foreground: "000000", fontStyle: "bold" },
      { token: "delimiter", foreground: "000000" },
      { token: "delimiter.bracket", foreground: "000000" },
      { token: "comment", foreground: "333333" },
      { token: "comment.line", foreground: "333333" },
      { token: "comment.block", foreground: "333333" },
      { token: "invalid", foreground: "8B1A1A", fontStyle: "underline" },
    ],
    colors: {
      "focusBorder": "#000000",
      "foreground": "#000000",
      "disabledForeground": "#4A4A4A",
      "editor.background": "#FFFFFF",
      "editor.foreground": "#000000",
      "editorCursor.foreground": "#000000",
      "editor.selectionBackground": "#D9D9D9",
      "editor.selectionForeground": "#000000",
      "editor.inactiveSelectionBackground": "#ECECEC",
      "editor.selectionHighlightBackground": "#EEEEEE",
      "editor.lineHighlightBackground": "#F7F7F7",
      "editor.lineHighlightBorder": "#D9D9D9",
      "editorLineNumber.foreground": "#333333",
      "editorLineNumber.activeForeground": "#000000",
      "editorGutter.background": "#FFFFFF",
      "editorWhitespace.foreground": "#B8B8B8",
      "editorIndentGuide.background1": "#E0E0E0",
      "editorIndentGuide.activeBackground1": "#000000",
      "editorBracketHighlight.foreground1": "#000000",
      "editorBracketHighlight.foreground2": "#000000",
      "editorBracketHighlight.foreground3": "#000000",
      "editorBracketHighlight.foreground4": "#000000",
      "editorBracketHighlight.foreground5": "#000000",
      "editorBracketHighlight.foreground6": "#000000",
      "editorBracketPairGuide.background1": "#D9D9D9",
      "editorBracketPairGuide.activeBackground1": "#000000",
      "editorWidget.background": "#FFFFFF",
      "editorWidget.foreground": "#000000",
      "editorWidget.border": "#000000",
      "editorSuggestWidget.background": "#FFFFFF",
      "editorSuggestWidget.foreground": "#000000",
      "editorSuggestWidget.border": "#000000",
      "editorSuggestWidget.selectedBackground": "#000000",
      "editorSuggestWidget.selectedForeground": "#FFFFFF",
      "editorHoverWidget.background": "#FFFFFF",
      "editorHoverWidget.foreground": "#000000",
      "editorHoverWidget.border": "#000000",
      "input.background": "#FFFFFF",
      "input.foreground": "#000000",
      "input.border": "#000000",
      "input.placeholderForeground": "#333333",
      "scrollbarSlider.background": "#C8C8C8",
      "scrollbarSlider.hoverBackground": "#8A8A8A",
      "scrollbarSlider.activeBackground": "#000000",
    },
  });
}
