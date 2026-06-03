use crate::commands::workspace::{read_json, CommandResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadHistoryPayload {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffPayload {
    pub current: Value,
    pub historical_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffRow {
    pub path: String,
    pub before: Option<Value>,
    pub after: Option<Value>,
    pub change: String,
}

#[tauri::command]
pub fn read_history_entry(payload: ReadHistoryPayload) -> CommandResult<Value> {
    read_json(&PathBuf::from(payload.path))
}

#[tauri::command]
pub fn request_diff(payload: DiffPayload) -> CommandResult<Vec<DiffRow>> {
    let historical = read_json(&PathBuf::from(payload.historical_path))?;
    let mut rows = Vec::new();
    diff_value("$", &historical, &payload.current, &mut rows);
    Ok(rows)
}

fn diff_value(path: &str, before: &Value, after: &Value, rows: &mut Vec<DiffRow>) {
    match (before, after) {
        (Value::Object(before_map), Value::Object(after_map)) => {
            let keys: BTreeSet<String> = before_map
                .keys()
                .chain(after_map.keys())
                .map(String::from)
                .collect();
            for key in keys {
                let next_path = format!("{path}.{key}");
                match (before_map.get(&key), after_map.get(&key)) {
                    (Some(before_value), Some(after_value)) => {
                        diff_value(&next_path, before_value, after_value, rows)
                    }
                    (Some(before_value), None) => rows.push(DiffRow {
                        path: next_path,
                        before: Some(before_value.clone()),
                        after: None,
                        change: "removed".to_string(),
                    }),
                    (None, Some(after_value)) => rows.push(DiffRow {
                        path: next_path,
                        before: None,
                        after: Some(after_value.clone()),
                        change: "added".to_string(),
                    }),
                    (None, None) => {}
                }
            }
        }
        _ if before == after => {}
        _ => rows.push(DiffRow {
            path: path.to_string(),
            before: Some(before.clone()),
            after: Some(after.clone()),
            change: "changed".to_string(),
        }),
    }
}
