use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub type CommandResult<T> = Result<T, String>;

pub const BIK_VERSION: &str = "1.0";

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BikRequest {
    pub bik_version: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub query_params: HashMap<String, String>,
    #[serde(default)]
    pub body: Value,
    #[serde(default)]
    pub variables: HashMap<String, String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VariableFile {
    pub bik_version: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub variables: HashMap<String, String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExampleEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EndpointIndex {
    pub id: String,
    pub name: String,
    pub path: String,
    pub request: BikRequest,
    pub history: Vec<HistoryEntry>,
    pub examples: Vec<ExampleEntry>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CollectionIndex {
    pub id: String,
    pub name: String,
    pub path: String,
    pub variables: HashMap<String, String>,
    pub endpoints: Vec<EndpointIndex>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndex {
    pub path: String,
    pub name: String,
    pub globals: HashMap<String, String>,
    pub environments: Vec<VariableFile>,
    pub collections: Vec<CollectionIndex>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequestPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub endpoint_id: String,
    pub request: BikRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveVariablesPayload {
    pub workspace_path: String,
    #[serde(default)]
    pub collection_id: Option<String>,
    #[serde(default)]
    pub environment_id: Option<String>,
    pub variables: HashMap<String, String>,
}

#[tauri::command]
pub fn create_workspace(path: String, name: Option<String>) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(path);
    ensure_dir(&root)?;
    ensure_dir(&root.join("environments"))?;
    ensure_dir(&root.join("collections"))?;

    let workspace_name = name.unwrap_or_else(|| {
        root.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("BikAPI Workspace")
            .to_string()
    });

    write_json(
        &root.join("workspace.bik"),
        &json!({
            "bikVersion": BIK_VERSION,
            "type": "workspace",
            "id": slugify(&workspace_name),
            "name": workspace_name,
            "createdAt": timestamp()
        }),
    )?;

    write_json(
        &root.join("globals.bik"),
        &json!({
            "bikVersion": BIK_VERSION,
            "type": "globals",
            "id": "globals",
            "name": "Globals",
            "variables": {}
        }),
    )?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn open_workspace(path: String) -> CommandResult<WorkspaceIndex> {
    scan_workspace(Path::new(&path))
}

#[tauri::command]
pub fn create_collection(workspace_path: String, name: String) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(workspace_path);
    let collection_id = unique_child_id(&root.join("collections"), &slugify(&name));
    let collection_dir = root.join("collections").join(&collection_id);
    ensure_dir(&collection_dir)?;
    ensure_dir(&collection_dir.join("endpoints"))?;

    write_json(
        &collection_dir.join("collection.bik"),
        &json!({
            "bikVersion": BIK_VERSION,
            "type": "collection",
            "id": collection_id,
            "name": name,
            "variables": {}
        }),
    )?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn create_environment(workspace_path: String, name: String) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(workspace_path);
    let environments_dir = root.join("environments");
    ensure_dir(&environments_dir)?;

    let environment_id = unique_child_id(&environments_dir, &slugify(&name));
    write_json(
        &environments_dir.join(format!("{environment_id}.bik")),
        &json!({
            "bikVersion": BIK_VERSION,
            "type": "environment",
            "id": environment_id,
            "name": name,
            "variables": {}
        }),
    )?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn create_endpoint(
    workspace_path: String,
    collection_id: String,
    name: String,
) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(workspace_path);
    let endpoints_dir = root
        .join("collections")
        .join(&collection_id)
        .join("endpoints");
    ensure_dir(&endpoints_dir)?;

    let endpoint_id = unique_child_id(&endpoints_dir, &slugify(&name));
    let endpoint_dir = endpoints_dir.join(&endpoint_id);
    ensure_dir(&endpoint_dir)?;
    ensure_dir(&endpoint_dir.join("examples"))?;
    ensure_dir(&endpoint_dir.join("history"))?;

    let request = BikRequest {
        bik_version: BIK_VERSION.to_string(),
        kind: "request".to_string(),
        id: endpoint_id,
        name,
        method: "GET".to_string(),
        url: "https://example.com/".to_string(),
        headers: HashMap::new(),
        query_params: HashMap::new(),
        body: Value::Null,
        variables: HashMap::new(),
    };

    write_json(&endpoint_dir.join("request.bik"), &request)?;
    fs::write(endpoint_dir.join("pre.js"), "").map_err(|error| error.to_string())?;
    fs::write(endpoint_dir.join("post.js"), "").map_err(|error| error.to_string())?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn save_request(payload: SaveRequestPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let endpoint_dir = endpoint_dir(&root, &payload.collection_id, &payload.endpoint_id);
    ensure_dir(&endpoint_dir)?;
    ensure_dir(&endpoint_dir.join("history"))?;
    ensure_dir(&endpoint_dir.join("examples"))?;

    let request_path = endpoint_dir.join("request.bik");
    if request_path.exists() {
        let existing = fs::read_to_string(&request_path).map_err(|error| error.to_string())?;
        let old_value: Value = serde_json::from_str(&existing).map_err(|error| error.to_string())?;
        let new_value = serde_json::to_value(&payload.request).map_err(|error| error.to_string())?;
        if old_value != new_value {
            let history_name = format!("request-{}.bik", filename_timestamp());
            fs::copy(&request_path, endpoint_dir.join("history").join(history_name))
                .map_err(|error| error.to_string())?;
        }
    }

    write_json(&request_path, &payload.request)?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn save_globals(payload: SaveVariablesPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    write_json(
        &root.join("globals.bik"),
        &VariableFile {
            bik_version: BIK_VERSION.to_string(),
            kind: "globals".to_string(),
            id: "globals".to_string(),
            name: "Globals".to_string(),
            variables: payload.variables,
        },
    )?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn save_collection_variables(payload: SaveVariablesPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let collection_id = payload
        .collection_id
        .ok_or_else(|| "Collection id is required".to_string())?;
    let collection_path = root
        .join("collections")
        .join(&collection_id)
        .join("collection.bik");
    let mut collection = read_variable_file(&collection_path)?;
    collection.variables = payload.variables;
    write_json(&collection_path, &collection)?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn save_environment_variables(payload: SaveVariablesPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let environment_id = payload
        .environment_id
        .ok_or_else(|| "Environment id is required".to_string())?;
    let environment_path = variable_file_path_by_id(&root.join("environments"), &environment_id)?
        .ok_or_else(|| format!("Environment not found: {environment_id}"))?;
    let mut environment = read_variable_file(&environment_path)?;
    environment.variables = payload.variables;
    write_json(&environment_path, &environment)?;
    scan_workspace(&root)
}

pub fn scan_workspace(root: &Path) -> CommandResult<WorkspaceIndex> {
    if !root.exists() {
        return Err(format!("Workspace path does not exist: {}", root.display()));
    }

    let workspace_file = root.join("workspace.bik");
    let workspace_name = if workspace_file.exists() {
        let value = read_json(&workspace_file)?;
        value
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("BikAPI Workspace")
            .to_string()
    } else {
        "BikAPI Workspace".to_string()
    };

    let globals = if root.join("globals.bik").exists() {
        read_variable_file(&root.join("globals.bik"))?.variables
    } else {
        HashMap::new()
    };

    let environments = scan_environments(&root.join("environments"))?;
    let collections = scan_collections(&root.join("collections"))?;

    Ok(WorkspaceIndex {
        path: root.to_string_lossy().to_string(),
        name: workspace_name,
        globals,
        environments,
        collections,
    })
}

pub fn read_json(path: &Path) -> CommandResult<Value> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Invalid JSON in {}: {error}", path.display()))
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> CommandResult<()> {
    let content = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, format!("{content}\n"))
        .map_err(|error| format!("Failed to write {}: {error}", path.display()))
}

pub fn endpoint_dir(root: &Path, collection_id: &str, endpoint_id: &str) -> PathBuf {
    root.join("collections")
        .join(collection_id)
        .join("endpoints")
        .join(endpoint_id)
}

pub fn ensure_dir(path: &Path) -> CommandResult<()> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Failed to create directory {}: {error}", path.display()))
}

pub fn filename_timestamp() -> String {
    Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string()
}

pub fn timestamp() -> String {
    Utc::now().to_rfc3339()
}

fn scan_environments(path: &Path) -> CommandResult<Vec<VariableFile>> {
    let mut environments = Vec::new();
    if !path.exists() {
        return Ok(environments);
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if is_bik_file(&path) {
            environments.push(read_variable_file(&path)?);
        }
    }
    environments.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(environments)
}

fn scan_collections(path: &Path) -> CommandResult<Vec<CollectionIndex>> {
    let mut collections = Vec::new();
    if !path.exists() {
        return Ok(collections);
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let collection_dir = entry.path();
        if !collection_dir.is_dir() {
            continue;
        }

        let collection_file = collection_dir.join("collection.bik");
        if !collection_file.exists() {
            continue;
        }

        let collection = read_variable_file(&collection_file)?;
        let endpoints = scan_endpoints(&collection_dir.join("endpoints"))?;
        collections.push(CollectionIndex {
            id: collection.id,
            name: collection.name,
            path: collection_dir.to_string_lossy().to_string(),
            variables: collection.variables,
            endpoints,
        });
    }
    collections.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(collections)
}

fn scan_endpoints(path: &Path) -> CommandResult<Vec<EndpointIndex>> {
    let mut endpoints = Vec::new();
    if !path.exists() {
        return Ok(endpoints);
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let endpoint_path = entry.path();
        if !endpoint_path.is_dir() {
            continue;
        }

        let request_path = endpoint_path.join("request.bik");
        if !request_path.exists() {
            continue;
        }

        let request = read_request(&request_path)?;
        let history = scan_named_entries(&endpoint_path.join("history"))?;
        let examples = scan_example_entries(&endpoint_path.join("examples"))?;
        endpoints.push(EndpointIndex {
            id: request.id.clone(),
            name: request.name.clone(),
            path: endpoint_path.to_string_lossy().to_string(),
            request,
            history,
            examples,
        });
    }
    endpoints.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(endpoints)
}

fn scan_named_entries(path: &Path) -> CommandResult<Vec<HistoryEntry>> {
    let mut entries = Vec::new();
    if !path.exists() {
        return Ok(entries);
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !is_bik_file(&path) {
            continue;
        }

        let filename = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("history")
            .to_string();
        entries.push(HistoryEntry {
            id: filename.clone(),
            name: filename,
            path: path.to_string_lossy().to_string(),
            created_at: file_modified_at(&path)?,
        });
    }
    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

fn scan_example_entries(path: &Path) -> CommandResult<Vec<ExampleEntry>> {
    let history_entries = scan_named_entries(path)?;
    Ok(history_entries
        .into_iter()
        .map(|entry| ExampleEntry {
            id: entry.id,
            name: entry.name,
            path: entry.path,
            created_at: entry.created_at,
        })
        .collect())
}

fn read_variable_file(path: &Path) -> CommandResult<VariableFile> {
    let value = read_json(path)?;
    serde_json::from_value(value).map_err(|error| format!("Invalid variable file: {error}"))
}

pub fn read_request(path: &Path) -> CommandResult<BikRequest> {
    let value = read_json(path)?;
    serde_json::from_value(value).map_err(|error| format!("Invalid request file: {error}"))
}

fn file_modified_at(path: &Path) -> CommandResult<String> {
    let modified = fs::metadata(path)
        .map_err(|error| error.to_string())?
        .modified()
        .map_err(|error| error.to_string())?;
    let datetime: chrono::DateTime<Utc> = modified.into();
    Ok(datetime.to_rfc3339())
}

fn is_bik_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("bik"))
        .unwrap_or(false)
}

fn variable_file_path_by_id(parent: &Path, id: &str) -> CommandResult<Option<PathBuf>> {
    if !parent.exists() {
        return Ok(None);
    }

    for entry in fs::read_dir(parent).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !is_bik_file(&path) {
            continue;
        }

        let variable_file = read_variable_file(&path)?;
        if variable_file.id == id {
            return Ok(Some(path));
        }
    }

    Ok(None)
}

fn slugify(input: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for character in input.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }
    let trimmed = output.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed
    }
}

fn unique_child_id(parent: &Path, desired: &str) -> String {
    let mut candidate = desired.to_string();
    let mut index = 2;
    while parent.join(&candidate).exists() {
        candidate = format!("{desired}-{index}");
        index += 1;
    }
    candidate
}
