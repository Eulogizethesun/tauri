// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Tray icon types and utilities.

pub(crate) mod plugin;

use crate::app::{GlobalMenuEventListener, GlobalTrayIconEventListener};
use crate::menu::ContextMenu;
use crate::menu::MenuEvent;
use crate::resources::Resource;
use crate::{
  image::Image, menu::run_item_main_thread, AppHandle, Manager, PhysicalPosition, Rect, Runtime,
};
use crate::{ResourceId, UnsafeSend};
use serde::Serialize;
use std::path::Path;
#[cfg(target_env = "ohos")]
pub use tray_icon::QuickOperationConfig;
pub use tray_icon::TrayIconId;

/// Describes the mouse button state.
#[derive(Default, Clone, Copy, PartialEq, Eq, Debug, Serialize)]
pub enum MouseButtonState {
  /// Mouse button pressed.
  #[default]
  Up,
  /// Mouse button released.
  Down,
}

impl From<tray_icon::MouseButtonState> for MouseButtonState {
  fn from(value: tray_icon::MouseButtonState) -> Self {
    match value {
      tray_icon::MouseButtonState::Up => MouseButtonState::Up,
      tray_icon::MouseButtonState::Down => MouseButtonState::Down,
    }
  }
}

/// Describes which mouse button triggered the event..
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Default)]
pub enum MouseButton {
  /// Left mouse button.
  #[default]
  Left,
  /// Right mouse button.
  Right,
  /// Middle mouse button.
  Middle,
}

impl From<tray_icon::MouseButton> for MouseButton {
  fn from(value: tray_icon::MouseButton) -> Self {
    match value {
      tray_icon::MouseButton::Left => MouseButton::Left,
      tray_icon::MouseButton::Right => MouseButton::Right,
      tray_icon::MouseButton::Middle => MouseButton::Middle,
    }
  }
}

/// Describes a tray icon event.
///
/// ## Platform-specific:
///
/// - **Linux**: Unsupported. The event is not emitted even though the icon is shown
///   and will still show a context menu on right click.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
#[non_exhaustive]
pub enum TrayIconEvent {
  /// A click happened on the tray icon.
  #[serde(rename_all = "camelCase")]
  Click {
    /// Id of the tray icon which triggered this event.
    id: TrayIconId,
    /// Physical Position of this event.
    position: PhysicalPosition<f64>,
    /// Position and size of the tray icon.
    rect: Rect,
    /// Mouse button that triggered this event.
    button: MouseButton,
    /// Mouse button state when this event was triggered.
    button_state: MouseButtonState,
  },
  /// A double click happened on the tray icon. **Windows Only**
  DoubleClick {
    /// Id of the tray icon which triggered this event.
    id: TrayIconId,
    /// Physical Position of this event.
    position: PhysicalPosition<f64>,
    /// Position and size of the tray icon.
    rect: Rect,
    /// Mouse button that triggered this event.
    button: MouseButton,
  },
  /// The mouse entered the tray icon region.
  Enter {
    /// Id of the tray icon which triggered this event.
    id: TrayIconId,
    /// Physical Position of this event.
    position: PhysicalPosition<f64>,
    /// Position and size of the tray icon.
    rect: Rect,
  },
  /// The mouse moved over the tray icon region.
  Move {
    /// Id of the tray icon which triggered this event.
    id: TrayIconId,
    /// Physical Position of this event.
    position: PhysicalPosition<f64>,
    /// Position and size of the tray icon.
    rect: Rect,
  },
  /// The mouse left the tray icon region.
  Leave {
    /// Id of the tray icon which triggered this event.
    id: TrayIconId,
    /// Physical Position of this event.
    position: PhysicalPosition<f64>,
    /// Position and size of the tray icon.
    rect: Rect,
  },
}

impl TrayIconEvent {
  /// Get the id of the tray icon that triggered this event.
  pub fn id(&self) -> &TrayIconId {
    match self {
      TrayIconEvent::Click { id, .. } => id,
      TrayIconEvent::DoubleClick { id, .. } => id,
      TrayIconEvent::Enter { id, .. } => id,
      TrayIconEvent::Move { id, .. } => id,
      TrayIconEvent::Leave { id, .. } => id,
    }
  }
}

// OHOS platform limitations (TrayIconEvent):
// - DoubleClick, Enter, Move, Leave events are never dispatched
// - All Click events have position (0,0) and rect Rect::default()
// - Only MouseButton::Left (icon click) and Right (menu click) are dispatched
// - All events have MouseButtonState::Up (no Down state)
// - rect() always returns None (StatusBar API has no tray icon position;
//   AvoidArea.topRect is the entire status bar area, not the tray icon itself)
// - NativeIcon is not supported (same as Windows/Linux)
impl From<tray_icon::TrayIconEvent> for TrayIconEvent {
  fn from(value: tray_icon::TrayIconEvent) -> Self {
    match value {
      tray_icon::TrayIconEvent::Click {
        id,
        position,
        rect,
        button,
        button_state,
      } => TrayIconEvent::Click {
        id,
        position,
        rect: Rect {
          position: rect.position.into(),
          size: rect.size.into(),
        },
        button: button.into(),
        button_state: button_state.into(),
      },
      tray_icon::TrayIconEvent::DoubleClick {
        id,
        position,
        rect,
        button,
      } => TrayIconEvent::DoubleClick {
        id,
        position,
        rect: Rect {
          position: rect.position.into(),
          size: rect.size.into(),
        },
        button: button.into(),
      },
      tray_icon::TrayIconEvent::Enter { id, position, rect } => TrayIconEvent::Enter {
        id,
        position,
        rect: Rect {
          position: rect.position.into(),
          size: rect.size.into(),
        },
      },
      tray_icon::TrayIconEvent::Move { id, position, rect } => TrayIconEvent::Move {
        id,
        position,
        rect: Rect {
          position: rect.position.into(),
          size: rect.size.into(),
        },
      },
      tray_icon::TrayIconEvent::Leave { id, position, rect } => TrayIconEvent::Leave {
        id,
        position,
        rect: Rect {
          position: rect.position.into(),
          size: rect.size.into(),
        },
      },
      #[cfg(target_env = "ohos")]
      _ => {
        log::warn!("Unhandled TrayIconEvent variant, falling back to Click");
        TrayIconEvent::Click {
          id: TrayIconId::new("unknown"),
          position: PhysicalPosition::new(0.0, 0.0),
          rect: Rect::default(),
          button: MouseButton::Left,
          button_state: MouseButtonState::Up,
        }
      }
      #[cfg(not(target_env = "ohos"))]
      _ => todo!(),
    }
  }
}

/// [`TrayIcon`] builder struct and associated methods.
#[derive(Default)]
pub struct TrayIconBuilder<R: Runtime> {
  on_menu_event: Option<GlobalMenuEventListener<AppHandle<R>>>,
  on_tray_icon_event: Option<GlobalTrayIconEventListener<TrayIcon<R>>>,
  inner: tray_icon::TrayIconBuilder,
}

impl<R: Runtime> TrayIconBuilder<R> {
  /// Creates a new tray icon builder.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Sometimes the icon won't be visible unless a menu is set.
  ///   Setting an empty [`Menu`](crate::menu::Menu) is enough.
  pub fn new() -> Self {
    Self {
      inner: tray_icon::TrayIconBuilder::new(),
      on_menu_event: None,
      on_tray_icon_event: None,
    }
  }

  /// Creates a new tray icon builder with the specified id.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Sometimes the icon won't be visible unless a menu is set.
  ///   Setting an empty [`Menu`](crate::menu::Menu) is enough.
  pub fn with_id<I: Into<TrayIconId>>(id: I) -> Self {
    let mut builder = Self::new();
    builder.inner = builder.inner.with_id(id);
    builder
  }

  /// Set the a menu for this tray icon.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux**: once a menu is set, it cannot be removed or replaced but you can change its content.
  pub fn menu<M: ContextMenu>(mut self, menu: &M) -> Self {
    self.inner = self.inner.with_menu(menu.inner_context_owned());
    self
  }

  /// Set an icon for this tray icon.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Sometimes the icon won't be visible unless a menu is set.
  ///   Setting an empty [`Menu`](crate::menu::Menu) is enough.
  pub fn icon(mut self, icon: Image<'_>) -> Self {
    let icon = icon.try_into().ok();
    if let Some(icon) = icon {
      self.inner = self.inner.with_icon(icon);
    }
    self
  }

  /// Set a tooltip for this tray icon.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Unsupported.
  pub fn tooltip<S: AsRef<str>>(mut self, s: S) -> Self {
    self.inner = self.inner.with_tooltip(s);
    self
  }

  /// Set the tray icon title.
  ///
  /// ## Platform-specific
  ///
  /// - **Linux:** The title will not be shown unless there is an icon
  ///   as well.  The title is useful for numerical and other frequently
  ///   updated information.  In general, it shouldn't be shown unless a
  ///   user requests it as it can take up a significant amount of space
  ///   on the user's panel.  This may not be shown in all visualizations.
  /// - **Windows:** Unsupported.
  pub fn title<S: AsRef<str>>(mut self, title: S) -> Self {
    self.inner = self.inner.with_title(title);
    self
  }

  /// Set tray icon temp dir path. **Linux only**.
  ///
  /// On Linux, we need to write the icon to the disk and usually it will
  /// be `$XDG_RUNTIME_DIR/tray-icon` or `$TEMP/tray-icon`.
  pub fn temp_dir_path<P: AsRef<Path>>(mut self, s: P) -> Self {
    self.inner = self.inner.with_temp_dir_path(s);
    self
  }

  /// Use the icon as a [template](https://developer.apple.com/documentation/appkit/nsimage/1520017-template?language=objc).
  ///
  /// ## Platform-specific
  ///
  /// - **macOS**: Template image rendered by system based on appearance (dark/light mode).
  /// - **OHOS**: Generates white and black versions from alpha mask; system selects based on wallpaper color.
  /// - **Windows / Linux**: Unsupported.
  pub fn icon_as_template(mut self, is_template: bool) -> Self {
    self.inner = self.inner.with_icon_as_template(is_template);
    self
  }

  /// Whether to show the tray menu on left click or not, default is `true`.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Unsupported.
  #[deprecated(
    since = "2.2.0",
    note = "Use `TrayIconBuilder::show_menu_on_left_click` instead."
  )]
  pub fn menu_on_left_click(mut self, enable: bool) -> Self {
    self.inner = self.inner.with_menu_on_left_click(enable);
    self
  }

  /// Whether to show the tray menu on left click or not, default is `true`.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Unsupported.
  pub fn show_menu_on_left_click(mut self, enable: bool) -> Self {
    self.inner = self.inner.with_menu_on_left_click(enable);
    self
  }

  /// Set QuickOperation for left-click popup. **OHOS only** — this method does
  /// not exist on other platforms.
  ///
  /// On OHOS, configures the system popup panel shown when the user left-clicks
  /// the tray icon. The popup is rendered by a `StatusBarViewExtensionAbility`
  /// that the application registers in `module.json5`.
  #[cfg(target_env = "ohos")]
  pub fn quick_operation(mut self, config: QuickOperationConfig) -> Self {
    self.inner = self.inner.with_quick_operation(config);
    self
  }

  /// Set a handler for menu events.
  ///
  /// Note that this handler is called for any menu event,
  /// whether it is coming from this window, another window or from the tray icon menu.
  pub fn on_menu_event<F: Fn(&AppHandle<R>, MenuEvent) + Sync + Send + 'static>(
    mut self,
    f: F,
  ) -> Self {
    self.on_menu_event.replace(Box::new(f));
    self
  }

  /// Set a handler for this tray icon events.
  pub fn on_tray_icon_event<F: Fn(&TrayIcon<R>, TrayIconEvent) + Sync + Send + 'static>(
    mut self,
    f: F,
  ) -> Self {
    self.on_tray_icon_event.replace(Box::new(f));
    self
  }

  /// Access the unique id that will be assigned to the tray icon
  /// this builder will create.
  pub fn id(&self) -> &TrayIconId {
    self.inner.id()
  }

  pub(crate) fn build_inner(
    self,
    app_handle: &AppHandle<R>,
  ) -> crate::Result<(TrayIcon<R>, ResourceId)> {
    let id = self.id().clone();

    // OHOS allows a single status-bar tray per ability: the tray-icon backend
    // rejects a second *visible* tray ("only one statusbar tray per ability").
    // Tauri's cross-platform API still lets apps create several TrayIcons
    // (they coexist on Windows/macOS), so map that contract onto the OHOS
    // reality at this layer: hide every tray this manager knows about before
    // adding the new one. The previous trays keep their objects (and can be
    // made visible again later); exactly one is registered with the system at
    // any time. set_visible(false) also works when other handles keep the
    // previous tray alive, which plain removal would not.
    #[cfg(target_env = "ohos")]
    for existing_id in app_handle.manager.tray.tray_ids() {
      if let Some(existing) = app_handle.manager.tray.tray_by_id(app_handle, &existing_id) {
        let _ = existing.set_visible(false);
      }
    }

    // OHOS: tray-icon's own QuickOperation defaults are deliberately neutral
    // (empty title falls back to the app name on the ArkTS side, `None`
    // module uses the system default). Tauri apps know better — the product
    // name for the panel title and the `entry` module where the templates
    // register abilities — so layer those Tauri-specific defaults here unless
    // the app configured a panel itself.
    #[cfg(target_env = "ohos")]
    let mut inner = self.inner;
    #[cfg(target_env = "ohos")]
    if inner.quick_operation_config().is_none() {
      inner = inner.with_quick_operation(QuickOperationConfig {
        title: app_handle.package_info().name.clone(),
        module_name: Some("entry".to_string()),
        ..Default::default()
      });
    }

    // SAFETY:
    // the menu within this builder was created on main thread
    // and will be accessed on the main thread
    #[cfg(target_env = "ohos")]
    let unsafe_builder = UnsafeSend(inner);
    #[cfg(not(target_env = "ohos"))]
    let unsafe_builder = UnsafeSend(self.inner);

    #[cfg(target_env = "ohos")]
    let unsafe_tray = {
      // On OHOS, TrayIcon::new dispatches the ArkTS bridge call to a dedicated
      // Rust worker thread (fire-and-forget), so the calling thread is never
      // blocked. We skip run_on_main_thread because no thread hop is needed.
      UnsafeSend(unsafe_builder.take().build()?)
    };

    #[cfg(not(target_env = "ohos"))]
    let unsafe_tray = {
      let (tx, rx) = std::sync::mpsc::channel();
      app_handle
        .run_on_main_thread(move || {
          // SAFETY: will only be accessed on main thread
          let _ = tx.send(unsafe_builder.take().build().map(UnsafeSend));
        })
        .and_then(|_| rx.recv().map_err(|_| crate::Error::FailedToReceiveMessage))??
    };

    let icon = TrayIcon {
      id,
      inner: unsafe_tray.take(),
      app_handle: app_handle.clone(),
    };

    let rid = icon.register(
      &icon.app_handle,
      self.on_menu_event,
      self.on_tray_icon_event,
    );

    Ok((icon, rid))
  }

  /// Builds and adds a new [`TrayIcon`] to the system tray.
  pub fn build<M: Manager<R>>(self, manager: &M) -> crate::Result<TrayIcon<R>> {
    let (icon, _rid) = self.build_inner(manager.app_handle())?;
    Ok(icon)
  }
}

/// Tray icon struct and associated methods.
///
/// This type is reference-counted and the icon is removed when the last instance is dropped.
///
/// See [TrayIconBuilder] to construct this type.
#[tauri_macros::default_runtime(crate::Wry, wry)]
pub struct TrayIcon<R: Runtime> {
  id: TrayIconId,
  inner: tray_icon::TrayIcon,
  app_handle: AppHandle<R>,
}

impl<R: Runtime> Clone for TrayIcon<R> {
  fn clone(&self) -> Self {
    Self {
      id: self.id.clone(),
      inner: self.inner.clone(),
      app_handle: self.app_handle.clone(),
    }
  }
}

/// # Safety
///
/// On non-OHOS platforms, we make sure it always runs on the main thread.
/// On OHOS, tray operations bypass run_on_main_thread because TSFN uses
/// NonBlocking mode and run_on_main_thread would deadlock Chrome_IOThread.
/// This is safe because tray_icon::TrayIcon on OHOS uses TSFN internally
/// which handles thread safety for NAPI calls.
unsafe impl<R: Runtime> Sync for TrayIcon<R> {}
unsafe impl<R: Runtime> Send for TrayIcon<R> {}

impl<R: Runtime> TrayIcon<R> {
  fn register(
    &self,
    app_handle: &AppHandle<R>,
    on_menu_event: Option<GlobalMenuEventListener<AppHandle<R>>>,
    on_tray_icon_event: Option<GlobalTrayIconEventListener<TrayIcon<R>>>,
  ) -> ResourceId {
    if let Some(handler) = on_menu_event {
      app_handle
        .manager
        .menu
        .global_event_listeners
        .lock()
        .unwrap()
        .push(handler);
    }

    if let Some(handler) = on_tray_icon_event {
      app_handle
        .manager
        .tray
        .event_listeners
        .lock()
        .unwrap()
        .insert(self.id.clone(), handler);
    }

    let rid = app_handle.resources_table().add(self.clone());
    app_handle
      .manager
      .tray
      .icons
      .lock()
      .unwrap()
      .push((self.id().clone(), rid));
    rid
  }

  /// The application handle associated with this type.
  pub fn app_handle(&self) -> &AppHandle<R> {
    &self.app_handle
  }

  /// Register a handler for menu events.
  ///
  /// Note that this handler is called for any menu event,
  /// whether it is coming from this window, another window or from the tray icon menu.
  pub fn on_menu_event<F: Fn(&AppHandle<R>, MenuEvent) + Sync + Send + 'static>(&self, f: F) {
    self
      .app_handle
      .manager
      .menu
      .global_event_listeners
      .lock()
      .unwrap()
      .push(Box::new(f));
  }

  /// Register a handler for this tray icon events.
  pub fn on_tray_icon_event<F: Fn(&TrayIcon<R>, TrayIconEvent) + Sync + Send + 'static>(
    &self,
    f: F,
  ) {
    self
      .app_handle
      .manager
      .tray
      .event_listeners
      .lock()
      .unwrap()
      .insert(self.id.clone(), Box::new(f));
  }

  /// Returns the id associated with this tray icon.
  pub fn id(&self) -> &TrayIconId {
    &self.id
  }

  /// Sets a new tray icon. If `None` is provided, it will remove the icon.
  pub fn set_icon(&self, icon: Option<Image<'_>>) -> crate::Result<()> {
    let icon = match icon {
      Some(i) => Some(i.try_into()?),
      None => None,
    };
    run_item_main_thread!(self, |self_: Self| self_.inner.set_icon(icon))?.map_err(Into::into)
  }

  /// Sets a new tray menu.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux**: once a menu is set it cannot be removed so `None` has no effect
  pub fn set_menu<M: ContextMenu + 'static>(&self, menu: Option<M>) -> crate::Result<()> {
    run_item_main_thread!(self, |self_: Self| {
      self_.inner.set_menu(menu.map(|m| m.inner_context_owned()))
    })
  }

  /// Sets the tooltip for this tray icon.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** Unsupported
  pub fn set_tooltip<S: AsRef<str>>(&self, tooltip: Option<S>) -> crate::Result<()> {
    let s = tooltip.map(|s| s.as_ref().to_string());
    run_item_main_thread!(self, |self_: Self| self_.inner.set_tooltip(s))?.map_err(Into::into)
  }

  /// Sets the title for this tray icon.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux:** The title will not be shown unless there is an icon
  ///   as well.  The title is useful for numerical and other frequently
  ///   updated information.  In general, it shouldn't be shown unless a
  ///   user requests it as it can take up a significant amount of space
  ///   on the user's panel.  This may not be shown in all visualizations.
  /// - **Windows:** Unsupported
  pub fn set_title<S: AsRef<str>>(&self, title: Option<S>) -> crate::Result<()> {
    let s = title.map(|s| s.as_ref().to_string());
    run_item_main_thread!(self, |self_: Self| self_.inner.set_title(s))?;
    Ok(())
  }

  /// Show or hide this tray icon.
  pub fn set_visible(&self, visible: bool) -> crate::Result<()> {
    run_item_main_thread!(self, |self_: Self| self_.inner.set_visible(visible))?
      .map_err(Into::into)
  }

  /// Sets the tray icon temp dir path. **Linux only**.
  ///
  /// On Linux, we need to write the icon to the disk and usually it will
  /// be `$XDG_RUNTIME_DIR/tray-icon` or `$TEMP/tray-icon`.
  pub fn set_temp_dir_path<P: AsRef<Path>>(&self, path: Option<P>) -> crate::Result<()> {
    #[allow(unused)]
    let p = path.map(|p| p.as_ref().to_path_buf());
    #[cfg(all(target_os = "linux", not(target_env = "ohos")))]
    run_item_main_thread!(self, |self_: Self| self_.inner.set_temp_dir_path(p))?;
    Ok(())
  }

  /// Sets the current icon as a [template](https://developer.apple.com/documentation/appkit/nsimage/1520017-template?language=objc).
  ///
  /// ## Platform-specific
  ///
  /// - **macOS**: Template image rendered by system based on appearance (dark/light mode).
  /// - **OHOS**: Generates white and black versions from alpha mask; system selects based on wallpaper color.
  /// - **Windows / Linux**: Unsupported.
  pub fn set_icon_as_template(&self, is_template: bool) -> crate::Result<()> {
    #[cfg(any(target_os = "macos", target_env = "ohos"))]
    run_item_main_thread!(self, |self_: Self| {
      self_.inner.set_icon_as_template(is_template)
    })?;
    #[cfg(not(any(target_os = "macos", target_env = "ohos")))]
    let _ = is_template;
    Ok(())
  }

  /// Disable or enable showing the tray menu on left click.
  ///
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux**: Unsupported.
  pub fn set_show_menu_on_left_click(&self, #[allow(unused)] enable: bool) -> crate::Result<()> {
    #[cfg(any(target_os = "macos", windows))]
    run_item_main_thread!(self, |self_: Self| {
      self_.inner.set_show_menu_on_left_click(enable)
    })?;
    Ok(())
  }

  /// Set QuickOperation for left-click popup. **OHOS only** — this method does
  /// not exist on other platforms.
  ///
  /// On OHOS, configures the system popup panel shown when the user left-clicks
  /// the tray icon. Pass `None` to disable the popup (left-click will only fire events).
  #[cfg(target_env = "ohos")]
  pub fn set_quick_operation(&self, config: Option<QuickOperationConfig>) -> crate::Result<()> {
    self.inner.set_quick_operation(config);
    Ok(())
  }

  /// Get tray icon rect.
  ///
  /// ## Platform-specific:
  ///
  /// - **Linux**: Unsupported, always returns `None`.
  /// - **OHOS**: Unsupported, always returns `None`. StatusBar API does not provide
  ///   tray icon position or dimensions. AvoidArea.topRect returns the entire status
  ///   bar area, not the tray icon itself, so it cannot serve as a meaningful
  ///   approximation.
  pub fn rect(&self) -> crate::Result<Option<crate::Rect>> {
    run_item_main_thread!(self, |self_: Self| {
      self_.inner.rect().map(|rect| Rect {
        position: rect.position.into(),
        size: rect.size.into(),
      })
    })
  }

  /// Do something with the inner [`tray_icon::TrayIcon`] on main thread
  ///
  /// Note that `tray-icon` crate may be updated in minor releases of Tauri.
  /// Therefore, it's recommended to pin Tauri to at least a minor version when you're using `with_inner_tray_icon`.
  pub fn with_inner_tray_icon<F, T>(&self, f: F) -> crate::Result<T>
  where
    F: FnOnce(&tray_icon::TrayIcon) -> T + Send + 'static,
    T: Send + 'static,
  {
    run_item_main_thread!(self, |self_: Self| { f(&self_.inner) })
  }
}

impl<R: Runtime> Resource for TrayIcon<R> {
  fn close(self: std::sync::Arc<Self>) {
    let mut icons = self.app_handle.manager.tray.icons.lock().unwrap();
    for (i, (tray_icon_id, _rid)) in icons.iter_mut().enumerate() {
      if tray_icon_id == &self.id {
        icons.swap_remove(i);
        return;
      }
    }
  }
}

#[cfg(test)]
mod tests {
  #[test]
  fn tray_event_json_serialization() {
    // NOTE: if this test is ever changed, you probably need to change `TrayIconEvent` in JS as well

    use super::*;
    let event = TrayIconEvent::Click {
      button: MouseButton::Left,
      button_state: MouseButtonState::Down,
      id: TrayIconId::new("id"),
      position: crate::PhysicalPosition::default(),
      rect: crate::Rect {
        position: tray_icon::Rect::default().position.into(),
        size: tray_icon::Rect::default().size.into(),
      },
    };

    let value = serde_json::to_value(&event).unwrap();
    assert_eq!(
      value,
      serde_json::json!({
          "type": "Click",
          "button": "Left",
          "buttonState": "Down",
          "id": "id",
          "position": {
              "x": 0.0,
              "y": 0.0,
          },
          "rect": {
              "size": {
                  "Physical": {
                      "width": 0,
                      "height": 0,
                  }
              },
              "position": {
                  "Physical": {
                      "x": 0,
                      "y": 0,
                  }
              },
          }
      })
    );
  }

  #[test]
  fn tray_icon_event_from_fallback_no_panic() {
    let tray_event = tray_icon::TrayIconEvent::Click {
      id: tray_icon::TrayIconId::new("test"),
      position: tray_icon::dpi::PhysicalPosition::new(10.0, 20.0),
      rect: tray_icon::Rect::default(),
      button: tray_icon::MouseButton::Left,
      button_state: tray_icon::MouseButtonState::Up,
    };
    let converted: TrayIconEvent = tray_event.into();
    match converted {
      TrayIconEvent::Click {
        id,
        position,
        button,
        button_state,
        ..
      } => {
        assert_eq!(id.0, "test");
        assert_eq!(position.x, 10.0);
        assert_eq!(button, MouseButton::Left);
        assert_eq!(button_state, MouseButtonState::Up);
      }
      _ => panic!("expected Click fallback"),
    }
  }
}
