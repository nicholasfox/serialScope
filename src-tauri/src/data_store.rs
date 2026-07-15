use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::parser::ParsedResult;

pub type SharedDataStore = Arc<Mutex<DataStore>>;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct DataPoint {
    pub timestamp: f64,
    pub fields: HashMap<String, f64>,
}

pub fn result_to_datapoint(result: &ParsedResult) -> DataPoint {
    DataPoint {
        timestamp: result.timestamp,
        fields: result.numeric_fields.clone(),
    }
}

pub struct DataStore {
    ring: Vec<DataPoint>,
    max_size: usize,
}

impl DataStore {
    pub fn new(max_size: usize) -> Self {
        Self {
            ring: Vec::with_capacity(max_size),
            max_size,
        }
    }

    pub fn push(&mut self, point: DataPoint) {
        if self.ring.len() >= self.max_size {
            self.ring.remove(0);
        }
        self.ring.push(point);
    }

    pub fn get_all(&self) -> &[DataPoint] {
        &self.ring
    }

    pub fn get_field(&self, field_name: &str) -> Vec<(f64, f64)> {
        self.ring
            .iter()
            .filter_map(|p| {
                p.fields
                    .get(field_name)
                    .map(|&v| (p.timestamp, v))
            })
            .collect()
    }

    pub fn get_available_fields(&self) -> Vec<String> {
        let mut fields: Vec<String> = Vec::new();
        for point in &self.ring {
            for key in point.fields.keys() {
                if !fields.contains(key) {
                    fields.push(key.clone());
                }
            }
        }
        fields
    }
}

pub fn create_shared_store(max_size: usize) -> SharedDataStore {
    Arc::new(Mutex::new(DataStore::new(max_size)))
}
