import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Folder,
  Gauge,
  Plus,
  PencilLine,
  Route,
  Search,
  Send,
  TerminalSquare,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ActionMenu } from "../ActionMenu";
import { IconButton } from "../common/IconButton";
import { MethodBadge } from "../common/MethodBadge";
import { CollectionIndex, SyncCollectionStatus, WorkspaceIndex } from "../../types/bik";
import { RequestDragPayload, setCurrentRequestDrag } from "../../services/requestDragStore";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  workspace: WorkspaceIndex;
  collectionStatuses: Record<string, SyncCollectionStatus>;
  selectedCollectionId: string | null;
  selectedEndpointId: string | null;
  selectedFlowId: string | null;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  onCreateCollection: () => void;
  onCreateEndpoint: (collectionId?: string) => void;
  onCreateFlow: (collectionId?: string) => void;
  onDuplicateCollection: (collectionId: string) => void;
  onExportCollection: (collection: CollectionIndex) => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectEndpoint: (collectionId: string, endpointId: string) => void;
  onSelectFlow: (collectionId: string, flowId: string) => void;
  onOpenEndpointHistory: (collectionId: string, endpointId: string) => void;
  onRenameCollection: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onRenameRequest: (collectionId: string, endpointId: string) => void;
  onDuplicateRequest: (collectionId: string, endpointId: string) => void;
  onDeleteRequest: (collectionId: string, endpointId: string) => void;
  onGenerateRequestCode: (collectionId: string, endpointId: string) => void;
  onRenameFlow: (collectionId: string, flowId: string) => void;
  onDuplicateFlow: (collectionId: string, flowId: string) => void;
  onDeleteFlow: (collectionId: string, flowId: string) => void;
}

interface EndpointContextMenuState {
  kind: "endpoint" | "flow";
  collectionId: string;
  endpointId?: string;
  flowId?: string;
  top: number;
  left: number;
}

interface CollectionContextMenuState {
  kind: "collection";
  collection: CollectionIndex;
  top: number;
  left: number;
}

export function Sidebar({
  workspace,
  collectionStatuses,
  selectedCollectionId,
  selectedEndpointId,
  selectedFlowId,
  collapsed,
  onClose,
  onToggleCollapsed,
  onCreateCollection,
  onCreateEndpoint,
  onCreateFlow,
  onDuplicateCollection,
  onExportCollection,
  onSelectCollection,
  onSelectEndpoint,
  onSelectFlow,
  onOpenEndpointHistory,
  onRenameCollection,
  onDeleteCollection,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onGenerateRequestCode,
  onRenameFlow,
  onDuplicateFlow,
  onDeleteFlow,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<EndpointContextMenuState | CollectionContextMenuState | null>(null);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(selectedCollectionId);

  const query = search.trim().toLowerCase();

  const filteredCollections = useMemo(() => {
    if (!query) {
      return workspace.collections;
    }

    return workspace.collections
      .map((collection) => {
        const matchesCollection = collection.name.toLowerCase().includes(query);
        const endpoints = collection.endpoints.filter((endpoint) =>
          `${endpoint.name} ${endpoint.request.method}`.toLowerCase().includes(query),
        );
        const flows = collection.flows.filter((flow) => flow.name.toLowerCase().includes(query));
        return matchesCollection ? collection : { ...collection, endpoints, flows };
      })
      .filter((collection) =>
        collection.endpoints.length > 0 ||
        collection.flows.length > 0 ||
        collection.name.toLowerCase().includes(query),
      );
  }, [workspace, query]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function handleClose() {
      setContextMenu(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }

    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("resize", handleClose);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("resize", handleClose);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (selectedCollectionId) {
      setExpandedCollectionId(selectedCollectionId);
    }
  }, [selectedCollectionId]);

  function handleToggleCollection(collectionId: string, isExpanded: boolean) {
    setExpandedCollectionId(isExpanded ? null : collectionId);
  }

  function handleSelectCollection(collectionId: string, isExpanded: boolean) {
    handleToggleCollection(collectionId, isExpanded);
    onSelectCollection(collectionId);
  }

  function handleSelectEndpoint(collectionId: string, endpointId: string) {
    setExpandedCollectionId(collectionId);
    onSelectEndpoint(collectionId, endpointId);
  }

  function handleSelectFlow(collectionId: string, flowId: string) {
    setExpandedCollectionId(collectionId);
    onSelectFlow(collectionId, flowId);
  }

  function dragPayload(collection: CollectionIndex, endpoint: CollectionIndex["endpoints"][number]): RequestDragPayload {
    const requestId = endpoint.request.id || endpoint.id;
    return {
      collectionId: collection.id,
      requestId,
      requestName: endpoint.name,
      name: endpoint.name,
      method: endpoint.request.method,
      url: endpoint.request.url,
      path: endpoint.path,
    };
  }

  return (
    <>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
        <div className={styles.brand}>
          <div className={styles.brandInfo}>
            <div className={styles.brandMark}>
              <Send size={16} />
            </div>
            {!collapsed && (
              <div className={styles.brandCopy}>
                <span>Workspace</span>
                <strong>{workspace.name}</strong>
              </div>
            )}
          </div>
          <div className={styles.brandActions}>
            <IconButton
              className={styles.headerActionButton}
              title={collapsed ? "Expand collections panel" : "Collapse collections panel"}
              onClick={onToggleCollapsed}
            >
              {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            </IconButton>
            <IconButton className={styles.headerActionButton} title="Hide collections panel" onClick={onClose}>
              <X size={14} />
            </IconButton>
          </div>
        </div>

        <div className={styles.searchBox} title={collapsed ? "Search collections or requests" : undefined}>
          <Search size={14} />
          {!collapsed && (
            <input
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search collections or requests"
            />
          )}
        </div>

        <div className={styles.workspaceMeta}>
          {!collapsed && <strong className={styles.workspaceLabel}>Workspace</strong>}
          <IconButton title="New collection" onClick={onCreateCollection}>
            <Plus size={14} />
          </IconButton>
        </div>

        <div className={styles.treeScroll}>
          {collapsed ? (
            <div className={styles.tree}>
              {filteredCollections.map((collection) => {
                const activeCollection = selectedCollectionId === collection.id;
                const isExpanded = expandedCollectionId === collection.id;

                return (
                  <button
                    key={collection.id}
                    type="button"
                    className={`${styles.collectionIconButton} ${activeCollection ? styles.collectionIconButtonActive : ""}`}
                    onClick={() => handleSelectCollection(collection.id, isExpanded)}
                    title={collection.name}
                  >
                    <Folder size={15} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.sidebarTreePanel}>
              <div className={styles.sidebarSectionTitle}>COLLECTIONS</div>
              <div className={styles.tree}>
                {filteredCollections.map((collection) => {
                  const activeCollection = selectedCollectionId === collection.id;
                  const isExpanded = query.length > 0 ? true : expandedCollectionId === collection.id;
                  const syncStatus = collectionStatuses[collection.id];

                  return (
                    <section className={styles.collectionTreeItem} key={collection.id}>
                      <div
                        className={`${styles.treeRow} ${activeCollection ? styles.active : ""}`}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({
                            kind: "collection",
                            collection,
                            top: event.clientY,
                            left: event.clientX,
                          });
                        }}
                      >
                        <button
                          type="button"
                          className={styles.collectionRowButton}
                          onClick={() => handleSelectCollection(collection.id, isExpanded)}
                          title={syncStatus ? `${collection.name} • ${syncLabel(syncStatus)}` : collection.name}
                        >
                          <ChevronRight
                            size={12}
                            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                          />
                          <span className={styles.rowTitle}>{collection.name}</span>
                        </button>
                        <div className={styles.rowActions}>
                          <IconButton
                            title={`New request in ${collection.name}`}
                            onClick={() => onCreateEndpoint(collection.id)}
                          >
                            <Plus size={12} />
                          </IconButton>
                          <ActionMenu
                            label={`${collection.name} options`}
                            items={[
                              {
                                label: "New request",
                                icon: <Plus size={12} />,
                                onSelect: () => onCreateEndpoint(collection.id),
                              },
                              {
                                label: "New flow",
                                icon: <Route size={12} />,
                                onSelect: () => onCreateFlow(collection.id),
                              },
                              {
                                label: "Clone",
                                icon: <Copy size={12} />,
                                onSelect: () => onDuplicateCollection(collection.id),
                              },
                              {
                                label: "Rename",
                                icon: <PencilLine size={12} />,
                                onSelect: () => onRenameCollection(collection.id),
                              },
                              {
                                label: "Delete",
                                icon: <Trash2 size={12} />,
                                onSelect: () => onDeleteCollection(collection.id),
                              },
                              {
                                label: "Export collection",
                                icon: <Folder size={12} />,
                                onSelect: () => onExportCollection(collection),
                              },
                            ]}
                          />
                        </div>
                      </div>

                      <div className={`${styles.collectionChildren} ${isExpanded ? styles.collectionChildrenOpen : ""}`}>
                        <div className={styles.endpointList}>
                          <div className={styles.treeGroupLabel}>Requests</div>
                          {collection.endpoints.map((endpoint) => {
                            const active = activeCollection && selectedEndpointId === endpoint.id;
                            return (
                              <div
                                key={endpoint.id}
                                role="button"
                                tabIndex={0}
                                draggable
                                className={`${styles.treeRow} ${styles.endpointRow} ${active ? styles.active : ""}`}
                                onPointerDown={() => {
                                  setCurrentRequestDrag(dragPayload(collection, endpoint));
                                }}
                                onDragStart={(event) => {
                                  const requestId = endpoint.request.id || endpoint.id;
                                  console.log("[DND] dragStart request", requestId, endpoint.name);
                                  const payload = dragPayload(collection, endpoint);
                                  setCurrentRequestDrag(payload);
                                  event.dataTransfer.setData("application/bikapi-request", JSON.stringify(payload));
                                  event.dataTransfer.setData("application/bikapi-endpoint", JSON.stringify(payload));
                                  event.dataTransfer.setData("text/plain", requestId);
                                  event.dataTransfer.effectAllowed = "copy";
                                }}
                                onClick={() => handleSelectEndpoint(collection.id, endpoint.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleSelectEndpoint(collection.id, endpoint.id);
                                  }
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  setContextMenu({
                                    kind: "endpoint",
                                    collectionId: collection.id,
                                    endpointId: endpoint.id,
                                    top: event.clientY,
                                    left: event.clientX,
                                  });
                                }}
                                title={`${endpoint.name} (right click for history)`}
                              >
                                <MethodBadge method={endpoint.request.method} compact className={styles.methodBadge} />
                                <span className={styles.rowTitle}>{endpoint.name}</span>
                                <div className={styles.rowActions} onClick={(event) => event.stopPropagation()}>
                                  <ActionMenu
                                    label={`${endpoint.name} options`}
                                    items={[
                                      {
                                        label: "Rename",
                                        icon: <PencilLine size={12} />,
                                        onSelect: () => onRenameRequest(collection.id, endpoint.id),
                                      },
                                      {
                                        label: "Clone",
                                        icon: <Copy size={12} />,
                                        onSelect: () => onDuplicateRequest(collection.id, endpoint.id),
                                      },
                                      {
                                        label: "Generate Code",
                                        icon: <TerminalSquare size={12} />,
                                        onSelect: () => onGenerateRequestCode(collection.id, endpoint.id),
                                      },
                                      {
                                        label: "Delete",
                                        icon: <Trash2 size={12} />,
                                        onSelect: () => onDeleteRequest(collection.id, endpoint.id),
                                      },
                                      {
                                        label: "See history",
                                        icon: <Route size={12} />,
                                        onSelect: () => onOpenEndpointHistory(collection.id, endpoint.id),
                                      },
                                    ]}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {collection.endpoints.length === 0 && <div className={styles.emptyFolder}>No requests</div>}
                          <div className={styles.treeGroupHeader}>
                            <span>Flows</span>
                            <IconButton title={`New flow in ${collection.name}`} onClick={() => onCreateFlow(collection.id)}>
                              <Plus size={12} />
                            </IconButton>
                          </div>
                          {collection.flows.map((flow) => {
                            const active = activeCollection && selectedFlowId === flow.id;
                            return (
                              <button
                                key={flow.id}
                                type="button"
                                className={`${styles.treeRow} ${styles.endpointRow} ${active ? styles.active : ""}`}
                                onClick={() => handleSelectFlow(collection.id, flow.id)}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  setContextMenu({
                                    kind: "flow",
                                    collectionId: collection.id,
                                    flowId: flow.id,
                                    top: event.clientY,
                                    left: event.clientX,
                                  });
                                }}
                                title={flow.name}
                              >
                                <Route size={12} className={styles.flowIcon} />
                                <span className={styles.rowTitle}>{flow.name}</span>
                              </button>
                            );
                          })}
                          {collection.flows.length === 0 && <div className={styles.emptyFolder}>No flows</div>}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.bottomNav}>
          <button type="button" className={styles.bottomNavActive} title="Console">
            <TerminalSquare size={12} />
            {!collapsed && "Console"}
          </button>
          <button type="button" title="Network">
            <Wifi size={12} />
            {!collapsed && "Network"}
          </button>
          <button type="button" title="Performance">
            <Gauge size={12} />
            {!collapsed && "Performance"}
          </button>
          <button type="button" title="Timeline">
            <Route size={12} />
            {!collapsed && "Timeline"}
          </button>
        </div>
      </aside>

      {contextMenu &&
        createPortal(
          <div
            className="menu-popover"
            role="menu"
            style={{ top: contextMenu.top, left: contextMenu.left, position: "fixed" }}
          >
            {contextMenu.kind === "endpoint" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.endpointId) {
                      onGenerateRequestCode(contextMenu.collectionId, contextMenu.endpointId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Generate Code</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.endpointId) {
                      onRenameRequest(contextMenu.collectionId, contextMenu.endpointId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.endpointId) {
                      onDuplicateRequest(contextMenu.collectionId, contextMenu.endpointId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Clone</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.endpointId) {
                      onDeleteRequest(contextMenu.collectionId, contextMenu.endpointId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.endpointId) {
                      onOpenEndpointHistory(contextMenu.collectionId, contextMenu.endpointId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>See history</span>
                </button>
              </>
            ) : contextMenu.kind === "flow" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.flowId) {
                      onRenameFlow(contextMenu.collectionId, contextMenu.flowId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.flowId) {
                      onDuplicateFlow(contextMenu.collectionId, contextMenu.flowId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Clone</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.flowId) {
                      onDeleteFlow(contextMenu.collectionId, contextMenu.flowId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>Delete</span>
                </button>
              </>
            ) : (() => {
              const collectionMenu = contextMenu as CollectionContextMenuState;
              return (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null);
                    onCreateEndpoint(collectionMenu.collection.id);
                  }}
                >
                  <span>New request</span>
                </button>
                <button type="button" role="menuitem" disabled>
                  <span>New folder</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null);
                    onRenameCollection(collectionMenu.collection.id);
                  }}
                >
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null);
                    onDuplicateCollection(collectionMenu.collection.id);
                  }}
                >
                  <span>Clone</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null);
                    onDeleteCollection(collectionMenu.collection.id);
                  }}
                >
                  <span>Delete</span>
                </button>
              </>
              );
            })()}
          </div>,
          document.body,
        )}
    </>
  );
}

function syncLabel(status: SyncCollectionStatus) {
  switch (status.state) {
    case "local_changes":
      return `Uploading ${status.localChanges} change${status.localChanges === 1 ? "" : "s"}`;
    case "remote_updates":
      return `Downloading ${status.remoteChanges} update${status.remoteChanges === 1 ? "" : "s"}`;
    case "sync_required":
      return "Sync required";
    case "conflict":
      return "Review changes";
    case "offline":
      return "Offline";
    case "not_git":
      return "Local only";
    case "synced":
    default:
      return "Synced";
  }
}
