import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CollectionIndex, FlowEdge, FlowNode, RunResponse } from "../../types/bik";
import { readLatestSuccessfulResponseExample } from "../../services/responseExampleService";
import * as api from "../../services/tauriApi";
import { AutoMapButton } from "./AutoMapButton";
import { CurrentRequestPanel } from "./CurrentRequestPanel";
import { MappingConnectionLayer } from "./MappingConnectionLayer";
import { MappingLane } from "./MappingLane";
import { MappingStepHeader } from "./MappingStepHeader";
import { PreviousResponsePanel } from "./PreviousResponsePanel";
import { TransformMenu } from "./TransformMenu";
import {
  buildAutoMapSuggestions,
  buildSourceCatalog,
  buildTargetCatalog,
  createMapping,
  defaultTransformTemplate,
  filterFields,
  filterTreeByField,
  filterTreeNodes,
  formatSourcePath,
  formatTargetPath,
  withEdgeSummary,
} from "./mappingBuilderUtils";
import { MappingSourceField, MappingTargetField, MappingTransformType } from "./mappingBuilderTypes";
import styles from "./MappingBuilderModal.module.css";
import { createRequestBody } from "../../services/requestBody";

interface MappingBuilderModalProps {
  open: boolean;
  workspacePath: string;
  collection: CollectionIndex;
  edge: FlowEdge;
  fromNode: FlowNode;
  toNode: FlowNode;
  environmentId: string | null;
  initialResponse: RunResponse | null;
  initialTargetPath?: string | null;
  onClose: () => void;
  onSave: (edge: FlowEdge) => void;
  onDiscoveredResponse: (nodeId: string, response: RunResponse) => void;
}

export function MappingBuilderModal({
  open,
  workspacePath,
  collection,
  edge,
  fromNode,
  toNode,
  environmentId,
  initialResponse,
  initialTargetPath,
  onClose,
  onSave,
  onDiscoveredResponse,
}: MappingBuilderModalProps) {
  const [draftMappings, setDraftMappings] = useState(edge.mappings);
  const [response, setResponse] = useState<RunResponse | null>(initialResponse);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [hoveredMappingIndex, setHoveredMappingIndex] = useState<number | null>(null);
  const [transformAnchor, setTransformAnchor] = useState<{ mappingIndex: number; left: number; top: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState("Select a value from the previous response.");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sourceRefs = useRef(new Map<string, HTMLButtonElement>());
  const targetRefs = useRef(new Map<string, HTMLButtonElement>());

  const sourceEndpoint = collection.endpoints.find((endpoint) => endpoint.id === fromNode.requestId) ?? null;
  const targetEndpoint = collection.endpoints.find((endpoint) => endpoint.id === toNode.requestId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftMappings(edge.mappings);
    setResponse(initialResponse);
    setSelectedSourceId(null);
    setSelectedTargetId(null);
    setHoveredMappingIndex(null);
    setTransformAnchor(null);
    setSourceSearch("");
    setTargetSearch("");
    setStatusMessage("Select a value from the previous response.");
  }, [edge.mappings, initialResponse, open]);

  useEffect(() => {
    if (!open || initialResponse || !sourceEndpoint) {
      return;
    }
    let cancelled = false;
    setLoadingResponse(true);
    void readLatestSuccessfulResponseExample(sourceEndpoint).then((next) => {
      if (!cancelled) {
        setResponse(next);
        setLoadingResponse(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialResponse, open, sourceEndpoint]);

  const sourceCatalog = useMemo(() => buildSourceCatalog(response), [response]);
  const targetCatalog = useMemo(
    () => targetEndpoint ? buildTargetCatalog(targetEndpoint.request) : buildTargetCatalog(emptyRequest()),
    [targetEndpoint],
  );

  useEffect(() => {
    if (!open || !initialTargetPath) {
      return;
    }
    const normalized = initialTargetPath.startsWith("body.") ? initialTargetPath : `body.${initialTargetPath}`;
    const field = targetCatalog.allFields.find((item) => item.targetPath === `$.request.${normalized}`);
    if (field) {
      setSelectedTargetId(field.id);
    }
  }, [initialTargetPath, open, targetCatalog.allFields]);

  const filteredSourceTree = useMemo(() => filterTreeNodes(sourceCatalog.bodyTree, sourceSearch), [sourceCatalog.bodyTree, sourceSearch]);
  const filteredSourceHeaders = useMemo(() => filterFields(sourceCatalog.headerFields, sourceSearch), [sourceCatalog.headerFields, sourceSearch]);
  const filteredSourceMeta = useMemo(() => filterFields(sourceCatalog.metaFields, sourceSearch), [sourceCatalog.metaFields, sourceSearch]);
  const filteredTargetTree = useMemo(() => filterTreeNodes(targetCatalog.bodyTree, targetSearch), [targetCatalog.bodyTree, targetSearch]);
  const filteredNeedsMappingTree = useMemo(
    () => filterTreeByField(filteredTargetTree, (field) => field.expectsMapping),
    [filteredTargetTree],
  );
  const filteredNeedsMappingFields = useMemo(
    () => filterFields(targetCatalog.allFields.filter((field) => field.expectsMapping), targetSearch),
    [targetCatalog.allFields, targetSearch],
  );
  const filteredOtherTargetFields = useMemo(
    () => filterFields(targetCatalog.allFields.filter((field) => !field.expectsMapping), targetSearch),
    [targetCatalog.allFields, targetSearch],
  );

  const selectedSource = sourceCatalog.allFields.find((field) => field.id === selectedSourceId) ?? null;

  const autoMapSuggestions = useMemo(
    () => buildAutoMapSuggestions(sourceCatalog.allFields, targetCatalog.allFields.filter((field) => field.expectsMapping), draftMappings),
    [draftMappings, sourceCatalog.allFields, targetCatalog.allFields],
  );

  const sourceMappedFieldIds = useMemo(() => {
    const ids = new Set<string>();
    draftMappings.forEach((mapping) => {
      const field = sourceCatalog.allFields.find((item) => item.path === mapping.sourcePath);
      if (field) {
        ids.add(field.id);
      }
    });
    return ids;
  }, [draftMappings, sourceCatalog.allFields]);

  const targetMappedFieldIds = useMemo(() => {
    const ids = new Set<string>();
    draftMappings.forEach((mapping) => {
      const field = targetCatalog.allFields.find((item) => item.targetType === mapping.targetType && item.key === mapping.targetKey);
      if (field) {
        ids.add(field.id);
      }
    });
    return ids;
  }, [draftMappings, targetCatalog.allFields]);

  const activeSourceFieldIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedSourceId) {
      ids.add(selectedSourceId);
    }
    if (hoveredMappingIndex !== null) {
      const mapping = draftMappings[hoveredMappingIndex];
      const field = mapping ? sourceCatalog.allFields.find((item) => item.path === mapping.sourcePath) : null;
      if (field) {
        ids.add(field.id);
      }
    }
    return ids;
  }, [draftMappings, hoveredMappingIndex, selectedSourceId, sourceCatalog.allFields]);

  const activeTargetFieldIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedTargetId) {
      ids.add(selectedTargetId);
    }
    if (hoveredMappingIndex !== null) {
      const mapping = draftMappings[hoveredMappingIndex];
      const field = mapping ? targetCatalog.allFields.find((item) => item.targetType === mapping.targetType && item.key === mapping.targetKey) : null;
      if (field) {
        ids.add(field.id);
      }
    }
    return ids;
  }, [draftMappings, hoveredMappingIndex, selectedTargetId, targetCatalog.allFields]);

  const connectionPaths = useMemo(() => {
    const containerRect = bodyRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return [];
    }
    return draftMappings.flatMap((mapping, index) => {
      const sourceField = sourceCatalog.allFields.find((item) => item.path === mapping.sourcePath);
      const targetField = targetCatalog.allFields.find((item) => item.targetType === mapping.targetType && item.key === mapping.targetKey);
      if (!sourceField || !targetField) {
        return [];
      }
      const sourceElement = sourceRefs.current.get(sourceField.id);
      const targetElement = targetRefs.current.get(targetField.id);
      if (!sourceElement || !targetElement) {
        return [];
      }
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const startX = sourceRect.right - containerRect.left;
      const startY = sourceRect.top - containerRect.top + sourceRect.height / 2;
      const endX = targetRect.left - containerRect.left;
      const endY = targetRect.top - containerRect.top + targetRect.height / 2;
      const dx = Math.max((endX - startX) / 2, 70);
      return [{
        id: `${sourceField.id}:${targetField.id}:${index}`,
        active: hoveredMappingIndex === null || hoveredMappingIndex === index,
        path: `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`,
      }];
    });
  }, [draftMappings, hoveredMappingIndex, sourceCatalog.allFields, targetCatalog.allFields]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (transformAnchor) {
        setTransformAnchor(null);
        return;
      }
      if (selectedSourceId || selectedTargetId) {
        setSelectedSourceId(null);
        setSelectedTargetId(null);
        setStatusMessage("Selection cleared. Select a value from the previous response.");
        return;
      }
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, selectedSourceId, selectedTargetId, transformAnchor]);

  if (!open || !targetEndpoint) {
    return null;
  }

  async function runSourceNode() {
    if (!sourceEndpoint) {
      return;
    }
    setLoadingResponse(true);
    try {
      const next = await api.sendRequest(
        workspacePath,
        collection.id,
        sourceEndpoint.id,
        environmentId,
        sourceEndpoint.request,
      );
      setResponse(next);
      setStatusMessage("Response updated. Select a value from the previous response.");
      onDiscoveredResponse(fromNode.id, next);
    } finally {
      setLoadingResponse(false);
    }
  }

  function handleSelectSource(field: MappingSourceField) {
    const nextSelectedId = selectedSourceId === field.id ? null : field.id;
    setSelectedSourceId(nextSelectedId);
    setSelectedTargetId(null);
    setStatusMessage(nextSelectedId ? `Selected ${formatSourcePath(field.path)}. Now choose where to place it.` : "Select a value from the previous response.");
  }

  function addMapping(targetField: MappingTargetField) {
    setSelectedTargetId(targetField.id);
    if (!selectedSource) {
      setStatusMessage("Choose a value from the previous response first.");
      return;
    }
    const exists = draftMappings.some((mapping) =>
      mapping.sourcePath === selectedSource.path &&
      mapping.targetType === targetField.targetType &&
      mapping.targetKey === targetField.key,
    );
    if (exists) {
      setStatusMessage(`Mapping already exists for ${formatTargetPath(targetField.targetPath)}.`);
      setSelectedSourceId(null);
      return;
    }
    setDraftMappings((current) => [...current, createMapping(selectedSource, targetField)]);
    setStatusMessage(`Mapped ${formatSourcePath(selectedSource.path)} → ${formatTargetPath(targetField.targetPath)}.`);
    setSelectedSourceId(null);
    setSelectedTargetId(null);
  }

  function applyAutoMap() {
    if (autoMapSuggestions.length === 0) {
      return;
    }
    setDraftMappings((current) => [...current, ...autoMapSuggestions.map((suggestion) => createMapping(suggestion.sourceField, suggestion.targetField))]);
    setStatusMessage(`Created ${autoMapSuggestions.length} automatic mapping${autoMapSuggestions.length === 1 ? "" : "s"}.`);
  }

  function clearMappings() {
    setDraftMappings([]);
    setHoveredMappingIndex(null);
    setSelectedSourceId(null);
    setSelectedTargetId(null);
    setStatusMessage("Mappings cleared. Select a value from the previous response.");
  }

  function updateTransform(mappingIndex: number, transformType: MappingTransformType, template: string) {
    setDraftMappings((current) =>
      current.map((mapping, index) =>
        index === mappingIndex
          ? { ...mapping, transformType, template: template || defaultTransformTemplate(transformType) }
          : mapping,
      ),
    );
  }

  function saveAndClose() {
    onSave(withEdgeSummary(edge, draftMappings));
    onClose();
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div>
            <strong>Mapping Builder</strong>
            <span>{fromNode.name} &rarr; {toNode.name}</span>
          </div>
          <div className={styles.headerActions}>
            <AutoMapButton count={autoMapSuggestions.length} onClick={applyAutoMap} />
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close mapping builder">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={styles.modalBody}>
          <MappingStepHeader message={statusMessage} />

          <div ref={bodyRef} className={styles.workspace}>
            <MappingConnectionLayer paths={connectionPaths} />

            <PreviousResponsePanel
              response={response}
              loading={loadingResponse}
              bodyTree={filteredSourceTree}
              headerFields={filteredSourceHeaders}
              metaFields={filteredSourceMeta}
              search={sourceSearch}
              mappedFieldIds={sourceMappedFieldIds}
              activeFieldIds={activeSourceFieldIds}
              selectedFieldId={selectedSourceId}
              getFieldRef={(field) => (node) => {
                if (node) {
                  sourceRefs.current.set(field.id, node);
                } else {
                  sourceRefs.current.delete(field.id);
                }
              }}
              onSearchChange={setSourceSearch}
              onRunSourceNode={() => void runSourceNode()}
              onSelectField={handleSelectSource}
              onHoverField={(field) => {
                if (!field) {
                  setHoveredMappingIndex(null);
                  return;
                }
                const mappingIndex = draftMappings.findIndex((mapping) => mapping.sourcePath === field.path);
                setHoveredMappingIndex(mappingIndex >= 0 ? mappingIndex : null);
              }}
            />

            <MappingLane
              mappings={draftMappings}
              hoveredMappingIndex={hoveredMappingIndex}
              selectedSourcePath={selectedSource ? formatSourcePath(selectedSource.path) : null}
              onHoverMapping={setHoveredMappingIndex}
              onOpenTransform={(mappingIndex, target) => {
                const rect = target.getBoundingClientRect();
                setTransformAnchor({ mappingIndex, left: rect.left - 120, top: rect.bottom + 8 });
              }}
              onDeleteMapping={(mappingIndex) => {
                setDraftMappings((current) => current.filter((_, index) => index !== mappingIndex));
                setTransformAnchor((current) => current?.mappingIndex === mappingIndex ? null : current);
                setStatusMessage("Mapping removed.");
              }}
              formatSourceLabel={(mapping) => formatSourcePath(mapping.sourcePath)}
              formatTargetLabel={(mapping) => formatTargetPath(mapping.targetPath)}
            />

            <CurrentRequestPanel
              needsMappingTree={filteredNeedsMappingTree}
              needsMappingFields={filteredNeedsMappingFields}
              otherFields={filteredOtherTargetFields}
              search={targetSearch}
              mappedFieldIds={targetMappedFieldIds}
              activeFieldIds={activeTargetFieldIds}
              selectedFieldId={selectedTargetId}
              pickMode={Boolean(selectedSource)}
              getFieldRef={(field) => (node) => {
                if (node) {
                  targetRefs.current.set(field.id, node);
                } else {
                  targetRefs.current.delete(field.id);
                }
              }}
              onSearchChange={setTargetSearch}
              onSelectField={addMapping}
              onHoverField={(field) => {
                if (!field) {
                  setHoveredMappingIndex(null);
                  return;
                }
                const mappingIndex = draftMappings.findIndex(
                  (mapping) => mapping.targetType === field.targetType && mapping.targetKey === field.key,
                );
                setHoveredMappingIndex(mappingIndex >= 0 ? mappingIndex : null);
              }}
            />
          </div>
        </div>

        <footer className={styles.modalFooter}>
          <div className={styles.footerHint}>
            {draftMappings.length === 0 ? "No mappings yet. Click a response field, then a target field." : `${draftMappings.length} mapping${draftMappings.length === 1 ? "" : "s"} ready to save.`}
          </div>
          <div className={styles.footerActions}>
            <button type="button" onClick={clearMappings}>Clear Mapping</button>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className={styles.primaryButton} onClick={saveAndClose}>Save</button>
          </div>
        </footer>

        {transformAnchor && draftMappings[transformAnchor.mappingIndex] ? (
          <TransformMenu
            anchor={{ left: transformAnchor.left, top: transformAnchor.top }}
            transformType={(draftMappings[transformAnchor.mappingIndex].transformType || "raw") as MappingTransformType}
            template={draftMappings[transformAnchor.mappingIndex].template || "{{value}}"}
            onChange={(transformType, template) => updateTransform(transformAnchor.mappingIndex, transformType, template)}
            onClose={() => setTransformAnchor(null)}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function emptyRequest() {
  return {
    bikVersion: "1.0",
    type: "request" as const,
    id: "empty",
    name: "Empty",
    method: "GET",
    url: "",
    headers: {},
    queryParams: {},
    body: createRequestBody("none"),
    variables: {},
  };
}
