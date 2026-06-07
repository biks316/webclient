import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { VariableContext, buildVariableEntries, resolveVariable, VARIABLE_PATTERN, maskVariableValue } from "../../services/variableResolver";

interface JsonEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  fontSize?: number;
  lineHeight?: number;
  variableContext?: VariableContext;
  onChange?: (value: string) => void;
}

export function JsonEditor({
  value,
  language = "json",
  readOnly = false,
  fontSize = 12,
  lineHeight = 18,
  variableContext,
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
      onMount={(editor: MonacoEditor.IStandaloneCodeEditor, monaco) => {
        editor.layout();
        window.requestAnimationFrame(() => editor.layout());
        window.setTimeout(() => editor.layout(), 60);
        if (variableContext) {
          const entries = buildVariableEntries(variableContext);
          monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: ["{"],
            provideCompletionItems(model, position) {
              const word = model.getWordUntilPosition(position);
              return {
                suggestions: entries.map((entry) => ({
                  label: entry.name,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  detail: `${entry.scope} ${maskVariableValue(entry.value, entry.isSecret)}`,
                  insertText: `{{${entry.name}}}`,
                  range: {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                  },
                })),
              };
            },
          });
          monaco.languages.registerHoverProvider(language, {
            provideHover(model, position) {
              const line = model.getLineContent(position.lineNumber);
              for (const match of line.matchAll(VARIABLE_PATTERN)) {
                const start = match.index ?? 0;
                const end = start + match[0].length;
                if (position.column >= start + 1 && position.column <= end + 1) {
                  const variable = resolveVariable(match[1], variableContext);
                  return {
                    contents: [
                      { value: `**${variable.name}**` },
                      { value: `scope: ${variable.scope}` },
                      { value: `value: ${variable.found ? maskVariableValue(variable.value, variable.isSecret) : "unresolved"}` },
                    ],
                  };
                }
              }
              return null;
            },
          });
        }
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
