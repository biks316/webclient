mod commands;

use commands::file_store::{
    read_app_state, read_collection_automation, read_recent_workspaces, read_scripts, save_app_state,
    read_text_file, read_text_folder_recursive, save_collection_automation_script,
    save_response_example, save_script, save_recent_workspaces,
};
use commands::git::{
    clone_workspace, get_git_remote_url, get_git_status, get_sync_status, initialize_git_repository,
    run_git_action, save_workspace_snapshot,
};
use commands::request_runner::send_request;
use commands::timeline::{read_history_entry, request_diff};
use commands::workspace::{
    create_collection, create_endpoint, create_environment, create_flow, create_workspace,
    create_workspace_in_directory, delete_collection, delete_environment, delete_flow, delete_request, open_workspace,
    duplicate_collection, duplicate_flow, duplicate_request, read_flow, rename_collection,
    rename_flow, rename_request, save_collection_variables, save_environment_variables, save_flow,
    save_globals, save_request,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_workspace,
            create_workspace_in_directory,
            open_workspace,
            create_collection,
            create_environment,
            delete_environment,
            create_endpoint,
            create_flow,
            rename_collection,
            delete_collection,
            duplicate_collection,
            rename_request,
            delete_request,
            duplicate_request,
            rename_flow,
            delete_flow,
            duplicate_flow,
            save_request,
            read_flow,
            save_flow,
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
            initialize_git_repository,
            clone_workspace,
            save_workspace_snapshot,
            read_app_state,
            save_app_state,
            read_recent_workspaces,
            save_recent_workspaces,
            read_text_file,
            read_text_folder_recursive
        ])
        .run(tauri::generate_context!())
        .expect("error while running BikAPI");
}
