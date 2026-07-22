import { Check, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiProtocol,
} from "../../services/tauriApi";
import styles from "./AiConnectionWizard.module.css";

const DEFAULT_CHAT_PATH: Record<AiProtocol, string> = {
  openAiCompatible: "/v1/chat/completions",
  ollama: "/api/chat",
};

interface AiConnectionWizardProps {
  mode: "configure" | "edit";
  initialConfig: AiConnectionConfig | null;
  onClose: () => void;
  onTest: (config: AiConnectionConfig) => Promise<AiConnectionTestResult>;
  onSave: (config: AiConnectionConfig) => Promise<void>;
}

type WizardStep = 1 | 2 | 3;

function createInitialConfig(config: AiConnectionConfig | null): AiConnectionConfig {
  return config ?? {
    endpointUrl: "",
    protocol: "openAiCompatible",
    chatPath: DEFAULT_CHAT_PATH.openAiCompatible,
    enabled: true,
  };
}

function validateConfiguration(config: AiConnectionConfig) {
  const endpoint = config.endpointUrl.trim();
  if (!endpoint) {
    return "Endpoint URL is required.";
  }

  try {
    const parsed = new URL(endpoint);
    if (!(["http:", "https:"] as string[]).includes(parsed.protocol) || !parsed.hostname) {
      return "Endpoint URL must be a valid http:// or https:// URL.";
    }
    if (parsed.username || parsed.password) {
      return "Endpoint URL cannot include authentication credentials.";
    }
    if (parsed.search || parsed.hash) {
      return "Endpoint URL cannot include a query string or fragment.";
    }
  } catch {
    return "Endpoint URL must be a valid http:// or https:// URL.";
  }

  const chatPath = config.chatPath.trim();
  if (!chatPath) {
    return "Chat path is required.";
  }
  if (chatPath.includes("?") || chatPath.includes("#")) {
    return "Chat path cannot include a query string or fragment.";
  }

  return null;
}

export function AiConnectionWizard({
  mode,
  initialConfig,
  onClose,
  onTest,
  onSave,
}: AiConnectionWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [config, setConfig] = useState(() => createInitialConfig(initialConfig));
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<"testing" | "saving" | null>(null);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !activity) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activity, onClose]);

  function updateConfig(patch: Partial<AiConnectionConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
    setTestResult(null);
    setError(null);
  }

  function selectProtocol(protocol: AiProtocol) {
    setConfig((current) => {
      const currentDefault = DEFAULT_CHAT_PATH[current.protocol];
      return {
        ...current,
        protocol,
        chatPath:
          current.chatPath === currentDefault ? DEFAULT_CHAT_PATH[protocol] : current.chatPath,
      };
    });
    setTestResult(null);
    setError(null);
  }

  function continueFromConfiguration(event: FormEvent) {
    event.preventDefault();
    const validationError = validateConfiguration(config);
    if (validationError) {
      setError(validationError);
      return;
    }

    setConfig((current) => ({
      ...current,
      endpointUrl: current.endpointUrl.trim().replace(/\/+$/, ""),
      chatPath: current.chatPath.trim().startsWith("/")
        ? current.chatPath.trim()
        : `/${current.chatPath.trim()}`,
    }));
    setError(null);
    setStep(2);
  }

  async function runTest() {
    setActivity("testing");
    setError(null);
    setTestResult(null);
    try {
      const result = await onTest(config);
      setTestResult(result);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : String(testError));
    } finally {
      setActivity(null);
    }
  }

  async function saveConnection() {
    setActivity("saving");
    setError(null);
    try {
      await onSave(config);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setActivity(null);
    }
  }

  const protocolLabel =
    config.protocol === "openAiCompatible" ? "OpenAI-compatible" : "Ollama";

  return (
    <div
      className="prompt-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!activity) {
          onClose();
        }
      }}
    >
      <div
        className={`${styles.dialog} prompt-dialog`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="ai-connection-title">
              {mode === "edit" ? "Edit AI Connection" : "Configure AI Connection"}
            </h2>
            <span>One unauthenticated endpoint</span>
          </div>
          <ol className={styles.steps} aria-label="Connection setup progress">
            {["Configure endpoint", "Test connection", "Save"].map((label, index) => {
              const itemStep = (index + 1) as WizardStep;
              return (
                <li
                  key={label}
                  className={itemStep === step ? styles.activeStep : itemStep < step ? styles.completeStep : ""}
                  aria-current={itemStep === step ? "step" : undefined}
                >
                  <span>{itemStep < step ? <Check size={12} /> : itemStep}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        </header>

        {step === 1 && (
          <form className={styles.content} onSubmit={continueFromConfiguration}>
            <label>
              <span>Endpoint URL</span>
              <input
                autoFocus
                type="url"
                value={config.endpointUrl}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => updateConfig({ endpointUrl: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>Protocol</span>
              <select
                value={config.protocol}
                onChange={(event) => selectProtocol(event.currentTarget.value as AiProtocol)}
              >
                <option value="openAiCompatible">OpenAI-compatible</option>
                <option value="ollama">Ollama</option>
              </select>
            </label>
            <label>
              <span>Chat path</span>
              <input
                value={config.chatPath}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => updateConfig({ chatPath: event.currentTarget.value })}
              />
            </label>
            {error && <span className="error-text">{error}</span>}
            <div className="prompt-actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <section className={styles.content}>
            <div className={styles.summary}>
              <span>{protocolLabel}</span>
              <code>{`${config.endpointUrl}${config.chatPath}`}</code>
            </div>
            <p className={styles.explanation}>
              BikAPI will contact this chat route through the desktop backend without credentials.
            </p>
            {testResult && (
              <div className={styles.testSuccess} role="status">
                <Check size={15} />
                <div>
                  <strong>Connection test passed</strong>
                  <span>
                    {testResult.message} {testResult.responseTimeMs} ms
                  </span>
                </div>
              </div>
            )}
            {error && <span className="error-text">{error}</span>}
            <div className="prompt-actions">
              <button type="button" disabled={Boolean(activity)} onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" disabled={Boolean(activity)} onClick={() => void runTest()}>
                {activity === "testing" && <LoaderCircle className={styles.spinner} size={14} />}
                {activity === "testing" ? "Testing" : testResult ? "Test again" : "Test connection"}
              </button>
              <button
                className="primary"
                type="button"
                disabled={!testResult || Boolean(activity)}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className={styles.content}>
            <div className={styles.saveSummary}>
              <div>
                <span>Endpoint URL</span>
                <code>{config.endpointUrl}</code>
              </div>
              <div>
                <span>Protocol</span>
                <strong>{protocolLabel}</strong>
              </div>
              <div>
                <span>Chat path</span>
                <code>{config.chatPath}</code>
              </div>
            </div>
            <p className={styles.explanation}>
              Saving replaces any previously configured AI connection.
            </p>
            {error && <span className="error-text">{error}</span>}
            <div className="prompt-actions">
              <button type="button" disabled={Boolean(activity)} onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="primary"
                type="button"
                disabled={Boolean(activity)}
                onClick={() => void saveConnection()}
              >
                {activity === "saving" && <LoaderCircle className={styles.spinner} size={14} />}
                {activity === "saving" ? "Saving" : "Save connection"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
