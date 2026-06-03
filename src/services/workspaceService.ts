import { CollectionIndex, EndpointIndex, WorkspaceIndex } from "../types/bik";

export function firstCollection(workspace: WorkspaceIndex | null): CollectionIndex | null {
  return workspace?.collections[0] ?? null;
}

export function firstEndpoint(collection: CollectionIndex | null): EndpointIndex | null {
  return collection?.endpoints[0] ?? null;
}

export function findCollection(
  workspace: WorkspaceIndex | null,
  collectionId: string | null,
): CollectionIndex | null {
  if (!workspace || !collectionId) {
    return null;
  }
  return workspace.collections.find((collection) => collection.id === collectionId) ?? null;
}

export function findEndpoint(
  workspace: WorkspaceIndex | null,
  collectionId: string | null,
  endpointId: string | null,
): EndpointIndex | null {
  const collection = findCollection(workspace, collectionId);
  if (!collection || !endpointId) {
    return null;
  }
  return collection.endpoints.find((endpoint) => endpoint.id === endpointId) ?? null;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
