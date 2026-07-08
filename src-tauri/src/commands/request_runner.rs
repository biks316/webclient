use crate::commands::workspace::{
    endpoint_dir, read_request, scan_workspace, timestamp, BikRequest, CommandResult,
};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
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
    pub globals: Option<HashMap<String, String>>,
    pub collection_variables: Option<HashMap<String, String>>,
    pub environment_variables: Option<HashMap<String, String>>,
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
    variables.extend(payload.globals.unwrap_or_else(|| workspace.globals.clone()));
    variables.extend(
        payload
            .collection_variables
            .unwrap_or_else(|| collection.variables.clone()),
    );

    if let Some(environment_variables) = payload.environment_variables {
        variables.extend(environment_variables);
    } else if let Some(environment_id) = payload.environment_id {
        if let Some(environment) = workspace
            .environments
            .iter()
            .find(|environment| environment.id == environment_id)
        {
            variables.extend(environment.variables.clone());
        }
    }

    variables.extend(request.variables.clone());

    let mut resolved = resolve_request(&request, &variables);
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

    let query_params: Vec<(&String, &String)> = resolved
        .query_params
        .iter()
        .filter(|(_, value)| !value.is_empty())
        .collect();
    if !query_params.is_empty() {
        builder = builder.query(&query_params);
    }

    if method_supports_body(&resolved.method) {
        apply_default_content_type(&mut resolved);
    }

    let headers = build_headers(&resolved.headers)?;
    builder = builder.headers(headers);

    if method_supports_body(&resolved.method) {
        builder = apply_request_body(builder, &resolved.body).await?;
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

async fn apply_request_body(
    mut builder: reqwest::RequestBuilder,
    body: &Value,
) -> CommandResult<reqwest::RequestBuilder> {
    match body_type(body) {
        "none" => Ok(builder),
        "json" => {
            let raw = body_raw(body);
            if raw.trim().is_empty() {
                return Ok(builder);
            }
            let _: Value =
                serde_json::from_str(raw).map_err(|error| format!("Invalid JSON body: {error}"))?;
            builder = builder.body(raw.to_string());
            Ok(builder)
        }
        "xml" | "text" => {
            let raw = body_raw(body);
            if raw.is_empty() {
                return Ok(builder);
            }
            builder = builder.body(raw.to_string());
            Ok(builder)
        }
        "graphql" => {
            let graphql = body
                .get("graphql")
                .and_then(Value::as_object)
                .ok_or_else(|| "Invalid GraphQL body".to_string())?;
            let query = graphql
                .get("query")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let variables_raw = graphql
                .get("variables")
                .and_then(Value::as_str)
                .unwrap_or("{}");
            let variables_value: Value = if variables_raw.trim().is_empty() {
                Value::Null
            } else {
                serde_json::from_str(variables_raw)
                    .map_err(|error| format!("Invalid GraphQL variables JSON: {error}"))?
            };
            builder = builder.body(
                json!({
                    "query": query,
                    "variables": variables_value,
                })
                .to_string(),
            );
            Ok(builder)
        }
        "form-urlencoded" => {
            let encoded = serde_urlencoded::to_string(form_pairs(body))
                .map_err(|error| format!("Failed to encode form body: {error}"))?;
            if encoded.is_empty() {
                return Ok(builder);
            }
            builder = builder.body(encoded);
            Ok(builder)
        }
        "multipart" => {
            let mut form = Form::new();
            if let Some(entries) = body.get("multipart").and_then(Value::as_array) {
                for entry in entries {
                    let Some(object) = entry.as_object() else { continue };
                    let enabled = object.get("enabled").and_then(Value::as_bool).unwrap_or(true);
                    let key = object.get("key").and_then(Value::as_str).unwrap_or("").trim();
                    if !enabled || key.is_empty() {
                        continue;
                    }
                    match object.get("kind").and_then(Value::as_str).unwrap_or("text") {
                        "file" => {
                            let Some(file) = object.get("file").and_then(Value::as_object) else { continue };
                            let path = file.get("path").and_then(Value::as_str).unwrap_or("").trim();
                            if path.is_empty() {
                                continue;
                            }
                            let bytes = fs::read(path)
                                .map_err(|error| format!("Failed to read multipart file {path}: {error}"))?;
                            let mut part = Part::bytes(bytes);
                            if let Some(name) = file.get("name").and_then(Value::as_str) {
                                part = part.file_name(name.to_string());
                            }
                            if let Some(mime_type) = file.get("mimeType").and_then(Value::as_str) {
                                if !mime_type.trim().is_empty() {
                                    part = part
                                        .mime_str(mime_type)
                                        .map_err(|error| format!("Invalid MIME type {mime_type}: {error}"))?;
                                }
                            }
                            form = form.part(key.to_string(), part);
                        }
                        _ => {
                            let value = object.get("value").and_then(Value::as_str).unwrap_or_default();
                            form = form.text(key.to_string(), value.to_string());
                        }
                    }
                }
            }
            builder = builder.multipart(form);
            Ok(builder)
        }
        "binary" => {
            let Some(file) = body.get("binary").and_then(Value::as_object) else {
                return Ok(builder);
            };
            let path = file.get("path").and_then(Value::as_str).unwrap_or("").trim();
            if path.is_empty() {
                return Ok(builder);
            }
            let bytes =
                fs::read(path).map_err(|error| format!("Failed to read binary file {path}: {error}"))?;
            builder = builder.body(bytes);
            Ok(builder)
        }
        _ => {
            if !body.is_null() {
                builder = builder.json(body);
            }
            Ok(builder)
        }
    }
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

fn apply_default_content_type(request: &mut BikRequest) {
    if has_header(&request.headers, "content-type") {
        return;
    }

    match body_type(&request.body) {
        "json" => {
            if !body_raw(&request.body).trim().is_empty() {
                request
                    .headers
                    .insert("Content-Type".to_string(), "application/json".to_string());
            }
        }
        "xml" => {
            request
                .headers
                .insert("Content-Type".to_string(), "application/xml".to_string());
        }
        "text" => {
            request
                .headers
                .insert("Content-Type".to_string(), "text/plain".to_string());
        }
        "form-urlencoded" => {
            request.headers.insert(
                "Content-Type".to_string(),
                "application/x-www-form-urlencoded".to_string(),
            );
        }
        "graphql" => {
            request
                .headers
                .insert("Content-Type".to_string(), "application/json".to_string());
        }
        "binary" => {
            let mime = request
                .body
                .get("binary")
                .and_then(Value::as_object)
                .and_then(|file| file.get("mimeType"))
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("application/octet-stream");
            request
                .headers
                .insert("Content-Type".to_string(), mime.to_string());
        }
        _ => {}
    }
}

fn has_header(headers: &HashMap<String, String>, name: &str) -> bool {
    headers.keys().any(|key| key.eq_ignore_ascii_case(name))
}

fn body_type(body: &Value) -> &str {
    body.get("type")
        .and_then(Value::as_str)
        .unwrap_or_else(|| if body.is_null() { "none" } else { "legacy-json" })
}

fn body_raw(body: &Value) -> &str {
    body.get("raw").and_then(Value::as_str).unwrap_or_default()
}

fn form_pairs(body: &Value) -> Vec<(String, String)> {
    body.get("form")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    let object = entry.as_object()?;
                    let enabled = object.get("enabled").and_then(Value::as_bool).unwrap_or(true);
                    let key = object.get("key").and_then(Value::as_str).unwrap_or("").trim();
                    if !enabled || key.is_empty() {
                        return None;
                    }
                    let value = object.get("value").and_then(Value::as_str).unwrap_or_default();
                    Some((key.to_string(), value.to_string()))
                })
                .collect()
        })
        .unwrap_or_default()
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
    let hybrid_resolved = resolve_hybrid_map_placeholders(input, variables);
    let mut output = String::new();
    let mut rest = hybrid_resolved.as_str();

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

fn resolve_hybrid_map_placeholders(input: &str, variables: &HashMap<String, String>) -> String {
    let mut output = String::new();
    let mut rest = input;
    const PREFIX: &str = "->map::{{";

    while let Some(start) = rest.find(PREFIX) {
        let (before, after_start) = rest.split_at(start);
        output.push_str(before);
        let after_prefix = &after_start[PREFIX.len()..];
        if let Some(end) = after_prefix.find("}}") {
            let key = after_prefix[..end].trim();
            output.push_str(variables.get(key).map(String::as_str).unwrap_or(""));
            rest = &after_prefix[end + 2..];
        } else {
            output.push_str(after_start);
            rest = "";
        }
    }

    output.push_str(rest);
    output
}
