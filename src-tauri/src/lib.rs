mod commands;
mod data_store;
mod file_source;
mod parser;
mod serial_source;

use commands::GlobalState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(GlobalState::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_serial_ports,
            commands::connect_serial,
            commands::disconnect_serial,
            commands::start_data_stream,
            commands::stop_data_stream,
            commands::start_file_stream,
            commands::stop_file_stream,
            commands::set_line_filters,
            commands::get_available_fields,
            commands::get_parsed_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
