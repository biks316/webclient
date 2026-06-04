import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

interface JsonEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  fontSize?: number;
  lineHeight?: number;
  onChange?: (value: string) => void;
}

export function JsonEditor({
  value,
  language = "json",
  readOnly = false,
  fontSize = 12,
  lineHeight = 18,
  onChange,
}: JsonEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage={language}
      language={language}
      theme="vs-dark"
      value={value}
      onChange={(nextValue) => onChange?.(nextValue ?? "")}
      onMount={(editor: MonacoEditor.IStandaloneCodeEditor) => {
        editor.layout();
        window.requestAnimationFrame(() => editor.layout());
        window.setTimeout(() => editor.layout(), 60);
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize,
        lineHeight,
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        wordWrap: "off",
        tabSize: 2,
        formatOnPaste: true,
        formatOnType: true,
        glyphMargin: false,
        folding: true,
        lineNumbersMinChars: 3,
        overviewRulerBorder: false,
        renderLineHighlight: "gutter",
      }}
    />
  );
}
