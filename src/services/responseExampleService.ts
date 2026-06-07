import { EndpointIndex, JsonValue, RunResponse } from "../types/bik";
import * as api from "./tauriApi";

interface ExampleFile {
  response?: RunResponse;
}

export async function readLatestSuccessfulResponseExample(endpoint: EndpointIndex): Promise<RunResponse | null> {
  for (const example of endpoint.examples) {
    try {
      const value = (await api.readHistoryEntry(example.path)) as JsonValue;
      const response = (value as ExampleFile).response;
      if (response && response.status >= 200 && response.status < 400) {
        return response;
      }
    } catch {
      continue;
    }
  }

  return null;
}
