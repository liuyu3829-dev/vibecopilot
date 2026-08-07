use std::{fs, path::PathBuf, sync::Mutex};

use keyring::Entry;
use tauri::{AppHandle, LogicalSize, Manager, Size, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

const IDLE_WIDTH: f64 = 92.0;
const IDLE_HEIGHT: f64 = 92.0;
const CARD_WIDTH: f64 = 332.0;
const CARD_HEIGHT: f64 = 310.0;
const TOKEN_SERVICE: &str = "Thought Space Orb";
const TOKEN_ACCOUNT: &str = "desktop-session";

struct PendingTicket(Mutex<Option<String>>);

enum OrbAction {
  Show(Option<String>),
  Hide,
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
    )),
    Some("hide-orb") => Some(OrbAction::Hide),
    _ => None,
  }
}

fn open_orb(app: &AppHandle, ticket: Option<String>) -> Result<(), String> {
  if let Some(ticket) = ticket {
    *app.state::<PendingTicket>().0.lock().map_err(|error| error.to_string())? = Some(ticket);
  }
  if let Some(window) = app.get_webview_window("orb") {
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
    Some(OrbAction::Show(ticket)) => open_orb(app, ticket),
    Some(OrbAction::Hide) => hide_orb(app),
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

#[tauri::command]
fn take_launch_ticket(state: State<PendingTicket>) -> Result<Option<String>, String> {
  state.0.lock().map_err(|error| error.to_string()).map(|mut ticket| ticket.take())
}

#[tauri::command]
fn api_origin() -> String {
  option_env!("THOUGHT_SPACE_API_ORIGIN").unwrap_or("http://127.0.0.1:3001").trim_end_matches('/').to_string()
}

#[tauri::command]
fn read_token() -> Result<Option<String>, String> {
  Ok(keyring_entry()?.get_password().ok())
}

#[tauri::command]
fn store_token(token: String) -> Result<(), String> {
  keyring_entry()?.set_password(&token).map_err(|error| error.to_string())
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
      app.deep_link().register_all()?;

      let handle = app.handle().clone();
      if let Some(urls) = app.deep_link().get_current()? {
        for url in urls {
          let _ = handle_orb_url(&handle, &url);
        }
      }

      let deep_link_handle = handle.clone();
      app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
          let _ = handle_orb_url(&deep_link_handle, &url);
        }
      });

      open_orb(&handle, None)?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![resize_orb, begin_drag, close_orb, read_token, store_token, take_launch_ticket, api_origin])
    .run(tauri::generate_context!())
    .expect("error while running Thought Space Orb");
}
