import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import styles from "./SplitPane.module.css";

interface SplitPaneProps {
  direction: "horizontal" | "vertical";
  first: ReactNode;
  second: ReactNode;
  initialPrimarySize: number;
  primarySize?: number;
  primary?: "first" | "second";
  minPrimarySize?: number;
  maxPrimarySize?: number;
  collapsed?: boolean;
  collapsePane?: "first" | "second";
  className?: string;
  animate?: boolean;
  onPrimarySizeChange?: (size: number) => void;
}

export function SplitPane({
  direction,
  first,
  second,
  initialPrimarySize,
  primarySize: controlledPrimarySize,
  primary = "first",
  minPrimarySize = 180,
  maxPrimarySize,
  collapsed = false,
  collapsePane = "second",
  className,
  animate = true,
  onPrimarySizeChange,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [uncontrolledPrimarySize, setUncontrolledPrimarySize] = useState(initialPrimarySize);
  const [dragging, setDragging] = useState(false);
  const isHorizontal = direction === "horizontal";
  const primarySize = controlledPrimarySize ?? uncontrolledPrimarySize;

  useEffect(() => {
    if (controlledPrimarySize === undefined) {
      setUncontrolledPrimarySize(initialPrimarySize);
    }
  }, [controlledPrimarySize, initialPrimarySize]);

  function updatePrimarySize(size: number) {
    if (controlledPrimarySize === undefined) {
      setUncontrolledPrimarySize(size);
    }
    onPrimarySizeChange?.(size);
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const totalSize = isHorizontal ? rect.width : rect.height;
    const start = isHorizontal ? event.clientX : event.clientY;
    const startingSize = primarySize;

    function onPointerMove(moveEvent: PointerEvent) {
      const current = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const delta = current - start;
      const rawNext = primary === "first" ? startingSize + delta : startingSize - delta;
      const limit = maxPrimarySize ?? totalSize - 180;
      const next = Math.max(minPrimarySize, Math.min(limit, rawNext));
      updatePrimarySize(next);
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
    }

    setDragging(true);
    document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const style = useMemo(() => {
    const value = collapsed ? "0px" : `${primarySize}px`;
    return { "--primary-size": value } as React.CSSProperties;
  }, [collapsed, primarySize]);

  const classNames = [
    styles.split,
    isHorizontal ? styles.horizontal : styles.vertical,
    primary === "first" ? styles.primaryFirst : styles.primarySecond,
    collapsed ? styles.collapsed : "",
    animate && !dragging ? styles.animated : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const hideFirst = collapsed && collapsePane === "first";
  const hideSecond = collapsed && collapsePane === "second";

  return (
    <div ref={containerRef} className={classNames} style={style}>
      <div className={`${styles.pane} ${hideFirst ? styles.hidden : ""}`}>{first}</div>
      {!collapsed && <div className={styles.handle} onPointerDown={handlePointerDown} role="separator" />}
      <div className={`${styles.pane} ${hideSecond ? styles.hidden : ""}`}>{second}</div>
    </div>
  );
}
