import { Copy, Download, FilePlus, FolderOpen, GitBranch, Plus, Send } from "lucide-react";
import { ActionMenu } from "./ActionMenu";
import { CollectionIndex, WorkspaceIndex } from "../types/bik";

interface SidebarProps {
  workspace: WorkspaceIndex | null;
  selectedCollectionId: string | null;
  selectedEndpointId: string | null;
  onOpenWorkspace: () => void;
  onCreateWorkspace: () => void;
  onCreateCollection: () => void;
  onCreateEndpoint: (collectionId: string) => void;
  onCopyCollection: (collection: CollectionIndex) => void;
  onExportCollection: (collection: CollectionIndex) => void;
  onSelectCollection: (collectionId: string) => void;
  onOpenCollectionWorkspace: (collectionId: string) => void;
  onSelectEndpoint: (collectionId: string, endpointId: string) => void;
}

export function Sidebar({
  workspace,
  selectedCollectionId,
  selectedEndpointId,
  onOpenWorkspace,
  onCreateWorkspace,
  onCreateCollection,
  onCreateEndpoint,
  onCopyCollection,
  onExportCollection,
  onSelectCollection,
  onOpenCollectionWorkspace,
  onSelectEndpoint,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Send size={20} />
        <div>
          <strong>BikAPI</strong>
          <span>local .bik client</span>
        </div>
      </div>

      {!workspace && (
        <div className="sidebar-actions">
          <button type="button" onClick={onOpenWorkspace}>
            <FolderOpen size={16} />
            Open local workspace
          </button>
          <button type="button" onClick={onCreateWorkspace}>
            <Plus size={16} />
            New workspace
          </button>
        </div>
      )}

      {workspace ? (
        <>
          <div className="workspace-meta">
            <span>{workspace.name}</span>
            <small title={workspace.path}>{workspace.path}</small>
          </div>
          <div className="section-title">
            <span>Collections</span>
            <button type="button" title="Create collection" onClick={onCreateCollection}>
              <Plus size={14} />
            </button>
          </div>
          <div className="collection-list">
            {workspace.collections.map((collection) => (
              <CollectionTree
                key={collection.id}
                collection={collection}
                selectedCollectionId={selectedCollectionId}
                selectedEndpointId={selectedEndpointId}
                onCreateEndpoint={onCreateEndpoint}
                onCopyCollection={onCopyCollection}
                onExportCollection={onExportCollection}
                onSelectCollection={onSelectCollection}
                onOpenCollectionWorkspace={onOpenCollectionWorkspace}
                onSelectEndpoint={onSelectEndpoint}
              />
            ))}
            {workspace.collections.length === 0 && (
              <div className="empty-state empty-state-action">
                <span>Create a collection to start.</span>
                <button type="button" className="primary" onClick={onCreateCollection}>
                  <Plus size={14} />
                  New collection
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">Open or create a folder workspace.</div>
      )}
    </aside>
  );
}

interface CollectionTreeProps {
  collection: CollectionIndex;
  selectedCollectionId: string | null;
  selectedEndpointId: string | null;
  onCreateEndpoint: (collectionId: string) => void;
  onCopyCollection: (collection: CollectionIndex) => void;
  onExportCollection: (collection: CollectionIndex) => void;
  onSelectCollection: (collectionId: string) => void;
  onOpenCollectionWorkspace: (collectionId: string) => void;
  onSelectEndpoint: (collectionId: string, endpointId: string) => void;
}

function CollectionTree({
  collection,
  selectedCollectionId,
  selectedEndpointId,
  onCreateEndpoint,
  onCopyCollection,
  onExportCollection,
  onSelectCollection,
  onOpenCollectionWorkspace,
  onSelectEndpoint,
}: CollectionTreeProps) {
  const activeCollection = selectedCollectionId === collection.id;

  return (
    <div className="collection-group">
      <div className={`collection-row ${activeCollection ? "active" : ""}`}>
        <button
          type="button"
          className="collection-select"
          onClick={() => onSelectCollection(collection.id)}
          onDoubleClick={() => onOpenCollectionWorkspace(collection.id)}
        >
          <GitBranch size={14} />
          <span>{collection.name}</span>
        </button>
        <ActionMenu
          label={`${collection.name} actions`}
          items={[
            {
              label: "New request",
              icon: <FilePlus size={14} />,
              onSelect: () => onCreateEndpoint(collection.id),
            },
            {
              label: "Copy collection",
              icon: <Copy size={14} />,
              onSelect: () => onCopyCollection(collection),
            },
            {
              label: "Export collection",
              icon: <Download size={14} />,
              onSelect: () => onExportCollection(collection),
            },
          ]}
        />
      </div>
      <div className="endpoint-list">
        {collection.endpoints.map((endpoint) => (
          <button
            type="button"
            key={endpoint.id}
            className={`endpoint-row ${
              activeCollection && selectedEndpointId === endpoint.id ? "active" : ""
            }`}
            onClick={() => onSelectEndpoint(collection.id, endpoint.id)}
          >
            <span className={`method-badge method-${endpoint.request.method.toLowerCase()}`}>
              {endpoint.request.method}
            </span>
            <strong>{endpoint.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
