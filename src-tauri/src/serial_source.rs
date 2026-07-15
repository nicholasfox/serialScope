use tokio_serial::SerialStream;

pub struct SerialSource {
    port_name: String,
    baud_rate: u32,
}

pub type BufferedPort = tokio::io::BufReader<SerialStream>;

#[derive(Clone, Debug, serde::Serialize)]
pub struct SerialPortInfo {
    pub name: String,
    pub available: bool,
}

impl SerialSource {
    pub fn new(port_name: &str, baud_rate: u32) -> Self {
        Self {
            port_name: port_name.to_string(),
            baud_rate,
        }
    }

    pub fn connect(&self) -> Result<BufferedPort, String> {
        let port = tokio_serial::new(&self.port_name, self.baud_rate)
            .open_native_async()
            .map_err(|e| format!("Failed to open serial port: {}", e))?;

        let buffered = tokio::io::BufReader::new(port);
        Ok(buffered)
    }

    pub fn port_name(&self) -> &str {
        &self.port_name
    }
}

pub async fn read_line_from_port(port: &mut BufferedPort) -> Result<String, String> {
    use tokio::io::AsyncBufReadExt;
    let mut line = String::new();
    port
        .read_line(&mut line)
        .await
        .map_err(|e| format!("Read error: {}", e))?;
    Ok(line.trim().to_string())
}

pub fn list_available_ports() -> Vec<SerialPortInfo> {
    tokio_serial::available_ports()
        .map(|ports| {
            ports
                .into_iter()
                .map(|p| SerialPortInfo {
                    name: p.port_name,
                    available: true,
                })
                .collect()
        })
        .unwrap_or_default()
}
