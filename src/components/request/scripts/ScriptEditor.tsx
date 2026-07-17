import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { defineBikApiMonacoThemes, useEditorTheme } from "../../../services/monacoTheme";

export interface ScriptEditorHandle {
  format: () => void;
  insertText: (text: string) => void;
}

interface ScriptEditorProps {
  value: string;
  minimap: boolean;
  wordWrap: boolean;
  onChange: (value: string) => void;
}

export const ScriptEditor = forwardRef<ScriptEditorHandle, ScriptEditorProps>(
  function ScriptEditor({ value, minimap, wordWrap, onChange }, ref) {
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const [mounted, setMounted] = useState(false);
    const editorTheme = useEditorTheme();

    useImperativeHandle(ref, () => ({
      format: () => {
        void editorRef.current?.getAction("editor.action.formatDocument")?.run();
      },
      insertText: (text) => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }

        const selection = editor.getSelection();
        if (!selection) {
          return;
        }

        editor.executeEdits("script-template", [{ range: selection, text, forceMoveMarkers: true }]);
        editor.focus();
      },
    }));

    return (
      <div className="script-editor-surface" data-mounted={mounted}>
        <Editor
          height="100%"
          language="javascript"
          theme={editorTheme.theme}
          beforeMount={defineBikApiMonacoThemes}
          value={value}
          onChange={(nextValue) => onChange(nextValue ?? "")}
          onMount={(editor) => {
            editorRef.current = editor;
            setMounted(true);
            editor.layout();
            window.requestAnimationFrame(() => editor.layout());
            window.setTimeout(() => editor.layout(), 80);
          }}
          options={{
            automaticLayout: true,
            cursorBlinking: "smooth",
            fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
            fontLigatures: true,
            fontSize: editorTheme.isBlackAndWhite ? 14 : 13,
            fontWeight: editorTheme.isBlackAndWhite ? "500" : "normal",
            formatOnPaste: true,
            formatOnType: true,
            lineHeight: 20,
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            minimap: { enabled: minimap },
            overviewRulerBorder: false,
            padding: { top: 12, bottom: 12 },
            quickSuggestions: true,
            renderLineHighlight: "all",
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            tabCompletion: "on",
            tabSize: 2,
            wordWrap: wordWrap ? "on" : "off",
          }}
        />
      </div>
    );
  },
);
