import Editor from "@monaco-editor/react";

interface JsonEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export function JsonEditor({
  value,
  language = "json",
  readOnly = false,
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
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 12,
        lineHeight: 18,
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
