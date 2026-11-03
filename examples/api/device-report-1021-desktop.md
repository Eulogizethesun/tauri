# Test Report

*Generated: 2026-10-21T03:13:50.231538126+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 12ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 35ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 23ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 159ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 677ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 192ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 141ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 113ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 37ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 41ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 54ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 59ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 113ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 148ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 176ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 33ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 125ms |  |
| 24 | webview.eval_with_callback | ✅ | 33ms |  |
| 25 | webview.webPageSnapshot | ✅ | 672ms |  |
| 26 | app_handle.emit | ✅ | 175ms |  |
| 27 | app_handle.listen | ✅ | 157ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 242ms |  |
| 29 | on_page_load events | ✅ | 1062ms |  |
| 30 | on_navigation interceptor | ✅ | 1551ms |  |
| 31 | on_document_title_changed | ✅ | 1556ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 48ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 161ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 37ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1572ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1577ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 36ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 93ms |  |
| 39 | create_borderless_window command | ✅ | 557ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 557ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 31ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 32ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 538ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1054ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 569ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 571ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 108ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1577ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2116ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 252ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 684ms |  |
| 52 | webview.clearAllBrowsingData clears document.cookie | ⏭️ | 4ms | document.cookie set/read not observable on this build (before="") — cookie wipe unverifiable from JS |
| 53 | on_download: Requested event fires | ✅ | 118ms |  |
| 54 | on_download: custom directory redirects path | ✅ | 113ms |  |
| 55 | on_download: block dangerous file types | ✅ | 104ms |  |
| 56 | on_download: audit log contains metadata | ✅ | 105ms |  |
| 57 | on_download: Finished event fires on successful download | ✅ | 119ms |  |
| 58 | webview child created with explicit bounds renders at requested size | ✅ | 653ms |  |
| 59 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 621ms |  |
| 60 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 731ms |  |
| 61 | DOM MouseEvent.dispatch (synthetic) | ✅ | 6ms |  |
| 62 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 63 | DOM WheelEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 64 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 65 | @tauri-apps/api/window.cursorPosition | ✅ | 142ms |  |
| 66 | webview.set_cookie round-trip (OHOS) | ✅ | 53ms |  |
| 67 | webview.cookies() returns array (OHOS best-effort) | ✅ | 46ms |  |
| 68 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 52ms |  |
| 69 | webview.cookies_for_url readable (OHOS) | ✅ | 46ms |  |
| 70 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1057ms |  |
| 71 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 152ms |  |
| 72 | PathResolver app_data_dir valid (OHOS) | ✅ | 42ms |  |
| 73 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 29ms |  |
| 74 | Clipboard API available (OHOS always-on) | ✅ | 2ms |  |
| 75 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 318ms |  |
| 76 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 155ms |  |
| 77 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 74ms |  |
| 78 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 79 | @tauri-apps/plugin-log.trace | ✅ | 200ms |  |
| 80 | @tauri-apps/plugin-log.debug | ✅ | 36ms |  |
| 81 | @tauri-apps/plugin-log.info | ✅ | 37ms |  |
| 82 | @tauri-apps/plugin-log.warn | ✅ | 36ms |  |
| 83 | @tauri-apps/plugin-log.error | ✅ | 41ms |  |
| 84 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 70ms |  |
| 85 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 114ms |  |
| 86 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 59ms |  |
| 87 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 45ms |  |
| 88 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 52ms |  |
| 89 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 76ms |  |
| 90 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 957ms |  |
| 91 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 61ms |  |
| 92 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 117ms |  |
| 93 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 41ms |  |
| 94 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 153ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 39ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 58ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 96ms |  |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 187ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 99 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 183ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 56ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 50ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 124ms |  |
| 103 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 49ms |  |
| 104 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 409ms |  |
| 105 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 79ms |  |
| 106 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 118ms |  |
| 107 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 3ms |  |
| 108 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 105ms |  |
| 109 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 64ms |  |
| 110 | @tauri-apps/plugin-notification.removeChannel | ✅ | 346ms |  |
| 111 | @tauri-apps/plugin-notification.pending+active | ✅ | 55ms |  |
| 112 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 113 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 246ms |  |
| 114 | tauri-plugin-sentry.breadcrumb | ✅ | 53ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 84ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 94ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 82ms |  |
| 118 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 234ms |  |
| 119 | tauri-plugin-sentry.envelope | ✅ | 57ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 75ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 74ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 59ms |  |
| 123 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 49ms |  |
| 124 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 77ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 51ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 102ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 152ms |  |
| 128 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 58ms |  |
| 129 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 44ms |  |
| 130 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 62ms |  |
| 131 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 50ms |  |
| 132 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 41ms |  |
| 133 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 161ms |  |
| 134 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 626ms |  |
| 135 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1320ms |  |
| 136 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 76ms |  |
| 137 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 47ms |  |
| 138 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 20ms |  |
| 139 | @tauri-apps/plugin-cli.getMatches | ✅ | 50ms |  |
| 140 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 72ms |  |
| 141 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 41ms |  |
| 142 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 78ms |  |
| 143 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 61ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 144 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 7ms |  |
| 145 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 35ms |  |
| 146 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 90ms |  |
| 147 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 4ms |  |
| 148 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 11ms |  |
| 149 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 167ms |  |
| 150 | @tauri-apps/api/window.innerSize | ✅ | 97ms |  |
| 151 | @tauri-apps/api/window.outerSize | ✅ | 96ms |  |
| 152 | @tauri-apps/api/window.innerPosition | ✅ | 84ms |  |
| 153 | @tauri-apps/api/window.outerPosition | ✅ | 69ms |  |
| 154 | @tauri-apps/api/window.scaleFactor | ✅ | 79ms |  |
| 155 | @tauri-apps/api/image.new | ✅ | 69ms |  |
| 156 | @tauri-apps/api/image.size | ✅ | 83ms |  |
| 157 | @tauri-apps/api/image.rgba | ✅ | 94ms |  |
| 158 | @tauri-apps/api/image.fromBytes | ✅ | 71ms |  |
| 159 | @tauri-apps/api/image.close | ✅ | 85ms |  |
| 160 | @tauri-apps/api/menu.Menu.new | ✅ | 71ms |  |
| 161 | @tauri-apps/api/menu.Menu.with_id | ✅ | 78ms |  |
| 162 | @tauri-apps/api/menu.Menu.with_items | ✅ | 141ms |  |
| 163 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 125ms |  |
| 164 | @tauri-apps/api/menu.Menu.append | ✅ | 104ms |  |
| 165 | @tauri-apps/api/menu.Menu.append_items | ✅ | 134ms |  |
| 166 | @tauri-apps/api/menu.Menu.prepend | ✅ | 140ms |  |
| 167 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 167ms |  |
| 168 | @tauri-apps/api/menu.Menu.insert | ✅ | 163ms |  |
| 169 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 156ms |  |
| 170 | @tauri-apps/api/menu.Menu.remove | ✅ | 130ms |  |
| 171 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 170ms |  |
| 172 | @tauri-apps/api/menu.Menu.get | ✅ | 158ms |  |
| 173 | @tauri-apps/api/menu.Menu.items | ✅ | 159ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.new | ✅ | 79ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 84ms |  |
| 176 | @tauri-apps/api/menu.MenuItem.text | ✅ | 94ms |  |
| 177 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 92ms |  |
| 178 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 85ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 103ms |  |
| 180 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 90ms |  |
| 181 | @tauri-apps/api/menu.Submenu.new | ✅ | 75ms |  |
| 182 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 61ms |  |
| 183 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 111ms |  |
| 184 | @tauri-apps/api/menu.Submenu.append | ✅ | 118ms |  |
| 185 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 109ms |  |
| 186 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 139ms |  |
| 187 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 158ms |  |
| 188 | @tauri-apps/api/menu.Submenu.insert | ✅ | 161ms |  |
| 189 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 146ms |  |
| 190 | @tauri-apps/api/menu.Submenu.remove | ✅ | 125ms |  |
| 191 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 144ms |  |
| 192 | @tauri-apps/api/menu.Submenu.items | ✅ | 130ms |  |
| 193 | @tauri-apps/api/menu.Submenu.get | ✅ | 119ms |  |
| 194 | @tauri-apps/api/menu.Submenu.text | ✅ | 98ms |  |
| 195 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 136ms |  |
| 196 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 91ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 61ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 86ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 83ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 110ms |  |
| 201 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 69ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 82ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 102ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 88ms |  |
| 205 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 123ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 61ms |  |
| 207 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 91ms |  |
| 208 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 91ms |  |
| 209 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 206ms |  |
| 210 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 100ms |  |
| 211 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 66ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 63ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 130ms |  |
| 214 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 60ms |  |
| 215 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 80ms |  |
| 216 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 95ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 100ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 85ms |  |
| 219 | @tauri-apps/api/menu.MenuItem.action | ✅ | 55ms |  |
| 220 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 73ms |  |
| 221 | @tauri-apps/api/menu.Submenu.kind | ✅ | 63ms |  |
| 222 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 63ms |  |
| 223 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 71ms |  |
| 224 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 71ms |  |
| 225 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 81ms |  |
| 226 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 146ms |  |
| 227 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 10ms |  |
| 228 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 259ms |  |
| 229 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 202ms |  |
| 230 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 155ms |  |
| 231 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 114ms |  |
| 232 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 161ms |  |
| 233 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 124ms |  |
| 234 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1208ms |  |
| 235 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1210ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 536ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 536ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 93ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 75ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 556ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 92ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 80ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 92ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 82ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 83ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 92ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 112ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 107ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 98ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 109ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 77ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 156ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 112ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 169ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 586ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1121ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 212ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 76ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 66ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 89ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 554ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 5ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 795ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1660ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1728ms |  |
| 266 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 659ms |  |
| 267 | ohos-adapter.monitor.real-size | ✅ | 108ms |  |
| 268 | ohos-adapter.monitor.refresh-rate | ✅ | 96ms |  |
| 269 | ohos-init.chain.window-menu-tray | ✅ | 238ms |  |
| 270 | @tauri-apps/plugin-os.type | ✅ | 12ms |  |
| 271 | @tauri-apps/plugin-os.family | ✅ | 8ms |  |
| 272 | @tauri-apps/plugin-os.arch | ✅ | 8ms |  |
| 273 | @tauri-apps/plugin-os.eol | ✅ | 18ms |  |
| 274 | @tauri-apps/plugin-os.exeExtension | ✅ | 7ms |  |
| 275 | @tauri-apps/plugin-os.version | ✅ | 5ms |  |
| 276 | @tauri-apps/plugin-os.locale | ✅ | 350ms |  |
| 277 | @tauri-apps/plugin-os.hostname | ✅ | 90ms |  |
| 278 | @tauri-apps/plugin-notification.onAction register | ✅ | 88ms |  |
| 279 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 71ms |  |
| 280 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 74ms |  |
| 281 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 83ms |  |
| 282 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 103ms |  |
| 283 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 223ms |  |
| 284 | plugin-biometric.status | ✅ | 125ms |  |
| 285 | plugin-nfc.is_available | ✅ | 76ms |  |
| 286 | plugin-barcode-scanner.check_permissions | ✅ | 75ms |  |
| 287 | plugin-geolocation.check_permissions | ✅ | 86ms |  |
| 288 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 84ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 289 | plugin-notification.registerListener | ✅ | 106ms |  |
| 290 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 836ms |  |
| 291 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1425ms |  |
| 292 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1416ms |  |
| 293 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 118ms |  |
| 294 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 113ms |  |
| 295 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 353ms |  |
| 296 | window.setFullscreen diag (main window) | ✅ | 2071ms |  |
| 297 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3129ms |  |
| 298 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 3926ms |  |
| 299 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2536ms |  |
| 300 | window.setInnerSize actually resizes (main window) | ✅ | 1518ms |  |
| 301 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1599ms |  |
| 302 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 3896ms |  |
| 303 | float window setInnerSize exact readback (decor=0) | ✅ | 689ms |  |
| 304 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 663ms |  |
| 305 | window.maximize fills monitor | ✅ | 1109ms |  |
| 306 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 862ms |  |
| 307 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1567ms |  |
| 308 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 46ms |  |
| 309 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 4ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 310 | window.setIgnoreCursorEvents smoke | ✅ | 85ms |  |
| 311 | window decoration flags smoke (D group, main window no-op) | ✅ | 190ms |  |
| 312 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1978ms |  |
| 313 | window cursor smoke (E group, no getter) | ✅ | 195ms |  |
| 314 | window.setContentProtection (demo cmd) | ✅ | 358ms |  |
| 315 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 422ms |  |
| 316 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 138ms |  |
| 317 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 509ms |  |
| 318 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 184ms |  |
| 319 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 226ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `eb38df2a5`, 9 uncommitted tracked file(s), diff-sha256 `9b784e9a969a9e16`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-21T03:15:25Z*
