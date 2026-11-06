# Test Report

*Generated: 2026-10-30T03:52:51.062943907+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 38ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 24ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 127ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 686ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 156ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 142ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 39ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 32ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 34ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 55ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 55ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 114ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 156ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 175ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 33ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 125ms |  |
| 24 | webview.eval_with_callback | ✅ | 34ms |  |
| 25 | webview.webPageSnapshot | ✅ | 685ms |  |
| 26 | app_handle.emit | ✅ | 166ms |  |
| 27 | app_handle.listen | ✅ | 166ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 239ms |  |
| 29 | on_page_load events | ✅ | 1061ms |  |
| 30 | on_navigation interceptor | ✅ | 1552ms |  |
| 31 | on_document_title_changed | ✅ | 1546ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 46ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 154ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 39ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1569ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1603ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 64ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 114ms |  |
| 39 | create_borderless_window command | ✅ | 571ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 554ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 29ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 23ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 531ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1153ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 601ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 577ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 79ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1563ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2210ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 257ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 749ms |  |
| 52 | webview.clearAllBrowsingData clears document.cookie | ⏭️ | 3ms | document.cookie set/read not observable on this build (before="") — cookie wipe unverifiable from JS |
| 53 | on_download: Requested event fires | ✅ | 118ms |  |
| 54 | on_download: custom directory redirects path | ✅ | 105ms |  |
| 55 | on_download: block dangerous file types | ✅ | 101ms |  |
| 56 | on_download: audit log contains metadata | ✅ | 101ms |  |
| 57 | on_download: Finished event fires on successful download | ✅ | 174ms |  |
| 58 | webview child created with explicit bounds renders at requested size | ✅ | 666ms |  |
| 59 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 957ms |  |
| 60 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 608ms |  |
| 61 | DOM MouseEvent.dispatch (synthetic) | ✅ | 4ms |  |
| 62 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 63 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 64 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 1ms |  |
| 65 | @tauri-apps/api/window.cursorPosition | ✅ | 121ms |  |
| 66 | webview.set_cookie round-trip (OHOS) | ✅ | 116ms |  |
| 67 | webview.cookies() returns array (OHOS best-effort) | ✅ | 45ms |  |
| 68 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 63ms |  |
| 69 | webview.cookies_for_url readable (OHOS) | ✅ | 53ms |  |
| 70 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1049ms |  |
| 71 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 425ms |  |
| 72 | PathResolver app_data_dir valid (OHOS) | ✅ | 33ms |  |
| 73 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 33ms |  |
| 74 | Clipboard API available (OHOS always-on) | ✅ | 4ms |  |
| 75 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 388ms |  |
| 76 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 134ms |  |
| 77 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 57ms |  |
| 78 | webview.url() main-thread sync read after SPA navigation (#192) | ✅ | 3195ms |  |
| 79 | webview.incognito create + cookie isolation (#188) | ✅ | 2821ms |  |
| 80 | window.set_title tracked ack: real window resolves, illegal label rejects (#219) | ✅ | 908ms |  |
| 81 | window tracked reject reaches invoke Err via ArkTS op (#219 M3) | ✅ | 39ms |  |
| 82 | https-intercept response headers reach the page (#186 M1) | ✅ | 277ms |  |
| 83 | @tauri-apps/plugin-os.platform | ✅ | 2ms |  |
| 84 | @tauri-apps/plugin-log.trace | ✅ | 77ms |  |
| 85 | @tauri-apps/plugin-log.debug | ✅ | 38ms |  |
| 86 | @tauri-apps/plugin-log.info | ✅ | 53ms |  |
| 87 | @tauri-apps/plugin-log.warn | ✅ | 48ms |  |
| 88 | @tauri-apps/plugin-log.error | ✅ | 42ms |  |
| 89 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 60ms |  |
| 90 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 81ms |  |
| 91 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 75ms |  |
| 92 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 52ms |  |
| 93 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 62ms |  |
| 94 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 87ms |  |
| 95 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 1603ms |  |
| 96 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 63ms |  |
| 97 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 165ms |  |
| 98 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 55ms |  |
| 99 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 171ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 47ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 55ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 53ms |  |
| 103 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 164ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 104 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 188ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 105 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 65ms |  |
| 106 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 43ms |  |
| 107 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 122ms |  |
| 108 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 46ms |  |
| 109 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 165ms |  |
| 110 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 127ms |  |
| 111 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 74ms |  |
| 112 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 2ms |  |
| 113 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 108ms |  |
| 114 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 56ms |  |
| 115 | @tauri-apps/plugin-notification.removeChannel | ✅ | 141ms |  |
| 116 | @tauri-apps/plugin-notification.pending+active | ✅ | 73ms |  |
| 117 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 3ms | notification permission disabled — enable notifications for this app to run this test |
| 118 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 254ms |  |
| 119 | tauri-plugin-sentry.breadcrumb | ✅ | 40ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 59ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 83ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 54ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 147ms |  |
| 124 | tauri-plugin-sentry.envelope | ✅ | 40ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 69ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 65ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 79ms |  |
| 128 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 54ms |  |
| 129 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 49ms |  |
| 130 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 46ms |  |
| 131 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 136ms |  |
| 132 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 186ms |  |
| 133 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 67ms |  |
| 134 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 36ms |  |
| 135 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 53ms |  |
| 136 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 51ms |  |
| 137 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 45ms |  |
| 138 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 150ms |  |
| 139 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 155ms |  |
| 140 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1299ms |  |
| 141 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 109ms |  |
| 142 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 62ms |  |
| 143 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 19ms |  |
| 144 | @tauri-apps/plugin-cli.getMatches | ✅ | 57ms |  |
| 145 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 83ms |  |
| 146 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 68ms |  |
| 147 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 117ms |  |
| 148 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 109ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 149 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 150 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 2ms |  |
| 151 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 4ms |  |
| 152 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 2ms |  |
| 153 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 154 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 2ms |  |
| 155 | @tauri-apps/api/window.innerSize | ✅ | 184ms |  |
| 156 | @tauri-apps/api/window.outerSize | ✅ | 53ms |  |
| 157 | @tauri-apps/api/window.innerPosition | ✅ | 61ms |  |
| 158 | @tauri-apps/api/window.outerPosition | ✅ | 51ms |  |
| 159 | @tauri-apps/api/window.scaleFactor | ✅ | 59ms |  |
| 160 | @tauri-apps/api/image.new | ✅ | 52ms |  |
| 161 | @tauri-apps/api/image.size | ✅ | 73ms |  |
| 162 | @tauri-apps/api/image.rgba | ✅ | 79ms |  |
| 163 | @tauri-apps/api/image.fromBytes | ✅ | 59ms |  |
| 164 | @tauri-apps/api/image.close | ✅ | 92ms |  |
| 165 | @tauri-apps/api/menu.Menu.new | ✅ | 52ms |  |
| 166 | @tauri-apps/api/menu.Menu.with_id | ✅ | 49ms |  |
| 167 | @tauri-apps/api/menu.Menu.with_items | ✅ | 101ms |  |
| 168 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 104ms |  |
| 169 | @tauri-apps/api/menu.Menu.append | ✅ | 101ms |  |
| 170 | @tauri-apps/api/menu.Menu.append_items | ✅ | 107ms |  |
| 171 | @tauri-apps/api/menu.Menu.prepend | ✅ | 155ms |  |
| 172 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 160ms |  |
| 173 | @tauri-apps/api/menu.Menu.insert | ✅ | 186ms |  |
| 174 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 145ms |  |
| 175 | @tauri-apps/api/menu.Menu.remove | ✅ | 148ms |  |
| 176 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 232ms |  |
| 177 | @tauri-apps/api/menu.Menu.get | ✅ | 144ms |  |
| 178 | @tauri-apps/api/menu.Menu.items | ✅ | 145ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.new | ✅ | 124ms |  |
| 180 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 81ms |  |
| 181 | @tauri-apps/api/menu.MenuItem.text | ✅ | 127ms |  |
| 182 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 108ms |  |
| 183 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 114ms |  |
| 184 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 129ms |  |
| 185 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 124ms |  |
| 186 | @tauri-apps/api/menu.Submenu.new | ✅ | 139ms |  |
| 187 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 97ms |  |
| 188 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 160ms |  |
| 189 | @tauri-apps/api/menu.Submenu.append | ✅ | 121ms |  |
| 190 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 169ms |  |
| 191 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 149ms |  |
| 192 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 295ms |  |
| 193 | @tauri-apps/api/menu.Submenu.insert | ✅ | 160ms |  |
| 194 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 127ms |  |
| 195 | @tauri-apps/api/menu.Submenu.remove | ✅ | 88ms |  |
| 196 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 126ms |  |
| 197 | @tauri-apps/api/menu.Submenu.items | ✅ | 126ms |  |
| 198 | @tauri-apps/api/menu.Submenu.get | ✅ | 118ms |  |
| 199 | @tauri-apps/api/menu.Submenu.text | ✅ | 96ms |  |
| 200 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 111ms |  |
| 201 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 72ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 93ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 81ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 75ms |  |
| 205 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 89ms |  |
| 206 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 86ms |  |
| 207 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 69ms |  |
| 208 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 94ms |  |
| 209 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 55ms |  |
| 210 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 120ms |  |
| 211 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 52ms |  |
| 212 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 61ms |  |
| 213 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 90ms |  |
| 214 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 94ms |  |
| 215 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 114ms |  |
| 216 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 56ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 58ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 120ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 54ms |  |
| 220 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 80ms |  |
| 221 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 98ms |  |
| 222 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 86ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 69ms |  |
| 224 | @tauri-apps/api/menu.MenuItem.action | ✅ | 56ms |  |
| 225 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 58ms |  |
| 226 | @tauri-apps/api/menu.Submenu.kind | ✅ | 43ms |  |
| 227 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 52ms |  |
| 228 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 70ms |  |
| 229 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 62ms |  |
| 230 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 60ms |  |
| 231 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 137ms |  |
| 232 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 22ms |  |
| 233 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 201ms |  |
| 234 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 116ms |  |
| 235 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 144ms |  |
| 236 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 141ms |  |
| 237 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 178ms |  |
| 238 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 116ms |  |
| 239 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1180ms |  |
| 240 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1184ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 530ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 573ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 50ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 50ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 579ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 63ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 53ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 77ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 161ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 68ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 65ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 94ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 92ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 83ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 108ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 64ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 140ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 87ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 129ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 602ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1149ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 184ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 53ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 41ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 69ms |  |
| 266 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 573ms |  |
| 267 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 2ms |  |
| 268 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 1191ms |  |
| 269 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1615ms |  |
| 270 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1663ms |  |
| 271 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 662ms |  |
| 272 | ohos-adapter.monitor.real-size | ✅ | 117ms |  |
| 273 | ohos-adapter.monitor.refresh-rate | ✅ | 82ms |  |
| 274 | ohos-init.chain.window-menu-tray | ✅ | 204ms |  |
| 275 | @tauri-apps/plugin-os.type | ✅ | 2ms |  |
| 276 | @tauri-apps/plugin-os.family | ✅ | 2ms |  |
| 277 | @tauri-apps/plugin-os.arch | ✅ | 2ms |  |
| 278 | @tauri-apps/plugin-os.eol | ✅ | 2ms |  |
| 279 | @tauri-apps/plugin-os.exeExtension | ✅ | 2ms |  |
| 280 | @tauri-apps/plugin-os.version | ✅ | 2ms |  |
| 281 | @tauri-apps/plugin-os.locale | ✅ | 256ms |  |
| 282 | @tauri-apps/plugin-os.hostname | ✅ | 69ms |  |
| 283 | @tauri-apps/plugin-notification.onAction register | ✅ | 72ms |  |
| 284 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 60ms |  |
| 285 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 54ms |  |
| 286 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 48ms |  |
| 287 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 61ms |  |
| 288 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 174ms |  |
| 289 | plugin-biometric.status | ✅ | 97ms |  |
| 290 | plugin-nfc.is_available | ✅ | 55ms |  |
| 291 | plugin-barcode-scanner.check_permissions | ✅ | 61ms |  |
| 292 | plugin-geolocation.check_permissions | ✅ | 54ms |  |
| 293 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 63ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 294 | plugin-notification.registerListener | ✅ | 77ms |  |
| 295 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 737ms |  |
| 296 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1309ms |  |
| 297 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1295ms |  |
| 298 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 75ms |  |
| 299 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 79ms |  |
| 300 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 272ms |  |
| 301 | window.setFullscreen diag (main window) | ✅ | 2124ms |  |
| 302 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3091ms |  |
| 303 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 4010ms |  |
| 304 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2565ms |  |
| 305 | window.setInnerSize actually resizes (main window) | ✅ | 1486ms |  |
| 306 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1480ms |  |
| 307 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 3844ms |  |
| 308 | float window setInnerSize exact readback (decor=0) | ✅ | 897ms |  |
| 309 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 648ms |  |
| 310 | window.maximize fills monitor | ✅ | 1106ms |  |
| 311 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 858ms |  |
| 312 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1409ms |  |
| 313 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 54ms |  |
| 314 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 3ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 315 | window.setIgnoreCursorEvents smoke | ✅ | 71ms |  |
| 316 | window decoration flags smoke (D group, main window contract #238) | ✅ | 146ms |  |
| 317 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1982ms |  |
| 318 | ut_window.hide rejects on OHOS (main window, #237) | ✅ | 63ms |  |
| 319 | ut_window.show keeps maximized state (#237, main window) | ✅ | 3236ms |  |
| 320 | ut_window main window decoration buttons (#238) | ✅ | 74ms |  |
| 321 | window cursor smoke (E group, no getter) | ✅ | 139ms |  |
| 322 | window.setContentProtection (demo cmd) | ✅ | 342ms |  |
| 323 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 680ms |  |
| 324 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 132ms |  |
| 325 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 499ms |  |
| 326 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 213ms |  |
| 327 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 276ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `947310a3a`, 6 uncommitted tracked file(s), diff-sha256 `3d48412bc4040d66`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-30T03:54:37Z*
