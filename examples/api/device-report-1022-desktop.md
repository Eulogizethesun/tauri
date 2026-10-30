# Test Report

*Generated: 2026-10-22T01:43:20.260951719+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 10ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 36ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 23ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 153ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 723ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 177ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 146ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 46ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 37ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 41ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 54ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 62ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 123ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 163ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 181ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 33ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 126ms |  |
| 24 | webview.eval_with_callback | ✅ | 31ms |  |
| 25 | webview.webPageSnapshot | ✅ | 668ms |  |
| 26 | app_handle.emit | ✅ | 171ms |  |
| 27 | app_handle.listen | ✅ | 158ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 244ms |  |
| 29 | on_page_load events | ✅ | 1153ms |  |
| 30 | on_navigation interceptor | ✅ | 1549ms |  |
| 31 | on_document_title_changed | ✅ | 1558ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 56ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 161ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 37ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1603ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1624ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 45ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 97ms |  |
| 39 | create_borderless_window command | ✅ | 552ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 552ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 38ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 33ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 539ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1063ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 568ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 572ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 85ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1563ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2186ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 263ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 665ms |  |
| 52 | webview.clearAllBrowsingData clears document.cookie | ⏭️ | 3ms | document.cookie set/read not observable on this build (before="") — cookie wipe unverifiable from JS |
| 53 | on_download: Requested event fires | ✅ | 128ms |  |
| 54 | on_download: custom directory redirects path | ✅ | 109ms |  |
| 55 | on_download: block dangerous file types | ✅ | 117ms |  |
| 56 | on_download: audit log contains metadata | ✅ | 102ms |  |
| 57 | on_download: Finished event fires on successful download | ✅ | 134ms |  |
| 58 | webview child created with explicit bounds renders at requested size | ✅ | 645ms |  |
| 59 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 626ms |  |
| 60 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 660ms |  |
| 61 | DOM MouseEvent.dispatch (synthetic) | ✅ | 5ms |  |
| 62 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 63 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 64 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 65 | @tauri-apps/api/window.cursorPosition | ✅ | 144ms |  |
| 66 | webview.set_cookie round-trip (OHOS) | ✅ | 67ms |  |
| 67 | webview.cookies() returns array (OHOS best-effort) | ✅ | 57ms |  |
| 68 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 66ms |  |
| 69 | webview.cookies_for_url readable (OHOS) | ✅ | 65ms |  |
| 70 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1055ms |  |
| 71 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 156ms |  |
| 72 | PathResolver app_data_dir valid (OHOS) | ✅ | 31ms |  |
| 73 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 33ms |  |
| 74 | Clipboard API available (OHOS always-on) | ✅ | 3ms |  |
| 75 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 330ms |  |
| 76 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 141ms |  |
| 77 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 74ms |  |
| 78 | webview.url() main-thread sync read after SPA navigation (#192) | ✅ | 3206ms |  |
| 79 | webview.incognito create + cookie isolation (#188) | ✅ | 2786ms |  |
| 80 | window.set_title tracked ack: real window resolves, illegal label rejects (#219) | ✅ | 883ms |  |
| 81 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 82 | @tauri-apps/plugin-log.trace | ✅ | 55ms |  |
| 83 | @tauri-apps/plugin-log.debug | ✅ | 42ms |  |
| 84 | @tauri-apps/plugin-log.info | ✅ | 37ms |  |
| 85 | @tauri-apps/plugin-log.warn | ✅ | 36ms |  |
| 86 | @tauri-apps/plugin-log.error | ✅ | 23ms |  |
| 87 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 49ms |  |
| 88 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 65ms |  |
| 89 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 66ms |  |
| 90 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 43ms |  |
| 91 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 60ms |  |
| 92 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 73ms |  |
| 93 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 972ms |  |
| 94 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 58ms |  |
| 95 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 209ms |  |
| 96 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 34ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 159ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 161ms |  |
| 99 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 49ms |  |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 65ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 185ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 191ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 103 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 41ms |  |
| 104 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 44ms |  |
| 105 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 108ms |  |
| 106 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 58ms |  |
| 107 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 328ms |  |
| 108 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 82ms |  |
| 109 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 101ms |  |
| 110 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 2ms |  |
| 111 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 90ms |  |
| 112 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 58ms |  |
| 113 | @tauri-apps/plugin-notification.removeChannel | ✅ | 111ms |  |
| 114 | @tauri-apps/plugin-notification.pending+active | ✅ | 69ms |  |
| 115 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 3ms | notification permission disabled — enable notifications for this app to run this test |
| 116 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 238ms |  |
| 117 | tauri-plugin-sentry.breadcrumb | ✅ | 40ms |  |
| 118 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 59ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 78ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 62ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 190ms |  |
| 122 | tauri-plugin-sentry.envelope | ✅ | 54ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 67ms |  |
| 124 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 54ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 44ms |  |
| 126 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 36ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 49ms |  |
| 128 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 39ms |  |
| 129 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 83ms |  |
| 130 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 178ms |  |
| 131 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 62ms |  |
| 132 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 34ms |  |
| 133 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 48ms |  |
| 134 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 55ms |  |
| 135 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 45ms |  |
| 136 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 168ms |  |
| 137 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 132ms |  |
| 138 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1283ms |  |
| 139 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 116ms |  |
| 140 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 45ms |  |
| 141 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 10ms |  |
| 142 | @tauri-apps/plugin-cli.getMatches | ✅ | 48ms |  |
| 143 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 57ms |  |
| 144 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 33ms |  |
| 145 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 68ms |  |
| 146 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 41ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 147 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 4ms |  |
| 148 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 2ms |  |
| 149 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 5ms |  |
| 150 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 5ms |  |
| 151 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 152 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 8ms |  |
| 153 | @tauri-apps/api/window.innerSize | ✅ | 114ms |  |
| 154 | @tauri-apps/api/window.outerSize | ✅ | 63ms |  |
| 155 | @tauri-apps/api/window.innerPosition | ✅ | 39ms |  |
| 156 | @tauri-apps/api/window.outerPosition | ✅ | 40ms |  |
| 157 | @tauri-apps/api/window.scaleFactor | ✅ | 51ms |  |
| 158 | @tauri-apps/api/image.new | ✅ | 38ms |  |
| 159 | @tauri-apps/api/image.size | ✅ | 63ms |  |
| 160 | @tauri-apps/api/image.rgba | ✅ | 53ms |  |
| 161 | @tauri-apps/api/image.fromBytes | ✅ | 49ms |  |
| 162 | @tauri-apps/api/image.close | ✅ | 61ms |  |
| 163 | @tauri-apps/api/menu.Menu.new | ✅ | 46ms |  |
| 164 | @tauri-apps/api/menu.Menu.with_id | ✅ | 57ms |  |
| 165 | @tauri-apps/api/menu.Menu.with_items | ✅ | 92ms |  |
| 166 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 68ms |  |
| 167 | @tauri-apps/api/menu.Menu.append | ✅ | 76ms |  |
| 168 | @tauri-apps/api/menu.Menu.append_items | ✅ | 112ms |  |
| 169 | @tauri-apps/api/menu.Menu.prepend | ✅ | 168ms |  |
| 170 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 164ms |  |
| 171 | @tauri-apps/api/menu.Menu.insert | ✅ | 162ms |  |
| 172 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 151ms |  |
| 173 | @tauri-apps/api/menu.Menu.remove | ✅ | 111ms |  |
| 174 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 189ms |  |
| 175 | @tauri-apps/api/menu.Menu.get | ✅ | 93ms |  |
| 176 | @tauri-apps/api/menu.Menu.items | ✅ | 122ms |  |
| 177 | @tauri-apps/api/menu.MenuItem.new | ✅ | 75ms |  |
| 178 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 65ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.text | ✅ | 87ms |  |
| 180 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 98ms |  |
| 181 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 107ms |  |
| 182 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 115ms |  |
| 183 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 89ms |  |
| 184 | @tauri-apps/api/menu.Submenu.new | ✅ | 74ms |  |
| 185 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 74ms |  |
| 186 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 130ms |  |
| 187 | @tauri-apps/api/menu.Submenu.append | ✅ | 122ms |  |
| 188 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 123ms |  |
| 189 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 160ms |  |
| 190 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 176ms |  |
| 191 | @tauri-apps/api/menu.Submenu.insert | ✅ | 165ms |  |
| 192 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 173ms |  |
| 193 | @tauri-apps/api/menu.Submenu.remove | ✅ | 135ms |  |
| 194 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 201ms |  |
| 195 | @tauri-apps/api/menu.Submenu.items | ✅ | 147ms |  |
| 196 | @tauri-apps/api/menu.Submenu.get | ✅ | 114ms |  |
| 197 | @tauri-apps/api/menu.Submenu.text | ✅ | 142ms |  |
| 198 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 105ms |  |
| 199 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 96ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 83ms |  |
| 201 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 75ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 86ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 88ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 83ms |  |
| 205 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 84ms |  |
| 206 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 113ms |  |
| 207 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 101ms |  |
| 208 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 112ms |  |
| 209 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 74ms |  |
| 210 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 103ms |  |
| 211 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 108ms |  |
| 212 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 130ms |  |
| 213 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 116ms |  |
| 214 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 77ms |  |
| 215 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 213ms |  |
| 216 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 157ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 78ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 107ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 125ms |  |
| 220 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 152ms |  |
| 221 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 124ms |  |
| 222 | @tauri-apps/api/menu.MenuItem.action | ✅ | 89ms |  |
| 223 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 65ms |  |
| 224 | @tauri-apps/api/menu.Submenu.kind | ✅ | 86ms |  |
| 225 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 79ms |  |
| 226 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 80ms |  |
| 227 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 67ms |  |
| 228 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 100ms |  |
| 229 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 179ms |  |
| 230 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 30ms |  |
| 231 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 260ms |  |
| 232 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 133ms |  |
| 233 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 128ms |  |
| 234 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 130ms |  |
| 235 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 157ms |  |
| 236 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 127ms |  |
| 237 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1210ms |  |
| 238 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1217ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 546ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 552ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 87ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 95ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 612ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 93ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 89ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 133ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 94ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 101ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 95ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 135ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 115ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 113ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 193ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 132ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 163ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 176ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 145ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 609ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1179ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 247ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 76ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 80ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 107ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 549ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 5ms |  |
| 266 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 889ms |  |
| 267 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1640ms |  |
| 268 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1782ms |  |
| 269 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 690ms |  |
| 270 | ohos-adapter.monitor.real-size | ✅ | 115ms |  |
| 271 | ohos-adapter.monitor.refresh-rate | ✅ | 107ms |  |
| 272 | ohos-init.chain.window-menu-tray | ✅ | 263ms |  |
| 273 | @tauri-apps/plugin-os.type | ✅ | 7ms |  |
| 274 | @tauri-apps/plugin-os.family | ✅ | 4ms |  |
| 275 | @tauri-apps/plugin-os.arch | ✅ | 6ms |  |
| 276 | @tauri-apps/plugin-os.eol | ✅ | 9ms |  |
| 277 | @tauri-apps/plugin-os.exeExtension | ✅ | 5ms |  |
| 278 | @tauri-apps/plugin-os.version | ✅ | 3ms |  |
| 279 | @tauri-apps/plugin-os.locale | ✅ | 319ms |  |
| 280 | @tauri-apps/plugin-os.hostname | ✅ | 106ms |  |
| 281 | @tauri-apps/plugin-notification.onAction register | ✅ | 105ms |  |
| 282 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 127ms |  |
| 283 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 70ms |  |
| 284 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 107ms |  |
| 285 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 94ms |  |
| 286 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 241ms |  |
| 287 | plugin-biometric.status | ✅ | 123ms |  |
| 288 | plugin-nfc.is_available | ✅ | 85ms |  |
| 289 | plugin-barcode-scanner.check_permissions | ✅ | 85ms |  |
| 290 | plugin-geolocation.check_permissions | ✅ | 55ms |  |
| 291 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 90ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 292 | plugin-notification.registerListener | ✅ | 96ms |  |
| 293 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 878ms |  |
| 294 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1461ms |  |
| 295 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1418ms |  |
| 296 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 113ms |  |
| 297 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 135ms |  |
| 298 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 461ms |  |
| 299 | window.setFullscreen diag (main window) | ✅ | 2147ms |  |
| 300 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3135ms |  |
| 301 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 3939ms |  |
| 302 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2597ms |  |
| 303 | window.setInnerSize actually resizes (main window) | ✅ | 1636ms |  |
| 304 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1505ms |  |
| 305 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 4977ms |  |
| 306 | float window setInnerSize exact readback (decor=0) | ✅ | 682ms |  |
| 307 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 660ms |  |
| 308 | window.maximize fills monitor | ✅ | 1098ms |  |
| 309 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 856ms |  |
| 310 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1702ms |  |
| 311 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 55ms |  |
| 312 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 4ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 313 | window.setIgnoreCursorEvents smoke | ✅ | 78ms |  |
| 314 | window decoration flags smoke (D group, main window no-op) | ✅ | 187ms |  |
| 315 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1942ms |  |
| 316 | window cursor smoke (E group, no getter) | ✅ | 203ms |  |
| 317 | window.setContentProtection (demo cmd) | ✅ | 360ms |  |
| 318 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 633ms |  |
| 319 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 127ms |  |
| 320 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 524ms |  |
| 321 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 210ms |  |
| 322 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 256ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `2c2dab839`, 6 uncommitted tracked file(s), diff-sha256 `bf12c0c968ae5b77`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-22T01:45:04Z*
