use std::fs;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::time::Duration;

use crate::data_store::{result_to_datapoint, SharedDataStore};
use crate::parser::{Parser, ParserConfig};

fn resolve_path(path: &str) -> std::path::PathBuf {
    let p = std::path::Path::new(path);
    if p.is_absolute() {
        return p.to_path_buf();
    }
    // Try as-is first (relative to cwd)
    if p.exists() {
        return p.to_path_buf();
    }
    // Try one level up (tauri dev runs with cwd = src-tauri/)
    let parent = std::path::Path::new("..").join(path);
    if parent.exists() {
        return parent;
    }
    // Fallback: resolve against current exe dir
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let exe_relative = dir.join(path);
            if exe_relative.exists() {
                return exe_relative;
            }
        }
    }
    p.to_path_buf()
}

pub async fn run_file_stream(
    app: AppHandle,
    file_path: String,
    interval_ms: u64,
    data_store: SharedDataStore,
    parser: Arc<Mutex<Parser>>,
    config: Arc<Mutex<ParserConfig>>,
    stop_flag: Arc<Mutex<bool>>,
) {
    let resolved = resolve_path(&file_path);
    let content = match fs::read_to_string(&resolved) {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("source-error", format!("Failed to read file {}: {}", resolved.display(), e));
            return;
        }
    };

    let lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    if lines.is_empty() {
        let _ = app.emit("source-error", "File is empty".to_string());
        return;
    }

    let _ = app.emit("source-status", format!("Loaded {} lines from {}", lines.len(), resolved.display()));

    loop {
        for line in &lines {
            {
                let stop = stop_flag.lock().await;
                if *stop {
                    return;
                }
            }

            let parser = parser.lock().await;
            let config = config.lock().await;

            if let Some(result) = parser.parse_line(line, &config) {
                let point = result_to_datapoint(&result);
                data_store.lock().await.push(point);

                let fields = result.numeric_fields.clone();
                let raw = result.raw.clone();

                drop(parser);
                drop(config);

                let _ = app.emit("data-point", fields);
                let _ = app.emit("raw-line", raw);
            } else {
                let _ = app.emit("raw-line", line.clone());
            }

            tokio::time::sleep(Duration::from_millis(interval_ms)).await;
        }
    }
}
