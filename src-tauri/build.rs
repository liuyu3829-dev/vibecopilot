fn main() {
  println!("cargo:rerun-if-env-changed=THOUGHT_SPACE_API_ORIGIN");
  let origin = std::env::var("THOUGHT_SPACE_API_ORIGIN").unwrap_or_else(|_| "http://127.0.0.1:3001".to_string());
  println!("cargo:rustc-env=THOUGHT_SPACE_API_ORIGIN={}", origin.trim_end_matches('/'));
  tauri_build::build()
}