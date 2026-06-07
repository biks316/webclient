import { JsonTreeNode } from "../../services/jsonTreeService";
import styles from "./FlowBuilder.module.css";

interface ResponseJsonTreeProps {
  nodes: JsonTreeNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
}

function TreeNode({ node, selectedPath, onSelect }: { node: JsonTreeNode; selectedPath: string; onSelect: (path: string) => void }) {
  const leaf = node.children.length === 0;
  return (
    <li>
      <button
        type="button"
        className={`${styles.treeValue} ${selectedPath === node.path ? styles.treeValueActive : ""}`}
        onClick={() => leaf && onSelect(node.path)}
        disabled={!leaf}
      >
        <span>{node.label}</span>
        {leaf && <em>{String(node.value ?? "").slice(0, 32)}</em>}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ResponseJsonTree({ nodes, selectedPath, onSelect }: ResponseJsonTreeProps) {
  return (
    <ul className={styles.responseTree}>
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </ul>
  );
}
