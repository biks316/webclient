use crate::commands::workspace::{
    endpoint_dir, filename_timestamp, read_json, timestamp, write_json, CommandResult, BIK_VERSION,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub endpoint_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionPayload {
    pub workspace_path: String,
    pub collection_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveScriptPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub endpoint_id: String,
    pub script_name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCollectionAutomationPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub script_name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveExamplePayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub endpoint_id: String,
    pub label: Option<String>,
    pub request: Value,
    pub response: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scripts {
    pub pre: String,
    pub post: String,
    pub helpers: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionAutomation {
    pub pre: String,
    pub post: String,
    pub test: String,
    pub assert: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelVisibility {
    pub sidebar: bool,
    pub timeline: bool,
    pub console: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub workspace_path: Option<String>,
    pub collection_id: Option<String>,
    pub endpoint_id: Option<String>,
    pub panel_visibility: PanelVisibility,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspace {
    pub name: String,
    pub path: String,
    pub last_opened_at: String,
    pub sync_type: String,
    pub remote_url: Option<String>,
    #[serde(default, skip_serializing)]
    pub missing: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspaceList {
    pub recent_workspaces: Vec<RecentWorkspace>,
}

#[tauri::command]
pub fn read_app_state() -> CommandResult<Option<AppState>> {
    let path = app_state_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let value = read_json(&path)?;
    serde_json::from_value(value)
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_app_state(payload: AppState) -> CommandResult<()> {
    let path = app_state_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    write_json(
        &path,
        &json!({
            "workspacePath": payload.workspace_path,
            "collectionId": payload.collection_id,
            "endpointId": payload.endpoint_id,
            "panelVisibility": payload.panel_visibility
        }),
    )
}

#[tauri::command]
pub fn read_recent_workspaces() -> CommandResult<RecentWorkspaceList> {
    let path = recent_workspaces_path()?;
    if !path.exists() {
        return Ok(RecentWorkspaceList {
            recent_workspaces: Vec::new(),
        });
    }

    let value = read_json(&path)?;
    let mut list: RecentWorkspaceList = serde_json::from_value(value).map_err(|error| error.to_string())?;
    for workspace in &mut list.recent_workspaces {
        workspace.missing = !PathBuf::from(&workspace.path).exists();
    }
    Ok(list)
}

#[tauri::command]
pub fn save_recent_workspaces(payload: RecentWorkspaceList) -> CommandResult<()> {
    let path = recent_workspaces_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let recent_workspaces = payload
        .recent_workspaces
        .into_iter()
        .map(|mut workspace| {
            workspace.missing = false;
            workspace
        })
        .collect::<Vec<_>>();

    write_json(
        &path,
        &json!({
            "recentWorkspaces": recent_workspaces
        }),
    )
}

#[tauri::command]
pub fn read_scripts(payload: EndpointPayload) -> CommandResult<Scripts> {
    let dir = endpoint_dir(
        &PathBuf::from(payload.workspace_path),
        &payload.collection_id,
        &payload.endpoint_id,
    );
    Ok(Scripts {
        pre: read_optional_text(&dir.join("pre.js"))?,
        post: read_optional_text(&dir.join("post.js"))?,
        helpers: read_optional_text(&dir.join("helpers.js"))?,
    })
}

#[tauri::command]
pub fn save_script(payload: SaveScriptPayload) -> CommandResult<()> {
    let file_name = match payload.script_name.as_str() {
        "pre" => "pre.js",
        "post" => "post.js",
        "helpers" => "helpers.js",
        _ => return Err("scriptName must be pre, post, or helpers".to_string()),
    };
    let dir = endpoint_dir(
        &PathBuf::from(payload.workspace_path),
        &payload.collection_id,
        &payload.endpoint_id,
    );
    fs::write(dir.join(file_name), payload.content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_collection_automation(payload: CollectionPayload) -> CommandResult<CollectionAutomation> {
    let dir = collection_dir(&payload.workspace_path, &payload.collection_id);
    Ok(CollectionAutomation {
        pre: read_optional_text(&dir.join("pre.js"))?,
        post: read_optional_text(&dir.join("post.js"))?,
        test: read_optional_text(&dir.join("test.js"))?,
        assert: read_optional_text(&dir.join("assert.js"))?,
    })
}

#[tauri::command]
pub fn save_collection_automation_script(
    payload: SaveCollectionAutomationPayload,
) -> CommandResult<()> {
    let file_name = match payload.script_name.as_str() {
        "pre" => "pre.js",
        "post" => "post.js",
        "test" => "test.js",
        "assert" => "assert.js",
        _ => return Err("scriptName must be pre, post, test, or assert".to_string()),
    };
    let dir = collection_dir(&payload.workspace_path, &payload.collection_id);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    fs::write(dir.join(file_name), payload.content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_response_example(payload: SaveExamplePayload) -> CommandResult<String> {
    let dir = endpoint_dir(
        &PathBuf::from(&payload.workspace_path),
        &payload.collection_id,
        &payload.endpoint_id,
    )
    .join("examples");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let mut label = payload
        .label
        .unwrap_or_else(|| "response".to_string())
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if label.is_empty() {
        label = "response".to_string();
    }
    let file_name = format!("{label}-{}.bik", filename_timestamp());
    let path = dir.join(file_name);

    write_json(
        &path,
        &json!({
            "bikVersion": BIK_VERSION,
            "type": "example",
            "id": path.file_stem().and_then(|value| value.to_str()).unwrap_or("example"),
            "name": label,
            "createdAt": timestamp(),
            "request": payload.request,
            "response": payload.response
        }),
    )?;

    Ok(path.to_string_lossy().to_string())
}

#[allow(dead_code)]
pub fn read_example(path: &str) -> CommandResult<HashMap<String, Value>> {
    let value = read_json(&PathBuf::from(path))?;
    serde_json::from_value(value).map_err(|error| error.to_string())
}

fn read_optional_text(path: &PathBuf) -> CommandResult<String> {
    if path.exists() {
        fs::read_to_string(path).map_err(|error| error.to_string())
    } else {
        Ok(String::new())
    }
}

fn collection_dir(workspace_path: &str, collection_id: &str) -> PathBuf {
    PathBuf::from(workspace_path)
        .join("collections")
        .join(collection_id)
}

fn app_state_path() -> CommandResult<PathBuf> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or_else(|| "Could not resolve a home directory for app state.".to_string())?;
    Ok(PathBuf::from(home).join(".bikapi").join("app-state.json"))
}

fn recent_workspaces_path() -> CommandResult<PathBuf> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or_else(|| "Could not resolve a home directory for recent workspaces.".to_string())?;
    let home = PathBuf::from(home);

    let config_dir = if cfg!(target_os = "macos") {
        home.join("Library")
            .join("Application Support")
            .join("BikAPI")
    } else if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join("AppData").join("Roaming"))
            .join("BikAPI")
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".config"))
            .join("BikAPI")
    };

    Ok(config_dir.join("recent-workspaces.bik"))
}
