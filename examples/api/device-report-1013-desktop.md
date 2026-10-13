# Test Report

*Generated: 2026-10-13T12:48:57.965422657+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 10ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 33ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 22ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 156ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 174ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 141ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 40ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ✅ | 33ms |  |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 37ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 46ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 50ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 15 | window.__TAURI__ | ✅ | 1ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 107ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 146ms |  |
| 18 | append_invoke_initialization_script | ✅ | 1ms |  |
| 19 | localStorage set/get/remove | ✅ | 1ms |  |
| 20 | on_window_event | ✅ | 171ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 28ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 123ms |  |
| 23 | webview.eval_with_callback | ✅ | 32ms |  |
| 24 | webview.webPageSnapshot | ✅ | 675ms |  |
| 25 | app_handle.emit | ✅ | 171ms |  |
| 26 | app_handle.listen | ✅ | 152ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 234ms |  |
| 28 | on_page_load events | ✅ | 1047ms |  |
| 29 | on_navigation interceptor | ✅ | 1546ms |  |
| 30 | on_document_title_changed | ✅ | 1543ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 55ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 158ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 45ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1575ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1695ms |  |
| 36 | window.isDecorated returns boolean | ✅ | 43ms |  |
| 37 | window.setDecorations toggles decorations state | ✅ | 119ms |  |
| 38 | create_borderless_window command | ✅ | 561ms |  |
| 39 | create_transparent_borderless_window command | ✅ | 556ms |  |
| 40 | window.is_maximized returns boolean | ✅ | 23ms |  |
| 41 | window.is_minimized returns boolean | ✅ | 22ms |  |
| 42 | window.maximize then is_maximized reflects state | ✅ | 531ms |  |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1057ms |  |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 570ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 591ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 91ms |  |
| 47 | on_new_window: Deny blocks window.open() | ✅ | 1563ms |  |
| 48 | on_new_window: window.open triggers event with correct URL | ✅ | 2184ms |  |
| 49 | webview.createPdf (default A4) | ✅ | 229ms |  |
| 50 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 678ms |  |
| 51 | on_download: Requested event fires | ✅ | 111ms |  |
| 52 | on_download: custom directory redirects path | ✅ | 104ms |  |
| 53 | on_download: block dangerous file types | ✅ | 97ms |  |
| 54 | on_download: audit log contains metadata | ✅ | 103ms |  |
| 55 | on_download: Finished event fires on successful download | ✅ | 184ms |  |
| 56 | DOM MouseEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 57 | DOM MouseEvent.coordinates | ✅ | 1ms |  |
| 58 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 59 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 1ms |  |
| 60 | @tauri-apps/api/window.cursorPosition | ✅ | 75ms |  |
| 61 | webview.set_cookie round-trip (OHOS) | ✅ | 28ms |  |
| 62 | webview.cookies() returns array (OHOS best-effort) | ✅ | 32ms |  |
| 63 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 33ms |  |
| 64 | webview.cookies_for_url readable (OHOS) | ✅ | 35ms |  |
| 65 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1040ms |  |
| 66 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 91ms |  |
| 67 | PathResolver app_data_dir valid (OHOS) | ✅ | 26ms |  |
| 68 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 23ms |  |
| 69 | Clipboard API available (OHOS always-on) | ✅ | 1ms |  |
| 70 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 348ms |  |
| 71 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 153ms |  |
| 72 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 71ms |  |
| 73 | @tauri-apps/plugin-os.platform | ✅ | 2ms |  |
| 74 | @tauri-apps/plugin-log.trace | ✅ | 172ms |  |
| 75 | @tauri-apps/plugin-log.debug | ✅ | 46ms |  |
| 76 | @tauri-apps/plugin-log.info | ✅ | 33ms |  |
| 77 | @tauri-apps/plugin-log.warn | ✅ | 33ms |  |
| 78 | @tauri-apps/plugin-log.error | ✅ | 27ms |  |
| 79 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 46ms |  |
| 80 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 141ms |  |
| 81 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 62ms |  |
| 82 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 41ms |  |
| 83 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 41ms |  |
| 84 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 75ms |  |
| 85 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 837ms |  |
| 86 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 64ms |  |
| 87 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 157ms |  |
| 88 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 38ms |  |
| 89 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 157ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 50ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 34ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 103ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 185ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 185ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 61ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 70ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 96ms |  |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 44ms |  |
| 99 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 249ms |  |
| 100 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 82ms |  |
| 101 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 84ms |  |
| 102 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 5ms |  |
| 103 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 78ms |  |
| 104 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 53ms |  |
| 105 | @tauri-apps/plugin-notification.removeChannel | ✅ | 104ms |  |
| 106 | @tauri-apps/plugin-notification.pending+active | ✅ | 54ms |  |
| 107 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 108 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 227ms |  |
| 109 | tauri-plugin-sentry.breadcrumb | ✅ | 40ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 69ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 63ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 51ms |  |
| 113 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 144ms |  |
| 114 | tauri-plugin-sentry.envelope | ✅ | 37ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 50ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 52ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 45ms |  |
| 118 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 40ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 46ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 50ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 60ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 84ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 41ms |  |
| 124 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 29ms |  |
| 125 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 46ms |  |
| 126 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 50ms |  |
| 127 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 34ms |  |
| 128 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 145ms |  |
| 129 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 136ms |  |
| 130 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1261ms |  |
| 131 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 55ms |  |
| 132 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 41ms |  |
| 133 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 9ms |  |
| 134 | @tauri-apps/plugin-cli.getMatches | ✅ | 42ms |  |
| 135 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 78ms |  |
| 136 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 41ms |  |
| 137 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 61ms |  |
| 138 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 43ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 139 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 140 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 1ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 1ms |  |
| 142 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 1ms |  |
| 143 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 5ms |  |
| 144 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 5ms |  |
| 145 | @tauri-apps/api/window.innerSize | ✅ | 60ms |  |
| 146 | @tauri-apps/api/window.outerSize | ✅ | 30ms |  |
| 147 | @tauri-apps/api/window.innerPosition | ✅ | 22ms |  |
| 148 | @tauri-apps/api/window.outerPosition | ✅ | 30ms |  |
| 149 | @tauri-apps/api/window.scaleFactor | ✅ | 28ms |  |
| 150 | @tauri-apps/api/image.new | ✅ | 35ms |  |
| 151 | @tauri-apps/api/image.size | ✅ | 39ms |  |
| 152 | @tauri-apps/api/image.rgba | ✅ | 32ms |  |
| 153 | @tauri-apps/api/image.fromBytes | ✅ | 39ms |  |
| 154 | @tauri-apps/api/image.close | ✅ | 47ms |  |
| 155 | @tauri-apps/api/menu.Menu.new | ✅ | 32ms |  |
| 156 | @tauri-apps/api/menu.Menu.with_id | ✅ | 39ms |  |
| 157 | @tauri-apps/api/menu.Menu.with_items | ✅ | 63ms |  |
| 158 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 56ms |  |
| 159 | @tauri-apps/api/menu.Menu.append | ✅ | 62ms |  |
| 160 | @tauri-apps/api/menu.Menu.append_items | ✅ | 89ms |  |
| 161 | @tauri-apps/api/menu.Menu.prepend | ✅ | 115ms |  |
| 162 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 103ms |  |
| 163 | @tauri-apps/api/menu.Menu.insert | ✅ | 117ms |  |
| 164 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 102ms |  |
| 165 | @tauri-apps/api/menu.Menu.remove | ✅ | 78ms |  |
| 166 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 124ms |  |
| 167 | @tauri-apps/api/menu.Menu.get | ✅ | 84ms |  |
| 168 | @tauri-apps/api/menu.Menu.items | ✅ | 114ms |  |
| 169 | @tauri-apps/api/menu.MenuItem.new | ✅ | 56ms |  |
| 170 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 44ms |  |
| 171 | @tauri-apps/api/menu.MenuItem.text | ✅ | 54ms |  |
| 172 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 86ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 64ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 63ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 56ms |  |
| 176 | @tauri-apps/api/menu.Submenu.new | ✅ | 38ms |  |
| 177 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 38ms |  |
| 178 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 70ms |  |
| 179 | @tauri-apps/api/menu.Submenu.append | ✅ | 75ms |  |
| 180 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 89ms |  |
| 181 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 130ms |  |
| 182 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 167ms |  |
| 183 | @tauri-apps/api/menu.Submenu.insert | ✅ | 135ms |  |
| 184 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 152ms |  |
| 185 | @tauri-apps/api/menu.Submenu.remove | ✅ | 108ms |  |
| 186 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 137ms |  |
| 187 | @tauri-apps/api/menu.Submenu.items | ✅ | 130ms |  |
| 188 | @tauri-apps/api/menu.Submenu.get | ✅ | 133ms |  |
| 189 | @tauri-apps/api/menu.Submenu.text | ✅ | 122ms |  |
| 190 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 97ms |  |
| 191 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 59ms |  |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 51ms |  |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 83ms |  |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 67ms |  |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 62ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 71ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 81ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 61ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 105ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 115ms |  |
| 201 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 48ms |  |
| 202 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 62ms |  |
| 203 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 72ms |  |
| 204 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 81ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 89ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 64ms |  |
| 207 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 46ms |  |
| 208 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 123ms |  |
| 209 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 47ms |  |
| 210 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 71ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 94ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 88ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 52ms |  |
| 214 | @tauri-apps/api/menu.MenuItem.action | ✅ | 36ms |  |
| 215 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 51ms |  |
| 216 | @tauri-apps/api/menu.Submenu.kind | ✅ | 35ms |  |
| 217 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 35ms |  |
| 218 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 34ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 38ms |  |
| 220 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 55ms |  |
| 221 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 88ms |  |
| 222 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 8ms |  |
| 223 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 132ms |  |
| 224 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 150ms |  |
| 225 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 87ms |  |
| 226 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 81ms |  |
| 227 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 146ms |  |
| 228 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 76ms |  |
| 229 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1107ms |  |
| 230 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1147ms |  |
| 231 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 553ms |  |
| 232 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 543ms |  |
| 233 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 69ms |  |
| 234 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 48ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 604ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 46ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 53ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 87ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 74ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 59ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 137ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 115ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 98ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 134ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 95ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 58ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 120ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 99ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 118ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 635ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1220ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 136ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 95ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 39ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 64ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 562ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 12ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 991ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1629ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1755ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 743ms |  |
| 262 | ohos-adapter.monitor.real-size | ✅ | 91ms |  |
| 263 | ohos-adapter.monitor.refresh-rate | ✅ | 56ms |  |
| 264 | ohos-init.chain.window-menu-tray | ✅ | 332ms |  |
| 265 | @tauri-apps/plugin-os.type | ✅ | 10ms |  |
| 266 | @tauri-apps/plugin-os.family | ✅ | 4ms |  |
| 267 | @tauri-apps/plugin-os.arch | ✅ | 6ms |  |
| 268 | @tauri-apps/plugin-os.eol | ✅ | 2ms |  |
| 269 | @tauri-apps/plugin-os.exeExtension | ✅ | 2ms |  |
| 270 | @tauri-apps/plugin-os.version | ✅ | 2ms |  |
| 271 | @tauri-apps/plugin-os.locale | ✅ | 287ms |  |
| 272 | @tauri-apps/plugin-os.hostname | ✅ | 86ms |  |
| 273 | @tauri-apps/plugin-notification.onAction register | ✅ | 94ms |  |
| 274 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 111ms |  |
| 275 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 81ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 105ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 76ms |  |
| 278 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 251ms |  |
| 279 | plugin-biometric.status | ✅ | 135ms |  |
| 280 | plugin-nfc.is_available | ✅ | 63ms |  |
| 281 | plugin-barcode-scanner.check_permissions | ✅ | 85ms |  |
| 282 | plugin-geolocation.check_permissions | ✅ | 104ms |  |
| 283 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 93ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 284 | plugin-notification.registerListener | ✅ | 76ms |  |
| 285 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 842ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1440ms |  |
| 287 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1332ms |  |
| 288 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 80ms |  |
| 289 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 89ms |  |
| 290 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 215ms |  |
| 291 | window.setFullscreen diag (main window) | ✅ | 2073ms |  |
| 292 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3099ms |  |
| 293 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 4008ms |  |
| 294 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2531ms |  |
| 295 | window.setInnerSize actually resizes (main window) | ✅ | 1600ms |  |
| 296 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1446ms |  |
| 297 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 4071ms |  |
| 298 | float window setInnerSize exact readback (decor=0) | ✅ | 679ms |  |
| 299 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 661ms |  |
| 300 | window.maximize fills monitor | ✅ | 1101ms |  |
| 301 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 851ms |  |
| 302 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1675ms |  |
| 303 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 54ms |  |
| 304 | window.setIgnoreCursorEvents smoke | ✅ | 53ms |  |
| 305 | window decoration flags smoke (D group, main window no-op) | ✅ | 157ms |  |
| 306 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 2029ms |  |
| 307 | window cursor smoke (E group, no getter) | ✅ | 161ms |  |
| 308 | window.setContentProtection (demo cmd) | ✅ | 349ms |  |
| 309 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 602ms |  |
| 310 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 124ms |  |
| 311 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 507ms |  |
| 312 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 159ms |  |
| 313 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 226ms |  |

---

*Report generated at end of test run.*
