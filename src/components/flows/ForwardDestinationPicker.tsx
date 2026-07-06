import { ForwardTargetLocation } from "./forwarding";
import styles from "./FlowBuilder.module.css";

interface ForwardDestinationPickerProps {
  destination: ForwardTargetLocation;
  sourceLabel: string;
  supportedFields: string[];
  destinationLabel: string;
  showCustom: boolean;
  customKey: string;
  onSelectField: (key: string) => void;
  onShowCustom: () => void;
  onCustomKeyChange: (value: string) => void;
}

export function ForwardDestinationPicker({
  destination,
  sourceLabel,
  supportedFields,
  destinationLabel,
  showCustom,
  customKey,
  onSelectField,
  onShowCustom,
  onCustomKeyChange,
}: ForwardDestinationPickerProps) {
  return (
    <>
      <div className={styles.forwardPopoverHint}>
        <strong>Forward "{sourceLabel}" to {destinationLabel}</strong>
        <span>Click a field to create the rule.</span>
      </div>

      {destination === "auth" ? (
        <button
          type="button"
          className={styles.forwardFieldChoice}
          onClick={() => onSelectField("Authorization")}
        >
          Authorization
        </button>
      ) : (
        <>
          {supportedFields.length > 0 ? (
            <div className={styles.forwardFieldChoices}>
              {supportedFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  className={styles.forwardFieldChoice}
                  onClick={() => onSelectField(field)}
                >
                  <span>{field}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.forwardEmptyHint}>No fields yet.</p>
          )}

          {!showCustom ? (
            <button
              type="button"
              className={styles.forwardNewField}
              onClick={onShowCustom}
            >
              + New {destinationLabel}
            </button>
          ) : (
            <div className={styles.forwardCustomRow}>
              <input
                autoFocus
                value={customKey}
                placeholder={`${destinationLabel} name`}
                onChange={(event) => onCustomKeyChange(event.currentTarget.value)}
              />
              <button
                type="button"
                className="primary"
                disabled={!customKey.trim()}
                onClick={() => onSelectField(customKey.trim())}
              >
                Add
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
