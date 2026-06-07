use crate::commands::workspace::{
    endpoint_dir, read_request, scan_workspace, timestamp, BikRequest, CommandResult,
};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequestPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub endpoint_id: String,
    pub environment_id: Option<String>,
    pub request: Option<BikRequest>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub response_time_ms: u128,
    pub sent_at: String,
    pub resolved_url: String,
}

#[tauri::command]
pub async fn send_request(payload: SendRequestPayload) -> CommandResult<RunResponse> {
    let root = PathBuf::from(&payload.workspace_path);
    let workspace = scan_workspace(&root)?;
    let request = match payload.request {
        Some(request) => request,
        None => read_request(
            &endpoint_dir(&root, &payload.collection_id, &payload.endpoint_id).join("request.bik"),
        )?,
    };

    let collection = workspace
        .collections
        .iter()
        .find(|collection| collection.id == payload.collection_id)
        .ok_or_else(|| "Collection not found".to_string())?;

    let mut variables = HashMap::new();
    variables.extend(workspace.globals.clone());

    if let Some(environment_id) = payload.environment_id {
        if let Some(environment) = workspace
            .environments
            .iter()
            .find(|environment| environment.id == environment_id)
        {
            variables.extend(environment.variables.clone());
        }
    }

    variables.extend(collection.variables.clone());
    variables.extend(request.variables.clone());

    let resolved = resolve_request(&request, &variables);
    if !resolved.url.starts_with("http://") && !resolved.url.starts_with("https://") {
        return Err(format!(
            "Resolved URL must start with http:// or https://. Current value resolved to '{}'.",
            resolved.url
        ));
    }

    let client = reqwest::Client::new();
    let mut builder = client.request(
        resolved
            .method
            .parse()
            .map_err(|error| format!("Invalid method: {error}"))?,
        &resolved.url,
    );

    let headers = build_headers(&resolved.headers)?;
    builder = builder.headers(headers);

    let query_params: Vec<(&String, &String)> = resolved
        .query_params
        .iter()
        .filter(|(_, value)| !value.is_empty())
        .collect();
    if !query_params.is_empty() {
        builder = builder.query(&query_params);
    }

    if method_supports_body(&resolved.method) && !resolved.body.is_null() {
        builder = builder.json(&resolved.body);
    }

    let start = Instant::now();
    let response = builder
        .send()
        .await
        .map_err(|error| format!("Request failed: {error}"))?;
    let response_time_ms = start.elapsed().as_millis();

    let status = response.status();
    let mut response_headers = HashMap::new();
    for (key, value) in response.headers() {
        response_headers.insert(
            key.to_string(),
            value.to_str().unwrap_or("<non-utf8>").to_string(),
        );
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {error}"))?;

    Ok(RunResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        headers: response_headers,
        body,
        response_time_ms,
        sent_at: timestamp(),
        resolved_url: resolved.url,
    })
}

fn method_supports_body(method: &str) -> bool {
    !matches!(method.to_ascii_uppercase().as_str(), "GET" | "HEAD")
}

fn build_headers(headers: &HashMap<String, String>) -> CommandResult<HeaderMap> {
    let mut map = HeaderMap::new();
    for (key, value) in headers {
        if key.trim().is_empty() || value.is_empty() {
            continue;
        }
        map.insert(
            HeaderName::from_bytes(key.as_bytes())
                .map_err(|error| format!("Invalid header name {key}: {error}"))?,
            HeaderValue::from_str(value)
                .map_err(|error| format!("Invalid header value for {key}: {error}"))?,
        );
    }
    Ok(map)
}

fn resolve_request(request: &BikRequest, variables: &HashMap<String, String>) -> BikRequest {
    let mut resolved = request.clone();
    resolved.url = resolve_string(&resolved.url, variables);
    resolved.headers = resolved
        .headers
        .iter()
        .map(|(key, value)| (key.clone(), resolve_string(value, variables)))
        .collect();
    resolved.query_params = resolved
        .query_params
        .iter()
        .map(|(key, value)| (key.clone(), resolve_string(value, variables)))
        .collect();
    resolved.body = resolve_value(&resolved.body, variables);
    resolved
}

fn resolve_value(value: &Value, variables: &HashMap<String, String>) -> Value {
    match value {
        Value::String(value) => Value::String(resolve_string(value, variables)),
        Value::Array(values) => Value::Array(
            values
                .iter()
                .map(|value| resolve_value(value, variables))
                .collect(),
        ),
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, value)| (key.clone(), resolve_value(value, variables)))
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn resolve_string(input: &str, variables: &HashMap<String, String>) -> String {
    let mut output = String::new();
    let mut rest = input;

    while let Some(start) = rest.find("{{") {
        let (before, after_start) = rest.split_at(start);
        output.push_str(before);
        let after_start = &after_start[2..];
        if let Some(end) = after_start.find("}}") {
            let key = after_start[..end].trim();
            output.push_str(variables.get(key).map(String::as_str).unwrap_or(""));
            rest = &after_start[end + 2..];
        } else {
            output.push_str("{{");
            output.push_str(after_start);
            rest = "";
        }
    }

    output.push_str(rest);
    output
}
