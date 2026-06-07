use crate::commands::workspace::{scan_workspace, CommandResult};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitActionPayload {
    pub workspace_path: String,
    pub repo_url: String,
    pub action: String,
    pub commit_message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemotePayload {
    pub workspace_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeGitRepositoryPayload {
    pub workspace_path: String,
    pub commit_message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneWorkspacePayload {
    pub repo_url: String,
    pub destination_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSnapshotPayload {
    pub workspace_path: String,
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitActionResult {
    pub action: String,
    pub branch: String,
    pub repo_url: String,
    pub output: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub branch: String,
    pub dirty: bool,
    pub has_local_commit: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncCollectionStatus {
    pub collection_id: String,
    pub state: String,
    pub local_changes: usize,
    pub remote_changes: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResult {
    pub state: String,
    pub branch: String,
    pub repo_url: Option<String>,
    pub local_changes: usize,
    pub remote_changes: usize,
    pub local_change_files: Vec<String>,
    pub remote_change_files: Vec<String>,
    pub collections: Vec<SyncCollectionStatus>,
    pub remote_empty: bool,
    pub checked_at: String,
}

#[tauri::command]
pub fn run_git_action(payload: GitActionPayload) -> CommandResult<GitActionResult> {
    let workspace = Path::new(&payload.workspace_path);
    if !workspace.exists() {
      return Err("Workspace path does not exist.".to_string());
    }

    let repo_url = payload.repo_url.trim();
    if repo_url.is_empty() {
      return Err("Repository URL is required.".to_string());
    }

    require_repo(workspace)?;
    ensure_origin_remote(workspace, repo_url)?;

    let branch = current_branch(workspace)?;
    let commit_message = payload
      .commit_message
      .as_deref()
      .map(str::trim)
      .filter(|value| !value.is_empty());

    let output = match payload.action.as_str() {
      "pull" => pull_repo(workspace, repo_url, &branch)?,
      "push" => push_repo(workspace, repo_url, &branch, commit_message)?,
      "sync" => sync_repo(workspace, repo_url, &branch, commit_message)?,
      _ => return Err("Unsupported git action.".to_string()),
    };

    Ok(GitActionResult {
      action: payload.action,
      branch,
      repo_url: repo_url.to_string(),
      output,
    })
}

#[tauri::command]
pub fn initialize_git_repository(payload: InitializeGitRepositoryPayload) -> CommandResult<GitActionResult> {
  let workspace = Path::new(&payload.workspace_path);
  if !workspace.exists() {
    return Err("Workspace path does not exist.".to_string());
  }

  ensure_repo(workspace)?;
  let branch = current_branch(workspace)?;
  let message = payload
    .commit_message
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .unwrap_or("Initial BikAPI workspace");

  stage_changes_safely(workspace)?;
  let output = if has_staged_changes(workspace)? {
    run_git(workspace, &["commit", "-m", message])?
  } else {
    "Repository initialized.".to_string()
  };

  Ok(GitActionResult {
    action: "initialize".to_string(),
    branch,
    repo_url: String::new(),
    output,
  })
}

#[tauri::command]
pub fn clone_workspace(payload: CloneWorkspacePayload) -> CommandResult<String> {
  let repo_url = payload.repo_url.trim();
  if repo_url.is_empty() {
    return Err("Repository URL is required.".to_string());
  }

  let destination = PathBuf::from(payload.destination_path);
  if destination.exists() {
    let mut entries = destination.read_dir().map_err(|error| error.to_string())?;
    if entries.next().transpose().map_err(|error| error.to_string())?.is_some() {
      return Err("Destination folder must be empty.".to_string());
    }
  } else if let Some(parent) = destination.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  let output = Command::new("git")
    .args(["clone", repo_url, &destination.to_string_lossy()])
    .output()
    .map_err(|error| format!("Failed to run git: {error}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
      stderr
    });
  }

  Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_git_remote_url(payload: GitRemotePayload) -> CommandResult<Option<String>> {
  let workspace = Path::new(&payload.workspace_path);
  if !workspace.exists() || !workspace.join(".git").exists() {
    return Ok(None);
  }

  match run_git(workspace, &["remote", "get-url", "origin"]) {
    Ok(url) => {
      let value = url.trim();
      if value.is_empty() {
        Ok(None)
      } else {
        Ok(Some(value.to_string()))
      }
    }
    Err(_) => Ok(None),
  }
}

#[tauri::command]
pub fn get_git_status(payload: GitRemotePayload) -> CommandResult<GitStatusResult> {
  let workspace = Path::new(&payload.workspace_path);
  if !workspace.exists() {
    return Err("Workspace path does not exist.".to_string());
  }

  require_repo(workspace)?;

  Ok(GitStatusResult {
    branch: current_branch(workspace)?,
    dirty: working_tree_dirty(workspace)?,
    has_local_commit: has_local_commit(workspace),
  })
}

#[tauri::command]
pub fn get_sync_status(payload: GitRemotePayload) -> CommandResult<SyncStatusResult> {
  let workspace = Path::new(&payload.workspace_path);
  if !workspace.exists() {
    return Err("Workspace path does not exist.".to_string());
  }

  let workspace_index = scan_workspace(workspace)?;
  if !is_git_workspace(workspace) {
    return Ok(SyncStatusResult {
      state: "not_git".to_string(),
      branch: String::new(),
      repo_url: None,
      local_changes: 0,
      remote_changes: 0,
      local_change_files: Vec::new(),
      remote_change_files: Vec::new(),
      collections: build_collection_statuses(workspace, &workspace_index.collections, &[], &[]),
      remote_empty: true,
      checked_at: Utc::now().to_rfc3339(),
    });
  }

  let branch = current_branch(workspace)?;
  let conflict = has_conflicts(workspace)?;
  let repo_url = get_origin_remote_url(workspace)?;

  let (remote_empty, local_files, remote_files) = if let Some(repo_url) = repo_url.as_deref() {
    match fetch_origin(workspace)
      .and_then(|_| remote_has_heads(workspace, repo_url))
      .and_then(|has_heads| {
        let remote_empty = !has_heads;
        let local_files = collect_local_change_files(workspace, repo_url, &branch, remote_empty)?;
        let remote_files = collect_remote_change_files(workspace, repo_url, &branch, remote_empty)?;
        Ok((remote_empty, local_files, remote_files))
      }) {
      Ok(values) => values,
      Err(_) => {
        let local_files = collect_local_only_files(workspace).unwrap_or_default();
        let collections = build_collection_statuses(workspace, &workspace_index.collections, &local_files, &[]);
        return Ok(SyncStatusResult {
          state: "offline".to_string(),
          branch,
          repo_url: Some(repo_url.to_string()),
          local_changes: local_files.len(),
          remote_changes: 0,
          local_change_files: local_files,
          remote_change_files: Vec::new(),
          collections,
          remote_empty: false,
          checked_at: Utc::now().to_rfc3339(),
        });
      }
    }
  } else {
    let local_files = collect_local_only_files(workspace)?;
    (true, local_files, Vec::new())
  };

  let collections = build_collection_statuses(workspace, &workspace_index.collections, &local_files, &remote_files);
  let state = sync_state_name(conflict, !local_files.is_empty(), !remote_files.is_empty()).to_string();

  Ok(SyncStatusResult {
    state,
    branch,
    repo_url,
    local_changes: local_files.len(),
    remote_changes: remote_files.len(),
    local_change_files: local_files,
    remote_change_files: remote_files,
    collections,
    remote_empty,
    checked_at: Utc::now().to_rfc3339(),
  })
}

#[tauri::command]
pub fn save_workspace_snapshot(payload: SaveSnapshotPayload) -> CommandResult<Option<String>> {
  let workspace = Path::new(&payload.workspace_path);
  if !workspace.exists() {
    return Err("Workspace path does not exist.".to_string());
  }

  if !is_git_workspace(workspace) {
    return Ok(None);
  }
  if !working_tree_dirty(workspace)? {
    return Ok(None);
  }

  let label = payload
    .label
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .unwrap_or("Workspace save");
  let message = format!("{label} {}", Utc::now().format("%Y-%m-%d %H:%M:%S"));
  let output = match commit_dirty_changes(workspace, &message)? {
    Some(value) => value,
    None => return Ok(None),
  };
  if output.trim().is_empty() {
    Ok(Some(message))
  } else {
    Ok(Some(format!("{message}\n{output}")))
  }
}

fn ensure_repo(workspace: &Path) -> CommandResult<()> {
  if is_git_workspace(workspace) {
    return Ok(());
  }

  run_git(workspace, &["init"])?;
  run_git(workspace, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
  Ok(())
}

fn require_repo(workspace: &Path) -> CommandResult<()> {
  if is_git_workspace(workspace) {
    Ok(())
  } else {
    Err("This workspace is local only.".to_string())
  }
}

fn ensure_origin_remote(workspace: &Path, repo_url: &str) -> CommandResult<()> {
  let remotes = run_git(workspace, &["remote"])?;
  let remote_names = remotes
    .lines()
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .collect::<Vec<_>>();

  if remote_names.iter().any(|name| *name == "origin") {
    run_git(workspace, &["remote", "set-url", "origin", repo_url])?;
  } else {
    run_git(workspace, &["remote", "add", "origin", repo_url])?;
  }
  Ok(())
}

fn get_origin_remote_url(workspace: &Path) -> CommandResult<Option<String>> {
  if !workspace.join(".git").exists() {
    return Ok(None);
  }

  match run_git(workspace, &["remote", "get-url", "origin"]) {
    Ok(url) => {
      let value = url.trim();
      if value.is_empty() {
        Ok(None)
      } else {
        Ok(Some(value.to_string()))
      }
    }
    Err(_) => Ok(None),
  }
}

fn current_branch(workspace: &Path) -> CommandResult<String> {
  match run_git(workspace, &["symbolic-ref", "--short", "HEAD"]) {
    Ok(branch) => {
      let name = branch.trim();
      if name.is_empty() {
        Ok("main".to_string())
      } else {
        Ok(name.to_string())
      }
    }
    Err(_) => {
      run_git(workspace, &["symbolic-ref", "HEAD", "refs/heads/main"])?;
      Ok("main".to_string())
    }
  }
}

fn has_local_commit(workspace: &Path) -> bool {
  run_git(workspace, &["rev-parse", "--verify", "HEAD"]).is_ok()
}

fn remote_default_branch(workspace: &Path, repo_url: &str) -> CommandResult<String> {
  let output = run_git(workspace, &["ls-remote", "--symref", repo_url, "HEAD"])?;
  for line in output.lines() {
    if let Some(rest) = line.strip_prefix("ref: ") {
      if let Some((reference, _)) = rest.split_once('\t') {
        if let Some(branch) = reference.trim().strip_prefix("refs/heads/") {
          return Ok(branch.to_string());
        }
      }
    }
  }
  Ok("main".to_string())
}

fn remote_has_heads(workspace: &Path, repo_url: &str) -> CommandResult<bool> {
  let output = run_git(workspace, &["ls-remote", "--heads", repo_url])?;
  Ok(output.lines().any(|line| !line.trim().is_empty()))
}

fn fetch_origin(workspace: &Path) -> CommandResult<String> {
  run_git(workspace, &["fetch", "origin"])
}

fn pull_repo(workspace: &Path, repo_url: &str, branch: &str) -> CommandResult<String> {
  if !remote_has_heads(workspace, repo_url)? {
    return Ok("Remote repository is empty. Nothing to pull yet.".to_string());
  }

  let target_branch = if has_local_commit(workspace) {
    branch.to_string()
  } else {
    remote_default_branch(workspace, repo_url)?
  };

  if has_local_commit(workspace) {
    run_git(workspace, &["pull", "--rebase", "origin", &target_branch])
  } else {
    let fetch_output = run_git(workspace, &["fetch", "origin", &target_branch])?;
    let checkout_output = run_git(
      workspace,
      &["checkout", "-B", &target_branch, "--track", &format!("origin/{target_branch}")],
    )?;
    Ok(join_outputs(fetch_output, checkout_output))
  }
}

fn push_repo(
  workspace: &Path,
  _repo_url: &str,
  branch: &str,
  commit_message: Option<&str>,
) -> CommandResult<String> {
  let mut output = String::new();

  if working_tree_dirty(workspace)? {
    let message = commit_message.ok_or_else(|| {
      "Uncommitted changes detected. Provide a commit message before pushing.".to_string()
    })?;
    if let Some(commit_output) = commit_dirty_changes(workspace, message)? {
      output = join_outputs(output, commit_output);
    }
  }

  if !has_local_commit(workspace) {
    return Err("No commits available to push. Commit your workspace changes first.".to_string());
  }

  Ok(join_outputs(output, run_git(workspace, &["push", "-u", "origin", branch])?))
}

fn sync_repo(
  workspace: &Path,
  repo_url: &str,
  branch: &str,
  commit_message: Option<&str>,
) -> CommandResult<String> {
  let mut output = String::new();

  if working_tree_dirty(workspace)? {
    let message = commit_message.ok_or_else(|| {
      "Uncommitted changes detected. Provide a commit message before syncing.".to_string()
    })?;
    if let Some(commit_output) = commit_dirty_changes(workspace, message)? {
      output = join_outputs(output, commit_output);
    }
  }

  output = join_outputs(output, pull_repo(workspace, repo_url, branch)?);

  let active_branch = current_branch(workspace)?;
  if has_local_commit(workspace) {
    output = join_outputs(output, run_git(workspace, &["push", "-u", "origin", &active_branch])?);
  } else if output.trim().is_empty() {
    output = "Nothing to sync.".to_string();
  }

  Ok(output)
}

fn run_git(workspace: &Path, args: &[&str]) -> CommandResult<String> {
  let output = Command::new("git")
    .args(args)
    .current_dir(workspace)
    .output()
    .map_err(|error| format!("Failed to run git: {error}"))?;

  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

  if output.status.success() {
    if stdout.is_empty() {
      Ok(stderr)
    } else if stderr.is_empty() {
      Ok(stdout)
    } else {
      Ok(join_outputs(stdout, stderr))
    }
  } else if stderr.is_empty() {
    Err(stdout)
  } else {
    Err(stderr)
  }
}

fn working_tree_dirty(workspace: &Path) -> CommandResult<bool> {
  Ok(!run_git(workspace, &["status", "--porcelain"])?.trim().is_empty())
}

fn commit_dirty_changes(workspace: &Path, message: &str) -> CommandResult<Option<String>> {
  stage_changes_safely(workspace)?;
  if !has_staged_changes(workspace)? {
    return Ok(None);
  }

  run_git(workspace, &["commit", "-m", message]).map(Some)
}

fn join_outputs(first: String, second: String) -> String {
  match (first.trim(), second.trim()) {
    ("", "") => String::new(),
    ("", value) => value.to_string(),
    (value, "") => value.to_string(),
    (left, right) => format!("{left}\n{right}"),
  }
}

fn has_conflicts(workspace: &Path) -> CommandResult<bool> {
  let output = run_git(workspace, &["status", "--porcelain"])?;
  Ok(output.lines().any(|line| {
    matches!(
      &line.chars().take(2).collect::<String>()[..],
      "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU"
    )
  }))
}

fn collect_local_only_files(workspace: &Path) -> CommandResult<Vec<String>> {
  let mut files = HashSet::new();
  add_porcelain_paths(workspace, &mut files)?;
  if has_local_commit(workspace) {
    add_command_paths(workspace, &["ls-files"], &mut files)?;
  }
  Ok(sorted_paths(files))
}

fn collect_local_change_files(
  workspace: &Path,
  _repo_url: &str,
  branch: &str,
  remote_empty: bool,
) -> CommandResult<Vec<String>> {
  let mut files = HashSet::new();
  add_porcelain_paths(workspace, &mut files)?;
  if remote_empty {
    if has_local_commit(workspace) {
      add_command_paths(workspace, &["ls-files"], &mut files)?;
    }
  } else {
    add_command_paths(workspace, &["diff", "--name-only", &format!("origin/{branch}..HEAD")], &mut files)?;
  }
  Ok(sorted_paths(files))
}

fn collect_remote_change_files(
  workspace: &Path,
  _repo_url: &str,
  branch: &str,
  remote_empty: bool,
) -> CommandResult<Vec<String>> {
  if remote_empty {
    return Ok(Vec::new());
  }

  let mut files = HashSet::new();
  if has_local_commit(workspace) {
    add_command_paths(workspace, &["diff", "--name-only", &format!("HEAD..origin/{branch}")], &mut files)?;
  } else {
    add_command_paths(workspace, &["ls-tree", "-r", "--name-only", &format!("origin/{branch}")], &mut files)?;
  }
  Ok(sorted_paths(files))
}

fn add_command_paths(workspace: &Path, args: &[&str], target: &mut HashSet<String>) -> CommandResult<()> {
  let output = run_git(workspace, args)?;
  for line in output.lines() {
    let value = line.trim();
    if !value.is_empty() {
      target.insert(normalize_rel_path(value));
    }
  }
  Ok(())
}

fn add_porcelain_paths(workspace: &Path, target: &mut HashSet<String>) -> CommandResult<()> {
  let output = run_git(workspace, &["status", "--porcelain"])?;
  for line in output.lines() {
    if line.len() < 4 {
      continue;
    }
    let path_part = line[3..].trim();
    let candidate = path_part.rsplit(" -> ").next().unwrap_or(path_part).trim();
    if !candidate.is_empty() {
      target.insert(normalize_rel_path(candidate));
    }
  }
  Ok(())
}

fn build_collection_statuses(
  workspace: &Path,
  collections: &[crate::commands::workspace::CollectionIndex],
  local_files: &[String],
  remote_files: &[String],
) -> Vec<SyncCollectionStatus> {
  let local_counts = count_paths_by_collection(workspace, collections, local_files);
  let remote_counts = count_paths_by_collection(workspace, collections, remote_files);

  collections
    .iter()
    .map(|collection| {
      let local_changes = *local_counts.get(&collection.id).unwrap_or(&0);
      let remote_changes = *remote_counts.get(&collection.id).unwrap_or(&0);
      SyncCollectionStatus {
        collection_id: collection.id.clone(),
        state: sync_state_name(false, local_changes > 0, remote_changes > 0).to_string(),
        local_changes,
        remote_changes,
      }
    })
    .collect()
}

fn count_paths_by_collection(
  workspace: &Path,
  collections: &[crate::commands::workspace::CollectionIndex],
  files: &[String],
) -> HashMap<String, usize> {
  let mut counts = HashMap::new();

  for collection in collections {
    let relative = PathBuf::from(&collection.path)
      .strip_prefix(workspace)
      .ok()
      .map(|path| normalize_rel_path(&path.to_string_lossy()))
      .unwrap_or_default();

    let count = files
      .iter()
      .filter(|file| file.starts_with(&relative))
      .count();

    counts.insert(collection.id.clone(), count);
  }

  counts
}

fn normalize_rel_path(value: &str) -> String {
  value.replace('\\', "/")
}

fn sorted_paths(paths: HashSet<String>) -> Vec<String> {
  let mut list = paths.into_iter().collect::<Vec<_>>();
  list.sort();
  list
}

fn sync_state_name(conflict: bool, has_local: bool, has_remote: bool) -> &'static str {
  if conflict {
    "conflict"
  } else if has_local && has_remote {
    "sync_required"
  } else if has_local {
    "local_changes"
  } else if has_remote {
    "remote_updates"
  } else {
    "synced"
  }
}

fn has_staged_changes(workspace: &Path) -> CommandResult<bool> {
  let output = Command::new("git")
    .args(["diff", "--cached", "--name-only"])
    .current_dir(workspace)
    .output()
    .map_err(|error| format!("Failed to run git: {error}"))?;

  if !output.status.success() {
    return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
  }

  Ok(String::from_utf8_lossy(&output.stdout)
    .lines()
    .any(|line| !line.trim().is_empty()))
}

fn stage_changes_safely(workspace: &Path) -> CommandResult<()> {
  let entries = git_status_entries(workspace)?;
  for entry in entries {
    if should_skip_path(workspace, &entry.path) {
      continue;
    }

    if entry.is_deleted() {
      let _ = run_git(workspace, &["rm", "--cached", "-r", "--ignore-unmatch", &entry.path]);
      let _ = run_git(workspace, &["add", "-u", "--", &entry.path]);
      continue;
    }

    let _ = run_git(workspace, &["add", "--", &entry.path]);
  }
  Ok(())
}

fn should_skip_path(workspace: &Path, relative_path: &str) -> bool {
  let absolute = workspace.join(relative_path);
  absolute.join(".git").exists() || fs::read_to_string(absolute.join(".git")).is_ok()
}

fn is_git_workspace(workspace: &Path) -> bool {
  workspace.join(".git").exists()
}

#[derive(Debug)]
struct GitStatusEntry {
  x: char,
  y: char,
  path: String,
}

impl GitStatusEntry {
  fn is_deleted(&self) -> bool {
    self.x == 'D' || self.y == 'D'
  }
}

fn git_status_entries(workspace: &Path) -> CommandResult<Vec<GitStatusEntry>> {
  let output = Command::new("git")
    .args(["status", "--porcelain", "-z"])
    .current_dir(workspace)
    .output()
    .map_err(|error| format!("Failed to run git: {error}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
      stderr
    });
  }

  let mut entries = Vec::new();
  let data = output.stdout;
  let mut index = 0usize;

  while index < data.len() {
    if index + 3 >= data.len() {
      break;
    }

    let x = data[index] as char;
    let y = data[index + 1] as char;
    index += 3;

    let start = index;
    while index < data.len() && data[index] != 0 {
      index += 1;
    }
    if index >= data.len() {
      break;
    }

    let mut path = String::from_utf8_lossy(&data[start..index]).to_string();
    index += 1;

    if x == 'R' || x == 'C' {
      let rename_start = index;
      while index < data.len() && data[index] != 0 {
        index += 1;
      }
      if index < data.len() {
        path = String::from_utf8_lossy(&data[rename_start..index]).to_string();
        index += 1;
      }
    }

    entries.push(GitStatusEntry { x, y, path: normalize_rel_path(&path) });
  }

  Ok(entries)
}
