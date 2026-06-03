interface KeyValueEditorProps {
  values: Record<string, string>;
  keyPlaceholder: string;
  valuePlaceholder: string;
  onChange: (values: Record<string, string>) => void;
}

export function KeyValueEditor({
  values,
  keyPlaceholder,
  valuePlaceholder,
  onChange,
}: KeyValueEditorProps) {
  const rows = Object.entries(values);

  function replaceKey(oldKey: string, nextKey: string) {
    const next = { ...values };
    const value = next[oldKey] ?? "";
    delete next[oldKey];
    if (nextKey.trim()) {
      next[nextKey] = value;
    }
    onChange(next);
  }

  function replaceValue(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  function addRow() {
    let key = "key";
    let index = 2;
    while (Object.prototype.hasOwnProperty.call(values, key)) {
      key = `key${index}`;
      index += 1;
    }
    onChange({ ...values, [key]: "" });
  }

  function removeRow(key: string) {
    const next = { ...values };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="kv-editor">
      {rows.map(([key, value]) => (
        <div className="kv-row" key={key}>
          <input
            value={key}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={keyPlaceholder}
            onChange={(event) => replaceKey(key, event.target.value)}
          />
          <input
            value={value}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={valuePlaceholder}
            onChange={(event) => replaceValue(key, event.target.value)}
          />
          <button type="button" title="Remove" onClick={() => removeRow(key)}>
            x
          </button>
        </div>
      ))}
      <button type="button" className="subtle" onClick={addRow}>
        Add row
      </button>
    </div>
  );
}
