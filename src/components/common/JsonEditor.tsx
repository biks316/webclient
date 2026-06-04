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
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 14, bottom: 14 },
        automaticLayout: true,
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        formatOnPaste: true,
        formatOnType: true,
      }}
    />
  );
}
