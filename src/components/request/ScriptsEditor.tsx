import { BikRequest, RunResponse, Scripts } from "../../types/bik";
import { ScriptsTab } from "./scripts/ScriptsTab";

interface ScriptsEditorProps {
  scripts: Scripts;
  request: BikRequest;
  response: RunResponse | null;
  variables: Record<string, string>;
  onChange: (next: Scripts) => void;
  onSave: () => void;
}

export function ScriptsEditor({
  scripts,
  request,
  response,
  variables,
  onChange,
  onSave,
}: ScriptsEditorProps) {
  return (
    <ScriptsTab
      scripts={scripts}
      request={request}
      response={response}
      variables={variables}
      onChange={onChange}
      onSave={onSave}
    />
  );
}
