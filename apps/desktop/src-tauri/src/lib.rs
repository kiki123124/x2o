use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tauri::command;

/// Perform an HTTP request and return (status, body) as a string.
/// This avoids the IPC memory explosion from tauriFetch plugin
/// which serialises raw response bytes as a JSON array of numbers.
#[command]
async fn http_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<(u16, String), String> {
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => client.get(&url),
    };
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok((status, text))
}

/// Read a UTF-8 text file directly in Rust to avoid JS-side byte-array
/// serialization overhead for large files.
#[command]
async fn read_text_file_rust(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())
}

#[command]
async fn append_debug_log(line: String) -> Result<(), String> {
    let path = "/tmp/x2o-debug.log";
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let full = format!("[{}] {}\n", now, line);
    use tokio::io::AsyncWriteExt;
    let mut f = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .await
        .map_err(|e| e.to_string())?;
    f.write_all(full.as_bytes()).await.map_err(|e| e.to_string())
}

#[command]
async fn open_target(target: String) -> Result<(), String> {
    let status = Command::new("open")
        .arg(target)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("open command failed with status: {}", status))
    }
}

#[command]
async fn open_in_obsidian(path: String) -> Result<(), String> {
    // Ensure this folder is registered as a vault in Obsidian config.
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let cfg_path = format!("{}/Library/Application Support/obsidian/obsidian.json", home);
    let raw = tokio::fs::read_to_string(&cfg_path)
        .await
        .unwrap_or_else(|_| "{\"vaults\":{}}".to_string());
    let mut cfg: Value =
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({ "vaults": {} }));
    if !cfg.get("vaults").map(|v| v.is_object()).unwrap_or(false) {
        cfg["vaults"] = serde_json::json!({});
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let exists = cfg
        .get("vaults")
        .and_then(|v| v.as_object())
        .map(|vaults| {
            vaults
                .values()
                .any(|meta| meta.get("path").and_then(|v| v.as_str()) == Some(path.as_str()))
        })
        .unwrap_or(false);

    if !exists {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        path.hash(&mut hasher);
        now_ms.hash(&mut hasher);
        let id = format!("{:016x}", hasher.finish());
        cfg["vaults"][id] = serde_json::json!({
            "path": path,
            "ts": now_ms
        });
        let out = serde_json::to_string(&cfg).map_err(|e| e.to_string())?;
        tokio::fs::write(&cfg_path, out).await.map_err(|e| e.to_string())?;
    }

    // Open root note to force Obsidian routing into this vault.
    let root_note = format!("{}/_index.md", path);
    let target = if Path::new(&root_note).exists() {
        root_note
    } else {
        path
    };

    let status = Command::new("open")
        .arg("-a")
        .arg("Obsidian")
        .arg(target)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("open -a Obsidian failed with status: {}", status))
    }
}

#[derive(Serialize)]
struct BookmarkLoadResult {
    bookmarks_json: String,
    total: usize,
    returned: usize,
    truncated: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BookmarkMedia {
    #[serde(rename = "type")]
    media_type: String,
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    alt_text: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BookmarkMetrics {
    likes: i64,
    retweets: i64,
    replies: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BookmarkItem {
    id: String,
    text: String,
    author_name: String,
    author_handle: String,
    created_at: String,
    url: String,
    media: Vec<BookmarkMedia>,
    metrics: BookmarkMetrics,
}

const X_BEARER_TOKEN: &str =
    "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const X_BOOKMARK_QUERY_ID: &str = "-LGfdImKeQz0xS_jjUwzlA";

/// Load bookmarks from JSON and cap returned items to reduce IPC memory usage.
#[command]
async fn load_bookmarks_json(path: String, limit: usize) -> Result<BookmarkLoadResult, String> {
    let raw = tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let mut bookmarks = match value {
        Value::Array(arr) => arr,
        Value::Object(mut map) => match map.remove("bookmarks") {
            Some(Value::Array(arr)) => arr,
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };

    let total = bookmarks.len();
    let effective_limit = if limit == 0 { total } else { limit.min(total) };
    bookmarks.truncate(effective_limit);

    let bookmarks_json = serde_json::to_string(&bookmarks).map_err(|e| e.to_string())?;
    Ok(BookmarkLoadResult {
        bookmarks_json,
        total,
        returned: bookmarks.len(),
        truncated: bookmarks.len() < total,
    })
}

fn get_path<'a>(root: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut cur = root;
    for key in path {
        cur = cur.get(*key)?;
    }
    Some(cur)
}

fn parse_bookmark_entries(json: &Value) -> (Vec<BookmarkItem>, Option<String>) {
    let instructions = get_path(
        json,
        &["data", "bookmark_timeline_v2", "timeline", "instructions"],
    )
    .or_else(|| {
        get_path(
            json,
            &[
                "data",
                "search_by_raw_query",
                "bookmarks_search_timeline",
                "timeline",
                "instructions",
            ],
        )
    })
    .and_then(|v| v.as_array());

    let mut out: Vec<BookmarkItem> = Vec::new();
    let mut next_cursor: Option<String> = None;

    let Some(instructions) = instructions else {
        return (out, next_cursor);
    };

    let entries = instructions
        .iter()
        .find(|i| i.get("type").and_then(|v| v.as_str()) == Some("TimelineAddEntries"))
        .and_then(|v| v.get("entries"))
        .and_then(|v| v.as_array());

    let Some(entries) = entries else {
        return (out, next_cursor);
    };

    for entry in entries {
        let entry_id = entry.get("entryId").and_then(|v| v.as_str()).unwrap_or("");

        if entry_id.starts_with("cursor-bottom-") {
            next_cursor = get_path(entry, &["content", "value"])
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            continue;
        }

        if !entry_id.starts_with("tweet-") {
            continue;
        }

        let mut result = get_path(
            entry,
            &["content", "itemContent", "tweet_results", "result"],
        )
        .cloned()
        .unwrap_or(Value::Null);

        if result
            .get("__typename")
            .and_then(|v| v.as_str())
            == Some("TweetWithVisibilityResults")
        {
            result = result.get("tweet").cloned().unwrap_or(Value::Null);
        }

        let legacy = result.get("legacy").cloned().unwrap_or(Value::Null);
        if legacy.is_null() {
            continue;
        }

        let user_result = get_path(&result, &["core", "user_results", "result"])
            .cloned()
            .unwrap_or(Value::Null);
        let user_core = user_result.get("core").cloned().unwrap_or(Value::Null);
        let user_legacy = user_result.get("legacy").cloned().unwrap_or(Value::Null);

        let screen_name = user_core
            .get("screen_name")
            .and_then(|v| v.as_str())
            .or_else(|| user_legacy.get("screen_name").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();
        let author_name = user_core
            .get("name")
            .and_then(|v| v.as_str())
            .or_else(|| user_legacy.get("name").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();
        let rest_id = result
            .get("rest_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if rest_id.is_empty() {
            continue;
        }

        let media = get_path(&legacy, &["extended_entities", "media"])
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .map(|m| {
                        let typ = m.get("type").and_then(|v| v.as_str()).unwrap_or("photo");
                        let media_type = match typ {
                            "video" => "video",
                            "animated_gif" => "gif",
                            _ => "photo",
                        }
                        .to_string();
                        BookmarkMedia {
                            media_type,
                            url: m
                                .get("media_url_https")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            alt_text: m
                                .get("ext_alt_text")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        // Prefer note_tweet full text for X Notes (long-form tweets)
        let note_text = get_path(
            &result,
            &["note_tweet", "note_tweet_results", "result", "text"],
        )
        .and_then(|v| v.as_str());

        let full_text = note_text
            .unwrap_or_else(|| {
                legacy
                    .get("full_text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
            })
            .to_string();

        let item = BookmarkItem {
            id: rest_id.clone(),
            text: full_text,
            author_name,
            author_handle: screen_name.clone(),
            created_at: legacy
                .get("created_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            url: if !screen_name.is_empty() {
                format!("https://x.com/{}/status/{}", screen_name, rest_id)
            } else {
                format!("https://x.com/i/status/{}", rest_id)
            },
            media,
            metrics: BookmarkMetrics {
                likes: legacy
                    .get("favorite_count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
                retweets: legacy
                    .get("retweet_count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
                replies: legacy
                    .get("reply_count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
            },
        };
        out.push(item);
    }

    (out, next_cursor)
}

/// Resolve t.co short URLs to real URLs (exposed as Tauri command for import path).
#[command]
async fn resolve_tco_urls_cmd(bookmarks: Vec<BookmarkItem>) -> Result<Vec<BookmarkItem>, String> {
    let mut bm = bookmarks;
    resolve_tco_urls(&mut bm).await;
    Ok(bm)
}

/// Resolve t.co short URLs to real URLs by following redirects.
async fn resolve_tco_urls(bookmarks: &mut Vec<BookmarkItem>) {
    use regex::Regex;
    use std::collections::HashSet;

    let tco_re = Regex::new(r"https?://t\.co/\w+").unwrap();

    // Collect unique t.co URLs
    let mut urls: HashSet<String> = HashSet::new();
    for b in bookmarks.iter() {
        for m in tco_re.find_iter(&b.text) {
            urls.insert(m.as_str().to_string());
        }
    }
    if urls.is_empty() {
        return;
    }

    // Resolve with no-redirect client
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut url_map: HashMap<String, String> = HashMap::new();
    for url in &urls {
        if let Ok(res) = client.head(url).send().await {
            if let Some(loc) = res.headers().get("location") {
                if let Ok(real) = loc.to_str() {
                    url_map.insert(url.clone(), real.to_string());
                }
            }
        }
    }

    // Replace in bookmark text
    for b in bookmarks.iter_mut() {
        let new_text = tco_re.replace_all(&b.text, |caps: &regex::Captures| {
            let matched = caps.get(0).unwrap().as_str();
            url_map.get(matched).cloned().unwrap_or_else(|| matched.to_string())
        });
        b.text = new_text.into_owned();
    }
}

#[command]
async fn fetch_bookmarks_rust(cookie: String, limit: usize) -> Result<Vec<BookmarkItem>, String> {
    if limit == 0 {
        return Ok(Vec::new());
    }
    let csrf_token = cookie
        .split(';')
        .map(|s| s.trim())
        .find_map(|part| part.strip_prefix("ct0=").map(|v| v.to_string()))
        .ok_or_else(|| "Cookie missing ct0".to_string())?;

    let client = reqwest::Client::new();
    let mut collected: Vec<BookmarkItem> = Vec::new();
    let mut cursor: Option<String> = None;

    while collected.len() < limit {
        let count = std::cmp::min(20, limit - collected.len());
        let mut variables = serde_json::json!({
            "count": count,
            "includePromotedContent": false
        });
        if let Some(c) = &cursor {
            variables["cursor"] = Value::String(c.clone());
        }
        let features = serde_json::json!({
            "graphql_timeline_v2_bookmark_timeline": true,
            "responsive_web_graphql_exclude_directive_enabled": true,
            "verified_phone_label_enabled": false,
            "responsive_web_graphql_timeline_navigation_enabled": true,
            "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
            "creator_subscriptions_tweet_preview_api_enabled": true,
            "communities_web_enable_tweet_community_results_fetch": true,
            "c9s_tweet_anatomy_moderator_badge_enabled": true,
            "tweetypie_unmention_optimization_enabled": true,
            "responsive_web_edit_tweet_api_enabled": true,
            "longform_notetweets_consumption_enabled": true,
            "responsive_web_media_download_video_enabled": false,
            "responsive_web_enhance_cards_enabled": false
        });

        let query = [
            ("variables", variables.to_string()),
            ("features", features.to_string()),
        ];
        let url = reqwest::Url::parse_with_params(
            &format!(
                "https://x.com/i/api/graphql/{}/Bookmarks",
                X_BOOKMARK_QUERY_ID
            ),
            &query,
        )
        .map_err(|e| e.to_string())?;

        let res = client
            .get(url)
            .header("authorization", format!("Bearer {}", X_BEARER_TOKEN))
            .header("cookie", &cookie)
            .header("x-csrf-token", &csrf_token)
            .header("x-twitter-active-user", "yes")
            .header("x-twitter-auth-type", "OAuth2Session")
            .header("content-type", "application/json")
            .header(
                "user-agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            )
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let status = res.status();
            let txt = res.text().await.unwrap_or_default();
            return Err(format!("X API error {}: {}", status, txt.chars().take(240).collect::<String>()));
        }

        let body = res.text().await.map_err(|e| e.to_string())?;
        let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        let (mut items, next) = parse_bookmark_entries(&json);
        if items.is_empty() {
            break;
        }
        collected.append(&mut items);
        cursor = next;
        if cursor.is_none() {
            break;
        }
    }

    if collected.len() > limit {
        collected.truncate(limit);
    }

    // Resolve t.co short URLs to real URLs
    resolve_tco_urls(&mut collected).await;

    Ok(collected)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            http_request,
            read_text_file_rust,
            append_debug_log,
            open_target,
            open_in_obsidian,
            load_bookmarks_json,
            fetch_bookmarks_rust,
            resolve_tco_urls_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
