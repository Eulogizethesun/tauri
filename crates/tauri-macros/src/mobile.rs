// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::{format_ident, quote};
use std::env::var;
use syn::{spanned::Spanned, Attribute, ItemFn};

/// Whether the attribute is one of the two entry-point attributes
/// (`tauri::mobile_entry_point` or `tauri::ohos::entry_point`, with or
/// without the leading `::`).
///
/// Full-path matching: an aliased import (`use tauri::ohos::entry_point as
/// x;` used as `#[x]`) renames the path and deliberately does NOT match —
/// the stripping degrades and the build fails with E0428 (visible, not
/// silent). Issue Eulogizethesun/tauri#242.
fn is_entry_point_attr(attr: &Attribute) -> bool {
  let segments: Vec<String> = attr
    .path()
    .segments
    .iter()
    .map(|s| s.ident.to_string())
    .collect();
  let segments: Vec<&str> = segments.iter().map(String::as_str).collect();
  matches!(
    segments.as_slice(),
    ["mobile_entry_point"]
      | ["tauri", "mobile_entry_point"]
      | ["entry_point"]
      | ["ohos", "entry_point"]
      | ["tauri", "ohos", "entry_point"]
  )
}

/// Removes the sibling entry-point attribute (if any) from the function's
/// remaining attributes, so exactly one expander runs when both attributes
/// are written on the same function — independent of the writing order (the
/// outer macro sees the inner attribute on its input; stripping it from the
/// passthrough function stops the inner expansion).
fn strip_sibling_entry_point_attrs(function: &mut ItemFn) {
  function.attrs.retain(|attr| !is_entry_point_attr(attr));
}

fn get_env_var(name: &str, error: &mut Option<TokenStream2>, function: &ItemFn) -> TokenStream2 {
  match var(name) {
    Ok(value) => {
      let ident = format_ident!("{value}");
      quote!(#ident)
    }
    Err(_) => {
      error.replace(
        syn::Error::new(
          function.span(),
          format!("`{name}` env var not set, do you have a build script with tauri-build?",),
        )
        .into_compile_error(),
      );
      quote!()
    }
  }
}

pub fn entry_point(_attributes: TokenStream, item: TokenStream) -> TokenStream {
  entry_point_impl(item.into()).into()
}

/// The expansion body, on `proc_macro2` types so it stays unit-testable
/// (`proc_macro::TokenStream` is only usable inside a live macro-expansion
/// bridge — calling the attribute fn directly in a unit test panics).
fn entry_point_impl(item: TokenStream2) -> TokenStream2 {
  let mut function = match syn::parse2::<ItemFn>(item) {
    Ok(function) => function,
    Err(error) => return error.to_compile_error(),
  };
  // Issue Eulogizethesun/tauri#242: when both entry-point attributes are
  // written on the same function, the outer expander sees the inner one on
  // its input (`cfg_attr` is already evaluated by rustc at this point).
  // Strip it from the passthrough function so exactly one expander runs —
  // otherwise both would emit the fixed-name glue items (stop_unwind /
  // _start_app / openharmony) and the build dies with E0428.
  strip_sibling_entry_point_attrs(&mut function);
  let function_name = function.sig.ident.clone();

  let mut error = None;
  let domain = get_env_var("TAURI_ANDROID_PACKAGE_NAME_PREFIX", &mut error, &function);
  let app_name = get_env_var("TAURI_ANDROID_PACKAGE_NAME_APP_NAME", &mut error, &function);

  let (wrapper, wrapper_name) = if function.sig.asyncness.is_some() {
    let wrapper_name = syn::Ident::new(&format!("{function_name}_wrapper"), function_name.span());
    (
      quote! {
        #function

        fn #wrapper_name() {
          ::tauri::async_runtime::block_on(#function_name());
        }
      },
      wrapper_name,
    )
  } else {
    (
      quote! {
        #function
      },
      function_name,
    )
  };

  if let Some(e) = error {
    quote!(#e)
  } else {
    quote!(
      fn stop_unwind<F: FnOnce() -> T, T>(f: F) -> T {
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
          Ok(t) => t,
          Err(err) => {
            eprintln!("attempt to unwind out of `rust` with err: {:?}", err);
            std::process::abort()
          }
        }
      }

      #wrapper

      fn _start_app() {
        #[cfg(target_os = "ios")]
        ::tauri::log_stdout();
        #[cfg(target_os = "android")]
        {
          ::tauri::android_binding!(#domain, #app_name, _start_app, ::tauri::wry);
        }
        stop_unwind(#wrapper_name);
      }

      // be careful when renaming this, the `start_app` symbol is checked by the CLI
      // Mobile half of the platform-complementary gating (issue
      // Eulogizethesun/tauri#242): on OHOS the Ability/NAPI model replaces the
      // OS-invoked `main`/`start_app` C symbols, so the mobile glue is compiled
      // out there (`openharmony` below is the OHOS half, gated
      // `#[cfg(target_env = "ohos")]`).
      #[cfg(all(target_os = "ios", not(target_env = "ohos")))]
      #[no_mangle]
      #[inline(never)]
      pub extern "C" fn start_app() {
        _start_app()
      }

      // OHOS half of the platform-complementary gating (issue
      // Eulogizethesun/tauri#242): the NAPI entry the Ability framework
      // invokes (the `ability` derive generates the module init contract).
      #[cfg(target_env = "ohos")]
      #[::tauri::ohos::openharmony_ability_derive::ability]
      pub fn openharmony(app: ::tauri::ohos::openharmony_ability::OpenHarmonyApp) {
        ::tauri::ohos::APP.lock().unwrap().replace(app);
        _start_app()
      }
    )
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::Mutex;

  /// `std::env::set_var` mutates process-global state — serialize the
  /// expansion tests that need the Android package env vars set.
  static ENV_LOCK: Mutex<()> = Mutex::new(());

  fn with_entry_point_env<T>(f: impl FnOnce() -> T) -> T {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    std::env::set_var("TAURI_ANDROID_PACKAGE_NAME_PREFIX", "com_example");
    std::env::set_var("TAURI_ANDROID_PACKAGE_NAME_APP_NAME", "testapp");
    f()
  }

  fn parse_attr(path: &str) -> Attribute {
    // `Attribute` is not `Parse` directly; parse a wrapper function and take
    // its first attribute.
    let item: ItemFn = syn::parse_str(&format!("#[{path}] pub fn probe() {{}}")).unwrap();
    item.attrs.into_iter().next().unwrap()
  }

  /// UT for entry-point attribute recognition: both entry-point attributes in
  /// every full-path spelling match; unrelated attributes do not.
  #[test]
  fn ut_entry_point_attr_recognition_matches_both_attributes_full_paths() {
    for path in [
      "mobile_entry_point",
      "tauri::mobile_entry_point",
      "::tauri::mobile_entry_point",
      "entry_point",
      "ohos::entry_point",
      "tauri::ohos::entry_point",
      "::tauri::ohos::entry_point",
    ] {
      assert!(
        is_entry_point_attr(&parse_attr(path)),
        "`{path}` must be recognized as an entry-point attribute"
      );
    }
    for path in [
      "inline",
      "cfg_attr(mobile, tauri::mobile_entry_point)",
      "command",
      "test",
    ] {
      assert!(
        !is_entry_point_attr(&parse_attr(path)),
        "`{path}` must NOT be recognized as an entry-point attribute"
      );
    }
  }

  /// UT for sibling stripping: when the input function still carries the other
  /// entry-point attribute (the outer expander's view of the two-line form),
  /// it is removed from the passthrough function so the inner expander never
  /// runs (no E0428 on the fixed-name glue items).
  #[test]
  fn ut_entry_point_strips_sibling_entry_point_attribute() {
    with_entry_point_env(|| {
      let item = "
        #[tauri::ohos::entry_point]
        pub fn run() {}
      "
      .parse::<TokenStream2>()
      .unwrap();
      let out = entry_point_impl(item).to_string();
      assert!(
        !out.contains("ohos :: entry_point"),
        "the sibling entry-point attribute must be stripped from the passthrough function, got: {out}"
      );
      assert!(
        out.contains("pub fn run"),
        "the annotated function itself must be preserved, got: {out}"
      );
    });
  }

  /// UT for the platform-complementary product: the mobile half is gated
  /// all(target_os = "ios", not(target_env = "ohos")) and the OHOS half
  /// target_env = "ohos", so the compiler keeps exactly one glue set per platform.
  #[test]
  fn ut_entry_point_product_gates_both_platform_halves() {
    with_entry_point_env(|| {
      let item = "pub fn run() {}".parse::<TokenStream2>().unwrap();
      let out = entry_point_impl(item).to_string();
      assert!(
        out.contains("all (target_os = \"ios\" , not (target_env = \"ohos\"))"),
        "the mobile half must be gated not(target_env = \"ohos\"), got: {out}"
      );
      assert!(
        out.contains("cfg (target_env = \"ohos\")") && out.contains("fn openharmony"),
        "the OHOS half (openharmony entry) must be gated target_env = \"ohos\", got: {out}"
      );
    });
  }

  /// UT for unrelated-attribute preservation: the passthrough function keeps
  /// every non-entry-point attribute it carried.
  #[test]
  fn ut_entry_point_preserves_unrelated_attributes() {
    with_entry_point_env(|| {
      let item = "
        #[inline]
        #[tauri::mobile_entry_point]
        pub fn run() {}
      "
      .parse::<TokenStream2>()
      .unwrap();
      // The outer attribute (mobile_entry_point here) is consumed by rustc
      // before the macro runs; in a direct call the input still carries it —
      // which doubles as the stripping check for a same-attribute sibling.
      let out = entry_point_impl(item).to_string();
      assert!(
        out.contains("inline"),
        "unrelated attributes must be preserved, got: {out}"
      );
      assert!(
        !out.contains("mobile_entry_point"),
        "the sibling entry-point attribute must be stripped, got: {out}"
      );
    });
  }
}
