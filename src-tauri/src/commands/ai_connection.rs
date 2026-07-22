use crate::commands::file_store::app_config_dir;
use crate::commands::workspace::{read_json, write_json, CommandResult};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

const AI_CONNECTION_FILE: &str = "ai-connection.bik";
const AI_CONNECTION_INITIALIZED_FILE: &str = "ai-connection-initialized.bik";
const DEFAULT_ENDPOINT_URL: &str = "http://192.168.1.4:11434";
const DEFAULT_CHAT_PATH: &str = "/v1/chat/completions";
const DEFAULT_AI_MODEL: &str = "gemma3:1b";

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub enum AiProtocol {
    #[serde(rename = "openAiCompatible")]
    OpenAiCompatible,
    #[serde(rename = "ollama")]
    Ollama,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionConfig {
    pub endpoint_url: String,
    pub protocol: AiProtocol,
    pub chat_path: String,
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetAiConnectionEnabledPayload {
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestResult {
    pub url: String,
    pub status_code: u16,
    pub response_time_ms: u128,
    pub message: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendAiChatPayload {
    pub messages: Vec<AiChatMessage>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResult {
    pub content: String,
}

#[tauri::command]
pub fn read_ai_connection() -> CommandResult<Option<AiConnectionConfig>> {
    let path = ai_connection_path()?;
    let config_exists = path.exists();
    let initialized = ai_connection_initialized_path()?.exists();
    if should_initialize_default(config_exists, initialized) {
        let config = default_ai_connection();
        return save_ai_connection(config).map(Some);
    }
    if !config_exists {
        return Ok(None);
    }

    let value = read_json(&path)?;
    let config: AiConnectionConfig =
        serde_json::from_value(value).map_err(|error| error.to_string())?;
    let config = normalize_config(config)?;
    if is_previous_development_default(&config) {
        let mut migrated = default_ai_connection();
        migrated.enabled = config.enabled;
        return save_ai_connection(migrated).map(Some);
    }
    ensure_ai_connection_initialized()?;
    Ok(Some(config))
}

#[tauri::command]
pub fn save_ai_connection(payload: AiConnectionConfig) -> CommandResult<AiConnectionConfig> {
    let config = normalize_config(payload)?;
    let path = ai_connection_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    write_json(&path, &config)?;
    ensure_ai_connection_initialized()?;
    Ok(config)
}

#[tauri::command]
pub fn set_ai_connection_enabled(
    payload: SetAiConnectionEnabledPayload,
) -> CommandResult<AiConnectionConfig> {
    let mut config =
        read_ai_connection()?.ok_or_else(|| "No AI connection is configured.".to_string())?;
    config.enabled = payload.enabled;
    save_ai_connection(config)
}

#[tauri::command]
pub fn remove_ai_connection() -> CommandResult<()> {
    let path = ai_connection_path()?;
    ensure_ai_connection_initialized()?;
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|error| format!("Failed to remove {}: {error}", path.display()))
}

#[tauri::command]
pub async fn test_ai_connection(
    payload: AiConnectionConfig,
) -> CommandResult<AiConnectionTestResult> {
    let config = normalize_config(payload)?;
    let url = connection_url(&config)?;
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("Could not create the AI connection client: {error}"))?;

    let messages = vec![AiChatMessage {
        role: "user".to_string(),
        content: "Reply with OK.".to_string(),
    }];
    let body = chat_request_body(&config.protocol, &messages, true);
    let started = Instant::now();
    let response = client
        .post(url.clone())
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Could not reach {url}: {error}"))?;
    let response_time_ms = started.elapsed().as_millis();
    let status = response.status();
    let response_body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read the AI endpoint response: {error}"))?;
    ensure_successful_response(status.as_u16(), &response_body)?;
    let response_json: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|error| format!("The AI endpoint returned invalid JSON: {error}"))?;
    extract_chat_content(&config.protocol, &response_json)?;

    Ok(AiConnectionTestResult {
        url: url.to_string(),
        status_code: status.as_u16(),
        response_time_ms,
        message: format!(
            "Reached the configured chat endpoint (HTTP {}).",
            status.as_u16()
        ),
    })
}

#[tauri::command]
pub async fn send_ai_chat(payload: SendAiChatPayload) -> CommandResult<AiChatResult> {
    let config = read_ai_connection()?.ok_or_else(|| "Connection unavailable".to_string())?;
    if !config.enabled {
        return Err("Connection unavailable".to_string());
    }
    if payload.messages.is_empty() {
        return Err("At least one chat message is required.".to_string());
    }
    validate_chat_messages(&payload.messages)?;

    let url = connection_url(&config)?;
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Could not create the AI connection client: {error}"))?;
    let response = client
        .post(url)
        .json(&chat_request_body(
            &config.protocol,
            &payload.messages,
            false,
        ))
        .send()
        .await
        .map_err(|_| "Connection unavailable".to_string())?;
    let status = response.status().as_u16();
    let response_body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read the AI endpoint response: {error}"))?;
    ensure_successful_response(status, &response_body)?;
    let response_json: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|error| format!("The AI endpoint returned invalid JSON: {error}"))?;
    let content = extract_chat_content(&config.protocol, &response_json)?;

    Ok(AiChatResult { content })
}

fn chat_request_body(
    protocol: &AiProtocol,
    messages: &[AiChatMessage],
    connection_test: bool,
) -> serde_json::Value {
    let mut body = match protocol {
        AiProtocol::OpenAiCompatible => json!({
            "model": DEFAULT_AI_MODEL,
            "messages": messages,
            "stream": false,
        }),
        AiProtocol::Ollama => json!({
            "model": DEFAULT_AI_MODEL,
            "messages": messages,
            "stream": false,
        }),
    };
    if connection_test {
        match protocol {
            AiProtocol::OpenAiCompatible => body["max_tokens"] = json!(4),
            AiProtocol::Ollama => body["options"] = json!({ "num_predict": 4 }),
        }
    }
    body
}

fn validate_chat_messages(messages: &[AiChatMessage]) -> CommandResult<()> {
    for message in messages {
        if !matches!(message.role.as_str(), "system" | "user" | "assistant") {
            return Err(format!("Unsupported AI chat role: {}", message.role));
        }
        if message.content.trim().is_empty() {
            return Err("AI chat messages cannot be empty.".to_string());
        }
    }
    Ok(())
}

fn ensure_successful_response(status: u16, response_body: &str) -> CommandResult<()> {
    if (200..300).contains(&status) {
        return Ok(());
    }

    let detail = response_body.trim();
    let detail = if detail.is_empty() {
        String::new()
    } else {
        format!(" {}", detail.chars().take(240).collect::<String>())
    };
    Err(format!("The AI endpoint returned HTTP {status}.{detail}"))
}

fn extract_chat_content(
    protocol: &AiProtocol,
    response: &serde_json::Value,
) -> CommandResult<String> {
    let content = match protocol {
        AiProtocol::OpenAiCompatible => response
            .get("choices")
            .and_then(serde_json::Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(serde_json::Value::as_str),
        AiProtocol::Ollama => response
            .get("message")
            .and_then(|message| message.get("content"))
            .and_then(serde_json::Value::as_str),
    }
    .map(str::trim)
    .filter(|content| !content.is_empty())
    .ok_or_else(|| "The AI endpoint response did not include assistant content.".to_string())?;

    Ok(content.to_string())
}

fn normalize_config(mut config: AiConnectionConfig) -> CommandResult<AiConnectionConfig> {
    config.endpoint_url = config.endpoint_url.trim().trim_end_matches('/').to_string();
    config.chat_path = config.chat_path.trim().to_string();

    if config.endpoint_url.is_empty() {
        return Err("Endpoint URL is required.".to_string());
    }
    let endpoint = Url::parse(&config.endpoint_url)
        .map_err(|error| format!("Endpoint URL is invalid: {error}"))?;
    if !matches!(endpoint.scheme(), "http" | "https") || endpoint.host_str().is_none() {
        return Err("Endpoint URL must be a valid http:// or https:// URL.".to_string());
    }
    if !endpoint.username().is_empty() || endpoint.password().is_some() {
        return Err("Endpoint URL cannot include authentication credentials.".to_string());
    }
    if endpoint.query().is_some() || endpoint.fragment().is_some() {
        return Err("Endpoint URL cannot include a query string or fragment.".to_string());
    }

    if config.chat_path.is_empty() {
        return Err("Chat path is required.".to_string());
    }
    if !config.chat_path.starts_with('/') {
        config.chat_path.insert(0, '/');
    }
    if config.chat_path.contains('?') || config.chat_path.contains('#') {
        return Err("Chat path cannot include a query string or fragment.".to_string());
    }

    connection_url(&config)?;
    Ok(config)
}

fn connection_url(config: &AiConnectionConfig) -> CommandResult<Url> {
    let combined = format!(
        "{}{}",
        config.endpoint_url.trim_end_matches('/'),
        config.chat_path
    );
    Url::parse(&combined).map_err(|error| format!("Combined AI endpoint URL is invalid: {error}"))
}

fn ai_connection_path() -> CommandResult<PathBuf> {
    Ok(app_config_dir()?.join(AI_CONNECTION_FILE))
}

fn ai_connection_initialized_path() -> CommandResult<PathBuf> {
    Ok(app_config_dir()?.join(AI_CONNECTION_INITIALIZED_FILE))
}

fn ensure_ai_connection_initialized() -> CommandResult<()> {
    let path = ai_connection_initialized_path()?;
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    write_json(&path, &json!({ "initialized": true }))
}

fn default_ai_connection() -> AiConnectionConfig {
    AiConnectionConfig {
        endpoint_url: DEFAULT_ENDPOINT_URL.to_string(),
        protocol: AiProtocol::OpenAiCompatible,
        chat_path: DEFAULT_CHAT_PATH.to_string(),
        enabled: true,
    }
}

fn is_previous_development_default(config: &AiConnectionConfig) -> bool {
    config.endpoint_url == DEFAULT_ENDPOINT_URL
        && config.protocol == AiProtocol::Ollama
        && config.chat_path == "/api/chat"
}

fn should_initialize_default(config_exists: bool, initialized: bool) -> bool {
    !config_exists && !initialized
}

fn enabled_by_default() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(endpoint_url: &str, chat_path: &str) -> AiConnectionConfig {
        AiConnectionConfig {
            endpoint_url: endpoint_url.to_string(),
            protocol: AiProtocol::OpenAiCompatible,
            chat_path: chat_path.to_string(),
            enabled: true,
        }
    }

    #[test]
    fn normalizes_endpoint_and_chat_path() {
        let normalized =
            normalize_config(config(" http://localhost:1234/ ", "v1/chat/completions"))
                .expect("configuration should be valid");

        assert_eq!(normalized.endpoint_url, "http://localhost:1234");
        assert_eq!(normalized.chat_path, "/v1/chat/completions");
        assert_eq!(
            connection_url(&normalized)
                .expect("URL should join")
                .as_str(),
            "http://localhost:1234/v1/chat/completions"
        );
    }

    #[test]
    fn preserves_endpoint_base_paths() {
        let normalized = normalize_config(config("http://192.168.1.20:8080/ai", "/chat"))
            .expect("configuration should be valid");

        assert_eq!(
            connection_url(&normalized)
                .expect("URL should join")
                .as_str(),
            "http://192.168.1.20:8080/ai/chat"
        );
    }

    #[test]
    fn rejects_credentials_and_non_http_urls() {
        assert!(normalize_config(config("file:///tmp/model", "/chat")).is_err());
        assert!(normalize_config(config("http://user:pass@localhost:11434", "/api/chat")).is_err());
    }

    #[test]
    fn rejects_query_data_outside_the_configured_path() {
        assert!(
            normalize_config(config("http://localhost:11434?token=value", "/api/chat")).is_err()
        );
        assert!(
            normalize_config(config("http://localhost:11434", "/api/chat?debug=true")).is_err()
        );
    }

    #[test]
    fn development_default_matches_the_local_network_configuration() {
        assert_eq!(
            default_ai_connection(),
            AiConnectionConfig {
                endpoint_url: "http://192.168.1.4:11434".to_string(),
                protocol: AiProtocol::OpenAiCompatible,
                chat_path: "/v1/chat/completions".to_string(),
                enabled: true,
            }
        );
    }

    #[test]
    fn default_is_created_only_before_the_connection_has_been_initialized() {
        assert!(should_initialize_default(false, false));
        assert!(!should_initialize_default(true, false));
        assert!(!should_initialize_default(false, true));
        assert!(!should_initialize_default(true, true));
    }

    #[test]
    fn builds_non_streaming_requests_with_the_fixed_development_model() {
        let messages = vec![AiChatMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }];
        let body = chat_request_body(&AiProtocol::OpenAiCompatible, &messages, false);

        assert_eq!(
            body.get("model").and_then(|value| value.as_str()),
            Some("gemma3:1b")
        );
        assert_eq!(
            body.get("stream").and_then(|value| value.as_bool()),
            Some(false)
        );
        assert!(body
            .get("messages")
            .and_then(|value| value.as_array())
            .is_some());
    }

    #[test]
    fn extracts_supported_protocol_responses() {
        let open_ai = json!({
            "choices": [{ "message": { "role": "assistant", "content": " Hello " } }]
        });
        let ollama = json!({
            "message": { "role": "assistant", "content": "Hi" }
        });

        assert_eq!(
            extract_chat_content(&AiProtocol::OpenAiCompatible, &open_ai).unwrap(),
            "Hello"
        );
        assert_eq!(
            extract_chat_content(&AiProtocol::Ollama, &ollama).unwrap(),
            "Hi"
        );
    }

    #[test]
    fn recognizes_only_the_previous_generated_default_for_migration() {
        let mut previous = config("http://192.168.1.4:11434", "/api/chat");
        previous.protocol = AiProtocol::Ollama;
        assert!(is_previous_development_default(&previous));

        previous.endpoint_url = "http://localhost:11434".to_string();
        assert!(!is_previous_development_default(&previous));
    }
}
