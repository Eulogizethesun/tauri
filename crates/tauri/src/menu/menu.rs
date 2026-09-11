// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

// OHOS: Menu is displayed only as a transient popup via ContextMenu::popup().
// Desktop mode optionally renders a persistent top menu bar via
// Navigation.toolbar() + ToolBarItem (see Phase 8 design doc).

use std::sync::Arc;

use super::run_item_main_thread;
use super::sealed::ContextMenuBase;
use super::{
  AboutMetadata, IsMenuItem, Menu, MenuInner, MenuItemKind, PredefinedMenuItem, Submenu,
};
use crate::run_main_thread;
use crate::Window;
use crate::{AppHandle, Manager, Position, Runtime};
// The muda `ContextMenu` trait is only used by the non-OHOS popup arms below
// (`hpopupmenu` on Windows, `show_context_menu_*` on macOS/Linux); OHOS calls
// the inherent `popup` instead.
#[cfg(not(target_env = "ohos"))]
use muda::ContextMenu;
use muda::MenuId;

/// Expected submenu id of the Window menu for macOS.
pub const WINDOW_SUBMENU_ID: &str = "__tauri_window_menu__";
/// Expected submenu id of the Help menu for macOS.
pub const HELP_SUBMENU_ID: &str = "__tauri_help_menu__";

impl<R: Runtime> super::ContextMenu for Menu<R> {
  #[cfg(target_os = "windows")]
  fn hpopupmenu(&self) -> crate::Result<isize> {
    run_item_main_thread!(self, |self_: Self| (*self_.0).as_ref().hpopupmenu())
  }

  fn popup<T: Runtime>(&self, window: Window<T>) -> crate::Result<()> {
    self.popup_inner(window, None::<Position>)
  }

  fn popup_at<T: Runtime, P: Into<Position>>(
    &self,
    window: Window<T>,
    position: P,
  ) -> crate::Result<()> {
    self.popup_inner(window, Some(position))
  }
}

impl<R: Runtime> ContextMenuBase for Menu<R> {
  fn popup_inner<T: Runtime, P: Into<crate::Position>>(
    &self,
    window: crate::Window<T>,
    position: Option<P>,
  ) -> crate::Result<()> {
    let position = position.map(Into::into);
    #[cfg(target_env = "ohos")]
    {
      let (x, y) = match position {
        Some(crate::Position::Logical(p)) => (Some(p.x), Some(p.y)),
        Some(crate::Position::Physical(p)) => (Some(p.x as f64), Some(p.y as f64)),
        None => (None, None),
      };
      let window_id = window.label();
      (*self.0)
        .as_ref()
        .popup(x, y, window_id)
        .map_err(Into::into)
    }
    #[cfg(not(target_env = "ohos"))]
    {
      run_item_main_thread!(self, move |self_: Self| {
        #[cfg(target_os = "macos")]
        if let Ok(view) = window.ns_view() {
          unsafe {
            self_
              .inner()
              .show_context_menu_for_nsview(view as _, position);
          }
        }

        #[cfg(all(
          any(
            target_os = "linux",
            target_os = "dragonfly",
            target_os = "freebsd",
            target_os = "netbsd",
            target_os = "openbsd"
          ),
          not(target_env = "ohos")
        ))]
        if let Ok(w) = window.gtk_window() {
          self_
            .inner()
            .show_context_menu_for_gtk_window(w.as_ref(), position);
        }

        #[cfg(windows)]
        if let Ok(hwnd) = window.hwnd() {
          unsafe {
            self_
              .inner()
              .show_context_menu_for_hwnd(hwnd.0 as _, position);
          }
        }
      })
    }
  }
  fn inner_context(&self) -> &dyn muda::ContextMenu {
    (*self.0).as_ref()
  }

  fn inner_context_owned(&self) -> Box<dyn muda::ContextMenu> {
    Box::new((*self.0).as_ref().clone())
  }
}

impl<R: Runtime> Menu<R> {
  /// Creates a new menu.
  pub fn new<M: Manager<R>>(manager: &M) -> crate::Result<Self> {
    let handle = manager.app_handle();
    let app_handle = handle.clone();

    // OHOS: subscribe to muda's menu-change notifications so every menu
    // mutation (item text/enabled/checked/icon, add/remove/insert) refreshes
    // the menubars through one coalesced callback — the individual menu APIs
    // no longer refresh manually.
    #[cfg(all(target_env = "ohos", desktop))]
    {
      let refresh_handle = app_handle.clone();
      muda::set_on_menu_change(Some(move || {
        super::auto_refresh_menubar(&refresh_handle)
      }));
    }

    let menu = run_main_thread!(handle, || {
      let menu = muda::Menu::new();
      MenuInner {
        id: menu.id().clone(),
        inner: Some(menu),
        app_handle,
      }
    })?;

    Ok(Self(Arc::new(menu)))
  }

  /// Creates a new menu with the specified id.
  pub fn with_id<M: Manager<R>, I: Into<MenuId>>(manager: &M, id: I) -> crate::Result<Self> {
    let handle = manager.app_handle();
    let app_handle = handle.clone();

    let id = id.into();
    let menu = run_main_thread!(handle, || {
      let menu = muda::Menu::with_id(id.clone());
      MenuInner {
        id,
        inner: Some(menu),
        app_handle,
      }
    })?;

    Ok(Self(Arc::new(menu)))
  }

  /// Creates a new menu with given `items`. It calls [`Menu::new`] and [`Menu::append_items`] internally.
  pub fn with_items<M: Manager<R>>(
    manager: &M,
    items: &[&dyn IsMenuItem<R>],
  ) -> crate::Result<Self> {
    let menu = Self::new(manager)?;
    menu.append_items(items)?;
    Ok(menu)
  }

  /// Creates a new menu with the specified id and given `items`.
  /// It calls [`Menu::new`] and [`Menu::append_items`] internally.
  pub fn with_id_and_items<M: Manager<R>, I: Into<MenuId>>(
    manager: &M,
    id: I,
    items: &[&dyn IsMenuItem<R>],
  ) -> crate::Result<Self> {
    let menu = Self::with_id(manager, id)?;
    menu.append_items(items)?;
    Ok(menu)
  }

  /// Creates a menu filled with default menu items and submenus.
  pub fn default(app_handle: &AppHandle<R>) -> crate::Result<Self> {
    let pkg_info = app_handle.package_info();
    let config = app_handle.config();
    let about_metadata = AboutMetadata {
      name: Some(pkg_info.name.clone()),
      version: Some(pkg_info.version.to_string()),
      copyright: config.bundle.copyright.clone(),
      authors: config.bundle.publisher.clone().map(|p| vec![p]),
      ..Default::default()
    };

    let window_menu = Submenu::with_id_and_items(
      app_handle,
      WINDOW_SUBMENU_ID,
      "Window",
      true,
      &[
        &PredefinedMenuItem::minimize(app_handle, None)?,
        &PredefinedMenuItem::maximize(app_handle, None)?,
        #[cfg(target_os = "macos")]
        &PredefinedMenuItem::separator(app_handle)?,
        &PredefinedMenuItem::close_window(app_handle, None)?,
      ],
    )?;

    let help_menu = Submenu::with_id_and_items(
      app_handle,
      HELP_SUBMENU_ID,
      "Help",
      true,
      &[
        #[cfg(not(target_os = "macos"))]
        &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
      ],
    )?;

    let menu = Menu::with_items(
      app_handle,
      &[
        #[cfg(target_os = "macos")]
        &Submenu::with_items(
          app_handle,
          pkg_info.name.clone(),
          true,
          &[
            &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::services(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::hide(app_handle, None)?,
            &PredefinedMenuItem::hide_others(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::quit(app_handle, None)?,
          ],
        )?,
        #[cfg(not(any(
          target_os = "linux",
          target_os = "dragonfly",
          target_os = "freebsd",
          target_os = "netbsd",
          target_os = "openbsd"
        )))]
        &Submenu::with_items(
          app_handle,
          "File",
          true,
          &[
            &PredefinedMenuItem::close_window(app_handle, None)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::quit(app_handle, None)?,
          ],
        )?,
        &Submenu::with_items(
          app_handle,
          "Edit",
          true,
          &[
            &PredefinedMenuItem::undo(app_handle, None)?,
            &PredefinedMenuItem::redo(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::cut(app_handle, None)?,
            &PredefinedMenuItem::copy(app_handle, None)?,
            &PredefinedMenuItem::paste(app_handle, None)?,
            &PredefinedMenuItem::select_all(app_handle, None)?,
          ],
        )?,
        #[cfg(target_os = "macos")]
        &Submenu::with_items(
          app_handle,
          "View",
          true,
          &[&PredefinedMenuItem::fullscreen(app_handle, None)?],
        )?,
        &window_menu,
        &help_menu,
      ],
    )?;

    Ok(menu)
  }

  pub(crate) fn inner(&self) -> &muda::Menu {
    (*self.0).as_ref()
  }

  /// The application handle associated with this type.
  pub fn app_handle(&self) -> &AppHandle<R> {
    &self.0.app_handle
  }

  /// Returns a unique identifier associated with this menu.
  pub fn id(&self) -> &MenuId {
    &self.0.id
  }

  /// Add a menu item to the end of this menu.
  ///
  /// ## Platform-specific:
  ///
  /// - **macOS:** Only [`Submenu`] can be added to the menu.
  ///
  /// [`Submenu`]: super::Submenu
  pub fn append(&self, item: &dyn IsMenuItem<R>) -> crate::Result<()> {
    let kind = item.kind();
    run_item_main_thread!(self, |self_: Self| {
      (*self_.0).as_ref().append(kind.inner().inner_muda())
    })?
    .map_err(Into::<crate::Error>::into)?;
    Ok(())
  }

  /// Add menu items to the end of this menu. It calls [`Menu::append`] in a loop internally.
  ///
  /// ## Platform-specific:
  ///
  /// - **macOS:** Only [`Submenu`] can be added to the menu
  ///
  /// [`Submenu`]: super::Submenu
  pub fn append_items(&self, items: &[&dyn IsMenuItem<R>]) -> crate::Result<()> {
    for item in items {
      self.append(*item)?
    }
    Ok(())
  }

  /// Add a menu item to the beginning of this menu.
  ///
  /// ## Platform-specific:
  ///
  /// - **macOS:** Only [`Submenu`] can be added to the menu
  ///
  /// [`Submenu`]: super::Submenu
  pub fn prepend(&self, item: &dyn IsMenuItem<R>) -> crate::Result<()> {
    let kind = item.kind();
    run_item_main_thread!(self, |self_: Self| {
      (*self_.0).as_ref().prepend(kind.inner().inner_muda())
    })?
    .map_err(Into::<crate::Error>::into)?;
    Ok(())
  }

  /// Add menu items to the beginning of this menu. It calls [`Menu::insert_items`] with position of `0` internally.
  ///
  /// ## Platform-specific:
  ///
  /// - **macOS:** Only [`Submenu`] can be added to the menu
  ///
  /// [`Submenu`]: super::Submenu
  pub fn prepend_items(&self, items: &[&dyn IsMenuItem<R>]) -> crate::Result<()> {
    self.insert_items(items, 0)
  }

  /// Insert a menu item at the specified `position` in the menu.
  ///
  /// ## Platform-specific:
  ///
  /// - **macOS:** Only [`Submenu`] can be added to the menu
  ///
  /// [`Submenu`]: super::Submenu
  pub fn insert(&self, item: &dyn IsMenuItem<R>, position: usize) -> crate::Result<()> {
    let kind = item.kind();
    run_item_main_thread!(self, |self_: Self| (*self_.0)
      .as_ref()
      .insert(kind.inner().inner_muda(), position))?
    .map_err(Into::<crate::Error>::into)?;
    Ok(())
  }

  /// Insert menu items at the specified `position` in the menu.
  ///
  /// ## Platform-specific:
  ///
  /// - **macOS:** Only [`Submenu`] can be added to the menu
  ///
  /// [`Submenu`]: super::Submenu
  pub fn insert_items(&self, items: &[&dyn IsMenuItem<R>], position: usize) -> crate::Result<()> {
    for (i, item) in items.iter().enumerate() {
      self.insert(*item, position + i)?
    }
    Ok(())
  }

  /// Remove a menu item from this menu.
  pub fn remove(&self, item: &dyn IsMenuItem<R>) -> crate::Result<()> {
    let kind = item.kind();
    run_item_main_thread!(self, |self_: Self| {
      (*self_.0).as_ref().remove(kind.inner().inner_muda())
    })?
    .map_err(Into::<crate::Error>::into)?;
    Ok(())
  }

  /// Remove the menu item at the specified position from this menu and returns it.
  pub fn remove_at(&self, position: usize) -> crate::Result<Option<MenuItemKind<R>>> {
    let result = run_item_main_thread!(self, |self_: Self| {
      (*self_.0)
        .as_ref()
        .remove_at(position)
        .map(|i| MenuItemKind::from_muda(self_.0.app_handle.clone(), i))
    })?;
    Ok(result)
  }

  /// Retrieves the menu item matching the given identifier.
  pub fn get<'a, I>(&self, id: &'a I) -> Option<MenuItemKind<R>>
  where
    I: ?Sized,
    MenuId: PartialEq<&'a I>,
  {
    self
      .items()
      .unwrap_or_default()
      .into_iter()
      .find(|i| i.id() == &id)
  }

  /// Returns a list of menu items that has been added to this menu.
  pub fn items(&self) -> crate::Result<Vec<MenuItemKind<R>>> {
    run_item_main_thread!(self, |self_: Self| {
      (*self_.0)
        .as_ref()
        .items()
        .into_iter()
        .map(|i| MenuItemKind::from_muda(self_.0.app_handle.clone(), i))
        .collect::<Vec<_>>()
    })
  }

  /// Set this menu as the application menu.
  ///
  /// This is an alias for [`AppHandle::set_menu`].
  pub fn set_as_app_menu(&self) -> crate::Result<Option<Menu<R>>> {
    self.0.app_handle.set_menu(self.clone())
  }

  /// Set this menu as the window menu.
  ///
  /// This is an alias for [`Window::set_menu`].
  pub fn set_as_window_menu(&self, window: &Window<R>) -> crate::Result<Option<Menu<R>>> {
    window.set_menu(self.clone())
  }

  /// Refresh the menu bar UI after modifying menu items.
  ///
  /// Call this after changing menu item text, enabled state, etc.
  /// to update the persistent menu bar display on desktop platforms.
  ///
  /// ## Platform-specific
  ///
  /// - **OHOS desktop**: Sends the updated menu JSON to ArkTS for re-rendering.
  /// - **Other platforms**: No-op (menu bar updates automatically).
  #[cfg(all(target_env = "ohos", desktop))]
  pub fn refresh_menubar(&self, window_id: &str) -> crate::Result<()> {
    (*self.0)
      .as_ref()
      .refresh_menubar(window_id)
      .map_err(Into::into)
  }
}
