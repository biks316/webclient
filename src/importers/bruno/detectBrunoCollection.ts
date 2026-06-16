export function detectBrunoCollection(files: Array<{ path: string; content: string }>) {
  return files.some((file) => file.path.endsWith("bruno.json") || file.path.endsWith(".bru"));
}
