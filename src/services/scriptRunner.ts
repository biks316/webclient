import { BikRequest, RunResponse } from "../types/bik";

type ScriptPhase = "pre" | "post";
type ScriptLogLevel = "log" | "info" | "warn" | "error";

interface ScriptRunOptions {
  name: string;
  phase: ScriptPhase;
  script: string;
  helpers?: string;
  request: BikRequest;
  response?: RunResponse;
  variables: Record<string, string>;
  onLog?: (message: string, level: ScriptLogLevel) => void;
}

interface ScriptRuntime {
  request: BikRequest;
  response: RunResponse | null;
  variables: Record<string, string>;
  console: Record<ScriptLogLevel, (...items: unknown[]) => void>;
  set: (name: string, value: unknown) => void;
  get: (name: string) => string | undefined;
  setVariable: (name: string, value: unknown) => void;
  getVariable: (name: string) => string | undefined;
  setHeader: (name: string, value: unknown) => void;
  removeHeader: (name: string) => void;
  setQueryParam: (name: string, value: unknown) => void;
  removeQueryParam: (name: string) => void;
  setMethod: (method: string) => void;
  setUrl: (url: string) => void;
  setBody: (body: unknown) => void;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

function stringifyLogItem(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }

  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function toScriptValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function scriptErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const stackLine = error.stack?.split("\n").find((line) => line.includes("<anonymous>:"));
  const match = stackLine?.match(/<anonymous>:(\d+):\d+/);
  if (!match) {
    return error.message;
  }

  const line = Math.max(Number(match[1]) - 2, 1);
  return `Line ${line}: ${error.name}: ${error.message}`;
}

function createScriptRuntime({
  request,
  response,
  variables,
  onLog,
}: Pick<ScriptRunOptions, "request" | "response" | "variables" | "onLog">): ScriptRuntime {
  const log = (level: ScriptLogLevel) => (...items: unknown[]) => {
    onLog?.(items.map(stringifyLogItem).join(" "), level);
  };
  const setVariable = (name: string, value: unknown) => {
    variables[name] = toScriptValue(value);
    request.variables[name] = toScriptValue(value);
  };
  const getVariable = (name: string) => variables[name];

  return {
    request,
    response: response ?? null,
    variables,
    console: {
      log: log("log"),
      info: log("info"),
      warn: log("warn"),
      error: log("error"),
    },
    set: setVariable,
    get: getVariable,
    setVariable,
    getVariable,
    setHeader: (name, value) => {
      request.headers[name] = toScriptValue(value);
    },
    removeHeader: (name) => {
      delete request.headers[name];
    },
    setQueryParam: (name, value) => {
      request.queryParams[name] = toScriptValue(value);
    },
    removeQueryParam: (name) => {
      delete request.queryParams[name];
    },
    setMethod: (method) => {
      request.method = method.toUpperCase();
    },
    setUrl: (url) => {
      request.url = url;
    },
    setBody: (body) => {
      request.body = body as BikRequest["body"];
    },
  };
}

export async function runRequestScript(options: ScriptRunOptions): Promise<void> {
  const source = [options.helpers, options.script].filter((script) => script?.trim()).join("\n\n");
  if (!source.trim()) {
    return;
  }

  const runtime = createScriptRuntime(options);
  const execute = new AsyncFunction(
    "bik",
    "request",
    "response",
    "variables",
    "console",
    "ctx",
    `"use strict";\n${source}`,
  );

  try {
    await execute(runtime, runtime.request, runtime.response, runtime.variables, runtime.console, runtime);
  } catch (error) {
    throw new Error(`${options.name} ${options.phase}.js failed: ${scriptErrorMessage(error)}`);
  }
}
