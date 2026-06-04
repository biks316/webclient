import { ChevronRight, Copy, FolderOpen, Plus, Search, Send, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ActionMenu } from "../ActionMenu";
import { EmptyState } from "../common/EmptyState";
import { IconButton } from "../common/IconButton";
import { MethodBadge } from "../common/MethodBadge";
import { CollectionIndex, WorkspaceIndex } from "../../types/bik";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  workspace: WorkspaceIndex | null;
  selectedCollectionId: string | null;
  selectedEndpointId: string | null;
  onClose: () => void;
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
  selectedCollectionId,
  selectedEndpointId,
  onClose,
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
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandInfo}>
            <div className={styles.brandMark}>
              <Send size={16} />
            </div>
            <div>
              <strong>{workspace?.name ?? "BikAPI"}</strong>
              <span>{workspace ? "Local workspace" : "Desktop API client"}</span>
            </div>
          </div>
          <IconButton title="Hide collections panel" onClick={onClose}>
            <X size={14} />
          </IconButton>
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
            <div className={styles.searchBox}>
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search collections or requests"
              />
            </div>

            <div className={styles.workspaceMeta}>
              <div>
                <strong>{workspace.name}</strong>
                <span title={workspace.path}>{workspace.path}</span>
              </div>
              <IconButton title="New collection" onClick={onCreateCollection}>
                <Plus size={14} />
              </IconButton>
            </div>

            <div className={styles.tree}>
              {filteredCollections.map((collection) => {
                const activeCollection = selectedCollectionId === collection.id;
                const isExpanded = query.length > 0 ? true : expandedCollectionId === collection.id;
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
                          size={14}
                          className={`${styles.folderIcon} ${isExpanded ? styles.folderIconExpanded : ""}`}
                        />
                      </button>
                      <button
                        type="button"
                        className={styles.collectionButton}
                        onClick={() => handleSelectCollection(collection.id)}
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
                        <strong>{collection.name}</strong>
                      </button>
                      <div className={styles.rowActions}>
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
                    {isExpanded && (
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
                              <MethodBadge method={endpoint.request.method} compact />
                              <span>{endpoint.name}</span>
                            </button>
                          );
                        })}
                        {collection.endpoints.length === 0 && (
                          <button type="button" className={styles.emptyFolder} onClick={() => onCreateEndpoint(collection.id)}>
                            Add request
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}

        <div className={styles.bottomNav}>
          <button type="button" className={styles.bottomNavActive}>Console</button>
          <button type="button">Network</button>
          <button type="button">Performance</button>
          <button type="button">Timeline</button>
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
