# Test Report

*Generated: 2026-10-19T17:20:47.658379531+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 35ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 22ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 165ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 1004ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 171ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 152ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 48ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 36ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 37ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 55ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 57ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 111ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 146ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 173ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 31ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 125ms |  |
| 24 | webview.eval_with_callback | ✅ | 32ms |  |
| 25 | webview.webPageSnapshot | ✅ | 670ms |  |
| 26 | app_handle.emit | ✅ | 169ms |  |
| 27 | app_handle.listen | ✅ | 155ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 246ms |  |
| 29 | on_page_load events | ✅ | 1063ms |  |
| 30 | on_navigation interceptor | ✅ | 1564ms |  |
| 31 | on_document_title_changed | ✅ | 1549ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 56ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 160ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 37ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1572ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1611ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 53ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 106ms |  |
| 39 | create_borderless_window command | ✅ | 550ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 554ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 25ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 22ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 532ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1059ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 575ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 584ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 96ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1570ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2212ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 214ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 1148ms |  |
| 52 | on_download: Requested event fires | ✅ | 98ms |  |
| 53 | on_download: custom directory redirects path | ✅ | 102ms |  |
| 54 | on_download: block dangerous file types | ✅ | 104ms |  |
| 55 | on_download: audit log contains metadata | ✅ | 113ms |  |
| 56 | on_download: Finished event fires on successful download | ✅ | 225ms |  |
| 57 | webview child created with explicit bounds renders at requested size | ✅ | 657ms |  |
| 58 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 631ms |  |
| 59 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 734ms |  |
| 60 | DOM MouseEvent.dispatch (synthetic) | ✅ | 7ms |  |
| 61 | DOM MouseEvent.coordinates | ✅ | 3ms |  |
| 62 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 63 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 64 | @tauri-apps/api/window.cursorPosition | ✅ | 135ms |  |
| 65 | webview.set_cookie round-trip (OHOS) | ✅ | 41ms |  |
| 66 | webview.cookies() returns array (OHOS best-effort) | ✅ | 55ms |  |
| 67 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 74ms |  |
| 68 | webview.cookies_for_url readable (OHOS) | ✅ | 60ms |  |
| 69 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1057ms |  |
| 70 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 144ms |  |
| 71 | PathResolver app_data_dir valid (OHOS) | ✅ | 41ms |  |
| 72 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 60ms |  |
| 73 | Clipboard API available (OHOS always-on) | ✅ | 2ms |  |
| 74 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 331ms |  |
| 75 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 170ms |  |
| 76 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 237ms |  |
| 77 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 78 | @tauri-apps/plugin-log.trace | ✅ | 197ms |  |
| 79 | @tauri-apps/plugin-log.debug | ✅ | 39ms |  |
| 80 | @tauri-apps/plugin-log.info | ✅ | 36ms |  |
| 81 | @tauri-apps/plugin-log.warn | ✅ | 54ms |  |
| 82 | @tauri-apps/plugin-log.error | ✅ | 60ms |  |
| 83 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 47ms |  |
| 84 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 63ms |  |
| 85 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 61ms |  |
| 86 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 45ms |  |
| 87 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 48ms |  |
| 88 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 77ms |  |
| 89 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 789ms |  |
| 90 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 85ms |  |
| 91 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 181ms |  |
| 92 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 31ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 169ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 48ms |  |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 55ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 80ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 206ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 207ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 99 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 64ms |  |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 57ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 120ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 62ms |  |
| 103 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 326ms |  |
| 104 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 97ms |  |
| 105 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 133ms |  |
| 106 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 5ms |  |
| 107 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 96ms |  |
| 108 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 62ms |  |
| 109 | @tauri-apps/plugin-notification.removeChannel | ✅ | 116ms |  |
| 110 | @tauri-apps/plugin-notification.pending+active | ✅ | 62ms |  |
| 111 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 5ms | notification permission disabled — enable notifications for this app to run this test |
| 112 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 275ms |  |
| 113 | tauri-plugin-sentry.breadcrumb | ✅ | 40ms |  |
| 114 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 65ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 83ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 61ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 221ms |  |
| 118 | tauri-plugin-sentry.envelope | ✅ | 46ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 77ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 61ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 61ms |  |
| 122 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 34ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 78ms |  |
| 124 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 33ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 84ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 147ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 59ms |  |
| 128 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 50ms |  |
| 129 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 111ms |  |
| 130 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 58ms |  |
| 131 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 42ms |  |
| 132 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 203ms |  |
| 133 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 115ms |  |
| 134 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1345ms |  |
| 135 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 88ms |  |
| 136 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 50ms |  |
| 137 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 11ms |  |
| 138 | @tauri-apps/plugin-cli.getMatches | ✅ | 39ms |  |
| 139 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 61ms |  |
| 140 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 50ms |  |
| 141 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 76ms |  |
| 142 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 52ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 143 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 144 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 1ms |  |
| 145 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 2ms |  |
| 146 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 2ms |  |
| 147 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 148 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 2ms |  |
| 149 | @tauri-apps/api/window.innerSize | ✅ | 108ms |  |
| 150 | @tauri-apps/api/window.outerSize | ✅ | 43ms |  |
| 151 | @tauri-apps/api/window.innerPosition | ✅ | 41ms |  |
| 152 | @tauri-apps/api/window.outerPosition | ✅ | 38ms |  |
| 153 | @tauri-apps/api/window.scaleFactor | ✅ | 35ms |  |
| 154 | @tauri-apps/api/image.new | ✅ | 33ms |  |
| 155 | @tauri-apps/api/image.size | ✅ | 46ms |  |
| 156 | @tauri-apps/api/image.rgba | ✅ | 61ms |  |
| 157 | @tauri-apps/api/image.fromBytes | ✅ | 49ms |  |
| 158 | @tauri-apps/api/image.close | ✅ | 82ms |  |
| 159 | @tauri-apps/api/menu.Menu.new | ✅ | 52ms |  |
| 160 | @tauri-apps/api/menu.Menu.with_id | ✅ | 49ms |  |
| 161 | @tauri-apps/api/menu.Menu.with_items | ✅ | 90ms |  |
| 162 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 109ms |  |
| 163 | @tauri-apps/api/menu.Menu.append | ✅ | 83ms |  |
| 164 | @tauri-apps/api/menu.Menu.append_items | ✅ | 133ms |  |
| 165 | @tauri-apps/api/menu.Menu.prepend | ✅ | 314ms |  |
| 166 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 147ms |  |
| 167 | @tauri-apps/api/menu.Menu.insert | ✅ | 221ms |  |
| 168 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 210ms |  |
| 169 | @tauri-apps/api/menu.Menu.remove | ✅ | 144ms |  |
| 170 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 189ms |  |
| 171 | @tauri-apps/api/menu.Menu.get | ✅ | 114ms |  |
| 172 | @tauri-apps/api/menu.Menu.items | ✅ | 142ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.new | ✅ | 82ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 84ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.text | ✅ | 94ms |  |
| 176 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 76ms |  |
| 177 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 94ms |  |
| 178 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 95ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 89ms |  |
| 180 | @tauri-apps/api/menu.Submenu.new | ✅ | 51ms |  |
| 181 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 41ms |  |
| 182 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 116ms |  |
| 183 | @tauri-apps/api/menu.Submenu.append | ✅ | 176ms |  |
| 184 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 185ms |  |
| 185 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 134ms |  |
| 186 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 907ms |  |
| 187 | @tauri-apps/api/menu.Submenu.insert | ✅ | 194ms |  |
| 188 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 165ms |  |
| 189 | @tauri-apps/api/menu.Submenu.remove | ✅ | 122ms |  |
| 190 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 154ms |  |
| 191 | @tauri-apps/api/menu.Submenu.items | ✅ | 200ms |  |
| 192 | @tauri-apps/api/menu.Submenu.get | ✅ | 127ms |  |
| 193 | @tauri-apps/api/menu.Submenu.text | ✅ | 74ms |  |
| 194 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 103ms |  |
| 195 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 119ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 69ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 123ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 96ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 65ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 59ms |  |
| 201 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 66ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 49ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 55ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 94ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 40ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 50ms |  |
| 207 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 83ms |  |
| 208 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 114ms |  |
| 209 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 106ms |  |
| 210 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 87ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 54ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 170ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 56ms |  |
| 214 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 86ms |  |
| 215 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 143ms |  |
| 216 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 102ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 79ms |  |
| 218 | @tauri-apps/api/menu.MenuItem.action | ✅ | 58ms |  |
| 219 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 59ms |  |
| 220 | @tauri-apps/api/menu.Submenu.kind | ✅ | 66ms |  |
| 221 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 72ms |  |
| 222 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 46ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 50ms |  |
| 224 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 72ms |  |
| 225 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 151ms |  |
| 226 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 10ms |  |
| 227 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 300ms |  |
| 228 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 162ms |  |
| 229 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 170ms |  |
| 230 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 118ms |  |
| 231 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 142ms |  |
| 232 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 116ms |  |
| 233 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1179ms |  |
| 234 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1206ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 524ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 566ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 552ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 78ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 571ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 113ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 56ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 110ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 70ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 121ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 75ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 110ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 106ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 82ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 120ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 84ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 157ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 126ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 206ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 613ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1158ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 227ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 51ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 52ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 64ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 569ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 6ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 804ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1660ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1719ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 691ms |  |
| 266 | ohos-adapter.monitor.real-size | ✅ | 106ms |  |
| 267 | ohos-adapter.monitor.refresh-rate | ✅ | 140ms |  |
| 268 | ohos-init.chain.window-menu-tray | ✅ | 217ms |  |
| 269 | @tauri-apps/plugin-os.type | ✅ | 7ms |  |
| 270 | @tauri-apps/plugin-os.family | ✅ | 12ms |  |
| 271 | @tauri-apps/plugin-os.arch | ✅ | 10ms |  |
| 272 | @tauri-apps/plugin-os.eol | ✅ | 5ms |  |
| 273 | @tauri-apps/plugin-os.exeExtension | ✅ | 9ms |  |
| 274 | @tauri-apps/plugin-os.version | ✅ | 4ms |  |
| 275 | @tauri-apps/plugin-os.locale | ✅ | 361ms |  |
| 276 | @tauri-apps/plugin-os.hostname | ✅ | 96ms |  |
| 277 | @tauri-apps/plugin-notification.onAction register | ✅ | 109ms |  |
| 278 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 85ms |  |
| 279 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 73ms |  |
| 280 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 89ms |  |
| 281 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 77ms |  |
| 282 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 209ms |  |
| 283 | plugin-biometric.status | ✅ | 88ms |  |
| 284 | plugin-nfc.is_available | ✅ | 63ms |  |
| 285 | plugin-barcode-scanner.check_permissions | ✅ | 144ms |  |
| 286 | plugin-geolocation.check_permissions | ✅ | 73ms |  |
| 287 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 58ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 288 | plugin-notification.registerListener | ✅ | 89ms |  |
| 289 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 927ms |  |
| 290 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1651ms |  |
| 291 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1623ms |  |
| 292 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 121ms |  |
| 293 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 113ms |  |
| 294 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 412ms |  |
| 295 | window.setFullscreen diag (main window) | ✅ | 2120ms |  |
| 296 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3876ms |  |
| 297 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 4954ms |  |
| 298 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 3943ms |  |
| 299 | window.setInnerSize actually resizes (main window) | ✅ | 4016ms |  |
| 300 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 2055ms |  |
| 301 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 4931ms |  |
| 302 | float window setInnerSize exact readback (decor=0) | ✅ | 1025ms |  |
| 303 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 1946ms |  |
| 304 | window.maximize fills monitor | ✅ | 1996ms |  |
| 305 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 933ms |  |
| 306 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1480ms |  |
| 307 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 63ms |  |
| 308 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 7ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 309 | window.setIgnoreCursorEvents smoke | ✅ | 59ms |  |
| 310 | window decoration flags smoke (D group, main window no-op) | ✅ | 193ms |  |
| 311 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1990ms |  |
| 312 | window cursor smoke (E group, no getter) | ✅ | 176ms |  |
| 313 | window.setContentProtection (demo cmd) | ✅ | 359ms |  |
| 314 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 644ms |  |
| 315 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 143ms |  |
| 316 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 510ms |  |
| 317 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 196ms |  |
| 318 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 255ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `0765b105f`, 15 uncommitted tracked file(s), diff-sha256 `b0842bf3b6062ab9`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-19T17:22:32Z*
