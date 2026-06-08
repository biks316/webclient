import { FlowDefinition, FlowEdge, FlowNode } from "../types/bik";

const NODE_X_GAP = 320;
const START_X = 100;
const START_Y = 110;
const NODE_Y_GAP = 160;

export function edgeSource(edge: FlowEdge) {
  return edge.source || edge.from;
}

export function edgeTarget(edge: FlowEdge) {
  return edge.target || edge.to;
}

export function orderedFlowNodes(flow: FlowDefinition): FlowNode[] {
  if (flow.nodes.length <= 1) {
    return flow.nodes;
  }

  const byId = new Map(flow.nodes.map((node) => [node.id, node]));
  const indegree = new Map(flow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();

  flow.edges.forEach((edge) => {
    const source = edgeSource(edge);
    const target = edgeTarget(edge);
    if (!byId.has(source) || !byId.has(target)) {
      return;
    }
    indegree.set(target, (indegree.get(target) ?? 0) + 1);
    outgoing.set(source, [...(outgoing.get(source) ?? []), target]);
  });

  const queue = flow.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0);
  const ordered: FlowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      continue;
    }
    ordered.push(node);
    (outgoing.get(node.id) ?? []).forEach((targetId) => {
      const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) {
        const targetNode = byId.get(targetId);
        if (targetNode) {
          queue.push(targetNode);
        }
      }
    });
  }

  flow.nodes.forEach((node) => {
    if (!ordered.some((orderedNode) => orderedNode.id === node.id)) {
      ordered.push(node);
    }
  });

  return ordered;
}

export function layoutFlow(flow: FlowDefinition): FlowDefinition {
  const ordered = orderedFlowNodes(flow);
  const orderedIds = new Set(ordered.map((node) => node.id));
  const branchByNode = new Map<string, number>();
  flow.edges.forEach((edge) => {
    const source = edgeSource(edge);
    const outgoingIndex = flow.edges.filter((item) => edgeSource(item) === source).findIndex((item) => item.id === edge.id);
    branchByNode.set(edgeTarget(edge), Math.max(branchByNode.get(edgeTarget(edge)) ?? 0, outgoingIndex));
  });
  const laidOut = ordered.map((node, index) => ({
    ...node,
    position: {
      x: START_X + index * NODE_X_GAP,
      y: START_Y + (branchByNode.get(node.id) ?? 0) * NODE_Y_GAP,
    },
  }));

  const untouched = flow.nodes
    .filter((node) => !orderedIds.has(node.id))
    .map((node, index) => ({
      ...node,
      position: {
        x: START_X + index * NODE_X_GAP,
        y: START_Y + NODE_Y_GAP,
      },
    }));

  return {
    ...flow,
    nodes: [...laidOut, ...untouched],
  };
}

export function replaceChainEdge(edges: FlowEdge[], nextEdge: FlowEdge): FlowEdge[] {
  return [
    ...edges.filter((edge) =>
      edge.id !== nextEdge.id &&
      edgeSource(edge) !== edgeSource(nextEdge) &&
      edgeTarget(edge) !== edgeTarget(nextEdge),
    ),
    nextEdge,
  ];
}

export function edgeExists(edges: FlowEdge[], source: string, target: string) {
  return edges.some((edge) => edgeSource(edge) === source && edgeTarget(edge) === target);
}

export function wouldCreateCycle(edges: FlowEdge[], source: string, target: string) {
  const outgoing = new Map<string, string[]>();
  edges.forEach((edge) => {
    const edgeFrom = edgeSource(edge);
    outgoing.set(edgeFrom, [...(outgoing.get(edgeFrom) ?? []), edgeTarget(edge)]);
  });

  const stack = [target];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) {
      continue;
    }
    if (current === source) {
      return true;
    }
    seen.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

export function layoutAfterConnection(flow: FlowDefinition, edge: FlowEdge): FlowDefinition {
  const source = flow.nodes.find((node) => node.id === edgeSource(edge));
  const target = flow.nodes.find((node) => node.id === edgeTarget(edge));
  if (!source || !target) {
    return flow;
  }

  const desired = {
    x: source.position.x + NODE_X_GAP,
    y: source.position.y,
  };
  const distance = Math.hypot(target.position.x - desired.x, target.position.y - desired.y);
  if (distance < 80) {
    return flow;
  }

  const occupied = new Set(
    flow.nodes
      .filter((node) => node.id !== target.id)
      .map((node) => `${Math.round(node.position.x)}:${Math.round(node.position.y)}`),
  );
  while (occupied.has(`${Math.round(desired.x)}:${Math.round(desired.y)}`)) {
    desired.y += NODE_Y_GAP;
  }

  return {
    ...flow,
    nodes: flow.nodes.map((node) => (node.id === target.id ? { ...node, position: desired } : node)),
  };
}
