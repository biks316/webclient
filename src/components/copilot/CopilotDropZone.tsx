import { ReactNode } from "react";
import styles from "./CopilotComposer.module.css";

interface CopilotDropZoneProps {
  active: boolean;
  children: ReactNode;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function CopilotDropZone({
  active,
  children,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: CopilotDropZoneProps) {
  return (
    <div
      className={`${styles.dropZone} ${active ? styles.dropZoneActive : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {active ? <div className={styles.dropOverlay}>Drop to attach context</div> : null}
    </div>
  );
}
