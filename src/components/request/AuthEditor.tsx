import { Shield } from "lucide-react";
import { EmptyState } from "../common/EmptyState";

export function AuthEditor() {
  return (
    <EmptyState
      title="Auth is manual for now"
      description="Keep authentication in headers, collection variables, or environment variables. Core request storage remains unchanged."
      icon={Shield}
    />
  );
}
