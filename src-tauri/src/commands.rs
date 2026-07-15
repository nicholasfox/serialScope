use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use crate::data_store::{create_shared_store, DataPoint, SharedDataStore};
use crate::parser::{Parser, ParserConfig, ParsedResult};
use crate::serial_source;

struct AppState {
    connected: bool,
    port_name: String,
    baud_rate: u32,
    active_stream: bool,
}

pub struct GlobalState {
    pub state: Arc<Mutex<AppState>>,
    pub data_store: SharedDataStore,
    pub parser: Arc<Mutex<Parser>>,
    pub config: Arc<Mutex<ParserConfig>>,
    pub port: Arc<Mutex<Option<serial_source::BufferedPort>>>,
    pub stream_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl Default for GlobalState {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(AppState {
                connected: false,
                port_name: String::new(),
                baud_rate: 115200,
                active_stream: false,
            })),
            data_store: create_shared_store(10000),
            parser: Arc::new(Mutex::new(Parser::new())),
            config: Arc::new(Mutex::new(ParserConfig::default_config("default"))),
            port: Arc::new(Mutex::new(None)),
            stream_handle: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn list_serial_ports() -> Vec<serial_source::SerialPortInfo> {
    serial_source::list_available_ports()
}

#[tauri::command]
pub async fn connect_serial(
    port_name: String,
    baud_rate: u32,
    state: State<'_, GlobalState>,
) -> Result<String, String> {
    let mut app_state = state.state.lock().await;

    let source = serial_source::SerialSource::new(&port_name, baud_rate);
    let buffered = source.connect()?;

    let mut port_guard = state.port.lock().await;
    *port_guard = Some(buffered);

    app_state.connected = true;
    app_state.port_name = port_name.clone();
    app_state.baud_rate = baud_rate;

    Ok(format!("Connected to {} at {} baud", port_name, baud_rate))
}

#[tauri::command]
pub async fn disconnect_serial(
    state: State<'_, GlobalState>,
) -> Result<String, String> {
    let mut app_state = state.state.lock().await;

    let mut handle = state.stream_handle.lock().await;
    if let Some(h) = handle.take() {
        h.abort();
    }

    let mut port = state.port.lock().await;
    *port = None;

    app_state.connected = false;
    app_state.active_stream = false;

    Ok("Disconnected".to_string())
}

#[tauri::command]
pub async fn start_data_stream(
    app: AppHandle,
    state: State<'_, GlobalState>,
) -> Result<String, String> {
    let mut app_state = state.state.lock().await;
    if !app_state.connected {
        return Err("Not connected to any device".to_string());
    }
    app_state.active_stream = true;
    drop(app_state);

    let port = state.port.clone();
    let data_store = state.data_store.clone();
    let parser = state.parser.clone();
    let config = state.config.clone();
    let app_handle = app.clone();

    let handle = tokio::spawn(async move {
        loop {
            let mut port_guard = port.lock().await;
            let port_ref = port_guard.as_mut();

            if let Some(p) = port_ref {
                match serial_source::read_line_from_port(p).await {
                    Ok(line) => {
                        let parser = parser.lock().await;
                        let config = config.lock().await;

                        if let Some(result) = parser.parse_line(&line, &config) {
                            let point = result_to_datapoint(&result);
                            data_store.lock().await.push(point);

                            let fields = result.numeric_fields.clone();
                            let raw = result.raw.clone();

                            drop(parser);
                            drop(config);

                            let _ = app_handle.emit("data-point", fields);
                            let _ = app_handle.emit("raw-line", raw);
                        }
                    }
                    Err(_) => {
                        break;
                    }
                }
            } else {
                break;
            }
            drop(port_guard);

            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
        }
    });

    let mut stream_handle = state.stream_handle.lock().await;
    *stream_handle = Some(handle);

    Ok("Data stream started".to_string())
}

#[tauri::command]
pub async fn stop_data_stream(
    state: State<'_, GlobalState>,
) -> Result<String, String> {
    let mut app_state = state.state.lock().await;
    app_state.active_stream = false;

    let mut handle = state.stream_handle.lock().await;
    if let Some(h) = handle.take() {
        h.abort();
    }

    Ok("Data stream stopped".to_string())
}

#[tauri::command]
pub async fn get_available_fields(
    state: State<'_, GlobalState>,
) -> Result<Vec<String>, String> {
    let store = state.data_store.lock().await;
    Ok(store.get_available_fields())
}

#[tauri::command]
pub async fn get_parsed_data(
    field: String,
    max_points: Option<usize>,
    state: State<'_, GlobalState>,
) -> Result<Vec<Vec<f64>>, String> {
    let store = state.data_store.lock().await;
    let points = store.get_field(&field);

    let max = max_points.unwrap_or(5000);
    let sampled: Vec<(f64, f64)> = if points.len() > max {
        let step = points.len() / max;
        points.iter().step_by(step).copied().collect()
    } else {
        points
    };

    Ok(sampled.into_iter().map(|(t, v)| vec![t, v]).collect())
}

fn result_to_datapoint(result: &ParsedResult) -> DataPoint {
    DataPoint {
        timestamp: result.timestamp,
        fields: result.numeric_fields.clone(),
    }
}
