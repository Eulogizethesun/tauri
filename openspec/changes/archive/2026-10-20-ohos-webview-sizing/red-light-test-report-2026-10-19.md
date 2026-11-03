# Test Report

*Generated: 2026-10-19T15:59:49.435488125+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 12ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 34ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 22ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 165ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 651ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 154ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 141ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 39ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 30ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 35ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 46ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 57ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 118ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 150ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 171ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 34ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 128ms |  |
| 24 | webview.eval_with_callback | ✅ | 32ms |  |
| 25 | webview.webPageSnapshot | ✅ | 672ms |  |
| 26 | app_handle.emit | ✅ | 183ms |  |
| 27 | app_handle.listen | ✅ | 155ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 242ms |  |
| 29 | on_page_load events | ✅ | 1047ms |  |
| 30 | on_navigation interceptor | ✅ | 1563ms |  |
| 31 | on_document_title_changed | ✅ | 1552ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 65ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 162ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 47ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1587ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1604ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 62ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 131ms |  |
| 39 | create_borderless_window command | ✅ | 553ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 553ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 29ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 27ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 545ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1061ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 589ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 576ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 112ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1569ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2189ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 213ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 673ms |  |
| 52 | on_download: Requested event fires | ✅ | 107ms |  |
| 53 | on_download: custom directory redirects path | ✅ | 104ms |  |
| 54 | on_download: block dangerous file types | ✅ | 105ms |  |
| 55 | on_download: audit log contains metadata | ✅ | 106ms |  |
| 56 | on_download: Finished event fires on successful download | ✅ | 123ms |  |
| 57 | webview child created with explicit bounds renders at requested size | ❌ | 7253ms | child A (bounds 50,50,300×200) rendered geometry: probe "test-sizing-child-a-1792425609857" never reported 300×200 within 7000ms — last sample: 1101×657 (doc 1101×657) |
| 58 | webview child setSize/setPosition change rendered geometry (last call wins) | ❌ | 7575ms | setSize(400,300) rendered geometry: probe "test-sizing-resize-1792425617112" never reported 400×300 within 7000ms — last sample: 1101×657 (doc 1101×657) |
| 59 | sub-window natural webview follows container then flips explicit via set_bounds | ❌ | 7769ms | set_bounds(320,240) overriding natural layout: probe "test-sizing-sub_6" never reported 320×240 within 7000ms — last sample: 601×451 (doc 601×451) |
| 60 | DOM MouseEvent.dispatch (synthetic) | ✅ | 4ms |  |
| 61 | DOM MouseEvent.coordinates | ✅ | 1ms |  |
| 62 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 63 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 1ms |  |
| 64 | @tauri-apps/api/window.cursorPosition | ✅ | 126ms |  |
| 65 | webview.set_cookie round-trip (OHOS) | ✅ | 41ms |  |
| 66 | webview.cookies() returns array (OHOS best-effort) | ✅ | 48ms |  |
| 67 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 50ms |  |
| 68 | webview.cookies_for_url readable (OHOS) | ✅ | 61ms |  |
| 69 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1062ms |  |
| 70 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 118ms |  |
| 71 | PathResolver app_data_dir valid (OHOS) | ✅ | 41ms |  |
| 72 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 51ms |  |
| 73 | Clipboard API available (OHOS always-on) | ✅ | 2ms |  |
| 74 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 368ms |  |
| 75 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 166ms |  |
| 76 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 65ms |  |
| 77 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 78 | @tauri-apps/plugin-log.trace | ✅ | 310ms |  |
| 79 | @tauri-apps/plugin-log.debug | ✅ | 43ms |  |
| 80 | @tauri-apps/plugin-log.info | ✅ | 40ms |  |
| 81 | @tauri-apps/plugin-log.warn | ✅ | 57ms |  |
| 82 | @tauri-apps/plugin-log.error | ✅ | 66ms |  |
| 83 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 43ms |  |
| 84 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 62ms |  |
| 85 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 66ms |  |
| 86 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 49ms |  |
| 87 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 50ms |  |
| 88 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 79ms |  |
| 89 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 926ms |  |
| 90 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 65ms |  |
| 91 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 125ms |  |
| 92 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 42ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 156ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 40ms |  |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 57ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 61ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 190ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 183ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 99 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 56ms |  |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 46ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 110ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 47ms |  |
| 103 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 224ms |  |
| 104 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 79ms |  |
| 105 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 84ms |  |
| 106 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 4ms |  |
| 107 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 100ms |  |
| 108 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 71ms |  |
| 109 | @tauri-apps/plugin-notification.removeChannel | ✅ | 162ms |  |
| 110 | @tauri-apps/plugin-notification.pending+active | ✅ | 57ms |  |
| 111 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 4ms | notification permission disabled — enable notifications for this app to run this test |
| 112 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 269ms |  |
| 113 | tauri-plugin-sentry.breadcrumb | ✅ | 35ms |  |
| 114 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 74ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 94ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 71ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 195ms |  |
| 118 | tauri-plugin-sentry.envelope | ✅ | 65ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 92ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 113ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 88ms |  |
| 122 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 51ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 52ms |  |
| 124 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 38ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 116ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 156ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 58ms |  |
| 128 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 46ms |  |
| 129 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 77ms |  |
| 130 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 54ms |  |
| 131 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 61ms |  |
| 132 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 209ms |  |
| 133 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 507ms |  |
| 134 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1317ms |  |
| 135 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 78ms |  |
| 136 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 51ms |  |
| 137 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 58ms |  |
| 138 | @tauri-apps/plugin-cli.getMatches | ✅ | 37ms |  |
| 139 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 69ms |  |
| 140 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 55ms |  |
| 141 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 106ms |  |
| 142 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 59ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 143 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 144 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 1ms |  |
| 145 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 1ms |  |
| 146 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 1ms |  |
| 147 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 1ms |  |
| 148 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 2ms |  |
| 149 | @tauri-apps/api/window.innerSize | ✅ | 180ms |  |
| 150 | @tauri-apps/api/window.outerSize | ✅ | 65ms |  |
| 151 | @tauri-apps/api/window.innerPosition | ✅ | 56ms |  |
| 152 | @tauri-apps/api/window.outerPosition | ✅ | 46ms |  |
| 153 | @tauri-apps/api/window.scaleFactor | ✅ | 61ms |  |
| 154 | @tauri-apps/api/image.new | ✅ | 75ms |  |
| 155 | @tauri-apps/api/image.size | ✅ | 77ms |  |
| 156 | @tauri-apps/api/image.rgba | ✅ | 92ms |  |
| 157 | @tauri-apps/api/image.fromBytes | ✅ | 121ms |  |
| 158 | @tauri-apps/api/image.close | ✅ | 100ms |  |
| 159 | @tauri-apps/api/menu.Menu.new | ✅ | 55ms |  |
| 160 | @tauri-apps/api/menu.Menu.with_id | ✅ | 88ms |  |
| 161 | @tauri-apps/api/menu.Menu.with_items | ✅ | 98ms |  |
| 162 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 108ms |  |
| 163 | @tauri-apps/api/menu.Menu.append | ✅ | 132ms |  |
| 164 | @tauri-apps/api/menu.Menu.append_items | ✅ | 146ms |  |
| 165 | @tauri-apps/api/menu.Menu.prepend | ✅ | 134ms |  |
| 166 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 214ms |  |
| 167 | @tauri-apps/api/menu.Menu.insert | ✅ | 193ms |  |
| 168 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 161ms |  |
| 169 | @tauri-apps/api/menu.Menu.remove | ✅ | 154ms |  |
| 170 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 191ms |  |
| 171 | @tauri-apps/api/menu.Menu.get | ✅ | 122ms |  |
| 172 | @tauri-apps/api/menu.Menu.items | ✅ | 163ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.new | ✅ | 100ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 80ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.text | ✅ | 80ms |  |
| 176 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 77ms |  |
| 177 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 98ms |  |
| 178 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 175ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 67ms |  |
| 180 | @tauri-apps/api/menu.Submenu.new | ✅ | 51ms |  |
| 181 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 83ms |  |
| 182 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 134ms |  |
| 183 | @tauri-apps/api/menu.Submenu.append | ✅ | 157ms |  |
| 184 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 111ms |  |
| 185 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 148ms |  |
| 186 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 253ms |  |
| 187 | @tauri-apps/api/menu.Submenu.insert | ✅ | 149ms |  |
| 188 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 200ms |  |
| 189 | @tauri-apps/api/menu.Submenu.remove | ✅ | 188ms |  |
| 190 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 175ms |  |
| 191 | @tauri-apps/api/menu.Submenu.items | ✅ | 146ms |  |
| 192 | @tauri-apps/api/menu.Submenu.get | ✅ | 140ms |  |
| 193 | @tauri-apps/api/menu.Submenu.text | ✅ | 97ms |  |
| 194 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 150ms |  |
| 195 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 93ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 87ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 113ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 82ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 73ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 67ms |  |
| 201 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 86ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 103ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 71ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 113ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 56ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 75ms |  |
| 207 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 77ms |  |
| 208 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 126ms |  |
| 209 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 135ms |  |
| 210 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 81ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 48ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 172ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 49ms |  |
| 214 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 65ms |  |
| 215 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 107ms |  |
| 216 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 106ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 79ms |  |
| 218 | @tauri-apps/api/menu.MenuItem.action | ✅ | 98ms |  |
| 219 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 44ms |  |
| 220 | @tauri-apps/api/menu.Submenu.kind | ✅ | 59ms |  |
| 221 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 50ms |  |
| 222 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 67ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 52ms |  |
| 224 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 81ms |  |
| 225 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 177ms |  |
| 226 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 9ms |  |
| 227 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 315ms |  |
| 228 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 163ms |  |
| 229 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 104ms |  |
| 230 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 105ms |  |
| 231 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 307ms |  |
| 232 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 124ms |  |
| 233 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1186ms |  |
| 234 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1241ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 552ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 561ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 114ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 82ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 590ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 79ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 48ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 125ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 74ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 116ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 55ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 111ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 91ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 76ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 137ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 77ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 253ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 156ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 137ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 642ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1228ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 222ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 52ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 57ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 96ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 568ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 9ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 924ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1639ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1781ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 757ms |  |
| 266 | ohos-adapter.monitor.real-size | ✅ | 92ms |  |
| 267 | ohos-adapter.monitor.refresh-rate | ✅ | 98ms |  |
| 268 | ohos-init.chain.window-menu-tray | ✅ | 326ms |  |
| 269 | @tauri-apps/plugin-os.type | ✅ | 7ms |  |
| 270 | @tauri-apps/plugin-os.family | ✅ | 9ms |  |
| 271 | @tauri-apps/plugin-os.arch | ✅ | 8ms |  |
| 272 | @tauri-apps/plugin-os.eol | ✅ | 3ms |  |
| 273 | @tauri-apps/plugin-os.exeExtension | ✅ | 3ms |  |
| 274 | @tauri-apps/plugin-os.version | ✅ | 5ms |  |
| 275 | @tauri-apps/plugin-os.locale | ✅ | 264ms |  |
| 276 | @tauri-apps/plugin-os.hostname | ✅ | 77ms |  |
| 277 | @tauri-apps/plugin-notification.onAction register | ✅ | 105ms |  |
| 278 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 70ms |  |
| 279 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 95ms |  |
| 280 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 72ms |  |
| 281 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 48ms |  |
| 282 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 173ms |  |
| 283 | plugin-biometric.status | ✅ | 67ms |  |
| 284 | plugin-nfc.is_available | ✅ | 43ms |  |
| 285 | plugin-barcode-scanner.check_permissions | ✅ | 59ms |  |
| 286 | plugin-geolocation.check_permissions | ✅ | 84ms |  |
| 287 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 51ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 288 | plugin-notification.registerListener | ✅ | 78ms |  |
| 289 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 1012ms |  |
| 290 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1634ms |  |
| 291 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1595ms |  |
| 292 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 177ms |  |
| 293 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 83ms |  |
| 294 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 613ms |  |
| 295 | window.setFullscreen diag (main window) | ✅ | 2105ms |  |
| 296 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 4018ms |  |
| 297 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 5037ms |  |
| 298 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 3945ms |  |
| 299 | window.setInnerSize actually resizes (main window) | ✅ | 3006ms |  |
| 300 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1971ms |  |
| 301 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 5020ms |  |
| 302 | float window setInnerSize exact readback (decor=0) | ✅ | 1003ms |  |
| 303 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 1956ms |  |
| 304 | window.maximize fills monitor | ✅ | 1998ms |  |
| 305 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 947ms |  |
| 306 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1436ms |  |
| 307 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 63ms |  |
| 308 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 4ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 309 | window.setIgnoreCursorEvents smoke | ✅ | 88ms |  |
| 310 | window decoration flags smoke (D group, main window no-op) | ✅ | 180ms |  |
| 311 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1979ms |  |
| 312 | window cursor smoke (E group, no getter) | ✅ | 199ms |  |
| 313 | window.setContentProtection (demo cmd) | ✅ | 382ms |  |
| 314 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 633ms |  |
| 315 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 149ms |  |
| 316 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 517ms |  |
| 317 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 195ms |  |
| 318 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 343ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `0765b105f`, 13 uncommitted tracked file(s), diff-sha256 `9f500ed5b2ad4a1b`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-19T16:01:56Z*
