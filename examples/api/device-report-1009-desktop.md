# Test Report

*Generated: 2026-10-09T03:37:29.076880780+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 12ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 35ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 29ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 140ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 178ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 143ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 39ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ✅ | 32ms |  |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 35ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 47ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 51ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 15 | window.__TAURI__ | ✅ | 1ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 106ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 145ms |  |
| 18 | append_invoke_initialization_script | ✅ | 1ms |  |
| 19 | localStorage set/get/remove | ✅ | 1ms |  |
| 20 | on_window_event | ✅ | 169ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 28ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 122ms |  |
| 23 | webview.eval_with_callback | ✅ | 34ms |  |
| 24 | webview.webPageSnapshot | ✅ | 681ms |  |
| 25 | app_handle.emit | ✅ | 165ms |  |
| 26 | app_handle.listen | ✅ | 154ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 236ms |  |
| 28 | on_page_load events | ✅ | 1045ms |  |
| 29 | on_navigation interceptor | ✅ | 1554ms |  |
| 30 | on_document_title_changed | ✅ | 1551ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 52ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 154ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 43ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1590ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1575ms |  |
| 36 | window.isDecorated returns boolean | ✅ | 36ms |  |
| 37 | window.setDecorations toggles decorations state | ✅ | 95ms |  |
| 38 | create_borderless_window command | ✅ | 557ms |  |
| 39 | create_transparent_borderless_window command | ✅ | 546ms |  |
| 40 | window.is_maximized returns boolean | ✅ | 35ms |  |
| 41 | window.is_minimized returns boolean | ✅ | 23ms |  |
| 42 | window.maximize then is_maximized reflects state | ✅ | 532ms |  |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1054ms |  |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 584ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 568ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 88ms |  |
| 47 | on_new_window: Deny blocks window.open() | ✅ | 1570ms |  |
| 48 | on_new_window: window.open triggers event with correct URL | ✅ | 2208ms |  |
| 49 | webview.createPdf (default A4) | ✅ | 260ms |  |
| 50 | on_download: Requested event fires | ✅ | 112ms |  |
| 51 | on_download: custom directory redirects path | ✅ | 103ms |  |
| 52 | on_download: block dangerous file types | ✅ | 118ms |  |
| 53 | on_download: audit log contains metadata | ✅ | 111ms |  |
| 54 | on_download: Finished event fires on successful download | ✅ | 134ms |  |
| 55 | DOM MouseEvent.dispatch (synthetic) | ✅ | 6ms |  |
| 56 | DOM MouseEvent.coordinates | ✅ | 1ms |  |
| 57 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 58 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 1ms |  |
| 59 | @tauri-apps/api/window.cursorPosition | ✅ | 92ms |  |
| 60 | webview.set_cookie round-trip (OHOS) | ✅ | 42ms |  |
| 61 | webview.cookies() returns array (OHOS best-effort) | ✅ | 42ms |  |
| 62 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 42ms |  |
| 63 | webview.cookies_for_url readable (OHOS) | ✅ | 40ms |  |
| 64 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1057ms |  |
| 65 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 91ms |  |
| 66 | PathResolver app_data_dir valid (OHOS) | ✅ | 27ms |  |
| 67 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 34ms |  |
| 68 | Clipboard API available (OHOS always-on) | ✅ | 1ms |  |
| 69 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 325ms |  |
| 70 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 128ms |  |
| 71 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 69ms |  |
| 72 | @tauri-apps/plugin-os.platform | ✅ | 2ms |  |
| 73 | @tauri-apps/plugin-log.trace | ✅ | 159ms |  |
| 74 | @tauri-apps/plugin-log.debug | ✅ | 38ms |  |
| 75 | @tauri-apps/plugin-log.info | ✅ | 38ms |  |
| 76 | @tauri-apps/plugin-log.warn | ✅ | 26ms |  |
| 77 | @tauri-apps/plugin-log.error | ✅ | 40ms |  |
| 78 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 50ms |  |
| 79 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 130ms |  |
| 80 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 60ms |  |
| 81 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 54ms |  |
| 82 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 68ms |  |
| 83 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 76ms |  |
| 84 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 796ms |  |
| 85 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 59ms |  |
| 86 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 134ms |  |
| 87 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 42ms |  |
| 88 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 159ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 89 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 39ms |  |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 36ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 43ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 225ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 171ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 43ms |  |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 52ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 115ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 37ms |  |
| 98 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 303ms |  |
| 99 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 76ms |  |
| 100 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 82ms |  |
| 101 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 4ms |  |
| 102 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 77ms |  |
| 103 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 56ms |  |
| 104 | @tauri-apps/plugin-notification.removeChannel | ✅ | 162ms |  |
| 105 | @tauri-apps/plugin-notification.pending+active | ✅ | 60ms |  |
| 106 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 107 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 175ms |  |
| 108 | tauri-plugin-sentry.breadcrumb | ✅ | 33ms |  |
| 109 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 62ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 71ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 63ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 168ms |  |
| 113 | tauri-plugin-sentry.envelope | ✅ | 35ms |  |
| 114 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 62ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 77ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 56ms |  |
| 117 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 34ms |  |
| 118 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 48ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 36ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 63ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 119ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 39ms |  |
| 123 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 31ms |  |
| 124 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 54ms |  |
| 125 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 40ms |  |
| 126 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 30ms |  |
| 127 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 154ms |  |
| 128 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 250ms |  |
| 129 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1283ms |  |
| 130 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 67ms |  |
| 131 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 44ms |  |
| 132 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 11ms |  |
| 133 | @tauri-apps/plugin-cli.getMatches | ✅ | 41ms |  |
| 134 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 51ms |  |
| 135 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 30ms |  |
| 136 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 66ms |  |
| 137 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 46ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 138 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 3ms |  |
| 139 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 2ms |  |
| 140 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 1ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 6ms |  |
| 142 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 143 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 5ms |  |
| 144 | @tauri-apps/api/window.innerSize | ✅ | 58ms |  |
| 145 | @tauri-apps/api/window.outerSize | ✅ | 34ms |  |
| 146 | @tauri-apps/api/window.innerPosition | ✅ | 32ms |  |
| 147 | @tauri-apps/api/window.outerPosition | ✅ | 28ms |  |
| 148 | @tauri-apps/api/window.scaleFactor | ✅ | 32ms |  |
| 149 | @tauri-apps/api/image.new | ✅ | 42ms |  |
| 150 | @tauri-apps/api/image.size | ✅ | 48ms |  |
| 151 | @tauri-apps/api/image.rgba | ✅ | 49ms |  |
| 152 | @tauri-apps/api/image.fromBytes | ✅ | 50ms |  |
| 153 | @tauri-apps/api/image.close | ✅ | 64ms |  |
| 154 | @tauri-apps/api/menu.Menu.new | ✅ | 52ms |  |
| 155 | @tauri-apps/api/menu.Menu.with_id | ✅ | 48ms |  |
| 156 | @tauri-apps/api/menu.Menu.with_items | ✅ | 74ms |  |
| 157 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 65ms |  |
| 158 | @tauri-apps/api/menu.Menu.append | ✅ | 78ms |  |
| 159 | @tauri-apps/api/menu.Menu.append_items | ✅ | 88ms |  |
| 160 | @tauri-apps/api/menu.Menu.prepend | ✅ | 101ms |  |
| 161 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 130ms |  |
| 162 | @tauri-apps/api/menu.Menu.insert | ✅ | 150ms |  |
| 163 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 205ms |  |
| 164 | @tauri-apps/api/menu.Menu.remove | ✅ | 113ms |  |
| 165 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 199ms |  |
| 166 | @tauri-apps/api/menu.Menu.get | ✅ | 104ms |  |
| 167 | @tauri-apps/api/menu.Menu.items | ✅ | 124ms |  |
| 168 | @tauri-apps/api/menu.MenuItem.new | ✅ | 109ms |  |
| 169 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 49ms |  |
| 170 | @tauri-apps/api/menu.MenuItem.text | ✅ | 52ms |  |
| 171 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 77ms |  |
| 172 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 95ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 74ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 70ms |  |
| 175 | @tauri-apps/api/menu.Submenu.new | ✅ | 56ms |  |
| 176 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 44ms |  |
| 177 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 70ms |  |
| 178 | @tauri-apps/api/menu.Submenu.append | ✅ | 75ms |  |
| 179 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 118ms |  |
| 180 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 114ms |  |
| 181 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 382ms |  |
| 182 | @tauri-apps/api/menu.Submenu.insert | ✅ | 226ms |  |
| 183 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 132ms |  |
| 184 | @tauri-apps/api/menu.Submenu.remove | ✅ | 104ms |  |
| 185 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 147ms |  |
| 186 | @tauri-apps/api/menu.Submenu.items | ✅ | 125ms |  |
| 187 | @tauri-apps/api/menu.Submenu.get | ✅ | 90ms |  |
| 188 | @tauri-apps/api/menu.Submenu.text | ✅ | 100ms |  |
| 189 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 103ms |  |
| 190 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 76ms |  |
| 191 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 58ms |  |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 64ms |  |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 62ms |  |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 65ms |  |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 62ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 61ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 63ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 79ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 113ms |  |
| 200 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 49ms |  |
| 201 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 64ms |  |
| 202 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 72ms |  |
| 203 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 87ms |  |
| 204 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 88ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 81ms |  |
| 206 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 72ms |  |
| 207 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 114ms |  |
| 208 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 49ms |  |
| 209 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 67ms |  |
| 210 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 106ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 99ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 61ms |  |
| 213 | @tauri-apps/api/menu.MenuItem.action | ✅ | 59ms |  |
| 214 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 55ms |  |
| 215 | @tauri-apps/api/menu.Submenu.kind | ✅ | 58ms |  |
| 216 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 51ms |  |
| 217 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 62ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 63ms |  |
| 219 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 66ms |  |
| 220 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 147ms |  |
| 221 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 17ms |  |
| 222 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 157ms |  |
| 223 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 198ms |  |
| 224 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 115ms |  |
| 225 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 99ms |  |
| 226 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 151ms |  |
| 227 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 97ms |  |
| 228 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1195ms |  |
| 229 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1212ms |  |
| 230 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 535ms |  |
| 231 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 545ms |  |
| 232 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 72ms |  |
| 233 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 48ms |  |
| 234 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 558ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 72ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 53ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 96ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 51ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 57ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 62ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 85ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 81ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 59ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 108ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 56ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 113ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 85ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 132ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 566ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1151ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 162ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 33ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 65ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 69ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 538ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 4ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 806ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1601ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1701ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 748ms |  |
| 261 | ohos-adapter.monitor.real-size | ✅ | 87ms |  |
| 262 | ohos-adapter.monitor.refresh-rate | ✅ | 71ms |  |
| 263 | ohos-init.chain.window-menu-tray | ✅ | 267ms |  |
| 264 | @tauri-apps/plugin-os.type | ✅ | 5ms |  |
| 265 | @tauri-apps/plugin-os.family | ✅ | 5ms |  |
| 266 | @tauri-apps/plugin-os.arch | ✅ | 9ms |  |
| 267 | @tauri-apps/plugin-os.eol | ✅ | 4ms |  |
| 268 | @tauri-apps/plugin-os.exeExtension | ✅ | 3ms |  |
| 269 | @tauri-apps/plugin-os.version | ✅ | 3ms |  |
| 270 | @tauri-apps/plugin-os.locale | ✅ | 250ms |  |
| 271 | @tauri-apps/plugin-os.hostname | ✅ | 82ms |  |
| 272 | @tauri-apps/plugin-notification.onAction register | ✅ | 71ms |  |
| 273 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 88ms |  |
| 274 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 50ms |  |
| 275 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 81ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 64ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 190ms |  |
| 278 | plugin-biometric.status | ✅ | 120ms |  |
| 279 | plugin-nfc.is_available | ✅ | 51ms |  |
| 280 | plugin-barcode-scanner.check_permissions | ✅ | 42ms |  |
| 281 | plugin-geolocation.check_permissions | ✅ | 31ms |  |
| 282 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 91ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 283 | plugin-notification.registerListener | ✅ | 87ms |  |
| 284 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 919ms |  |
| 285 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1525ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1410ms |  |
| 287 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 80ms |  |
| 288 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 93ms |  |
| 289 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 418ms |  |
| 290 | window.setFullscreen diag (main window) | ✅ | 2080ms |  |
| 291 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3627ms |  |
| 292 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 5029ms |  |
| 293 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 3948ms |  |
| 294 | window.setInnerSize actually resizes (main window) | ✅ | 5010ms |  |
| 295 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 2002ms |  |
| 296 | float window setInnerSize exact readback (decor=0) | ✅ | 1054ms |  |
| 297 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 1919ms |  |
| 298 | window.maximize fills monitor | ✅ | 1995ms |  |
| 299 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 897ms |  |
| 300 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1550ms |  |
| 301 | window.setAlwaysOnTop smoke (OHOS partial: flag only, no z-order API) | ✅ | 57ms |  |
| 302 | window.setIgnoreCursorEvents smoke | ✅ | 43ms |  |
| 303 | window decoration flags smoke (D group, main window no-op) | ✅ | 173ms |  |
| 304 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 2027ms |  |
| 305 | window cursor smoke (E group, no getter) | ✅ | 160ms |  |
| 306 | window.setContentProtection (demo cmd) | ✅ | 339ms |  |
| 307 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 598ms |  |
| 308 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 136ms |  |
| 309 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 500ms |  |
| 310 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 163ms |  |
| 311 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 204ms |  |

---

*Report generated at end of test run.*
