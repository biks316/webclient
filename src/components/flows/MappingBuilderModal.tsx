import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CollectionIndex, FlowEdge, FlowNode, RunResponse } from "../../types/bik";
import { readLatestSuccessfulResponseExample } from "../../services/responseExampleService";
import * as api from "../../services/tauriApi";
import { CurrentRequestJsonView } from "./CurrentRequestJsonView";
import { LiveMappingArrowLayer, MappingOverlayPath } from "./LiveMappingArrowLayer";
import { LiveMappingColumn } from "./LiveMappingColumn";
import { MappingFooter } from "./MappingFooter";
import { MappingStepper } from "./MappingStepper";
import { PreviousResponseJsonTree } from "./PreviousResponseJsonTree";
import { TransformMenu } from "./TransformMenu";
import {
  buildAutoMapSuggestions,
  buildSourceCatalog,
  buildTargetCatalog,
  createMapping,
  defaultTransformTemplate,
  filterFields,
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

type DragHandle = "left" | "right" | null;

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
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [hoveredMappingIndex, setHoveredMappingIndex] = useState<number | null>(null);
  const [transformAnchor, setTransformAnchor] = useState<{ mappingIndex: number; left: number; top: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState("Click any value in the previous response.");
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [leftRatio, setLeftRatio] = useState(0.26);
  const [rightRatio, setRightRatio] = useState(0.3);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
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
    setHoveredTargetId(null);
    setHoveredMappingIndex(null);
    setTransformAnchor(null);
    setSourceSearch("");
    setTargetSearch("");
    setStatusMessage("Click any value in the previous response.");
    setPointerPosition(null);
    setLeftCollapsed(false);
    setLeftRatio(0.26);
    setRightRatio(0.3);
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

  useEffect(() => {
    if (!open || !workspaceRef.current) {
      return;
    }
    const bumpLayout = () => setLayoutTick((current) => current + 1);
    const observer = new ResizeObserver(([entry]) => {
      setWorkspaceWidth(entry.contentRect.width);
      bumpLayout();
    });
    observer.observe(workspaceRef.current);
    workspaceRef.current.addEventListener("scroll", bumpLayout, true);
    window.addEventListener("resize", bumpLayout);
    return () => {
      observer.disconnect();
      workspaceRef.current?.removeEventListener("scroll", bumpLayout, true);
      window.removeEventListener("resize", bumpLayout);
    };
  }, [open]);

  useEffect(() => {
    if (!dragHandle || !workspaceRef.current) {
      return;
    }
    function handlePointerMove(event: PointerEvent) {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const x = event.clientX - rect.left;
      const minimumLeft = 240;
      const minimumRight = 280;
      const handleWidth = 10;
      if (dragHandle === "left") {
        const nextLeft = Math.max(minimumLeft, Math.min(rect.width - minimumRight - handleWidth * 2 - 320, x));
        setLeftCollapsed(false);
        setLeftRatio(nextLeft / rect.width);
      } else {
        const rightStart = rect.width - x;
        const nextRight = Math.max(minimumRight, Math.min(rect.width - minimumLeft - handleWidth * 2 - 320, rightStart));
        setRightRatio(nextRight / rect.width);
      }
    }
    function handlePointerUp() {
      setDragHandle(null);
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragHandle]);

  const sourceCatalog = useMemo(() => buildSourceCatalog(response), [response]);
  const targetCatalog = useMemo(
    () => (targetEndpoint ? buildTargetCatalog(targetEndpoint.request) : buildTargetCatalog(emptyRequest())),
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

  const selectedSource = sourceCatalog.allFields.find((field) => field.id === selectedSourceId) ?? null;
  const placeholderTargetFields = targetCatalog.allFields.filter((field) => field.expectsMapping);
  const filteredSourceTree = useMemo(
    () => filterTreeNodes(sourceCatalog.bodyTree, sourceSearch),
    [sourceCatalog.bodyTree, sourceSearch],
  );
  const sourceExtraFields = useMemo(
    () => filterFields([...sourceCatalog.headerFields, ...sourceCatalog.metaFields], sourceSearch),
    [sourceCatalog.headerFields, sourceCatalog.metaFields, sourceSearch],
  );
  const otherTargetFields = useMemo(
    () => filterFields(targetCatalog.allFields.filter((field) => field.section !== "body"), targetSearch),
    [targetCatalog.allFields, targetSearch],
  );

  const autoMapSuggestions = useMemo(
    () => buildAutoMapSuggestions(sourceCatalog.allFields, placeholderTargetFields, draftMappings),
    [draftMappings, placeholderTargetFields, sourceCatalog.allFields],
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
    if (hoveredTargetId) {
      ids.add(hoveredTargetId);
    }
    if (hoveredMappingIndex !== null) {
      const mapping = draftMappings[hoveredMappingIndex];
      const field = mapping ? targetCatalog.allFields.find((item) => item.targetType === mapping.targetType && item.key === mapping.targetKey) : null;
      if (field) {
        ids.add(field.id);
      }
    }
    return ids;
  }, [draftMappings, hoveredMappingIndex, hoveredTargetId, selectedTargetId, targetCatalog.allFields]);

  const glowTargetFieldIds = useMemo(
    () => (selectedSource ? new Set(placeholderTargetFields.map((field) => field.id)) : undefined),
    [placeholderTargetFields, selectedSource],
  );

  const hoveredTargetField = hoveredTargetId
    ? targetCatalog.allFields.find((field) => field.id === hoveredTargetId) ?? null
    : null;

  const overlayPaths = useMemo(() => {
    const container = workspaceRef.current;
    if (!container) {
      return [];
    }
    const containerRect = container.getBoundingClientRect();
    const paths: MappingOverlayPath[] = [];

    draftMappings.forEach((mapping, index) => {
      const sourceField = sourceCatalog.allFields.find((item) => item.path === mapping.sourcePath);
      const targetField = targetCatalog.allFields.find((item) => item.targetType === mapping.targetType && item.key === mapping.targetKey);
      if (!sourceField || !targetField) {
        return;
      }
      const sourceElement = sourceRefs.current.get(sourceField.id);
      const targetElement = targetRefs.current.get(targetField.id);
      if (!sourceElement || !targetElement) {
        return;
      }
      paths.push({
        id: `${sourceField.id}:${targetField.id}:${index}`,
        path: connectorPath(sourceElement, targetElement, containerRect),
        tone: hoveredMappingIndex === index ? "active" : "saved",
      });
    });

    if (selectedSource) {
      const sourceElement = sourceRefs.current.get(selectedSource.id);
      if (sourceElement) {
        const start = sourceElement.getBoundingClientRect();
        const startX = start.right - containerRect.left;
        const startY = start.top - containerRect.top + start.height / 2;
        if (hoveredTargetField) {
          const targetElement = targetRefs.current.get(hoveredTargetField.id);
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const endX = targetRect.left - containerRect.left;
            const endY = targetRect.top - containerRect.top + targetRect.height / 2;
            const dx = Math.max((endX - startX) / 2, 90);
            paths.push({
              id: "temporary-snap",
              path: `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`,
              tone: "active",
            });
          }
        } else if (pointerPosition) {
          const dx = Math.max((pointerPosition.x - startX) / 2, 90);
          paths.push({
            id: "temporary-selection",
            path: `M ${startX} ${startY} C ${startX + dx} ${startY}, ${pointerPosition.x - dx} ${pointerPosition.y}, ${pointerPosition.x} ${pointerPosition.y}`,
            tone: "temporary",
          });
        }
      }
    }

    return paths;
  }, [draftMappings, hoveredMappingIndex, hoveredTargetField, layoutTick, pointerPosition, selectedSource, sourceCatalog.allFields, targetCatalog.allFields]);

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
        setHoveredTargetId(null);
        setPointerPosition(null);
        setStatusMessage("Click any value in the previous response.");
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
      const next = await api.sendRequest(workspacePath, collection.id, sourceEndpoint.id, environmentId, sourceEndpoint.request);
      setResponse(next);
      setStatusMessage("Click any value in the previous response.");
      onDiscoveredResponse(fromNode.id, next);
    } finally {
      setLoadingResponse(false);
    }
  }

  function handleSelectSource(field: MappingSourceField) {
    const nextSelectedId = selectedSourceId === field.id ? null : field.id;
    setSelectedSourceId(nextSelectedId);
    setSelectedTargetId(null);
    setHoveredTargetId(null);
    setPointerPosition(null);
    setStatusMessage(
      nextSelectedId
        ? `Selected ${formatSourcePath(field.path)} = ${field.value}. Now click a request placeholder.`
        : "Click any value in the previous response.",
    );
  }

  function handleHoverSource(field: MappingSourceField | null) {
    if (!field) {
      if (hoveredMappingIndex === null) {
        setHoveredTargetId(null);
      }
      return;
    }
    const mappingIndex = draftMappings.findIndex((mapping) => mapping.sourcePath === field.path);
    setHoveredMappingIndex(mappingIndex >= 0 ? mappingIndex : null);
  }

  function handleHoverTarget(field: MappingTargetField | null) {
    if (!field) {
      setHoveredTargetId(null);
      if (hoveredMappingIndex === null) {
        setHoveredMappingIndex(null);
      }
      return;
    }
    setHoveredTargetId(field.id);
    const mappingIndex = draftMappings.findIndex(
      (mapping) => mapping.targetType === field.targetType && mapping.targetKey === field.key,
    );
    setHoveredMappingIndex(mappingIndex >= 0 ? mappingIndex : null);
  }

  function addMapping(targetField: MappingTargetField) {
    setSelectedTargetId(targetField.id);
    if (!selectedSource) {
      setStatusMessage("Click a response value first.");
      return;
    }
    if (!targetField.expectsMapping) {
      setStatusMessage("Only `->map` placeholders can accept a mapping.");
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
      setHoveredTargetId(null);
      setPointerPosition(null);
      return;
    }
    setDraftMappings((current) => [...current, createMapping(selectedSource, targetField)]);
    setStatusMessage(`Mapped ${formatSourcePath(selectedSource.path)} → ${formatTargetPath(targetField.targetPath)}.`);
    setSelectedSourceId(null);
    setSelectedTargetId(null);
    setHoveredTargetId(null);
    setPointerPosition(null);
  }

  function applyAutoMap() {
    if (autoMapSuggestions.length === 0) {
      return;
    }
    setDraftMappings((current) => [
      ...current,
      ...autoMapSuggestions.map((suggestion) => createMapping(suggestion.sourceField, suggestion.targetField)),
    ]);
    setStatusMessage(`Created ${autoMapSuggestions.length} automatic mapping${autoMapSuggestions.length === 1 ? "" : "s"}.`);
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

  const activeStep: 1 | 2 | 3 = selectedSource ? 2 : draftMappings.length > 0 ? 3 : 1;
  const leftWidth = leftCollapsed ? 72 : Math.max(260, Math.round(workspaceWidth * leftRatio));
  const rightWidth = Math.max(300, Math.round(workspaceWidth * rightRatio));
  const workspaceColumns = `${leftWidth}px 10px minmax(360px, 1fr) 10px ${rightWidth}px`;

  return createPortal(
    <div className={styles.backdrop}>
      <div className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div>
            <strong>Mapping Builder</strong>
            <span>{fromNode.name} &rarr; {toNode.name}</span>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close mapping builder">
            <X size={16} />
          </button>
        </header>

        <div className={styles.modalBody}>
          <MappingStepper activeStep={activeStep} message={statusMessage} />

          <div
            ref={workspaceRef}
            className={styles.mappingWorkspace}
            style={{ gridTemplateColumns: workspaceColumns }}
            onMouseMove={(event) => {
              if (!selectedSource || !workspaceRef.current || hoveredTargetField) {
                return;
              }
              const rect = workspaceRef.current.getBoundingClientRect();
              setPointerPosition({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
            onMouseLeave={() => setPointerPosition(null)}
          >
            <LiveMappingArrowLayer paths={overlayPaths} />

            <PreviousResponseJsonTree
              response={response}
              responseAvailable={Boolean(response)}
              loading={loadingResponse}
              bodyTree={filteredSourceTree}
              extraFields={sourceExtraFields}
              search={sourceSearch}
              mappedFieldIds={sourceMappedFieldIds}
              activeFieldIds={activeSourceFieldIds}
              selectedFieldId={selectedSourceId}
              collapsed={leftCollapsed}
              selectedSource={selectedSource}
              getFieldRef={(field) => (node) => {
                if (node) {
                  sourceRefs.current.set(field.id, node);
                } else {
                  sourceRefs.current.delete(field.id);
                }
              }}
              onToggleCollapse={() => setLeftCollapsed((current) => !current)}
              onSearchChange={setSourceSearch}
              onRunSourceNode={() => void runSourceNode()}
              onSelectField={handleSelectSource}
              onHoverField={handleHoverSource}
            />

            <div className={styles.resizeHandle} onPointerDown={() => setDragHandle("left")} />

            <LiveMappingColumn
              mappings={draftMappings}
              autoMapCount={autoMapSuggestions.length}
              instruction={selectedSource ? "Click a response value, then click a request placeholder." : "Click a response value, then click a request placeholder."}
              hoveredMappingIndex={hoveredMappingIndex}
              selectedSourcePath={selectedSource ? formatSourcePath(selectedSource.path) : null}
              getSourceValue={(mapping) => sourceCatalog.allFields.find((field) => field.path === mapping.sourcePath)?.value ?? ""}
              formatSourceLabel={(mapping) => formatSourcePath(mapping.sourcePath)}
              formatTargetLabel={(mapping) => formatTargetPath(mapping.targetPath)}
              onAutoMap={applyAutoMap}
              onHoverMapping={(mappingIndex) => {
                setHoveredMappingIndex(mappingIndex);
                if (mappingIndex === null) {
                  return;
                }
                const mapping = draftMappings[mappingIndex];
                const targetField = targetCatalog.allFields.find((field) => field.targetType === mapping.targetType && field.key === mapping.targetKey);
                setHoveredTargetId(targetField?.id ?? null);
              }}
              onOpenTransform={(mappingIndex, target) => {
                const rect = target.getBoundingClientRect();
                setTransformAnchor({ mappingIndex, left: rect.left - 120, top: rect.bottom + 8 });
              }}
              onDeleteMapping={(mappingIndex) => {
                setDraftMappings((current) => current.filter((_, index) => index !== mappingIndex));
                setTransformAnchor((current) => (current?.mappingIndex === mappingIndex ? null : current));
                setStatusMessage("Mapping removed.");
              }}
            />

            <div className={styles.resizeHandle} onPointerDown={() => setDragHandle("right")} />

            <CurrentRequestJsonView
              bodyTree={targetCatalog.bodyTree}
              hasPlaceholders={placeholderTargetFields.length > 0}
              otherFields={otherTargetFields}
              search={targetSearch}
              mappedFieldIds={targetMappedFieldIds}
              activeFieldIds={activeTargetFieldIds}
              glowFieldIds={glowTargetFieldIds}
              selectedFieldId={selectedTargetId}
              getFieldRef={(field) => (node) => {
                if (node) {
                  targetRefs.current.set(field.id, node);
                } else {
                  targetRefs.current.delete(field.id);
                }
              }}
              onSearchChange={setTargetSearch}
              onSelectField={addMapping}
              onHoverField={handleHoverTarget}
            />
          </div>
        </div>

        <MappingFooter count={draftMappings.length} onCancel={onClose} onSave={saveAndClose} />

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

function connectorPath(sourceElement: HTMLButtonElement, targetElement: HTMLButtonElement, containerRect: DOMRect) {
  const sourceRect = sourceElement.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const startX = sourceRect.right - containerRect.left;
  const startY = sourceRect.top - containerRect.top + sourceRect.height / 2;
  const endX = targetRect.left - containerRect.left;
  const endY = targetRect.top - containerRect.top + targetRect.height / 2;
  const dx = Math.max((endX - startX) / 2, 90);
  return `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
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
