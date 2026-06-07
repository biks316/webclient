export interface RequestDragPayload {
  collectionId?: string;
  requestId: string;
  requestName?: string;
  name?: string;
  method: string;
  url?: string;
  path?: string;
}

let currentRequestDrag: RequestDragPayload | null = null;

export function setCurrentRequestDrag(payload: RequestDragPayload) {
  currentRequestDrag = payload;
}

export function getCurrentRequestDrag() {
  return currentRequestDrag;
}

export function clearCurrentRequestDrag() {
  currentRequestDrag = null;
}
