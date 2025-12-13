use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
struct AIResponse {
    reply: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AIRequest {
    message: String,
}

// 发送消息到AI服务
#[command]
async fn send_message_to_ai(message: String, api_url: String) -> Result<AIResponse, String> {
    let client = reqwest::Client::new();
    let request = AIRequest { message };
    
    match client.post(&api_url)
        .json(&request)
        .send()
        .await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<AIResponse>().await {
                        Ok(ai_response) => Ok(ai_response),
                        Err(e) => Err(format!("解析响应失败: {}", e))
                    }
                } else {
                    Err(format!("API请求失败: 状态码 {}", response.status()))
                }
            },
            Err(e) => Err(format!("发送请求失败: {}", e))
        }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        send_message_to_ai
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
