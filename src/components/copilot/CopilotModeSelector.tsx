import { CopilotMode } from "../../types/copilot";
import { CompactSelect } from "../common/CompactSelect";

interface CopilotModeSelectorProps {
  mode: CopilotMode;
  onChange: (mode: CopilotMode) => void;
}

const OPTIONS = [
  { value: "ask", label: "Ask" },
  { value: "build", label: "Build" },
  { value: "debug", label: "Debug" },
  { value: "run", label: "Run" },
];

export function CopilotModeSelector({ mode, onChange }: CopilotModeSelectorProps) {
  return <CompactSelect value={mode} options={OPTIONS} onChange={(value) => onChange(value as CopilotMode)} />;
}
