import { useMemo, useState } from "react";
import { BikRequest, FlowDefinition, FlowNode } from "../../types/bik";
import { edgeSource, edgeTarget } from "../../services/flowLayoutService";
import styles from "./FlowBuilder.module.css";

interface FlowNodeInspectorProps {
  node: FlowNode;
  request: BikRequest;
  flow: FlowDefinition;
  onRunStep: () => void;
}

type InspectorTab = "request" | "response" | "mappings" | "variables";

export function FlowNodeInspector({ node, request, flow, onRunStep }: FlowNodeInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("request");
  const incomingMappings = useMemo(
    () => flow.edges.filter((edge) => edgeTarget(edge) === node.id).flatMap((edge) => edge.mappings),
    [flow.edges, node.id],
  );
  const outgoingMappings = useMemo(
    () => flow.edges.filter((edge) => edgeSource(edge) === node.id).flatMap((edge) => edge.mappings),
    [flow.edges, node.id],
  );

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
          <button type="button" onClick={onRunStep}>Run this step</button>
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
          <strong>Variables used</strong>
          <pre>{JSON.stringify(request.variables, null, 2)}</pre>
        </div>
      )}
    </aside>
  );
}
