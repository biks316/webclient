import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { APP_THEMES } from "../../services/themeStore";
import styles from "./ThemePicker.module.css";

type FilterMode = "all" | "dark" | "light" | "bw" | "popular";

function modeLabel(mode: "dark" | "light" | "bw") {
  return mode === "bw" ? "B/W" : mode === "dark" ? "Dark" : "Light";
}

interface ThemePickerProps {
  open: boolean;
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
  onClose: () => void;
}

export function ThemePicker({ open, selectedThemeId, onSelect, onClose }: ThemePickerProps) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const visibleThemes = useMemo(() => {
    switch (filter) {
      case "dark":
        return APP_THEMES.filter((theme) => theme.mode === "dark");
      case "light":
        return APP_THEMES.filter((theme) => theme.mode === "light");
      case "bw":
        return APP_THEMES.filter((theme) => theme.mode === "bw");
      case "popular":
        return APP_THEMES.filter((theme) => theme.popular);
      default:
        return APP_THEMES;
    }
  }, [filter]);

  if (!open) {
    return null;
  }

  return (
    <div className="prompt-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Choose theme"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2>Choose Theme</h2>
            <p>Switch between dark, light, and high-contrast presets.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        <div className={styles.filters}>
          {(["all", "dark", "light", "bw", "popular"] as FilterMode[]).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? styles.filterActive : ""}
              onClick={() => setFilter(item)}
            >
              {item === "all" ? "All" : item === "popular" ? "Popular" : modeLabel(item)}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {visibleThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`${styles.card} ${selectedThemeId === theme.id ? styles.cardActive : ""}`}
              onClick={() => onSelect(theme.id)}
            >
              <div className={styles.cardTop}>
                <div>
                  <strong>{theme.name}</strong>
                  <span>{modeLabel(theme.mode)}</span>
                </div>
                {selectedThemeId === theme.id ? <Check size={14} /> : null}
              </div>
              <div className={styles.preview}>
                <span
                  style={{
                    background: theme.mode === "bw"
                      ? "linear-gradient(90deg, #000000 0 50%, #ffffff 50% 100%)"
                      : `linear-gradient(135deg, ${theme.accent}, rgba(255,255,255,0.12))`,
                  }}
                />
                <span className={styles.previewPanel} />
                <span className={styles.previewField} />
              </div>
              <div className={styles.meta}>
                <span className={styles.accent} style={{ backgroundColor: theme.accent }} />
                <span>{theme.mode === "bw" ? "High contrast" : theme.popular ? "Popular pick" : "Preset"}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
