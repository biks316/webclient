mod commands;

use commands::file_store::{
    read_app_state, read_collection_automation, read_scripts, save_app_state,
    save_collection_automation_script, save_response_example, save_script,
};
use commands::git::{get_git_remote_url, get_git_status, get_sync_status, run_git_action, save_workspace_snapshot};
use commands::request_runner::send_request;
use commands::timeline::{read_history_entry, request_diff};
use commands::workspace::{
    create_collection, create_endpoint, create_environment, create_workspace, open_workspace,
    save_collection_variables, save_environment_variables, save_globals, save_request,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_workspace,
            open_workspace,
            create_collection,
            create_environment,
            create_endpoint,
            save_request,
            save_globals,
            save_collection_variables,
            save_environment_variables,
            send_request,
            read_collection_automation,
            save_collection_automation_script,
            save_response_example,
            read_scripts,
            save_script,
            read_history_entry,
            request_diff,
            get_git_remote_url,
            get_git_status,
            get_sync_status,
            run_git_action,
            save_workspace_snapshot,
            read_app_state,
            save_app_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running BikAPI");
}
