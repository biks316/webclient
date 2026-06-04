import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Folder,
  FolderOpen,
  Gauge,
  Plus,
  Route,
  Search,
  Send,
  Settings2,
  TerminalSquare,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ActionMenu } from "../ActionMenu";
import { EmptyState } from "../common/EmptyState";
import { IconButton } from "../common/IconButton";
import { MethodBadge } from "../common/MethodBadge";
import { CollectionListCard } from "./CollectionListCard";
import { CollectionIndex, SyncCollectionStatus, WorkspaceIndex } from "../../types/bik";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  workspace: WorkspaceIndex | null;
  collectionStatuses: Record<string, SyncCollectionStatus>;
  selectedCollectionId: string | null;
  selectedEndpointId: string | null;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  onOpenWorkspace: () => void;
  onCreateWorkspace: () => void;
  onCreateCollection: () => void;
  onCreateEndpoint: (collectionId?: string) => void;
  onCopyCollection: (collection: CollectionIndex) => void;
  onExportCollection: (collection: CollectionIndex) => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectEndpoint: (collectionId: string, endpointId: string) => void;
  onOpenEndpointHistory: (collectionId: string, endpointId: string) => void;
}

interface EndpointContextMenuState {
  kind: "endpoint";
  collectionId: string;
  endpointId: string;
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
  collapsed,
  onClose,
  onToggleCollapsed,
  onOpenWorkspace,
  onCreateWorkspace,
  onCreateCollection,
  onCreateEndpoint,
  onCopyCollection,
  onExportCollection,
  onSelectCollection,
  onSelectEndpoint,
  onOpenEndpointHistory,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<EndpointContextMenuState | CollectionContextMenuState | null>(null);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(selectedCollectionId);

  const query = search.trim().toLowerCase();

  const filteredCollections = useMemo(() => {
    if (!workspace) {
      return [];
    }
    if (!query) {
      return workspace.collections;
    }

    return workspace.collections
      .map((collection) => {
        const matchesCollection = collection.name.toLowerCase().includes(query);
        const endpoints = collection.endpoints.filter((endpoint) =>
          `${endpoint.name} ${endpoint.request.method}`.toLowerCase().includes(query),
        );
        return matchesCollection ? collection : { ...collection, endpoints };
      })
      .filter((collection) => collection.endpoints.length > 0 || collection.name.toLowerCase().includes(query));
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

  function handleSelectCollection(collectionId: string) {
    setExpandedCollectionId(collectionId);
    onSelectCollection(collectionId);
  }

  function handleSelectEndpoint(collectionId: string, endpointId: string) {
    setExpandedCollectionId(collectionId);
    onSelectEndpoint(collectionId, endpointId);
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
                <span>{workspace ? "Workspace" : "BikAPI"}</span>
                <strong>{workspace?.name ?? "Collections"}</strong>
              </div>
            )}
          </div>
          <div className={styles.brandActions}>
            {workspace && !collapsed && (
              <>
                <IconButton className={styles.headerActionButton} title="Switch workspace" onClick={onOpenWorkspace}>
                  <FolderOpen size={14} />
                </IconButton>
                <IconButton className={styles.headerActionButton} title="Open new workspace" onClick={onCreateWorkspace}>
                  <Plus size={14} />
                </IconButton>
              </>
            )}
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

        {!workspace ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              title="Open a workspace"
              description="Start from an existing folder or create a new local .bik workspace."
              actionLabel="Open workspace"
              onAction={onOpenWorkspace}
              icon={FolderOpen}
            />
            <button type="button" onClick={onCreateWorkspace}>
              <Plus size={14} />
              New workspace
            </button>
          </div>
        ) : (
          <>
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
                    return (
                      <button
                        key={collection.id}
                        type="button"
                        className={`${styles.collectionIconButton} ${activeCollection ? styles.collectionIconButtonActive : ""}`}
                        onClick={() => handleSelectCollection(collection.id)}
                        title={collection.name}
                      >
                        <Folder size={15} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <CollectionListCard title="Collections">
                  <div className={styles.tree}>
                    {filteredCollections.map((collection) => {
                      const activeCollection = selectedCollectionId === collection.id;
                      const isExpanded = query.length > 0 ? true : expandedCollectionId === collection.id;
                      const syncStatus = collectionStatuses[collection.id];

                      return (
                        <section
                          className={`${styles.collection} ${isExpanded ? styles.collectionExpanded : styles.collectionCollapsed}`}
                          key={collection.id}
                        >
                          <div className={`${styles.collectionRow} ${activeCollection ? styles.activeCollection : ""}`}>
                            <button
                              type="button"
                              className={styles.collectionToggle}
                              onClick={() => handleToggleCollection(collection.id, isExpanded)}
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${collection.name}`}
                              aria-expanded={isExpanded}
                            >
                              <ChevronRight
                                size={12}
                                className={`${styles.folderIcon} ${isExpanded ? styles.folderIconExpanded : ""}`}
                              />
                            </button>
                            <button
                              type="button"
                              className={styles.collectionButton}
                              onClick={() => handleSelectCollection(collection.id)}
                              title={syncStatus ? `${collection.name} • ${syncLabel(syncStatus)}` : collection.name}
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
                              <span className={styles.collectionCopy}>
                                <strong>{collection.name}</strong>
                              </span>
                            </button>
                            <div className={styles.rowActions}>
                              <IconButton title={`New request in ${collection.name}`} onClick={() => onCreateEndpoint(collection.id)}>
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
                                    label: "New folder",
                                    icon: <Plus size={12} />,
                                    disabled: true,
                                    onSelect: () => undefined,
                                  },
                                  {
                                    label: "Rename",
                                    icon: <Settings2 size={12} />,
                                    disabled: true,
                                    onSelect: () => undefined,
                                  },
                                  {
                                    label: "Duplicate",
                                    icon: <Copy size={12} />,
                                    onSelect: () => onCopyCollection(collection),
                                  },
                                  {
                                    label: "Delete",
                                    icon: <Settings2 size={12} />,
                                    disabled: true,
                                    onSelect: () => undefined,
                                  },
                                  {
                                    label: "Export collection",
                                    icon: <Settings2 size={12} />,
                                    onSelect: () => onExportCollection(collection),
                                  },
                                ]}
                              />
                            </div>
                          </div>
                          <div className={`${styles.collectionBody} ${isExpanded ? styles.collectionBodyExpanded : ""}`}>
                            <div className={styles.endpointList}>
                              {collection.endpoints.map((endpoint) => {
                                const active = activeCollection && selectedEndpointId === endpoint.id;
                                return (
                                  <button
                                    key={endpoint.id}
                                    type="button"
                                    className={`${styles.endpoint} ${active ? styles.endpointActive : ""}`}
                                    onClick={() => handleSelectEndpoint(collection.id, endpoint.id)}
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
                                    <MethodBadge
                                      method={endpoint.request.method}
                                      compact
                                      className={styles.endpointMethodBadge}
                                    />
                                    <span>{endpoint.name}</span>
                                  </button>
                                );
                              })}
                              {collection.endpoints.length === 0 && <div className={styles.emptyFolder}>No requests</div>}
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </CollectionListCard>
              )}
            </div>
          </>
        )}

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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setContextMenu(null);
                  onOpenEndpointHistory(contextMenu.collectionId, contextMenu.endpointId);
                }}
              >
                <span>See history</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null);
                    onCreateEndpoint(contextMenu.collection.id);
                  }}
                >
                  <span>New request</span>
                </button>
                <button type="button" role="menuitem" disabled>
                  <span>New folder</span>
                </button>
                <button type="button" role="menuitem" disabled>
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null);
                    onCopyCollection(contextMenu.collection);
                  }}
                >
                  <span>Duplicate</span>
                </button>
                <button type="button" role="menuitem" disabled>
                  <span>Delete</span>
                </button>
              </>
            )}
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
    case "synced":
    default:
      return "Synced";
  }
}

function syncTone(state: SyncCollectionStatus["state"]) {
  switch (state) {
    case "local_changes":
      return "blue";
    case "remote_updates":
      return "orange";
    case "sync_required":
    case "conflict":
      return "red";
    case "synced":
    default:
      return "green";
  }
}
