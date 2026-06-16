import { ImportReport, ImportResult } from "./ImportResult";

export function createImportReport(result: ImportResult): ImportReport {
  const folders = new Set<string>();
  let requests = 0;
  let variables = 0;
  result.collections.forEach((collection) => {
    variables += Object.keys(collection.variables).length;
    requests += collection.requests.length;
    collection.requests.forEach((request) => {
      request.folderPath.forEach((_, index) => folders.add(request.folderPath.slice(0, index + 1).join("/")));
    });
  });
  result.environments.forEach((environment) => {
    variables += Object.keys(environment.variables).length;
  });
  return {
    importedAt: new Date().toISOString(),
    sourceType: result.sourceType,
    collections: result.collections.length,
    folders: folders.size,
    requests,
    variables,
    warnings: result.warnings,
  };
}
