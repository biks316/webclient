mod commands;

use commands::file_store::{
    read_collection_automation, read_scripts, save_collection_automation_script,
    save_response_example, save_script,
};
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
            request_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running BikAPI");
}
