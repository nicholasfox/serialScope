use std::collections::HashMap;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParserConfig {
    pub device: String,
    pub line_prefix: Option<String>,
    pub delimiter: Option<String>,
    pub group_chars: Option<Vec<String>>,
    pub fields: Vec<FieldConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldConfig {
    pub name: String,
    pub field_type: FieldType,
    pub aliases: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldType {
    Scalar,
    Array,
    NamedArray,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedResult {
    pub timestamp: f64,
    pub raw: String,
    pub numeric_fields: HashMap<String, f64>,
    pub string_fields: HashMap<String, String>,
    pub array_fields: HashMap<String, Vec<f64>>,
}

pub struct Parser {
    std_line_re: Regex,
    array_group_re: Regex,
    named_array_re: Regex,
}

impl Default for Parser {
    fn default() -> Self {
        Self::new()
    }
}

impl Parser {
    pub fn new() -> Self {
        Self {
            std_line_re: Regex::new(r"(\w+)=([^,}\])]+)").unwrap(),
            array_group_re: Regex::new(r"(\w+)=\{([^}]*)\}").unwrap(),
            named_array_re: Regex::new(r"\{([^}]+)\}=\{([^}]*)\}").unwrap(),
        }
    }

    pub fn parse_line(&self, line: &str, config: &ParserConfig) -> Option<ParsedResult> {
        use chrono::Utc;

        let timestamp = Utc::now().timestamp_millis() as f64 / 1000.0;

        let content = if let Some(ref prefix) = config.line_prefix {
            line.trim().strip_prefix(prefix.as_str())?.trim()
        } else {
            line.trim()
        };

        let mut numeric_fields = HashMap::new();
        let mut string_fields = HashMap::new();
        let mut array_fields = HashMap::new();

        // Handle named arrays: {name1,name2}={v1,v2}
        if let Some(caps) = self.named_array_re.captures(&content) {
            let names_str = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let values_str = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            let names: Vec<&str> = names_str.split(',').map(|s| s.trim()).collect();
            let values: Vec<&str> = values_str.split(',').map(|s| s.trim()).collect();

            for (i, name) in names.iter().enumerate() {
                if let Some(val_str) = values.get(i) {
                    if let Ok(val) = val_str.parse::<f64>() {
                        numeric_fields.insert(name.to_string(), val);
                    } else {
                        string_fields.insert(name.to_string(), val_str.to_string());
                    }
                }
            }
        }

        // Handle array groups: groupname={v1,v2,v3}
        if let Some(caps) = self.array_group_re.captures(&content) {
            let group_name = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let values_str = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            let values: Vec<f64> = values_str
                .split(',')
                .filter_map(|s| s.trim().parse::<f64>().ok())
                .collect();

            if !values.is_empty() {
                array_fields.insert(group_name.to_string(), values.clone());
                for (i, val) in values.iter().enumerate() {
                    numeric_fields.insert(
                        format!("{}_{}", group_name, i),
                        *val,
                    );
                }
            }
        }

        // Handle same with parens: (...)
        let paren_array_re = Regex::new(r"(\w+)=\(([^)]*)\)").unwrap();
        if let Some(caps) = paren_array_re.captures(&content) {
            let group_name = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let values_str = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            let values: Vec<f64> = values_str
                .split(',')
                .filter_map(|s| s.trim().parse::<f64>().ok())
                .collect();

            if !values.is_empty() {
                array_fields.insert(group_name.to_string(), values.clone());
                for (i, val) in values.iter().enumerate() {
                    numeric_fields.insert(
                        format!("{}_{}", group_name, i),
                        *val,
                    );
                }
            }
        }

        // Handle standard name=value pairs
        for caps in self.std_line_re.captures_iter(&content) {
            let name = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let value = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            if let Ok(val) = value.parse::<f64>() {
                numeric_fields.insert(name.to_string(), val);
            } else {
                string_fields.insert(name.to_string(), value.to_string());
            }
        }

        if numeric_fields.is_empty() && string_fields.is_empty() && array_fields.is_empty() {
            return None;
        }

        Some(ParsedResult {
            timestamp,
            raw: line.to_string(),
            numeric_fields,
            string_fields,
            array_fields,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_standard_fields() {
        let parser = Parser::new();
        let config = ParserConfig {
            device: "test".to_string(),
            line_prefix: Some("TAG:".to_string()),
            delimiter: Some(",".to_string()),
            group_chars: None,
            fields: vec![],
        };

        let result = parser.parse_line("TAG: rssi=-45,ber=0.02,freq=2400", &config);
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.numeric_fields.get("rssi"), Some(&-45.0));
        assert_eq!(r.numeric_fields.get("ber"), Some(&0.02));
        assert_eq!(r.numeric_fields.get("freq"), Some(&2400.0));
    }

    #[test]
    fn test_parse_array_group() {
        let parser = Parser::new();
        let config = ParserConfig {
            device: "test".to_string(),
            line_prefix: None,
            delimiter: None,
            group_chars: None,
            fields: vec![],
        };

        let result = parser.parse_line("channels={13,11,11,2,1,1,1},rssi=-45", &config);
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.array_fields.get("channels").unwrap().len(), 7);
        assert_eq!(r.numeric_fields.get("channels_0"), Some(&13.0));
        assert_eq!(r.numeric_fields.get("channels_1"), Some(&11.0));
        assert_eq!(r.numeric_fields.get("rssi"), Some(&-45.0));
    }

    #[test]
    fn test_parse_named_array() {
        let parser = Parser::new();
        let config = ParserConfig::default_config("test");

        let result = parser.parse_line("{ch1,ch2,ch3}={10,20,30}", &config);
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.numeric_fields.get("ch1"), Some(&10.0));
        assert_eq!(r.numeric_fields.get("ch2"), Some(&20.0));
        assert_eq!(r.numeric_fields.get("ch3"), Some(&30.0));
    }

    #[test]
    fn test_parse_parenthesis_group() {
        let parser = Parser::new();
        let config = ParserConfig::default_config("test");

        let result = parser.parse_line("data=(1,2,3,4,5)", &config);
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.numeric_fields.get("data_0"), Some(&1.0));
        assert_eq!(r.numeric_fields.get("data_4"), Some(&5.0));
    }

    #[test]
    fn test_parse_mixed() {
        let parser = Parser::new();
        let config = ParserConfig::default_config("test");

        let line = "DATA: rssi=-45,snr=12.5,channels={1,2,3,4,5,6}";
        let result = parser.parse_line(line, &config);
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.numeric_fields.get("rssi"), Some(&-45.0));
        assert_eq!(r.numeric_fields.get("snr"), Some(&12.5));
        assert_eq!(r.numeric_fields.get("channels_0"), Some(&1.0));
    }
}

impl ParserConfig {
    pub fn default_config(device: &str) -> Self {
        Self {
            device: device.to_string(),
            line_prefix: None,
            delimiter: Some(",".to_string()),
            group_chars: None,
            fields: vec![],
        }
    }
}
