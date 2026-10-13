# Test Report

*Generated: 2026-10-13T02:08:06.131242812+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 33ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 33ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 139ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 174ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 142ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 40ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ✅ | 32ms |  |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 35ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 47ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 53ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 15 | window.__TAURI__ | ✅ | 1ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 103ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 144ms |  |
| 18 | append_invoke_initialization_script | ✅ | 1ms |  |
| 19 | localStorage set/get/remove | ✅ | 1ms |  |
| 20 | on_window_event | ✅ | 170ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 29ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 122ms |  |
| 23 | webview.eval_with_callback | ✅ | 31ms |  |
| 24 | webview.webPageSnapshot | ✅ | 667ms |  |
| 25 | app_handle.emit | ✅ | 173ms |  |
| 26 | app_handle.listen | ✅ | 157ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 236ms |  |
| 28 | on_page_load events | ✅ | 1048ms |  |
| 29 | on_navigation interceptor | ✅ | 1552ms |  |
| 30 | on_document_title_changed | ✅ | 1544ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 50ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 162ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 48ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1601ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1598ms |  |
| 36 | window.isDecorated returns boolean | ✅ | 45ms |  |
| 37 | window.setDecorations toggles decorations state | ✅ | 81ms |  |
| 38 | create_borderless_window command | ✅ | 555ms |  |
| 39 | create_transparent_borderless_window command | ✅ | 561ms |  |
| 40 | window.is_maximized returns boolean | ✅ | 33ms |  |
| 41 | window.is_minimized returns boolean | ✅ | 23ms |  |
| 42 | window.maximize then is_maximized reflects state | ✅ | 538ms |  |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1052ms |  |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 586ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 570ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 87ms |  |
| 47 | on_new_window: Deny blocks window.open() | ✅ | 1558ms |  |
| 48 | on_new_window: window.open triggers event with correct URL | ✅ | 2211ms |  |
| 49 | webview.createPdf (default A4) | ✅ | 239ms |  |
| 50 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 663ms |  |
| 51 | on_download: Requested event fires | ✅ | 106ms |  |
| 52 | on_download: custom directory redirects path | ✅ | 106ms |  |
| 53 | on_download: block dangerous file types | ✅ | 101ms |  |
| 54 | on_download: audit log contains metadata | ✅ | 101ms |  |
| 55 | on_download: Finished event fires on successful download | ✅ | 127ms |  |
| 56 | DOM MouseEvent.dispatch (synthetic) | ✅ | 4ms |  |
| 57 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 58 | DOM WheelEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 59 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 60 | @tauri-apps/api/window.cursorPosition | ✅ | 100ms |  |
| 61 | webview.set_cookie round-trip (OHOS) | ✅ | 29ms |  |
| 62 | webview.cookies() returns array (OHOS best-effort) | ✅ | 34ms |  |
| 63 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 33ms |  |
| 64 | webview.cookies_for_url readable (OHOS) | ✅ | 33ms |  |
| 65 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1046ms |  |
| 66 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 89ms |  |
| 67 | PathResolver app_data_dir valid (OHOS) | ✅ | 25ms |  |
| 68 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 26ms |  |
| 69 | Clipboard API available (OHOS always-on) | ✅ | 1ms |  |
| 70 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 301ms |  |
| 71 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 142ms |  |
| 72 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 63ms |  |
| 73 | @tauri-apps/plugin-os.platform | ✅ | 2ms |  |
| 74 | @tauri-apps/plugin-log.trace | ✅ | 164ms |  |
| 75 | @tauri-apps/plugin-log.debug | ✅ | 33ms |  |
| 76 | @tauri-apps/plugin-log.info | ✅ | 30ms |  |
| 77 | @tauri-apps/plugin-log.warn | ✅ | 31ms |  |
| 78 | @tauri-apps/plugin-log.error | ✅ | 31ms |  |
| 79 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 45ms |  |
| 80 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 134ms |  |
| 81 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 61ms |  |
| 82 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 47ms |  |
| 83 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 51ms |  |
| 84 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 64ms |  |
| 85 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 1143ms |  |
| 86 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 48ms |  |
| 87 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 112ms |  |
| 88 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 35ms |  |
| 89 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 150ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 49ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 321ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 65ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 181ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 178ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 43ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 41ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 138ms |  |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 41ms |  |
| 99 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 211ms |  |
| 100 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 91ms |  |
| 101 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 124ms |  |
| 102 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 3ms |  |
| 103 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 100ms |  |
| 104 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 53ms |  |
| 105 | @tauri-apps/plugin-notification.removeChannel | ✅ | 98ms |  |
| 106 | @tauri-apps/plugin-notification.pending+active | ✅ | 51ms |  |
| 107 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 108 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 236ms |  |
| 109 | tauri-plugin-sentry.breadcrumb | ✅ | 36ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 62ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 71ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 58ms |  |
| 113 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 213ms |  |
| 114 | tauri-plugin-sentry.envelope | ✅ | 39ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 60ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 65ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 54ms |  |
| 118 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 31ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 48ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 50ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 78ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 121ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 56ms |  |
| 124 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 44ms |  |
| 125 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 49ms |  |
| 126 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 56ms |  |
| 127 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 39ms |  |
| 128 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 184ms |  |
| 129 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 224ms |  |
| 130 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1309ms |  |
| 131 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 125ms |  |
| 132 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 64ms |  |
| 133 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 12ms |  |
| 134 | @tauri-apps/plugin-cli.getMatches | ✅ | 63ms |  |
| 135 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 61ms |  |
| 136 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 39ms |  |
| 137 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 117ms |  |
| 138 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 56ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 139 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 4ms |  |
| 140 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 4ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 4ms |  |
| 142 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 2ms |  |
| 143 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 144 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 1ms |  |
| 145 | @tauri-apps/api/window.innerSize | ✅ | 101ms |  |
| 146 | @tauri-apps/api/window.outerSize | ✅ | 32ms |  |
| 147 | @tauri-apps/api/window.innerPosition | ✅ | 23ms |  |
| 148 | @tauri-apps/api/window.outerPosition | ✅ | 26ms |  |
| 149 | @tauri-apps/api/window.scaleFactor | ✅ | 26ms |  |
| 150 | @tauri-apps/api/image.new | ✅ | 33ms |  |
| 151 | @tauri-apps/api/image.size | ✅ | 52ms |  |
| 152 | @tauri-apps/api/image.rgba | ✅ | 42ms |  |
| 153 | @tauri-apps/api/image.fromBytes | ✅ | 63ms |  |
| 154 | @tauri-apps/api/image.close | ✅ | 54ms |  |
| 155 | @tauri-apps/api/menu.Menu.new | ✅ | 34ms |  |
| 156 | @tauri-apps/api/menu.Menu.with_id | ✅ | 33ms |  |
| 157 | @tauri-apps/api/menu.Menu.with_items | ✅ | 52ms |  |
| 158 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 73ms |  |
| 159 | @tauri-apps/api/menu.Menu.append | ✅ | 51ms |  |
| 160 | @tauri-apps/api/menu.Menu.append_items | ✅ | 83ms |  |
| 161 | @tauri-apps/api/menu.Menu.prepend | ✅ | 183ms |  |
| 162 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 111ms |  |
| 163 | @tauri-apps/api/menu.Menu.insert | ✅ | 172ms |  |
| 164 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 171ms |  |
| 165 | @tauri-apps/api/menu.Menu.remove | ✅ | 109ms |  |
| 166 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 205ms |  |
| 167 | @tauri-apps/api/menu.Menu.get | ✅ | 143ms |  |
| 168 | @tauri-apps/api/menu.Menu.items | ✅ | 91ms |  |
| 169 | @tauri-apps/api/menu.MenuItem.new | ✅ | 106ms |  |
| 170 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 73ms |  |
| 171 | @tauri-apps/api/menu.MenuItem.text | ✅ | 72ms |  |
| 172 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 70ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 124ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 86ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 91ms |  |
| 176 | @tauri-apps/api/menu.Submenu.new | ✅ | 79ms |  |
| 177 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 48ms |  |
| 178 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 87ms |  |
| 179 | @tauri-apps/api/menu.Submenu.append | ✅ | 76ms |  |
| 180 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 119ms |  |
| 181 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 111ms |  |
| 182 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 258ms |  |
| 183 | @tauri-apps/api/menu.Submenu.insert | ✅ | 209ms |  |
| 184 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 201ms |  |
| 185 | @tauri-apps/api/menu.Submenu.remove | ✅ | 141ms |  |
| 186 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 180ms |  |
| 187 | @tauri-apps/api/menu.Submenu.items | ✅ | 191ms |  |
| 188 | @tauri-apps/api/menu.Submenu.get | ✅ | 108ms |  |
| 189 | @tauri-apps/api/menu.Submenu.text | ✅ | 144ms |  |
| 190 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 102ms |  |
| 191 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 83ms |  |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 84ms |  |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 52ms |  |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 65ms |  |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 89ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 70ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 57ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 72ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 77ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 99ms |  |
| 201 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 58ms |  |
| 202 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 99ms |  |
| 203 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 79ms |  |
| 204 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 111ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 99ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 58ms |  |
| 207 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 57ms |  |
| 208 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 139ms |  |
| 209 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 67ms |  |
| 210 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 60ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 89ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 121ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 71ms |  |
| 214 | @tauri-apps/api/menu.MenuItem.action | ✅ | 50ms |  |
| 215 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 86ms |  |
| 216 | @tauri-apps/api/menu.Submenu.kind | ✅ | 71ms |  |
| 217 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 46ms |  |
| 218 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 38ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 49ms |  |
| 220 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 43ms |  |
| 221 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 146ms |  |
| 222 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 17ms |  |
| 223 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 280ms |  |
| 224 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 128ms |  |
| 225 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 127ms |  |
| 226 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 109ms |  |
| 227 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 148ms |  |
| 228 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 186ms |  |
| 229 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1243ms |  |
| 230 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1304ms |  |
| 231 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 550ms |  |
| 232 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 595ms |  |
| 233 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 87ms |  |
| 234 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 64ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 631ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 55ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 55ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 85ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 45ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 57ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 45ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 68ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 61ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 63ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 85ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 44ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 101ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 235ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 122ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 579ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1167ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 239ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 53ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 59ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 63ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 617ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 4ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 1015ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1691ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1738ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 829ms |  |
| 262 | ohos-adapter.monitor.real-size | ✅ | 90ms |  |
| 263 | ohos-adapter.monitor.refresh-rate | ✅ | 63ms |  |
| 264 | ohos-init.chain.window-menu-tray | ✅ | 212ms |  |
| 265 | @tauri-apps/plugin-os.type | ✅ | 6ms |  |
| 266 | @tauri-apps/plugin-os.family | ✅ | 4ms |  |
| 267 | @tauri-apps/plugin-os.arch | ✅ | 3ms |  |
| 268 | @tauri-apps/plugin-os.eol | ✅ | 5ms |  |
| 269 | @tauri-apps/plugin-os.exeExtension | ✅ | 5ms |  |
| 270 | @tauri-apps/plugin-os.version | ✅ | 7ms |  |
| 271 | @tauri-apps/plugin-os.locale | ✅ | 256ms |  |
| 272 | @tauri-apps/plugin-os.hostname | ✅ | 74ms |  |
| 273 | @tauri-apps/plugin-notification.onAction register | ✅ | 86ms |  |
| 274 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 141ms |  |
| 275 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 57ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 59ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 58ms |  |
| 278 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 191ms |  |
| 279 | plugin-biometric.status | ✅ | 71ms |  |
| 280 | plugin-nfc.is_available | ✅ | 94ms |  |
| 281 | plugin-barcode-scanner.check_permissions | ✅ | 69ms |  |
| 282 | plugin-geolocation.check_permissions | ✅ | 67ms |  |
| 283 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 54ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 284 | plugin-notification.registerListener | ✅ | 72ms |  |
| 285 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 1079ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1720ms |  |
| 287 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1449ms |  |
| 288 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 102ms |  |
| 289 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 109ms |  |
| 290 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 510ms |  |
| 291 | window.setFullscreen diag (main window) | ✅ | 2179ms |  |
| 292 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3685ms |  |
| 293 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 4982ms |  |
| 294 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 3997ms |  |
| 295 | window.setInnerSize actually resizes (main window) | ✅ | 3007ms |  |
| 296 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1938ms |  |
| 297 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 4996ms |  |
| 298 | float window setInnerSize exact readback (decor=0) | ✅ | 1074ms |  |
| 299 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 1902ms |  |
| 300 | window.maximize fills monitor | ✅ | 1996ms |  |
| 301 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 923ms |  |
| 302 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1505ms |  |
| 303 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 53ms |  |
| 304 | window.setIgnoreCursorEvents smoke | ✅ | 44ms |  |
| 305 | window decoration flags smoke (D group, main window no-op) | ✅ | 182ms |  |
| 306 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1969ms |  |
| 307 | window cursor smoke (E group, no getter) | ✅ | 189ms |  |
| 308 | window.setContentProtection (demo cmd) | ✅ | 347ms |  |
| 309 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 439ms |  |
| 310 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 144ms |  |
| 311 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 498ms |  |
| 312 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 249ms |  |
| 313 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 270ms |  |

---

*Report generated at end of test run.*
