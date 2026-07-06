import { useEffect, useState } from "react";
import { CollectionIndex, FlowDefinition, FlowEdge, FlowMapping, RunResponse } from "../../types/bik";
import { leafLabel } from "../../services/jsonTreeService";
import { readLatestSuccessfulResponseExample } from "../../services/responseExampleService";
import { TargetType, TransformType } from "../../services/mappingSuggestionService";
import * as api from "../../services/tauriApi";
import { edgeSource, edgeTarget } from "../../services/flowLayoutService";
import { VariableContext } from "../../services/variableResolver";
import { ForwardableResponseViewer } from "./ForwardableResponseViewer";
import { ForwardRuleList } from "./ForwardRuleList";
import { ForwardRuleBadge } from "./ForwardRuleBadge";
import { ForwardValuePopover } from "./ForwardValuePopover";
import { AdvancedForwardingPanel } from "./AdvancedForwardingPanel";
import { forwardRuleSummary, forwardRuleToMapping, ForwardSource, ForwardTargetLocation } from "./forwarding";
import { TargetPicker } from "./TargetPicker";
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
  return { ...next, label: forwardRuleSummary(next) };
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
  const [selectedSource, setSelectedSource] = useState<ForwardSource | null>(null);
  const [sourceAnchor, setSourceAnchor] = useState<{ top: number; left: number } | null>(null);
  const [exampleResponse, setExampleResponse] = useState<RunResponse | null>(null);
  const [loadingExample, setLoadingExample] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [sourcePath, setSourcePath] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("flowVariable");
  const [targetKey, setTargetKey] = useState("value");
  const [targetPath, setTargetPath] = useState("variables.value");
  const [transformType, setTransformType] = useState<TransformType>("raw");
  const [template, setTemplate] = useState("{{value}}");

  const from = edge ? flow.nodes.find((node) => node.id === edgeSource(edge)) : null;
  const to = edge ? flow.nodes.find((node) => node.id === edgeTarget(edge)) : null;
  const sourceEndpoint = from ? collection.endpoints.find((endpoint) => endpoint.id === from.requestId) ?? null : null;
  const targetEndpoint = to ? collection.endpoints.find((endpoint) => endpoint.id === to.requestId) ?? null : null;

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

  useEffect(() => {
    if (!edge || editingIndex === null) {
      return;
    }
    const mapping = edge.mappings[editingIndex];
    if (!mapping) {
      return;
    }
    setSourcePath(mapping.sourcePath);
    setTargetType(mapping.targetType as TargetType);
    setTargetKey(mapping.targetKey);
    setTargetPath(mapping.targetPath);
    setTransformType(mapping.transformType);
    setTemplate(mapping.template);
  }, [edge, editingIndex]);

  function chooseSource(source: ForwardSource, anchor: DOMRect) {
    setSelectedSource(source);
    setSourceAnchor({ top: anchor.bottom + 8, left: anchor.left });
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

  function commitForwardRule(target: { location: ForwardTargetLocation; key: string }) {
    if (!edge || !selectedSource) {
      return;
    }

    const nextMapping: FlowMapping = {
      ...forwardRuleToMapping({
        id: `${edge.id}:${selectedSource.path}:${target.location}:${target.key}`,
        sourceNodeId: from?.id ?? edgeSource(edge),
        targetNodeId: to?.id ?? edgeTarget(edge),
        source: {
          location: selectedSource.location,
          path: selectedSource.path,
        },
        target,
        transform: {
          type: "raw",
        },
      }),
      sourceLabel: selectedSource.label,
    };

    onChange(edgeWithLabel(edge, [...edge.mappings, nextMapping]));
    setSelectedSource(null);
    setSourceAnchor(null);
  }

  function commitAdvancedMapping() {
    if (!edge || !sourcePath) {
      return;
    }

    const mapping: FlowMapping = {
      sourcePath,
      sourceLabel: leafLabel(sourcePath),
      targetType,
      targetKey,
      targetPath,
      targetVariable: targetType === "flowVariable" ? targetKey : undefined,
      transformType,
      template,
    };

    const nextMappings =
      editingIndex === null
        ? [...edge.mappings, mapping]
        : edge.mappings.map((item, index) => (index === editingIndex ? mapping : item));

    onChange(edgeWithLabel(edge, nextMappings));
    setEditingIndex(null);
    setAdvancedOpen(false);
  }

  function startEditing(index: number) {
    const mapping = edge?.mappings[index];
    if (!mapping) {
      return;
    }
    setSourcePath(mapping.sourcePath);
    setTargetType(mapping.targetType as TargetType);
    setTargetKey(mapping.targetKey);
    setTargetPath(mapping.targetPath);
    setTransformType(mapping.transformType);
    setTemplate(mapping.template);
    setEditingIndex(index);
    setAdvancedOpen(true);
  }

  function deleteMapping(index: number) {
    if (!edge) {
      return;
    }
    onChange(edgeWithLabel(edge, edge.mappings.filter((_, itemIndex) => itemIndex !== index)));
  }

  if (!edge) {
    return (
      <aside className={styles.mappingPanel}>
        <h3>Forward Values</h3>
        {warning && <p className={styles.flowWarning}>{warning}</p>}
        <p>Connect two request nodes or select an arrow to define how values move through the chain.</p>
      </aside>
    );
  }

  const availableSource = exampleResponse ?? null;

  return (
    <aside className={styles.mappingPanel}>
      <header className={styles.forwardHeader}>
        <div>
          <h3>Forward Values</h3>
          <ForwardRuleBadge
            label={forwardRuleSummary(edge)}
            active={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
          />
        </div>
        <button type="button" onClick={onDeleteEdge}>Delete connection</button>
      </header>

      {warning && <p className={styles.flowWarning}>{warning}</p>}

      <ForwardRuleList edge={edge} onEdit={startEditing} onDelete={deleteMapping} />

      <ForwardableResponseViewer
        response={availableSource}
        loading={loadingExample}
        onRunSourceRequest={() => void runSourceRequest()}
        onPickSource={chooseSource}
      />

      {selectedSource && sourceAnchor && (
        <ForwardValuePopover
          source={selectedSource}
          anchor={sourceAnchor}
          request={targetEndpoint?.request ?? sourceEndpoint!.request}
          onClose={() => {
            setSelectedSource(null);
            setSourceAnchor(null);
          }}
          onCommit={commitForwardRule}
        />
      )}

      <AdvancedForwardingPanel open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)}>
        <div className={styles.visualMappingGrid}>
          <section>
            <strong>Previous response</strong>
            <p>Use the compact forwarder above for one-off rules.</p>
          </section>

          <section>
            <strong>Advanced target picker</strong>
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
            <button type="button" className={styles.primaryButton} disabled={!sourcePath} onClick={commitAdvancedMapping}>
              {editingIndex === null ? "Save mapping" : "Update mapping"}
            </button>
          </section>
        </div>
      </AdvancedForwardingPanel>
    </aside>
  );
}
