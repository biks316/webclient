import { FilePlus, MoreHorizontal, Save, ScrollText } from "lucide-react";
import { useState } from "react";
import { ActionMenu } from "./ActionMenu";
import { KeyValueEditor } from "./KeyValueEditor";
import { CollectionAutomation, CollectionIndex } from "../types/bik";

export type CollectionPanelTab = "variables" | "scripts" | "tests";

interface CollectionPanelProps {
  collection: CollectionIndex;
  activeTab: CollectionPanelTab;
  automation: CollectionAutomation;
  isBusy: boolean;
  onCreateEndpoint: (collectionId: string) => void;
  onVariablesChange: (variables: Record<string, string>) => void;
  onAutomationChange: (automation: CollectionAutomation) => void;
  onSaveVariables: () => void;
  onSaveAutomation: () => void;
}

export function CollectionPanel({
  collection,
  activeTab,
  automation,
  isBusy,
  onCreateEndpoint,
  onVariablesChange,
  onAutomationChange,
  onSaveVariables,
  onSaveAutomation,
}: CollectionPanelProps) {
  const [showVariablesDialog, setShowVariablesDialog] = useState(false);

  function updateAutomation(patch: Partial<CollectionAutomation>) {
    onAutomationChange({ ...automation, ...patch });
  }

  return (
    <main className="collection-panel">
      <div className="collection-panel-toolbar">
        <div>
          <span>Collection</span>
          <strong>{collection.name}</strong>
        </div>
        <button type="button" className="primary" onClick={() => onCreateEndpoint(collection.id)}>
          <FilePlus size={16} />
          New request
        </button>
      </div>

      {activeTab === "variables" && (
        <section className="collection-section">
          <div className="section-heading">
            <h2>Collection Variables</h2>
            <ActionMenu
              label="Collection variables"
              items={[
                {
                  label: "Edit variables",
                  icon: <MoreHorizontal size={14} />,
                  onSelect: () => setShowVariablesDialog(true),
                },
                {
                  label: "Save variables",
                  icon: <Save size={14} />,
                  disabled: isBusy,
                  onSelect: onSaveVariables,
                },
              ]}
            />
          </div>
          <div className="collection-hint">
            Variables are hidden by default. Open them from the `...` menu only when needed.
          </div>
        </section>
      )}

      {activeTab === "scripts" && (
        <section className="collection-section">
          <div className="section-heading">
            <h2>Scripts</h2>
            <button type="button" onClick={onSaveAutomation} disabled={isBusy}>
              <ScrollText size={14} />
              Save scripts
            </button>
          </div>
          <div className="script-grid">
            <label>
              pre.js
              <textarea
                spellCheck={false}
                value={automation.pre}
                onChange={(event) => updateAutomation({ pre: event.target.value })}
              />
            </label>
            <label>
              post.js
              <textarea
                spellCheck={false}
                value={automation.post}
                onChange={(event) => updateAutomation({ post: event.target.value })}
              />
            </label>
          </div>
        </section>
      )}

      {activeTab === "tests" && (
        <section className="collection-section">
          <div className="section-heading">
            <h2>Tests</h2>
            <button type="button" onClick={onSaveAutomation} disabled={isBusy}>
              <ScrollText size={14} />
              Save tests
            </button>
          </div>
          <div className="test-grid">
            <label>
              test.js
              <textarea
                spellCheck={false}
                value={automation.test}
                onChange={(event) => updateAutomation({ test: event.target.value })}
              />
            </label>
            <label>
              assert.js
              <textarea
                spellCheck={false}
                value={automation.assert}
                onChange={(event) => updateAutomation({ assert: event.target.value })}
              />
            </label>
          </div>
        </section>
      )}

      {showVariablesDialog && (
        <div className="prompt-backdrop" role="presentation">
          <div className="prompt-dialog variable-dialog">
            <div className="variable-scope">
              <div className="section-heading">
                <h3>Collection Variables</h3>
                <div className="inline-actions">
                  <button type="button" onClick={() => setShowVariablesDialog(false)}>
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveVariables();
                      setShowVariablesDialog(false);
                    }}
                    disabled={isBusy}
                  >
                    <Save size={14} />
                    Save variables
                  </button>
                </div>
              </div>
              <KeyValueEditor
                values={collection.variables}
                keyPlaceholder="tenantId"
                valuePlaceholder="acme"
                onChange={onVariablesChange}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
