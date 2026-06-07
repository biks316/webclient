import { useMemo } from "react";
import {
  buildVariableEntries,
  resolveTemplate,
  resolveVariable,
  VariableContext,
} from "../../services/variableResolver";

export function useVariableResolver(context: VariableContext) {
  const entries = useMemo(() => buildVariableEntries(context), [context]);

  return useMemo(() => ({
    entries,
    resolveVariable: (name: string) => resolveVariable(name, context),
    resolveTemplate: (text: string) => resolveTemplate(text, context),
  }), [context, entries]);
}
