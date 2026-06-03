import { MoreHorizontal } from "lucide-react";
import { CSSProperties, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight: number;
  transformOrigin: string;
}

const MENU_OFFSET = 5;
const VIEWPORT_GUTTER = 8;
const MIN_MENU_HEIGHT = 120;

export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const right = Math.max(VIEWPORT_GUTTER, window.innerWidth - rect.right);
    const belowHeight = window.innerHeight - rect.bottom - MENU_OFFSET - VIEWPORT_GUTTER;
    const aboveHeight = rect.top - MENU_OFFSET - VIEWPORT_GUTTER;

    if (belowHeight < MIN_MENU_HEIGHT && aboveHeight > belowHeight) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + MENU_OFFSET,
        right,
        maxHeight: Math.max(MIN_MENU_HEIGHT, aboveHeight),
        transformOrigin: "bottom right",
      });
      return;
    }

    setMenuPosition({
      top: rect.bottom + MENU_OFFSET,
      right,
      maxHeight: Math.max(MIN_MENU_HEIGHT, belowHeight),
      transformOrigin: "top right",
    });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      updateMenuPosition();
    } else {
      setMenuPosition(null);
    }
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const popoverStyle: CSSProperties | undefined = menuPosition
    ? {
        top: menuPosition.top,
        bottom: menuPosition.bottom,
        right: menuPosition.right,
        maxHeight: menuPosition.maxHeight,
        transformOrigin: menuPosition.transformOrigin,
      }
    : undefined;

  return (
    <div className="action-menu" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        menuPosition &&
        createPortal(
          <div className="menu-popover" role="menu" ref={popoverRef} style={popoverStyle}>
            {items.map((item) => (
              <button
                type="button"
                role="menuitem"
                key={item.label}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
