use std::{
  fs,
  io::{ErrorKind, Read, Write},
  net::{TcpListener, TcpStream},
  path::PathBuf,
  sync::Mutex,
  thread,
  time::Duration,
};

use keyring::Entry;
use reqwest::Method;
use serde::Serialize;
use tauri::{AppHandle, LogicalSize, Manager, Size, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

const IDLE_WIDTH: f64 = 92.0;
const IDLE_HEIGHT: f64 = 92.0;
const CARD_WIDTH: f64 = 332.0;
const CARD_HEIGHT: f64 = 240.0;
const TOKEN_SERVICE: &str = "Thought Space Orb";
const TOKEN_ACCOUNT: &str = "desktop-session";
const CONTROL_ACCOUNT: &str = "desktop-control";
const CONTROL_PORT: u16 = 17894;

struct PendingTicket(Mutex<Option<String>>);

enum OrbAction {
  Show(Option<String>, Option<String>),
  Hide(Option<String>),
}

#[derive(Serialize)]
struct DesktopApiResponse {
  status: u16,
  body: String,
}

fn position_path(app: &AppHandle) -> Result<PathBuf, String> {
  let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
  fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
  Ok(directory.join("orb-position.txt"))
}

fn saved_position(app: &AppHandle) -> Option<(f64, f64)> {
  let contents = fs::read_to_string(position_path(app).ok()?).ok()?;
  let mut values = contents.split(',').filter_map(|value| value.parse::<f64>().ok());
  Some((values.next()?, values.next()?))
}

fn orb_action_from_url(url: &Url) -> Option<OrbAction> {
  if url.scheme() != "thoughtspace" {
    return None;
  }

  match url.host_str() {
    Some("open-orb") => Some(OrbAction::Show(
      url.query_pairs().find(|(name, _)| name == "ticket").map(|(_, value)| value.into_owned()),
      url.query_pairs().find(|(name, _)| name == "control").map(|(_, value)| value.into_owned()),
    )),
    Some("hide-orb") => Some(OrbAction::Hide(
      url.query_pairs().find(|(name, _)| name == "control").map(|(_, value)| value.into_owned()),
    )),
    _ => None,
  }
}

fn open_orb(app: &AppHandle, ticket: Option<String>, control_secret: Option<String>) -> Result<(), String> {
  let refresh_shell = ticket.is_some();
  if let Some(control_secret) = control_secret {
    store_control_secret(&control_secret)?;
  }
  if let Some(ticket) = ticket {
    *app.state::<PendingTicket>().0.lock().map_err(|error| error.to_string())? = Some(ticket);
  }
  if let Some(window) = app.get_webview_window("orb") {
    if refresh_shell {
      window.eval("window.location.reload();").map_err(|error| error.to_string())?;
    }
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    return Ok(());
  }

  let mut builder = WebviewWindowBuilder::new(app, "orb", WebviewUrl::App("orb-shell/index.html".into()))
    .title("Thought Space")
    .inner_size(IDLE_WIDTH, IDLE_HEIGHT)
    .transparent(true)
    .decorations(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(true);

  if let Some((x, y)) = saved_position(app) {
    builder = builder.position(x, y);
  }

  builder.build().map_err(|error| error.to_string())?;
  Ok(())
}

fn hide_orb(app: &AppHandle) -> Result<(), String> {
  if let Some(window) = app.get_webview_window("orb") {
    window.hide().map_err(|error| error.to_string())?;
  }
  Ok(())
}

fn handle_orb_url(app: &AppHandle, url: &Url) -> Result<(), String> {
  match orb_action_from_url(url) {
    Some(OrbAction::Show(ticket, control_secret)) => open_orb(app, ticket, control_secret),
    Some(OrbAction::Hide(control_secret)) => {
      if let Some(control_secret) = control_secret {
        store_control_secret(&control_secret)?;
      }
      hide_orb(app)
    }
    None => Ok(()),
  }
}

#[tauri::command]
fn begin_drag(window: WebviewWindow) -> Result<(), String> {
  window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_orb(window: WebviewWindow, expanded: bool) -> Result<(), String> {
  let size = if expanded {
    LogicalSize::new(CARD_WIDTH, CARD_HEIGHT)
  } else {
    LogicalSize::new(IDLE_WIDTH, IDLE_HEIGHT)
  };
  window.set_size(Size::Logical(size)).map_err(|error| error.to_string())
}

#[tauri::command]
fn close_orb(window: WebviewWindow) -> Result<(), String> {
  window.close().map_err(|error| error.to_string())
}

fn keyring_entry() -> Result<Entry, String> {
  Entry::new(TOKEN_SERVICE, TOKEN_ACCOUNT).map_err(|error| error.to_string())
}

fn control_keyring_entry() -> Result<Entry, String> {
  Entry::new(TOKEN_SERVICE, CONTROL_ACCOUNT).map_err(|error| error.to_string())
}

fn store_control_secret(secret: &str) -> Result<(), String> {
  control_keyring_entry()?.set_password(secret).map_err(|error| error.to_string())
}

fn stored_control_secret() -> Option<String> {
  control_keyring_entry().ok()?.get_password().ok()
}

fn api_origin_value() -> String {
  option_env!("THOUGHT_SPACE_API_ORIGIN").unwrap_or("http://127.0.0.1:3001").trim_end_matches('/').to_string()
}

fn desktop_api_url(path: &str) -> Result<String, String> {
  if !path.starts_with("/api/") {
    return Err("Desktop requests must target Thought Space APIs.".to_string());
  }
  Ok(format!("{}{}", api_origin_value(), path))
}

#[tauri::command]
async fn desktop_api_request(
  path: String,
  method: String,
  body: Option<String>,
  authorization: Option<String>,
) -> Result<DesktopApiResponse, String> {
  let method = match method.as_str() {
    "GET" => Method::GET,
    "POST" => Method::POST,
    _ => return Err("Unsupported desktop request method.".to_string()),
  };
  // Use the operating system's proxy configuration when one is present, just
  // like the browser that the user used to open Thought Space.
  let client = reqwest::Client::builder().build()
    .map_err(|error| format!("Unable to prepare Thought Space connection: {error}"))?;
  let mut request = client.request(method, desktop_api_url(&path)?)
    .header("Accept", "application/json");
  if let Some(authorization) = authorization {
    request = request.header("Authorization", authorization);
  }
  if let Some(body) = body {
    request = request.header("Content-Type", "application/json").body(body);
  }
  let response = request.send().await.map_err(|error| format!("Unable to reach Thought Space: {error}"))?;
  let status = response.status().as_u16();
  let body = response.text().await.map_err(|error| format!("Unable to read Thought Space response: {error}"))?;
  Ok(DesktopApiResponse { status, body })
}

fn allowed_control_origin(origin: &str) -> bool {
  origin == api_origin_value()
    || (cfg!(debug_assertions) && origin == "http://localhost:3001")
}

fn secrets_match(expected: &str, received: &str) -> bool {
  if expected.len() != received.len() { return false; }
  expected.bytes().zip(received.bytes()).fold(0_u8, |difference, (left, right)| difference | (left ^ right)) == 0
}

fn write_control_response(stream: &mut TcpStream, status: &str, origin: Option<&str>) {
  let cors = origin.filter(|value| allowed_control_origin(value)).map(|value| format!(
    "Access-Control-Allow-Origin: {value}\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: X-Thought-Space-Orb-Control\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Max-Age: 600\r\n"
  )).unwrap_or_default();
  let response = format!("HTTP/1.1 {status}\r\n{cors}Content-Length: 0\r\nConnection: close\r\n\r\n");
  let _ = stream.write_all(response.as_bytes());
}

fn handle_control_connection(mut stream: TcpStream, app: &AppHandle) {
  let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
  let mut bytes = [0_u8; 8_192];
  let length = match stream.read(&mut bytes) { Ok(length) if length > 0 => length, _ => return };
  let request = match std::str::from_utf8(&bytes[..length]) { Ok(request) => request, Err(_) => { write_control_response(&mut stream, "400 Bad Request", None); return; } };
  let mut lines = request.split("\r\n");
  let request_line = lines.next().unwrap_or_default();
  let mut origin = None;
  let mut secret = None;
  for line in lines {
    if let Some(value) = line.strip_prefix("Origin: ").or_else(|| line.strip_prefix("origin: ")) { origin = Some(value.trim()); }
    if let Some(value) = line.strip_prefix("X-Thought-Space-Orb-Control: ").or_else(|| line.strip_prefix("x-thought-space-orb-control: ")) { secret = Some(value.trim()); }
  }
  let Some(origin) = origin else { write_control_response(&mut stream, "403 Forbidden", None); return; };
  if !allowed_control_origin(origin) { write_control_response(&mut stream, "403 Forbidden", None); return; }
  if request_line.starts_with("OPTIONS ") { write_control_response(&mut stream, "204 No Content", Some(origin)); return; }
  let Some(expected) = stored_control_secret() else { write_control_response(&mut stream, "401 Unauthorized", Some(origin)); return; };
  if !secret.is_some_and(|value| secrets_match(&expected, value)) { write_control_response(&mut stream, "401 Unauthorized", Some(origin)); return; }
  let result = if request_line.starts_with("POST /v1/orb/show ") { open_orb(app, None, None) } else if request_line.starts_with("POST /v1/orb/hide ") { hide_orb(app) } else { write_control_response(&mut stream, "404 Not Found", Some(origin)); return; };
  write_control_response(&mut stream, if result.is_ok() { "204 No Content" } else { "500 Internal Server Error" }, Some(origin));
}

fn control_listener_retry_delay(error: ErrorKind) -> Option<Duration> {
  match error {
    ErrorKind::AddrInUse | ErrorKind::Interrupted => Some(Duration::from_secs(1)),
    _ => None,
  }
}

fn start_control_listener(app: AppHandle) {
  thread::spawn(move || loop {
    let listener = match TcpListener::bind(("127.0.0.1", CONTROL_PORT)) {
      Ok(listener) => listener,
      Err(error) => match control_listener_retry_delay(error.kind()) {
        Some(delay) => {
          thread::sleep(delay);
          continue;
        }
        None => return,
      },
    };
    if listener.set_nonblocking(true).is_err() {
      thread::sleep(Duration::from_secs(1));
      continue;
    }
    loop {
      match listener.accept() {
        Ok((stream, _)) => handle_control_connection(stream, &app),
        Err(error) if error.kind() == ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(40)),
        Err(_) => break,
      }
    }
    thread::sleep(Duration::from_secs(1));
  });
}

#[tauri::command]
fn take_launch_ticket(state: State<PendingTicket>) -> Result<Option<String>, String> {
  state.0.lock().map_err(|error| error.to_string()).map(|mut ticket| ticket.take())
}

#[tauri::command]
fn api_origin() -> String {
  api_origin_value()
}

#[tauri::command]
fn read_token() -> Result<Option<String>, String> {
  Ok(keyring_entry()?.get_password().ok())
}

#[tauri::command]
fn store_token(token: String) -> Result<(), String> {
  keyring_entry()?.set_password(&token).map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_token() -> Result<(), String> {
  match keyring_entry()?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(error) => Err(error.to_string()),
  }
}

#[cfg(test)]
mod control_bridge_tests {
  use super::{allowed_control_origin, api_origin_value, control_listener_retry_delay, secrets_match};
  use std::{io::ErrorKind, time::Duration};

  #[test]
  fn only_the_packaged_web_origin_is_allowed_to_control_the_orb() {
    assert!(allowed_control_origin(&api_origin_value()));
    assert!(!allowed_control_origin("https://untrusted.example"));
  }

  #[test]
  fn rejects_temporary_vercel_deployment_urls() {
    assert!(!allowed_control_origin("https://vibecopilot-pp4tns6c6-liuyu3829-devs-projects.vercel.app"));
  }

  #[test]
  fn control_secret_requires_an_exact_match() {
    assert!(secrets_match("desktop-control-secret", "desktop-control-secret"));
    assert!(!secrets_match("desktop-control-secret", "desktop-control-secrex"));
    assert!(!secrets_match("desktop-control-secret", "desktop-control"));
  }

  #[test]
  fn temporarily_busy_control_ports_are_retried() {
    assert_eq!(control_listener_retry_delay(ErrorKind::AddrInUse), Some(Duration::from_secs(1)));
  }
}

pub fn run() {
  let mut builder = tauri::Builder::default().manage(PendingTicket(Mutex::new(None)));
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _| {
      for argument in argv {
        if let Ok(url) = Url::parse(&argument) {
          let _ = handle_orb_url(app, &url);
        }
      }
    }));
  }

  builder
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      #[cfg(any(windows, target_os = "linux"))]
      // The installer registers the protocol. A development build may lack the
      // registry permission to repeat that work, which must not stop the orb.
      let _ = app.deep_link().register_all();

      let handle = app.handle().clone();
      let mut launched_for_hide_only = false;
      if let Some(urls) = app.deep_link().get_current()? {
        for url in urls {
          if matches!(orb_action_from_url(&url), Some(OrbAction::Hide(_))) {
            launched_for_hide_only = true;
          }
          let _ = handle_orb_url(&handle, &url);
        }
      }

      let deep_link_handle = handle.clone();
      app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
          let _ = handle_orb_url(&deep_link_handle, &url);
        }
      });

      start_control_listener(handle.clone());
      if !launched_for_hide_only {
        open_orb(&handle, None, None)?;
      }
      Ok(())
    })
  .invoke_handler(tauri::generate_handler![resize_orb, begin_drag, close_orb, read_token, store_token, clear_token, take_launch_ticket, api_origin, desktop_api_request])
    .run(tauri::generate_context!())
    .expect("error while running Thought Space Orb");
}
