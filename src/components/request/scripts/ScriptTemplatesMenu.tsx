import { useState } from "react";

interface TemplateItem {
  label: string;
  snippet: string;
}

interface ScriptTemplatesMenuProps {
  onInsert: (snippet: string) => void;
}

const TEMPLATES: TemplateItem[] = [
  {
    label: "Generate UUID",
    snippet: 'ctx.set("id", crypto.randomUUID());',
  },
  {
    label: "Set Timestamp",
    snippet: 'ctx.set("timestamp", new Date().toISOString());',
  },
  {
    label: "Set Variable",
    snippet: 'ctx.set("token", "value");',
  },
  {
    label: "Read Variable",
    snippet: 'const token = ctx.get("token");',
  },
  {
    label: "Generate Random Number",
    snippet: 'ctx.set("randomNumber", Math.floor(Math.random() * 1000000));',
  },
  {
    label: "Generate Future Date",
    snippet: 'ctx.set("futureDate", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());',
  },
  {
    label: "Generate Correlation Id",
    snippet: 'ctx.set("correlationId", crypto.randomUUID());',
  },
];

export function ScriptTemplatesMenu({ onInsert }: ScriptTemplatesMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="script-template-menu">
      <button type="button" onClick={() => setOpen((current) => !current)}>
        Templates ▾
      </button>
      {open && (
        <div className="script-template-popover">
          {TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => {
                onInsert(template.snippet);
                setOpen(false);
              }}
            >
              {template.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
