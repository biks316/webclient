import { useEffect, useMemo, useState } from "react";
import { BikRequest, CollectionIndex, FlowDefinition, FlowEdge, FlowMapping, RunResponse } from "../../types/bik";
import { buildResponseTree, leafLabel } from "../../services/jsonTreeService";
import { readLatestSuccessfulResponseExample } from "../../services/responseExampleService";
import { suggestMapping, TargetType, TransformType } from "../../services/mappingSuggestionService";
import * as api from "../../services/tauriApi";
import { ResponseJsonTree } from "./ResponseJsonTree";
import { TargetPicker } from "./TargetPicker";
import { mappingLabel } from "./EdgeLabel";
import { edgeSource, edgeTarget } from "../../services/flowLayoutService";
import { VariableContext } from "../../services/variableResolver";
import styles from "./FlowBuilder.module.css";

interface MappingPanelProps {
  workspacePath: string;
  collection: CollectionIndex;
  environmentId: string | null;
  flow: FlowDefinition;
  edge: FlowEdge | null;
  onChange: (edge: FlowEdge) => void;
  onDiscoveredResponse: (nodeId: string, response: RunResponse) => void;
  warning?: string | null;
  onDeleteEdge: () => void;
  variableContext?: VariableContext;
}

function edgeWithLabel(edge: FlowEdge, mappings: FlowMapping[]): FlowEdge {
  const next = { ...edge, mappings };
  return { ...next, label: mappingLabel(next) };
}

export function MappingPanel({
  workspacePath,
  collection,
  environmentId,
  flow,
  edge,
  onChange,
  onDiscoveredResponse,
  warning,
  onDeleteEdge,
  variableContext,
}: MappingPanelProps) {
  const [sourcePath, setSourcePath] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("variable");
  const [targetKey, setTargetKey] = useState("value");
  const [targetPath, setTargetPath] = useState("variables.value");
  const [transformType, setTransformType] = useState<TransformType>("raw");
  const [template, setTemplate] = useState("{{value}}");
  const [exampleResponse, setExampleResponse] = useState<RunResponse | null>(null);
  const [loadingExample, setLoadingExample] = useState(false);

  const from = edge ? flow.nodes.find((node) => node.id === edgeSource(edge)) : null;
  const to = edge ? flow.nodes.find((node) => node.id === edgeTarget(edge)) : null;
  const sourceEndpoint = from ? collection.endpoints.find((endpoint) => endpoint.id === from.requestId) ?? null : null;
  const responseTree = useMemo(() => exampleResponse ? buildResponseTree(exampleResponse) : [], [exampleResponse]);

  useEffect(() => {
    let cancelled = false;
    async function loadExample() {
      if (!sourceEndpoint) {
        setExampleResponse(null);
        return;
      }
      setLoadingExample(true);
      const next = await readLatestSuccessfulResponseExample(sourceEndpoint);
      if (!cancelled) {
        setExampleResponse(next);
        setLoadingExample(false);
      }
    }
    void loadExample();
    return () => {
      cancelled = true;
    };
  }, [sourceEndpoint?.id, sourceEndpoint?.examples.length]);

  function chooseSource(path: string) {
    setSourcePath(path);
    const suggestion = suggestMapping(path);
    setTargetType(suggestion.targetType);
    setTargetKey(suggestion.targetKey);
    setTargetPath(suggestion.targetPath);
    setTransformType(suggestion.transformType);
    setTemplate(suggestion.template);
  }

  async function runSourceRequest() {
    if (!from || !sourceEndpoint) {
      return;
    }
    const response = await api.sendRequest(
      workspacePath,
      collection.id,
      sourceEndpoint.id,
      environmentId,
      sourceEndpoint.request,
    );
    setExampleResponse(response);
    onDiscoveredResponse(from.id, response);
  }

  if (!edge) {
    return (
      <aside className={styles.mappingPanel}>
        <h3>Mapping</h3>
        {warning && <p className={styles.flowWarning}>{warning}</p>}
        <p>Connect two request nodes or select an arrow to define how values move through the chain.</p>
      </aside>
    );
  }

  function addMapping() {
    if (!edge || !sourcePath) {
      return;
    }

    const mapping: FlowMapping = {
      sourcePath,
      sourceLabel: leafLabel(sourcePath),
      targetType,
      targetKey,
      targetPath,
      targetVariable: targetType === "variable" ? targetKey : undefined,
      transformType,
      template,
    };
    onChange(edgeWithLabel(edge, [...edge.mappings, mapping]));
  }

  return (
    <aside className={styles.mappingPanel}>
      <header>
        <h3>Map values from {from?.name} to {to?.name}</h3>
        <span>{mappingLabel(edge)}</span>
      </header>
      {warning && <p className={styles.flowWarning}>{warning}</p>}
      <button type="button" onClick={onDeleteEdge}>Delete connection</button>

      <div className={styles.visualMappingGrid}>
        <section>
          <strong>Previous response</strong>
          {loadingExample ? (
            <p>Loading response example...</p>
          ) : responseTree.length > 0 ? (
            <ResponseJsonTree nodes={responseTree} selectedPath={sourcePath} onSelect={chooseSource} />
          ) : (
            <div className={styles.noExample}>
              <p>No response example found. Run this request once to discover fields.</p>
              <button type="button" onClick={() => void runSourceRequest()}>Run source request to discover fields</button>
            </div>
          )}
        </section>

        <section>
          <strong>Target picker</strong>
          <TargetPicker
            targetType={targetType}
            targetKey={targetKey}
            targetPath={targetPath}
            transformType={transformType}
            template={template}
            variableContext={variableContext}
            onChange={(next) => {
              setTargetType(next.targetType);
              setTargetKey(next.targetKey);
              setTargetPath(next.targetPath);
              setTransformType(next.transformType);
              setTemplate(next.template);
            }}
          />
          <button type="button" className={styles.primaryButton} disabled={!sourcePath} onClick={addMapping}>
            Add mapping
          </button>
        </section>
      </div>

      <div className={styles.mappingList}>
        {edge.mappings.map((mapping, index) => (
          <div key={`${mapping.sourcePath}-${index}`} className={styles.mappingSummary}>
            <span>{mapping.sourceLabel} → {mapping.targetKey || mapping.targetType}</span>
            <button
              type="button"
              title="Delete mapping"
              onClick={() => onChange(edgeWithLabel(edge, edge.mappings.filter((_, itemIndex) => itemIndex !== index)))}
            >
              Trash
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
