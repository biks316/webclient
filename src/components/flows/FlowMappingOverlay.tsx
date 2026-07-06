import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Search,
  Sparkles,
  Trash2,
  X,
  EyeOff,
  FunctionSquare,
} from "lucide-react";
import { CollectionIndex, FlowEdge, FlowMapping, FlowNode, RunResponse } from "../../types/bik";
import { readLatestSuccessfulResponseExample } from "../../services/responseExampleService";
import { targetPathFor } from "../../services/mappingSuggestionService";
import { extractVariableNames } from "../../services/variableResolver";
import * as api from "../../services/tauriApi";
import { forwardRuleSummary, formatTargetLabel } from "./forwarding";
import styles from "./FlowBuilder.module.css";

type SourceSection = "body" | "header" | "status";
type DestinationSection = "body" | "header" | "query" | "path" | "cookie" | "request-variable" | "flow-variable" | "auth";
type EnabledTransformType = "raw" | "bearer" | "template" | "uppercase" | "lowercase" | "trim" | "substring" | "jsonpath" | "javascript";

interface SourceField {
  id: string;
  label: string;
  path: string;
  value: string;
  section: SourceSection;
  groupLabel: string;
}

interface DestinationField {
  id: string;
  label: string;
  key: string;
  targetType: FlowMapping["targetType"];
  targetPath: string;
  section: DestinationSection;
  groupLabel: string;
}

interface OverlayMappingPath {
  id: string;
  mappingIndex: number;
  sourceId: string;
  destinationId: string;
  label: string;
  path: string;
  active: boolean;
  muted: boolean;
  sourcePoint: { x: number; y: number };
  destinationPoint: { x: number; y: number };
  midpoint: { x: number; y: number };
}

interface FlowMappingOverlayProps {
  workspacePath: string;
  collection: CollectionIndex;
  edge: FlowEdge;
  fromNode: FlowNode;
  toNode: FlowNode;
  environmentId: string | null;
  anchor: { left: number; top: number };
  lastResponse: RunResponse | null;
  warning?: string | null;
  onClose: () => void;
  onChange: (edge: FlowEdge) => void;
  onDeleteEdge: () => void;
  onDiscoveredResponse: (nodeId: string, response: RunResponse) => void;
}

const TRANSFORM_OPTIONS: Array<{ id: EnabledTransformType; label: string; placeholder?: string }> = [
  { id: "raw", label: "Raw" },
  { id: "uppercase", label: "Uppercase" },
  { id: "lowercase", label: "Lowercase" },
  { id: "trim", label: "Trim" },
  { id: "substring", label: "Substring", placeholder: "0:8" },
  { id: "jsonpath", label: "JSONPath", placeholder: "$.id" },
  { id: "javascript", label: "Custom JavaScript", placeholder: "return String(value);" },
  { id: "template", label: "Template", placeholder: "{{value}}" },
  { id: "bearer", label: "Bearer" },
];

function edgeWithLabel(edge: FlowEdge, mappings: FlowMapping[]): FlowEdge {
  const next = { ...edge, mappings };
  return { ...next, label: forwardRuleSummary(next) };
}

export function FlowMappingOverlay({
  workspacePath,
  collection,
  edge,
  fromNode,
  toNode,
  environmentId,
  anchor,
  lastResponse,
  warning,
  onClose,
  onChange,
  onDeleteEdge,
  onDiscoveredResponse,
}: FlowMappingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sourceRefs = useRef(new Map<string, HTMLButtonElement>());
  const destinationRefs = useRef(new Map<string, HTMLButtonElement>());
  const [exampleResponse, setExampleResponse] = useState<RunResponse | null>(lastResponse);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [hoveredMappingIds, setHoveredMappingIds] = useState<string[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [geometryVersion, setGeometryVersion] = useState(0);
  const [mappingMenu, setMappingMenu] = useState<{ mappingIndex: number; left: number; top: number } | null>(null);
  const [transformEditor, setTransformEditor] = useState<{
    mappingIndex: number;
    left: number;
    top: number;
    transformType: EnabledTransformType;
    template: string;
  } | null>(null);
  const [autoMapOpen, setAutoMapOpen] = useState(false);
  const [autoMapSelection, setAutoMapSelection] = useState<Record<string, boolean>>({});

  const sourceEndpoint = collection.endpoints.find((endpoint) => endpoint.id === fromNode.requestId) ?? null;
  const targetEndpoint = collection.endpoints.find((endpoint) => endpoint.id === toNode.requestId) ?? null;

  useEffect(() => {
    setExampleResponse(lastResponse);
  }, [lastResponse]);

  useEffect(() => {
    let cancelled = false;
    async function loadExample() {
      if (lastResponse || !sourceEndpoint) {
        return;
      }
      setLoadingResponse(true);
      const next = await readLatestSuccessfulResponseExample(sourceEndpoint);
      if (!cancelled) {
        setExampleResponse(next);
        setLoadingResponse(false);
      }
    }
    void loadExample();
    return () => {
      cancelled = true;
    };
  }, [lastResponse, sourceEndpoint]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (mappingMenu) {
          setMappingMenu(null);
          return;
        }
        if (transformEditor) {
          setTransformEditor(null);
          return;
        }
        if (autoMapOpen) {
          setAutoMapOpen(false);
          return;
        }
        onClose();
      }
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-flow-mapping-overlay]")) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [autoMapOpen, mappingMenu, onClose, transformEditor]);

  useLayoutEffect(() => {
    const rerenderGeometry = () => setGeometryVersion((current) => current + 1);
    window.addEventListener("resize", rerenderGeometry);
    return () => {
      window.removeEventListener("resize", rerenderGeometry);
    };
  }, []);

  const sourceFields = useMemo(() => buildSourceFields(exampleResponse), [exampleResponse]);
  const destinationFields = useMemo(
    () => buildDestinationFields(targetEndpoint?.request.headers ?? {}, targetEndpoint?.request.queryParams ?? {}, targetEndpoint?.request.body, targetEndpoint?.request.url ?? "", targetEndpoint?.request.variables ?? {}),
    [targetEndpoint?.request.body, targetEndpoint?.request.headers, targetEndpoint?.request.queryParams, targetEndpoint?.request.url, targetEndpoint?.request.variables],
  );

  const filteredSourceFields = useMemo(
    () => filterFields(sourceFields, sourceSearch),
    [sourceFields, sourceSearch],
  );
  const filteredDestinationFields = useMemo(
    () => filterFields(destinationFields, destinationSearch),
    [destinationFields, destinationSearch],
  );

  const filteredSourceIds = useMemo(() => new Set(filteredSourceFields.map((field) => field.id)), [filteredSourceFields]);
  const filteredDestinationIds = useMemo(() => new Set(filteredDestinationFields.map((field) => field.id)), [filteredDestinationFields]);

  const selectedSource = selectedSourceId
    ? sourceFields.find((field) => field.id === selectedSourceId) ?? null
    : null;

  const sourceIdsByPath = useMemo(() => new Map(sourceFields.map((field) => [field.path, field.id])), [sourceFields]);
  const destinationIdsByTarget = useMemo(
    () => new Map(destinationFields.map((field) => [`${field.targetType}:${field.key}`, field.id])),
    [destinationFields],
  );

  const mappingPaths = useMemo(() => {
    const containerRect = overlayRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return [] as OverlayMappingPath[];
    }

    return edge.mappings.flatMap((mapping, mappingIndex) => {
      const sourceId = sourceIdsByPath.get(mapping.sourcePath);
      const destinationId = destinationIdsByTarget.get(`${mapping.targetType}:${mapping.targetKey}`);
      if (!sourceId || !destinationId || !filteredSourceIds.has(sourceId) || !filteredDestinationIds.has(destinationId)) {
        return [];
      }
      const sourceElement = sourceRefs.current.get(sourceId);
      const destinationElement = destinationRefs.current.get(destinationId);
      if (!sourceElement || !destinationElement) {
        return [];
      }
      const sourceRect = sourceElement.getBoundingClientRect();
      const destinationRect = destinationElement.getBoundingClientRect();
      const sourcePoint = {
        x: sourceRect.right - containerRect.left,
        y: sourceRect.top - containerRect.top + sourceRect.height / 2,
      };
      const destinationPoint = {
        x: destinationRect.left - containerRect.left,
        y: destinationRect.top - containerRect.top + destinationRect.height / 2,
      };
      const curve = buildConnectorPath(sourcePoint, destinationPoint);
      const mappingId = mappingKey(mapping, mappingIndex);
      return [{
        id: mappingId,
        mappingIndex,
        sourceId,
        destinationId,
        label: `${mapping.sourceLabel} -> ${formatTargetLabel(mapping.targetType, mapping.targetKey, mapping.targetPath)}`,
        path: curve,
        active: hoveredMappingIds.length === 0 || hoveredMappingIds.includes(mappingId),
        muted: Boolean(mapping.disabled),
        sourcePoint,
        destinationPoint,
        midpoint: {
          x: (sourcePoint.x + destinationPoint.x) / 2,
          y: (sourcePoint.y + destinationPoint.y) / 2,
        },
      }];
    });
  }, [destinationIdsByTarget, edge.mappings, filteredDestinationIds, filteredSourceIds, geometryVersion, hoveredMappingIds, sourceIdsByPath]);

  useLayoutEffect(() => {
    setGeometryVersion((current) => current + 1);
  }, [filteredDestinationFields, filteredSourceFields, edge.mappings, exampleResponse, sourceSearch, destinationSearch]);

  const autoMapSuggestions = useMemo(() => buildAutoMapSuggestions(sourceFields, destinationFields, edge.mappings), [destinationFields, edge.mappings, sourceFields]);

  useEffect(() => {
    if (!autoMapOpen) {
      return;
    }
    setAutoMapSelection(
      Object.fromEntries(autoMapSuggestions.map((suggestion) => [suggestion.id, true])),
    );
  }, [autoMapOpen, autoMapSuggestions]);

  async function runSourceRequest() {
    if (!sourceEndpoint) {
      return;
    }
    setLoadingResponse(true);
    const response = await api.sendRequest(
      workspacePath,
      collection.id,
      sourceEndpoint.id,
      environmentId,
      sourceEndpoint.request,
    );
    setExampleResponse(response);
    setLoadingResponse(false);
    onDiscoveredResponse(fromNode.id, response);
  }

  function commitMapping(sourceField: SourceField, destinationField: DestinationField) {
    const exists = edge.mappings.some((mapping) =>
      mapping.sourcePath === sourceField.path &&
      mapping.targetType === destinationField.targetType &&
      mapping.targetKey === destinationField.key,
    );
    if (exists) {
      setSelectedSourceId(null);
      return;
    }
    const next: FlowMapping = {
      sourcePath: sourceField.path,
      sourceLabel: sourceField.label,
      targetType: destinationField.targetType,
      targetKey: destinationField.key,
      targetPath: destinationField.targetPath,
      targetVariable:
        destinationField.targetType === "variable" || destinationField.targetType === "flowVariable"
          ? destinationField.key
          : undefined,
      transformType: "raw",
      template: "{{value}}",
      disabled: false,
    };
    onChange(edgeWithLabel(edge, [...edge.mappings, next]));
    setSelectedSourceId(null);
  }

  function updateMapping(mappingIndex: number, patch: Partial<FlowMapping>) {
    onChange(edgeWithLabel(
      edge,
      edge.mappings.map((mapping, index) => (index === mappingIndex ? { ...mapping, ...patch } : mapping)),
    ));
  }

  function deleteMapping(mappingIndex: number) {
    onChange(edgeWithLabel(edge, edge.mappings.filter((_, index) => index !== mappingIndex)));
    setMappingMenu(null);
    setTransformEditor(null);
  }

  function duplicateMapping(mappingIndex: number) {
    const mapping = edge.mappings[mappingIndex];
    if (!mapping) {
      return;
    }
    onChange(edgeWithLabel(edge, [...edge.mappings, { ...mapping }]));
    setMappingMenu(null);
  }

  function applyAutoMap() {
    const additions = autoMapSuggestions
      .filter((suggestion) => autoMapSelection[suggestion.id])
      .map(({ sourceField, destinationField }) => ({
        sourcePath: sourceField.path,
        sourceLabel: sourceField.label,
        targetType: destinationField.targetType,
        targetKey: destinationField.key,
        targetPath: destinationField.targetPath,
        targetVariable:
          destinationField.targetType === "variable" || destinationField.targetType === "flowVariable"
            ? destinationField.key
            : undefined,
        transformType: "raw" as const,
        template: "{{value}}",
        disabled: false,
      }));
    if (additions.length === 0) {
      setAutoMapOpen(false);
      return;
    }
    onChange(edgeWithLabel(edge, [...edge.mappings, ...additions]));
    setAutoMapOpen(false);
  }

  const left = anchor.left;
  const top = anchor.top;

  return (
    <div
      ref={overlayRef}
      data-flow-mapping-overlay
      className={styles.mappingOverlay}
      style={{ left, top }}
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className={styles.mappingOverlayHeader}>
        <div>
          <strong>{`${fromNode.name} -> ${toNode.name}`}</strong>
          <span>{forwardRuleSummary(edge)}</span>
        </div>
        <div className={styles.mappingOverlayActions}>
          <button type="button" onClick={() => setAutoMapOpen((value) => !value)}>
            <Sparkles size={14} />
            Auto Map
          </button>
          <button type="button" onClick={onDeleteEdge}>
            <Trash2 size={14} />
            Delete
          </button>
          <button type="button" onClick={onClose} aria-label="Close mapping overlay">
            <X size={14} />
          </button>
        </div>
      </div>

      {warning && <p className={styles.flowWarning}>{warning}</p>}

      {autoMapOpen && (
        <section className={styles.autoMapPanel}>
          <header>
            <strong>Auto Map Preview</strong>
            <span>Review direct name matches before adding them.</span>
          </header>
          {autoMapSuggestions.length === 0 ? (
            <p className={styles.autoMapEmpty}>No direct matches found between source and destination fields.</p>
          ) : (
            <div className={styles.autoMapList}>
              {autoMapSuggestions.map((suggestion) => (
                <label key={suggestion.id} className={styles.autoMapRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(autoMapSelection[suggestion.id])}
                    onChange={(event) =>
                      setAutoMapSelection((current) => ({ ...current, [suggestion.id]: event.currentTarget.checked }))
                    }
                  />
                  <span>{suggestion.sourceField.label}</span>
                  <strong>{formatTargetLabel(suggestion.destinationField.targetType, suggestion.destinationField.key, suggestion.destinationField.targetPath)}</strong>
                </label>
              ))}
            </div>
          )}
          <div className={styles.autoMapFooter}>
            <button type="button" onClick={() => setAutoMapOpen(false)}>Cancel</button>
            <button type="button" className={styles.primaryButton} onClick={applyAutoMap}>Apply Mappings</button>
          </div>
        </section>
      )}

      <div className={styles.mappingOverlayCanvas}>
        <Pane
          title="Source Response"
          sections={groupFields(filteredSourceFields)}
          searchValue={sourceSearch}
          onSearchChange={setSourceSearch}
          emptyState={!exampleResponse ? (
            <div className={styles.mappingPaneEmpty}>
              <strong>No response captured yet.</strong>
              <span>Run Request to populate source fields.</span>
              <button type="button" className={styles.primaryButton} disabled={loadingResponse} onClick={() => void runSourceRequest()}>
                {loadingResponse ? "Running..." : "Run Request"}
              </button>
            </div>
          ) : null}
          renderField={(field) => {
            const mappedIds = edge.mappings
              .map((mapping, index) => ({ mapping, id: mappingKey(mapping, index) }))
              .filter(({ mapping }) => mapping.sourcePath === (field as SourceField).path)
              .map(({ id }) => id);
            const isMapped = mappedIds.length > 0;
            const isActive = selectedSourceId === field.id || intersects(mappedIds, hoveredMappingIds);
            return (
              <button
                key={field.id}
                ref={(node) => {
                  if (node) {
                    sourceRefs.current.set(field.id, node);
                  } else {
                    sourceRefs.current.delete(field.id);
                  }
                }}
                type="button"
                className={`${styles.mappingField} ${isMapped ? styles.mappingFieldMapped : ""} ${isActive ? styles.mappingFieldActive : ""}`}
                onClick={() => setSelectedSourceId((current) => current === field.id ? null : field.id)}
                onMouseEnter={() => setHoveredMappingIds(mappedIds)}
                onMouseLeave={() => setHoveredMappingIds([])}
              >
                <span>{field.label}</span>
                <em>{field.value}</em>
                {isMapped && <Check size={14} />}
              </button>
            );
          }}
        />

        <div className={styles.mappingOverlaySvgLayer}>
          <svg className={styles.mappingOverlaySvg}>
            {mappingPaths.map((mapping) => (
              <g key={mapping.id}>
                <path
                  d={mapping.path}
                  className={`${styles.mappingConnectorHit} ${mapping.active ? styles.mappingConnectorHitActive : ""}`}
                  onMouseEnter={() => setHoveredMappingIds([mapping.id])}
                  onMouseLeave={() => setHoveredMappingIds([])}
                  onClick={() => {
                    setMappingMenu({
                      mappingIndex: mapping.mappingIndex,
                      left: mapping.midpoint.x,
                      top: mapping.midpoint.y + 18,
                    });
                    setTransformEditor(null);
                  }}
                />
                <path
                  d={mapping.path}
                  className={`${styles.mappingConnector} ${mapping.active ? styles.mappingConnectorActive : ""} ${mapping.muted ? styles.mappingConnectorMuted : ""}`}
                />
              </g>
            ))}
          </svg>
          {mappingPaths.map((mapping) => (
            <button
              key={`${mapping.id}-label`}
              type="button"
              className={`${styles.mappingConnectorLabel} ${mapping.active ? styles.mappingConnectorLabelActive : ""}`}
              style={{ left: mapping.midpoint.x, top: mapping.midpoint.y }}
              onMouseEnter={() => setHoveredMappingIds([mapping.id])}
              onMouseLeave={() => setHoveredMappingIds([])}
              onClick={() => {
                setMappingMenu({
                  mappingIndex: mapping.mappingIndex,
                  left: mapping.midpoint.x,
                  top: mapping.midpoint.y + 18,
                });
                setTransformEditor(null);
              }}
            >
              {mapping.label}
            </button>
          ))}
        </div>

        <Pane
          title="Destination Request"
          sections={groupFields(filteredDestinationFields)}
          searchValue={destinationSearch}
          onSearchChange={setDestinationSearch}
          renderField={(field) => {
            const destinationField = field as DestinationField;
            const mappedIds = edge.mappings
              .map((mapping, index) => ({ mapping, id: mappingKey(mapping, index) }))
              .filter(({ mapping }) => mapping.targetType === destinationField.targetType && mapping.targetKey === destinationField.key)
              .map(({ id }) => id);
            const isMapped = mappedIds.length > 0;
            const isActive = intersects(mappedIds, hoveredMappingIds);
            const canCreate = Boolean(selectedSource);
            return (
              <button
                key={field.id}
                ref={(node) => {
                  if (node) {
                    destinationRefs.current.set(field.id, node);
                  } else {
                    destinationRefs.current.delete(field.id);
                  }
                }}
                type="button"
                className={`${styles.mappingField} ${styles.mappingDestinationField} ${isMapped ? styles.mappingFieldMapped : ""} ${isActive ? styles.mappingFieldActive : ""} ${canCreate ? styles.mappingFieldTargetable : ""}`}
                onClick={() => {
                  if (!selectedSource) {
                    return;
                  }
                  commitMapping(selectedSource, destinationField);
                }}
                onMouseEnter={() => setHoveredMappingIds(mappedIds)}
                onMouseLeave={() => setHoveredMappingIds([])}
              >
                <span>{field.label}</span>
                <em>{destinationField.groupLabel}</em>
                {isMapped && <Check size={14} />}
              </button>
            );
          }}
        />
      </div>

      <div className={styles.mappingOverlayFooter}>
        <span>
          {selectedSource ? `Selected source: ${selectedSource.label}. Click a destination field to map it.` : "Click a source field, then click a destination field."}
        </span>
        {selectedSource && (
          <button type="button" onClick={() => setSelectedSourceId(null)}>
            Clear Selection
          </button>
        )}
      </div>

      {mappingMenu && (
        <div
          className={styles.mappingPopover}
          style={{ left: mappingMenu.left, top: mappingMenu.top }}
        >
          <button
            type="button"
            onClick={() => {
              const mapping = edge.mappings[mappingMenu.mappingIndex];
              if (!mapping) {
                return;
              }
              setTransformEditor({
                mappingIndex: mappingMenu.mappingIndex,
                left: mappingMenu.left,
                top: mappingMenu.top + 12,
                transformType: mapping.transformType as EnabledTransformType,
                template: mapping.template,
              });
              setMappingMenu(null);
            }}
          >
            <FunctionSquare size={13} />
            Edit Transform
          </button>
          <button type="button" onClick={() => duplicateMapping(mappingMenu.mappingIndex)}>
            <Copy size={13} />
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              const mapping = edge.mappings[mappingMenu.mappingIndex];
              if (!mapping) {
                return;
              }
              updateMapping(mappingMenu.mappingIndex, { disabled: !mapping.disabled });
              setMappingMenu(null);
            }}
          >
            <EyeOff size={13} />
            {edge.mappings[mappingMenu.mappingIndex]?.disabled ? "Enable" : "Disable"}
          </button>
          <button type="button" onClick={() => deleteMapping(mappingMenu.mappingIndex)}>
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}

      {transformEditor && (
        <div
          className={styles.mappingPopover}
          style={{ left: transformEditor.left, top: transformEditor.top }}
        >
          <label className={styles.mappingTransformLabel}>
            <span>Transform</span>
            <select
              value={transformEditor.transformType}
              onChange={(event) => {
                const nextType = event.currentTarget.value as EnabledTransformType;
                setTransformEditor((current) => current ? {
                  ...current,
                  transformType: nextType,
                  template: defaultTransformTemplate(nextType),
                } : current);
              }}
            >
              {TRANSFORM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          {needsTransformInput(transformEditor.transformType) && (
            <label className={styles.mappingTransformLabel}>
              <span>Config</span>
              <input
                value={transformEditor.template}
                placeholder={TRANSFORM_OPTIONS.find((option) => option.id === transformEditor.transformType)?.placeholder}
                onChange={(event) => setTransformEditor((current) => current ? { ...current, template: event.currentTarget.value } : current)}
              />
            </label>
          )}
          <div className={styles.mappingPopoverFooter}>
            <button type="button" onClick={() => setTransformEditor(null)}>Cancel</button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                updateMapping(transformEditor.mappingIndex, {
                  transformType: transformEditor.transformType,
                  template: transformEditor.template || defaultTransformTemplate(transformEditor.transformType),
                });
                setTransformEditor(null);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pane<T extends SourceField | DestinationField>({
  title,
  sections,
  searchValue,
  onSearchChange,
  emptyState,
  renderField,
}: {
  title: string;
  sections: Array<{ id: string; label: string; fields: T[] }>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyState?: JSX.Element | null;
  renderField: (field: T) => JSX.Element;
}) {
  return (
    <section className={styles.mappingPane}>
      <header className={styles.mappingPaneHeader}>
        <div>
          <strong>{title}</strong>
        </div>
        <label className={styles.mappingSearch}>
          <Search size={13} />
          <input value={searchValue} placeholder="Search fields" onChange={(event) => onSearchChange(event.currentTarget.value)} />
        </label>
      </header>
      <div className={styles.mappingPaneBody}>
        {emptyState ?? sections.map((section) => (
          <div key={section.id} className={styles.mappingSection}>
            <div className={styles.mappingSectionLabel}>{section.label}</div>
            <div className={styles.mappingFieldList}>
              {section.fields.map((field) => renderField(field))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildSourceFields(response: RunResponse | null): SourceField[] {
  if (!response) {
    return [];
  }
  const body = parseResponseBody(response.body);
  const bodyFields = flattenSourceValue(body, "$.response.body", "Response Body");
  const headerFields = Object.entries(response.headers ?? {}).map(([key, value]) => ({
    id: `header:${key}`,
    label: key,
    path: `$.response.headers.${key}`,
    value: String(value),
    section: "header" as const,
    groupLabel: "Response Headers",
  }));
  const statusFields = [{
    id: "status:status",
    label: "status",
    path: "$.response.status",
    value: String(response.status),
    section: "status" as const,
    groupLabel: "Response Status",
  }];
  return [...bodyFields, ...headerFields, ...statusFields];
}

function buildDestinationFields(
  headers: Record<string, string>,
  queryParams: Record<string, string>,
  body: unknown,
  url: string,
  variables: Record<string, string>,
): DestinationField[] {
  const bodyFields = flattenDestinationBody(body);
  const headerFields = Object.keys(headers).map((key) => destinationField("header", "Headers", key));
  const queryFields = Object.keys(queryParams).map((key) => destinationField("query", "Query", key));
  const cookieHeader = headers.Cookie ?? headers.cookie ?? "";
  const cookieFields = cookieHeader
    .split(";")
    .map((entry) => entry.split("=")[0]?.trim())
    .filter((value): value is string => Boolean(value))
    .map((key) => destinationField("cookie", "Cookies", key));
  const pathVariableFields = extractVariableNames(url).map((key) => destinationField("path", "Path Variables", key));
  const requestVariableFields = Object.keys(variables).map((key) => destinationField("variable", "Request Vars", key));
  const flowVariableFields = Object.keys(variables).map((key) => destinationField("flowVariable", "Flow Vars", key));
  return [
    ...bodyFields,
    ...headerFields,
    ...queryFields,
    ...cookieFields,
    ...pathVariableFields,
    ...requestVariableFields,
    ...flowVariableFields,
    destinationField("auth", "Auth", "Authorization", "Auth Token"),
  ];
}

function destinationField(
  targetType: FlowMapping["targetType"],
  groupLabel: string,
  key: string,
  label = key,
): DestinationField {
  return {
    id: `${targetType}:${key}`,
    label,
    key,
    targetType,
    targetPath: targetPathFor(targetType, key),
    section:
      targetType === "body"
        ? "body"
        : targetType === "header"
          ? "header"
          : targetType === "query"
            ? "query"
            : targetType === "path"
              ? "path"
            : targetType === "cookie"
              ? "cookie"
              : targetType === "auth"
                ? "auth"
                : targetType === "flowVariable"
                  ? "flow-variable"
                  : "request-variable",
    groupLabel,
  };
}

function flattenDestinationBody(value: unknown, prefix = ""): DestinationField[] {
  const parsed = typeof value === "string" ? parseResponseBody(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return prefix ? [destinationField("body", "Body", prefix)] : [];
  }
  return Object.entries(parsed as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const nested = flattenDestinationBody(child, path);
      return nested.length > 0 ? nested : [destinationField("body", "Body", path)];
    }
    return [destinationField("body", "Body", path)];
  });
}

function flattenSourceValue(value: unknown, path: string, groupLabel: string): SourceField[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flattenSourceValue(child, `${path}.${key}`, groupLabel),
    );
  }
  const label = path.split(".").pop() ?? path;
  return [{
    id: `source:${path}`,
    label,
    path,
    value: value === null || value === undefined ? "" : stringifyValue(value),
    section: "body",
    groupLabel,
  }];
}

function parseResponseBody(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value);
}

function groupFields<T extends SourceField | DestinationField>(fields: T[]) {
  const groups = new Map<string, T[]>();
  fields.forEach((field) => {
    groups.set(field.groupLabel, [...(groups.get(field.groupLabel) ?? []), field]);
  });
  return [...groups.entries()].map(([label, groupFields]) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    fields: groupFields,
  }));
}

function filterFields<T extends SourceField | DestinationField>(fields: T[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return fields;
  }
  return fields.filter((field) =>
    `${field.label} ${field.groupLabel} ${"path" in field ? field.path : field.key} ${"value" in field ? field.value : ""}`
      .toLowerCase()
      .includes(query),
  );
}

function mappingKey(mapping: FlowMapping, index: number) {
  return `${mapping.sourcePath}:${mapping.targetType}:${mapping.targetKey}:${index}`;
}

function buildConnectorPath(source: { x: number; y: number }, destination: { x: number; y: number }) {
  const dx = Math.max((destination.x - source.x) / 2, 40);
  return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${destination.x - dx} ${destination.y}, ${destination.x} ${destination.y}`;
}

function intersects(left: string[], right: string[]) {
  return left.some((value) => right.includes(value));
}

function defaultTransformTemplate(type: EnabledTransformType) {
  switch (type) {
    case "template":
      return "{{value}}";
    case "substring":
      return "0:8";
    case "jsonpath":
      return "$.id";
    case "javascript":
      return "return String(value);";
    case "bearer":
      return "Bearer {{value}}";
    default:
      return "{{value}}";
  }
}

function needsTransformInput(type: EnabledTransformType) {
  return type === "template" || type === "substring" || type === "jsonpath" || type === "javascript";
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildAutoMapSuggestions(sourceFields: SourceField[], destinationFields: DestinationField[], existingMappings: FlowMapping[]) {
  const existing = new Set(existingMappings.map((mapping) => `${mapping.sourcePath}:${mapping.targetType}:${mapping.targetKey}`));
  const destinationPriority = ["body", "header", "query", "cookie", "variable", "flowVariable", "path", "auth"];
  const byName = new Map<string, DestinationField[]>();
  destinationFields.forEach((field) => {
    const normalized = normalizeFieldName(field.label);
    byName.set(normalized, [...(byName.get(normalized) ?? []), field]);
  });

  return sourceFields.flatMap((sourceField) => {
    const normalized = normalizeFieldName(sourceField.label);
    const matches = (byName.get(normalized) ?? [])
      .slice()
      .sort((left, right) => destinationPriority.indexOf(left.targetType) - destinationPriority.indexOf(right.targetType));
    const match = matches[0];
    if (!match) {
      return [];
    }
    const key = `${sourceField.path}:${match.targetType}:${match.key}`;
    if (existing.has(key)) {
      return [];
    }
    return [{
      id: key,
      sourceField,
      destinationField: match,
    }];
  });
}
