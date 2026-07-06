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
pub struct FlowPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlowNode {
    pub id: String,
    #[serde(default = "default_request_node_type")]
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub request_path: String,
    pub request_id: String,
    #[serde(default)]
    pub name: String,
    pub position: FlowPosition,
    #[serde(default)]
    pub last_run: Option<Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlowMapping {
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub transform: String,
    #[serde(default)]
    pub source_path: String,
    #[serde(default)]
    pub source_label: String,
    #[serde(default)]
    pub target_type: String,
    #[serde(default)]
    pub target_key: String,
    #[serde(default)]
    pub target_path: String,
    #[serde(default)]
    pub target_variable: String,
    #[serde(default)]
    pub transform_type: String,
    #[serde(default)]
    pub template: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlowEdge {
    pub id: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub from: String,
    #[serde(default)]
    pub to: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub mappings: Vec<FlowMapping>,
}

fn default_request_node_type() -> String {
    "request".to_string()
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlowDefinition {
    pub bik_version: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub nodes: Vec<FlowNode>,
    #[serde(default)]
    pub edges: Vec<FlowEdge>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlowIndex {
    pub id: String,
    pub name: String,
    pub path: String,
    pub flow: FlowDefinition,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CollectionIndex {
    pub id: String,
    pub name: String,
    pub path: String,
    pub variables: HashMap<String, String>,
    pub endpoints: Vec<EndpointIndex>,
    pub flows: Vec<FlowIndex>,
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
pub struct FlowPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub flow_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFlowPayload {
    pub workspace_path: String,
    pub collection_id: String,
    pub flow: FlowDefinition,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceInDirectoryPayload {
    pub parent_path: String,
    pub name: String,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameEntityPayload {
    pub workspace_path: String,
    pub collection_id: String,
    #[serde(default)]
    pub entity_id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntityPayload {
    pub workspace_path: String,
    pub collection_id: String,
    #[serde(default)]
    pub entity_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateEntityPayload {
    pub workspace_path: String,
    pub collection_id: String,
    #[serde(default)]
    pub entity_id: String,
    pub name: String,
}

#[tauri::command]
pub fn create_workspace(path: String, name: Option<String>) -> CommandResult<WorkspaceIndex> {
    create_workspace_at_path(PathBuf::from(path), name)
}

#[tauri::command]
pub fn create_workspace_in_directory(
    payload: CreateWorkspaceInDirectoryPayload,
) -> CommandResult<WorkspaceIndex> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err("Workspace name is required.".to_string());
    }

    let root = PathBuf::from(payload.parent_path).join(name);
    create_workspace_at_path(root, Some(name.to_string()))
}

fn create_workspace_at_path(root: PathBuf, name: Option<String>) -> CommandResult<WorkspaceIndex> {
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
    ensure_dir(&collection_dir.join("flows"))?;

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
        url: String::new(),
        headers: HashMap::new(),
        query_params: HashMap::new(),
        body: Value::Null,
        variables: HashMap::new(),
    };

    write_json(&endpoint_dir.join("request.bik"), &request)?;
    fs::write(endpoint_dir.join("pre.js"), "").map_err(|error| error.to_string())?;
    fs::write(endpoint_dir.join("post.js"), "").map_err(|error| error.to_string())?;
    fs::write(endpoint_dir.join("helpers.js"), "").map_err(|error| error.to_string())?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn create_flow(
    workspace_path: String,
    collection_id: String,
    name: String,
) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(workspace_path);
    let flows_dir = root
        .join("collections")
        .join(&collection_id)
        .join("flows");
    ensure_dir(&flows_dir)?;

    let flow_id = unique_child_id(&flows_dir, &slugify(&name));
    let flow_dir = flows_dir.join(&flow_id);
    ensure_dir(&flow_dir)?;

    let flow = FlowDefinition {
        bik_version: BIK_VERSION.to_string(),
        kind: "flow".to_string(),
        id: flow_id,
        name,
        nodes: Vec::new(),
        edges: Vec::new(),
    };

    write_json(&flow_dir.join("flow.bik"), &flow)?;
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
pub fn read_flow(payload: FlowPayload) -> CommandResult<FlowDefinition> {
    let root = PathBuf::from(payload.workspace_path);
    let flow_path = root
        .join("collections")
        .join(&payload.collection_id)
        .join("flows")
        .join(&payload.flow_id)
        .join("flow.bik");
    read_flow_definition(&flow_path)
}

#[tauri::command]
pub fn save_flow(payload: SaveFlowPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let flow_dir = root
        .join("collections")
        .join(&payload.collection_id)
        .join("flows")
        .join(&payload.flow.id);
    ensure_dir(&flow_dir)?;
    write_json(&flow_dir.join("flow.bik"), &payload.flow)?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn rename_collection(payload: RenameEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let collection_path = root
        .join("collections")
        .join(&payload.collection_id)
        .join("collection.bik");
    let mut collection = read_variable_file(&collection_path)?;
    collection.name = payload.name;
    write_json(&collection_path, &collection)?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn delete_collection(payload: DeleteEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let collection_dir = root.join("collections").join(&payload.collection_id);
    if collection_dir.exists() {
        fs::remove_dir_all(&collection_dir)
            .map_err(|error| format!("Failed to delete {}: {error}", collection_dir.display()))?;
    }
    scan_workspace(&root)
}

#[tauri::command]
pub fn rename_request(payload: RenameEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let endpoint_dir = endpoint_dir(&root, &payload.collection_id, &payload.entity_id);
    let request_path = endpoint_dir.join("request.bik");
    let mut request = read_request(&request_path)?;
    request.name = payload.name;
    write_json(&request_path, &request)?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn delete_request(payload: DeleteEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let endpoint_dir = endpoint_dir(&root, &payload.collection_id, &payload.entity_id);
    if endpoint_dir.exists() {
        fs::remove_dir_all(&endpoint_dir)
            .map_err(|error| format!("Failed to delete {}: {error}", endpoint_dir.display()))?;
    }

    let flows_dir = root
        .join("collections")
        .join(&payload.collection_id)
        .join("flows");
    if flows_dir.exists() {
        for entry in fs::read_dir(&flows_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let flow_file = entry.path().join("flow.bik");
            if !flow_file.exists() {
                continue;
            }
            let mut flow = read_flow_definition(&flow_file)?;
            let removed: Vec<String> = flow
                .nodes
                .iter()
                .filter(|node| node.request_id == payload.entity_id)
                .map(|node| node.id.clone())
                .collect();
            if removed.is_empty() {
                continue;
            }
            flow.nodes.retain(|node| node.request_id != payload.entity_id);
            flow.edges.retain(|edge| {
                !removed.contains(&edge.source)
                    && !removed.contains(&edge.from)
                    && !removed.contains(&edge.target)
                    && !removed.contains(&edge.to)
            });
            write_json(&flow_file, &flow)?;
        }
    }

    scan_workspace(&root)
}

#[tauri::command]
pub fn rename_flow(payload: RenameEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let flow_file = root
        .join("collections")
        .join(&payload.collection_id)
        .join("flows")
        .join(&payload.entity_id)
        .join("flow.bik");
    let mut flow = read_flow_definition(&flow_file)?;
    flow.name = payload.name;
    write_json(&flow_file, &flow)?;
    scan_workspace(&root)
}

#[tauri::command]
pub fn delete_flow(payload: DeleteEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let flow_dir = root
        .join("collections")
        .join(&payload.collection_id)
        .join("flows")
        .join(&payload.entity_id);
    if flow_dir.exists() {
        fs::remove_dir_all(&flow_dir)
            .map_err(|error| format!("Failed to delete {}: {error}", flow_dir.display()))?;
    }
    scan_workspace(&root)
}

#[tauri::command]
pub fn duplicate_collection(payload: DuplicateEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let collections_dir = root.join("collections");
    let source_dir = collections_dir.join(&payload.collection_id);
    let new_id = unique_child_id(&collections_dir, &slugify(&payload.name));
    let target_dir = collections_dir.join(&new_id);
    copy_dir_all(&source_dir, &target_dir)?;

    let collection_file = target_dir.join("collection.bik");
    let mut collection = read_variable_file(&collection_file)?;
    collection.id = new_id;
    collection.name = payload.name;
    write_json(&collection_file, &collection)?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn duplicate_request(payload: DuplicateEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let endpoints_dir = root
        .join("collections")
        .join(&payload.collection_id)
        .join("endpoints");
    let source_dir = endpoints_dir.join(&payload.entity_id);
    let new_id = unique_child_id(&endpoints_dir, &slugify(&payload.name));
    let target_dir = endpoints_dir.join(&new_id);
    copy_dir_all(&source_dir, &target_dir)?;

    let request_file = target_dir.join("request.bik");
    let mut request = read_request(&request_file)?;
    request.id = new_id;
    request.name = payload.name;
    write_json(&request_file, &request)?;

    scan_workspace(&root)
}

#[tauri::command]
pub fn duplicate_flow(payload: DuplicateEntityPayload) -> CommandResult<WorkspaceIndex> {
    let root = PathBuf::from(payload.workspace_path);
    let flows_dir = root
        .join("collections")
        .join(&payload.collection_id)
        .join("flows");
    let source_dir = flows_dir.join(&payload.entity_id);
    let new_id = unique_child_id(&flows_dir, &slugify(&payload.name));
    let target_dir = flows_dir.join(&new_id);
    copy_dir_all(&source_dir, &target_dir)?;

    let flow_file = target_dir.join("flow.bik");
    let mut flow = read_flow_definition(&flow_file)?;
    flow.id = new_id;
    flow.name = payload.name;
    write_json(&flow_file, &flow)?;

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
        let flows = scan_flows(&collection_dir.join("flows"))?;
        collections.push(CollectionIndex {
            id: collection.id,
            name: collection.name,
            path: collection_dir.to_string_lossy().to_string(),
            variables: collection.variables,
            endpoints,
            flows,
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

fn scan_flows(path: &Path) -> CommandResult<Vec<FlowIndex>> {
    let mut flows = Vec::new();
    if !path.exists() {
        return Ok(flows);
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let flow_path = entry.path();
        if !flow_path.is_dir() {
            continue;
        }

        let flow_file = flow_path.join("flow.bik");
        if !flow_file.exists() {
            continue;
        }

        let flow = read_flow_definition(&flow_file)?;
        flows.push(FlowIndex {
            id: flow.id.clone(),
            name: flow.name.clone(),
            path: flow_path.to_string_lossy().to_string(),
            flow,
        });
    }

    flows.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(flows)
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

fn read_flow_definition(path: &Path) -> CommandResult<FlowDefinition> {
    let value = read_json(path)?;
    serde_json::from_value(value).map_err(|error| format!("Invalid flow file: {error}"))
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

fn copy_dir_all(source: &Path, target: &Path) -> CommandResult<()> {
    ensure_dir(target)?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("Failed to read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let target_path = target.join(entry.file_name());
        if entry_path.is_dir() {
          copy_dir_all(&entry_path, &target_path)?;
        } else {
          fs::copy(&entry_path, &target_path)
            .map_err(|error| format!("Failed to copy {}: {error}", entry_path.display()))?;
        }
    }
    Ok(())
}
