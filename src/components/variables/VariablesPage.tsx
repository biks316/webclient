import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Info, Plus } from "lucide-react";
import {
  extractVariableNames,
  isSecretVariable,
  VariableContext,
} from "../../services/variableResolver";
import { VariableFile } from "../../types/bik";
import { VariableDrawer } from "./VariableDrawer";
import {
  ManagedVariable,
  VARIABLE_SCOPE_LABEL,
  VariableDraft,
  VariableScopeKey,
  VariableSortKey,
  VariableType,
  VariableUsage,
} from "./VariableManagerTypes";
import { VariableSearch } from "./VariableSearch";
import { VariableTable } from "./VariableTable";
import { VariableTabs } from "./VariableTabs";
import { VariableUsagePanel } from "./VariableUsagePanel";
import styles from "./Variables.module.css";

interface VariablesPageProps {
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

const EMPTY_SCOPE_COPY: Record<VariableScopeKey, string> = {
  request: "Request variables exist only for the current request and override all other scopes.",
  flow: "Flow variables are created by mappings and automation while a flow runs.",
  collection: "Collection variables are shared by every request in this collection.",
  environment: "Environment variables switch values between dev, staging, and production.",
  global: "Global variables are available to every workspace request.",
  runtime: "Runtime variables are temporary values created by scripts during execution.",
  secrets: "Secrets are masked values detected from token, key, password, and secret names.",
};

const GROUP_MATCHERS: Array<[RegExp, string]> = [
  [/(auth|token|client|secret|password|refresh)/i, "Authentication"],
  [/(url|api|base|timeout|version|host)/i, "API"],
  [/(user|locale|account|profile)/i, "User"],
];

function inferGroup(name: string) {
  return GROUP_MATCHERS.find(([matcher]) => matcher.test(name))?.[1] ?? "Variables";
}

function inferType(name: string, scope: VariableScopeKey): VariableType {
  if (isSecretVariable(name)) {
    return "secret";
  }
  if (scope === "runtime" || scope === "flow") {
    return "computed";
  }
  return "default";
}

function valuesForScope(context: VariableContext, scope: VariableScopeKey) {
  if (scope === "request") {
    return context.requestVariables ?? {};
  }
  if (scope === "flow") {
    return context.flowVariables ?? {};
  }
  if (scope === "collection") {
    return context.collection?.variables ?? {};
  }
  if (scope === "environment") {
    return context.environment?.variables ?? {};
  }
  if (scope === "global") {
    return context.globals ?? {};
  }
  if (scope === "runtime") {
    return context.runtimeVariables ?? {};
  }
  return {};
}

function makeUsage(name: string, usedText: string, requestName: string): VariableUsage[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "g");
  const usages: VariableUsage[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(usedText))) {
    const start = Math.max(0, match.index - 28);
    const end = Math.min(usedText.length, match.index + match[0].length + 28);
    usages.push({
      id: `${name}:${match.index}`,
      requestName,
      location: "Current request",
      excerpt: usedText.slice(start, end).replace(/\s+/g, " ").trim(),
    });
  }
  return usages;
}

function rowsForScope(context: VariableContext, scope: VariableScopeKey, usedText: string, requestName: string) {
  if (scope === "secrets") {
    const scopes: VariableScopeKey[] = ["request", "flow", "collection", "environment", "global", "runtime"];
    return scopes.flatMap((sourceScope) =>
      Object.entries(valuesForScope(context, sourceScope))
        .filter(([name]) => isSecretVariable(name))
        .map(([name, value]) => makeVariableRow(name, value, "secrets", usedText, requestName, sourceScope)),
    );
  }

  return Object.entries(valuesForScope(context, scope)).map(([name, value]) =>
    makeVariableRow(name, value, scope, usedText, requestName),
  );
}

function makeVariableRow(
  name: string,
  value: string,
  scope: VariableScopeKey,
  usedText: string,
  requestName: string,
  sourceScope?: VariableScopeKey,
  environmentId?: string,
): ManagedVariable {
  const usages = makeUsage(name, usedText, requestName);
  const actualScope = sourceScope ?? scope;
  return {
    id: `${scope}:${sourceScope ?? scope}:${environmentId ?? "default"}:${name}`,
    enabled: true,
    name,
    initialValue: value,
    currentValue: value,
    description: "",
    scope,
    sourceScope,
    environmentId,
    type: scope === "secrets" ? "secret" : inferType(name, actualScope),
    usedCount: usages.length,
    usages,
    group: inferGroup(name),
  };
}

function sortVariables(variables: ManagedVariable[], key: VariableSortKey, direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...variables].sort((a, b) => {
    const left = key === "enabled" ? Number(a.enabled) : a[key];
    const right = key === "enabled" ? Number(b.enabled) : b[key];
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * multiplier;
  });
}

export function VariablesPage({
  context,
  usedText = "",
  requestName = "Current request",
  environments = [],
  selectedEnvironmentId,
  onRequestVariablesChange,
  onCollectionVariablesChange,
  onEnvironmentVariablesChange,
  onEnvironmentVariablesByIdChange,
  onGlobalVariablesChange,
  onCreateEnvironment,
}: VariablesPageProps) {
  const [activeScope, setActiveScope] = useState<VariableScopeKey>("request");
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(
    selectedEnvironmentId ?? environments[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<VariableSortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [draft, setDraft] = useState<VariableDraft | null>(null);
  const [usageVariable, setUsageVariable] = useState<ManagedVariable | null>(null);
  const [maskedIds, setMaskedIds] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState<Record<string, Partial<ManagedVariable>>>({});
  const [localValues, setLocalValues] = useState<Partial<Record<VariableScopeKey, Record<string, string>>>>({});
  const [localEnvironmentValues, setLocalEnvironmentValues] = useState<Record<string, Record<string, string>>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const availableEnvironments = useMemo(
    () => (environments.length > 0 ? environments : context.environment ? [context.environment] : []),
    [context.environment, environments],
  );

  useEffect(() => {
    setActiveEnvironmentId((current) => {
      if (selectedEnvironmentId && availableEnvironments.some((environment) => environment.id === selectedEnvironmentId)) {
        return selectedEnvironmentId;
      }
      if (current && availableEnvironments.some((environment) => environment.id === current)) {
        return current;
      }
      return availableEnvironments[0]?.id ?? null;
    });
  }, [availableEnvironments, selectedEnvironmentId]);

  function environmentValues(environmentId: string | null) {
    const environment = environments.find((item) => item.id === environmentId) ??
      (environmentId === context.environment?.id ? context.environment : null);
    return {
      ...(environment?.variables ?? {}),
      ...(environmentId ? localEnvironmentValues[environmentId] ?? {} : {}),
    };
  }

  function scopeValues(scope: VariableScopeKey) {
    if (scope === "environment") {
      return environmentValues(activeEnvironmentId);
    }
    return {
      ...valuesForScope(context, scope),
      ...(localValues[scope] ?? {}),
    };
  }

  const baseVariables = useMemo(() => {
    const scopes: VariableScopeKey[] = ["request", "flow", "collection", "environment", "global", "runtime", "secrets"];
    return scopes.flatMap((scope) => {
      if (scope === "secrets") {
        const sourceScopes: VariableScopeKey[] = ["request", "flow", "collection", "environment", "global", "runtime"];
        return sourceScopes.flatMap((sourceScope) =>
          sourceScope === "environment"
            ? (environments.length > 0 ? environments : context.environment ? [context.environment] : []).flatMap((environment) =>
                Object.entries(environmentValues(environment.id))
                  .filter(([name]) => isSecretVariable(name) || metadata[`secrets:environment:${environment.id}:${name}`]?.type === "secret")
                  .map(([name, value]) =>
                    makeVariableRow(name, value, "secrets", usedText, requestName, "environment", environment.id),
                  ),
              )
            : Object.entries(scopeValues(sourceScope))
                .filter(([name]) => isSecretVariable(name) || metadata[`secrets:${sourceScope}:default:${name}`]?.type === "secret")
                .map(([name, value]) => makeVariableRow(name, value, "secrets", usedText, requestName, sourceScope)),
        );
      }

      if (scope === "environment") {
        return Object.entries(environmentValues(activeEnvironmentId)).map(([name, value]) =>
          makeVariableRow(name, value, scope, usedText, requestName, undefined, activeEnvironmentId ?? undefined),
        );
      }

      return Object.entries(scopeValues(scope)).map(([name, value]) =>
        makeVariableRow(name, value, scope, usedText, requestName),
      );
    });
  }, [activeEnvironmentId, context, environments, localEnvironmentValues, localValues, metadata, requestName, usedText]);

  const allVariables = useMemo(
    () =>
      baseVariables.map((variable) => ({
        ...variable,
        ...metadata[variable.id],
        id: variable.id,
      })),
    [baseVariables, metadata],
  );

  const scopedVariables = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = allVariables.filter((variable) => variable.scope === activeScope);
    const filtered = query
      ? rows.filter((variable) =>
          [variable.name, variable.currentValue, variable.initialValue, variable.description]
            .some((value) => value.toLowerCase().includes(query)),
        )
      : rows;
    return sortVariables(filtered, sortKey, sortDirection);
  }, [activeScope, allVariables, search, sortDirection, sortKey]);

  useEffect(() => {
    setMaskedIds(new Set(allVariables.filter((variable) => variable.type === "secret").map((variable) => variable.id)));
  }, [allVariables]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openNewVariable();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeScope]);

  function updateScope(
    scope: VariableScopeKey,
    updater: (values: Record<string, string>) => Record<string, string>,
    environmentIdOverride?: string,
  ) {
    const targetScope = scope === "secrets" ? "request" : scope;
    if (targetScope === "environment") {
      const environmentId = environmentIdOverride ?? activeEnvironmentId ?? environments[0]?.id ?? context.environment?.id ?? null;
      if (!environmentId) {
        return;
      }
      const next = updater({ ...environmentValues(environmentId) });
      setLocalEnvironmentValues((currentLocal) => ({
        ...currentLocal,
        [environmentId]: next,
      }));
      onEnvironmentVariablesByIdChange?.(environmentId, next);
      if (environmentId === selectedEnvironmentId || !onEnvironmentVariablesByIdChange) {
        onEnvironmentVariablesChange?.(next);
      }
      return;
    }

    const current = scopeValues(targetScope);
    const next = updater({ ...current });
    setLocalValues((currentLocal) => ({
      ...currentLocal,
      [targetScope]: next,
    }));
    if (targetScope === "request") {
      onRequestVariablesChange?.(next);
    } else if (targetScope === "collection") {
      onCollectionVariablesChange?.(next);
    } else if (targetScope === "global") {
      onGlobalVariablesChange?.(next);
    }
  }

  function openNewVariable(environmentIdOverride?: string) {
    const environmentId = environmentIdOverride ?? activeEnvironmentId ?? undefined;
    setDraft({
      enabled: true,
      name: "",
      initialValue: "",
      currentValue: "",
      description: "",
      scope: activeScope === "secrets" ? "request" : activeScope,
      environmentId: activeScope === "environment" ? environmentId : undefined,
      type: activeScope === "secrets" ? "secret" : "default",
      group: inferGroup(""),
    });
  }

  function openEdit(variable: ManagedVariable) {
    setDraft({
      id: variable.id,
      enabled: variable.enabled,
      name: variable.name,
      initialValue: variable.initialValue,
      currentValue: variable.currentValue,
      description: variable.description,
      scope: variable.sourceScope ?? variable.scope,
      environmentId: variable.environmentId,
      type: variable.type,
      group: variable.group,
    });
  }

  function saveDraft() {
    if (!draft) {
      return;
    }
    const original = allVariables.find((variable) => variable.id === draft.id);
    const targetScope = draft.scope;
    const targetEnvironmentId = targetScope === "environment"
      ? draft.environmentId ?? activeEnvironmentId ?? environments[0]?.id ?? context.environment?.id ?? undefined
      : undefined;
    const nextId = original
      ? `${original.scope}:${original.sourceScope ?? targetScope}:${targetEnvironmentId ?? original.environmentId ?? "default"}:${draft.name.trim()}`
      : `${activeScope === "secrets" ? "secrets" : targetScope}:${targetScope}:${targetEnvironmentId ?? "default"}:${draft.name.trim()}`;
    updateScope(targetScope, (values) => {
      if (original && original.name !== draft.name) {
        delete values[original.name];
      }
      values[draft.name.trim()] = draft.currentValue;
      return values;
    }, targetEnvironmentId);
    setMetadata((current) => {
      const next = { ...current };
      if (original) {
        delete next[original.id];
      }
      next[nextId] = {
        enabled: draft.enabled,
        description: draft.description,
        type: draft.type,
        group: draft.group || inferGroup(draft.name),
        environmentId: targetEnvironmentId,
      };
      return next;
    });
    setDraft(null);
  }

  function deleteVariable(variable: ManagedVariable) {
    if (!window.confirm(`Delete variable "${variable.name}" from ${VARIABLE_SCOPE_LABEL[variable.sourceScope ?? variable.scope]}?`)) {
      return;
    }
    updateScope(variable.sourceScope ?? variable.scope, (values) => {
      delete values[variable.name];
      return values;
    });
    setMetadata((current) => {
      const next = { ...current };
      delete next[variable.id];
      return next;
    });
  }

  function duplicateVariable(variable: ManagedVariable) {
    const copyName = `${variable.name}_copy`;
    updateScope(variable.sourceScope ?? variable.scope, (values) => ({
      ...values,
      [copyName]: variable.currentValue,
    }));
    const scope = variable.sourceScope ?? variable.scope;
    setMetadata((current) => ({
      ...current,
      [`${variable.scope}:${scope}:${variable.environmentId ?? "default"}:${copyName}`]: {
        description: variable.description,
        type: variable.type,
        group: variable.group,
        enabled: variable.enabled,
        environmentId: variable.environmentId,
      },
    }));
  }

  function toggleEnabled(variable: ManagedVariable) {
    setMetadata((current) => ({
      ...current,
      [variable.id]: {
        ...current[variable.id],
        enabled: !variable.enabled,
      },
    }));
  }

  function copyValue(variable: ManagedVariable) {
    void navigator.clipboard?.writeText(variable.currentValue);
  }

  function toggleSort(key: VariableSortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function exportVariables() {
    const blob = new Blob([`${JSON.stringify(scopedVariables, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${VARIABLE_SCOPE_LABEL[activeScope].toLowerCase()}-variables.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importVariables(file: File | null) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const entries: Array<[string, string]> = Array.isArray(parsed)
          ? parsed
              .filter((item) => item && typeof item.name === "string")
              .map((item) => [item.name, String(item.currentValue ?? item.value ?? item.initialValue ?? "")])
          : Object.entries(parsed).map(([name, value]) => [name, String(value)]);
        const targetScope = activeScope === "secrets" ? "request" : activeScope;
        updateScope(targetScope, (values) => ({
          ...values,
          ...Object.fromEntries(entries),
        }));
      } catch (error) {
        window.alert(`Could not import variables: ${String(error)}`);
      } finally {
        if (importRef.current) {
          importRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  }

  const referencedNames = extractVariableNames(usedText);

  return (
    <section className={styles.managerPage}>
      <header className={styles.managerHeader}>
        <div>
          <h2>Variables</h2>
          <p>Manage variables used across requests.</p>
        </div>
        <VariableSearch value={search} onChange={setSearch} inputRef={searchRef} />
      </header>

      <div className={styles.managerToolbar}>
        <div className={styles.managerPrecedence}>
          <span>Request</span>
          <em>↓</em>
          <span>Flow</span>
          <em>↓</em>
          <span>Collection</span>
          <em>↓</em>
          <span>Environment</span>
          <em>↓</em>
          <span>Globals</span>
          <em>↓</em>
          <span>Runtime</span>
          <Info size={13} />
          <strong>Highest matching scope wins.</strong>
        </div>
        <div className={styles.managerToolbarActions}>
          <button type="button" onClick={() => importRef.current?.click()}>
            <FileUp size={14} />
            Import
          </button>
          <input
            ref={importRef}
            className={styles.managerHiddenInput}
            type="file"
            accept="application/json,.json"
            onChange={(event) => importVariables(event.currentTarget.files?.[0] ?? null)}
          />
          <button type="button" onClick={exportVariables}>
            <Download size={14} />
            Export
          </button>
          <button type="button" className={styles.managerPrimaryButton} onClick={() => openNewVariable()}>
            <Plus size={14} />
            New Variable
          </button>
        </div>
      </div>

      <div className={styles.managerTabStack}>
        <VariableTabs activeScope={activeScope} variables={allVariables} onChange={setActiveScope} />

        {activeScope === "environment" && (
          <div className={styles.managerEnvironmentSection}>
            <nav className={styles.managerSubTabs} aria-label="Environments">
              {availableEnvironments.map((environment) => {
                const count = Object.keys(environmentValues(environment.id)).length;
                return (
                  <div key={environment.id} className={styles.managerEnvironmentItem}>
                    <button
                      type="button"
                      className={activeEnvironmentId === environment.id ? styles.managerSubTabActive : ""}
                      onClick={() => setActiveEnvironmentId(environment.id)}
                    >
                      <span>{environment.name}</span>
                      <em>{count}</em>
                    </button>
                    <button
                      type="button"
                      className={styles.managerEnvironmentQuickAction}
                      onClick={() => {
                        setActiveEnvironmentId(environment.id);
                        openNewVariable(environment.id);
                      }}
                    >
                      <Plus size={14} />
                      New Variable
                    </button>
                  </div>
                );
              })}
            </nav>
            {availableEnvironments.length === 0 && onCreateEnvironment && (
              <>
                <div className={styles.managerEnvironmentSeparator} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.managerEnvironmentCreate}
                  onClick={() => onCreateEnvironment()}
                >
                  <Plus size={14} />
                  Create New Environment
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.managerContent}>
        <div className={styles.managerMain}>
          {scopedVariables.length === 0 ? (
            <div className={styles.managerEmpty}>
              <strong>No {VARIABLE_SCOPE_LABEL[activeScope]} Variables</strong>
              <span>{EMPTY_SCOPE_COPY[activeScope]}</span>
              {referencedNames.length > 0 && (
                <small>{referencedNames.length} variable reference(s) found in the current request.</small>
              )}
              <button type="button" className={styles.managerPrimaryButton} onClick={() => openNewVariable()}>
                Create {VARIABLE_SCOPE_LABEL[activeScope]} Variable
              </button>
            </div>
          ) : (
            <VariableTable
              variables={scopedVariables}
              maskedIds={maskedIds}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={toggleSort}
              onToggleMask={(id) =>
                setMaskedIds((current) => {
                  const next = new Set(current);
                  if (next.has(id)) {
                    next.delete(id);
                  } else {
                    next.add(id);
                  }
                  return next;
                })
              }
              onToggleEnabled={toggleEnabled}
              onEdit={openEdit}
              onCopy={copyValue}
              onDuplicate={duplicateVariable}
              onDelete={deleteVariable}
              onUsage={setUsageVariable}
            />
          )}
        </div>
        <VariableUsagePanel variable={usageVariable} onClose={() => setUsageVariable(null)} />
      </div>

      <VariableDrawer draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onSave={saveDraft} />
    </section>
  );
}
