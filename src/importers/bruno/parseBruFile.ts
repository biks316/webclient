export interface BruSection {
  name: string;
  body: string;
}

export interface BruFile {
  sections: BruSection[];
  unknownSections: BruSection[];
}

const KNOWN = new Set(["meta", "get", "post", "put", "patch", "delete", "head", "options", "headers", "params", "body", "auth", "vars", "script:pre-request", "script:post-response", "tests", "assertions"]);

export function parseBruFile(content: string): BruFile {
  const sections: BruSection[] = [];
  const pattern = /^([a-zA-Z0-9:_-]+)\s*\{\s*$/gm;
  const matches = [...content.matchAll(pattern)];
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? content.length : content.length;
    const raw = content.slice(start, end);
    const close = raw.lastIndexOf("}");
    sections.push({ name: match[1].toLowerCase(), body: (close >= 0 ? raw.slice(0, close) : raw).trim() });
  });
  return {
    sections,
    unknownSections: sections.filter((section) => !KNOWN.has(section.name)),
  };
}

export function parseKeyValues(body: string) {
  const values: Record<string, string> = {};
  body.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("~")) {
      return;
    }
    const separator = trimmed.includes(":") ? ":" : "=";
    const index = trimmed.indexOf(separator);
    if (index > 0) {
      values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    }
  });
  return values;
}
