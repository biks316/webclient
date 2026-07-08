import { VariableContext } from "../../services/variableResolver";
import { VariableFile } from "../../types/bik";
import { VariablesPage } from "./VariablesPage";

interface VariablePanelProps {
  context: VariableContext;
  usedText?: string;
  requestName?: string;
  environments?: VariableFile[];
  selectedEnvironmentId?: string | null;
  onRequestVariablesChange?: (variables: Record<string, string>) => void;
  onCollectionVariablesChange?: (variables: Record<string, string>) => void;
  onEnvironmentVariablesChange?: (variables: Record<string, string>) => void;
  onEnvironmentVariablesByIdChange?: (environmentId: string, variables: Record<string, string>) => void;
  onGlobalVariablesChange?: (variables: Record<string, string>) => void;
  onCreateEnvironment?: () => void;
}

export function VariablePanel({
  context,
  usedText = "",
  requestName,
  environments = [],
  selectedEnvironmentId,
  onRequestVariablesChange,
  onCollectionVariablesChange,
  onEnvironmentVariablesChange,
  onEnvironmentVariablesByIdChange,
  onGlobalVariablesChange,
  onCreateEnvironment,
}: VariablePanelProps) {
  return (
    <VariablesPage
      context={context}
      usedText={usedText}
      requestName={requestName}
      environments={environments}
      selectedEnvironmentId={selectedEnvironmentId}
      onRequestVariablesChange={onRequestVariablesChange}
      onCollectionVariablesChange={onCollectionVariablesChange}
      onEnvironmentVariablesChange={onEnvironmentVariablesChange}
      onEnvironmentVariablesByIdChange={onEnvironmentVariablesByIdChange}
      onGlobalVariablesChange={onGlobalVariablesChange}
      onCreateEnvironment={onCreateEnvironment}
    />
  );
}
