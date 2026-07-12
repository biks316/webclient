import { ReactNode } from "react";
import { SplitPane } from "../common/SplitPane";
import styles from "./AppShell.module.css";

interface RightPanelConfig {
  id: string;
  content: ReactNode;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: (size: number) => void;
}

interface AppShellProps {
  toolbar?: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  rightPanels?: RightPanelConfig[];
  showSidebar: boolean;
  sidebarWidth?: number;
  sidebarMinWidth?: number;
  sidebarMaxWidth?: number;
  onSidebarWidthChange?: (size: number) => void;
}

interface CenterColumnProps {
  top: ReactNode;
  content: ReactNode;
  bottom?: ReactNode;
  bottomCollapsed?: boolean;
}

function AppShellRoot({
  toolbar,
  sidebar,
  main,
  rightPanels = [],
  showSidebar,
  sidebarWidth = 220,
  sidebarMinWidth = 180,
  sidebarMaxWidth = 280,
  onSidebarWidthChange,
}: AppShellProps) {
  const center = rightPanels.reduce<ReactNode>(
    (content, panel) => (
      <SplitPane
        key={panel.id}
        direction="horizontal"
        first={content}
        second={panel.content}
        initialPrimarySize={panel.width}
        primarySize={panel.width}
        primary="second"
        minPrimarySize={panel.minWidth ?? 260}
        maxPrimarySize={panel.maxWidth}
        onPrimarySizeChange={panel.onWidthChange}
        className={styles.mainSplit}
      />
    ),
    <div className={styles.main}>{main}</div>,
  );

  if (!showSidebar) {
    return (
      <div className={styles.shell}>
        {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        <div className={styles.body}>{center}</div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
      <div className={styles.body}>
        <SplitPane
          direction="horizontal"
          first={sidebar}
          second={center}
          initialPrimarySize={sidebarWidth}
          primarySize={sidebarWidth}
          minPrimarySize={sidebarMinWidth}
          maxPrimarySize={sidebarMaxWidth}
          onPrimarySizeChange={onSidebarWidthChange}
          className={styles.outerSplit}
        />
      </div>
    </div>
  );
}

function CenterColumn({ top, content, bottom, bottomCollapsed = false }: CenterColumnProps) {
  if (!bottom) {
    return (
      <div className={styles.center}>
        <div className={styles.top}>{top}</div>
        <div className={styles.content}>{content}</div>
      </div>
    );
  }

  return (
    <SplitPane
      direction="vertical"
      first={
        <div className={styles.center}>
          <div className={styles.top}>{top}</div>
          <div className={styles.content}>{content}</div>
        </div>
      }
      second={bottom}
      initialPrimarySize={190}
      primary="second"
      minPrimarySize={72}
      maxPrimarySize={280}
      collapsePane="second"
      collapsed={bottomCollapsed}
      className={styles.consoleSplit}
    />
  );
}

export const AppShell = Object.assign(AppShellRoot, {
  CenterColumn,
});
