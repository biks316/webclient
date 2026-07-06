import { useMemo, useState } from "react";
import { BikRequest, FlowDefinition, FlowNode } from "../../types/bik";
import { edgeSource, edgeTarget } from "../../services/flowLayoutService";
import { extractVariableNames, resolveTemplate, VariableContext } from "../../services/variableResolver";
import { findBodyMapPlaceholders } from "../../services/mapPlaceholderService";
import { MapPlaceholderDetector } from "./MapPlaceholderDetector";
import styles from "./FlowBuilder.module.css";

interface FlowNodeInspectorProps {
  node: FlowNode;
  request: BikRequest;
  flow: FlowDefinition;
  variableContext?: VariableContext;
  onRunStep: () => void;
  onDeleteNode: () => void;
  onOpenPlaceholderMapping: (targetPath: string) => void;
}

type InspectorTab = "request" | "response" | "mappings" | "variables";

export function FlowNodeInspector({ node, request, flow, variableContext = {}, onRunStep, onDeleteNode, onOpenPlaceholderMapping }: FlowNodeInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("request");
  const incomingMappings = useMemo(
    () => flow.edges.filter((edge) => edgeTarget(edge) === node.id).flatMap((edge) => edge.mappings),
    [flow.edges, node.id],
  );
  const outgoingMappings = useMemo(
    () => flow.edges.filter((edge) => edgeSource(edge) === node.id).flatMap((edge) => edge.mappings),
    [flow.edges, node.id],
  );
  const usedText = `${request.url}\n${JSON.stringify(request.headers)}\n${JSON.stringify(request.queryParams)}\n${JSON.stringify(request.body)}`;
  const usedVariables = extractVariableNames(usedText).map((name) => resolveTemplate(`{{${name}}}`, {
    ...variableContext,
    requestVariables: request.variables,
  }).variables[0]);
  const mapPlaceholders = useMemo(() => findBodyMapPlaceholders(request.body), [request.body]);

  return (
    <aside className={styles.mappingPanel}>
      <header>
        <h3>{request.name}</h3>
        <span>{request.method} {request.url}</span>
      </header>
      <div className={styles.inspectorTabs}>
        {(["request", "response", "mappings", "variables"] as InspectorTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? styles.targetOptionActive : ""} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "request" && (
        <div className={styles.nodeDetails}>
          <strong>Headers</strong>
          <pre>{JSON.stringify(request.headers, null, 2)}</pre>
          <strong>Body</strong>
          <pre>{JSON.stringify(request.body, null, 2)}</pre>
          <strong>Map placeholders</strong>
          <MapPlaceholderDetector
            placeholders={mapPlaceholders}
            onSelect={(placeholder) => onOpenPlaceholderMapping(placeholder.path)}
          />
          <button type="button" onClick={onRunStep}>Run this step</button>
          <button type="button" onClick={onDeleteNode}>Delete node</button>
        </div>
      )}

      {tab === "response" && (
        <div className={styles.nodeDetails}>
          <strong>Last status</strong>
          <pre>{node.lastRun ? `${node.lastRun.statusCode ?? "Error"} ${node.lastRun.durationMs ?? "-"}ms\n${node.lastRun.error ?? ""}` : "Not run"}</pre>
          <strong>Response headers</strong>
          <pre>{JSON.stringify(node.lastRun?.responseHeaders ?? {}, null, 2)}</pre>
          <strong>Response body</strong>
          <pre>{node.lastRun?.responseBody || "No response yet"}</pre>
        </div>
      )}

      {tab === "mappings" && (
        <div className={styles.nodeDetails}>
          <strong>Incoming mappings</strong>
          <pre>{JSON.stringify(incomingMappings, null, 2)}</pre>
          <strong>Extracted output fields</strong>
          <pre>{JSON.stringify(outgoingMappings, null, 2)}</pre>
        </div>
      )}

      {tab === "variables" && (
        <div className={styles.nodeDetails}>
          <strong>Variables used by this request</strong>
          <pre>{JSON.stringify(usedVariables, null, 2)}</pre>
          <strong>Missing variables</strong>
          <pre>{JSON.stringify(usedVariables.filter((variable) => !variable.found), null, 2)}</pre>
          <strong>Runtime variables created by outgoing mappings</strong>
          <pre>{JSON.stringify(outgoingMappings.filter((mapping) => mapping.targetType === "variable" || mapping.targetType === "flowVariable"), null, 2)}</pre>
        </div>
      )}
    </aside>
  );
}
