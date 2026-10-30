# Test Report

*Generated: 2026-10-26T06:22:13.416522031+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 33ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 22ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 124ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 637ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 153ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 140ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 39ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 51ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 35ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 45ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 109ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 126ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 142ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 179ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 32ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 131ms |  |
| 24 | webview.eval_with_callback | ✅ | 30ms |  |
| 25 | webview.webPageSnapshot | ✅ | 663ms |  |
| 26 | app_handle.emit | ✅ | 161ms |  |
| 27 | app_handle.listen | ✅ | 149ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 235ms |  |
| 29 | on_page_load events | ✅ | 1048ms |  |
| 30 | on_navigation interceptor | ✅ | 1548ms |  |
| 31 | on_document_title_changed | ✅ | 1551ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 54ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 161ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 40ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1568ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1598ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 35ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 111ms |  |
| 39 | create_borderless_window command | ✅ | 562ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 560ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 28ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 24ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 535ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1063ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 655ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 569ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 110ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1568ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2207ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 225ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 719ms |  |
| 52 | webview.clearAllBrowsingData clears document.cookie | ⏭️ | 3ms | document.cookie set/read not observable on this build (before="") — cookie wipe unverifiable from JS |
| 53 | on_download: Requested event fires | ✅ | 122ms |  |
| 54 | on_download: custom directory redirects path | ✅ | 101ms |  |
| 55 | on_download: block dangerous file types | ✅ | 113ms |  |
| 56 | on_download: audit log contains metadata | ✅ | 98ms |  |
| 57 | on_download: Finished event fires on successful download | ✅ | 111ms |  |
| 58 | webview child created with explicit bounds renders at requested size | ✅ | 681ms |  |
| 59 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 617ms |  |
| 60 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 705ms |  |
| 61 | DOM MouseEvent.dispatch (synthetic) | ✅ | 3ms |  |
| 62 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 63 | DOM WheelEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 64 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 65 | @tauri-apps/api/window.cursorPosition | ✅ | 118ms |  |
| 66 | webview.set_cookie round-trip (OHOS) | ✅ | 36ms |  |
| 67 | webview.cookies() returns array (OHOS best-effort) | ✅ | 39ms |  |
| 68 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 41ms |  |
| 69 | webview.cookies_for_url readable (OHOS) | ✅ | 51ms |  |
| 70 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1043ms |  |
| 71 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 138ms |  |
| 72 | PathResolver app_data_dir valid (OHOS) | ✅ | 41ms |  |
| 73 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 48ms |  |
| 74 | Clipboard API available (OHOS always-on) | ✅ | 4ms |  |
| 75 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 272ms |  |
| 76 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 187ms |  |
| 77 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 62ms |  |
| 78 | webview.url() main-thread sync read after SPA navigation (#192) | ✅ | 3201ms |  |
| 79 | webview.incognito create + cookie isolation (#188) | ✅ | 2789ms |  |
| 80 | window.set_title tracked ack: real window resolves, illegal label rejects (#219) | ✅ | 900ms |  |
| 81 | window tracked reject reaches invoke Err via ArkTS op (#219 M3) | ✅ | 43ms |  |
| 82 | https-intercept response headers reach the page (#186 M1) | ✅ | 301ms |  |
| 83 | @tauri-apps/plugin-os.platform | ✅ | 5ms |  |
| 84 | @tauri-apps/plugin-log.trace | ✅ | 73ms |  |
| 85 | @tauri-apps/plugin-log.debug | ✅ | 43ms |  |
| 86 | @tauri-apps/plugin-log.info | ✅ | 46ms |  |
| 87 | @tauri-apps/plugin-log.warn | ✅ | 41ms |  |
| 88 | @tauri-apps/plugin-log.error | ✅ | 49ms |  |
| 89 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 53ms |  |
| 90 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 85ms |  |
| 91 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 66ms |  |
| 92 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 58ms |  |
| 93 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 55ms |  |
| 94 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 78ms |  |
| 95 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 1135ms |  |
| 96 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 81ms |  |
| 97 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 264ms |  |
| 98 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 70ms |  |
| 99 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 190ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 90ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 54ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 61ms |  |
| 103 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 187ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 104 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 196ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 105 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 55ms |  |
| 106 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 47ms |  |
| 107 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 95ms |  |
| 108 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 42ms |  |
| 109 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 230ms |  |
| 110 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 76ms |  |
| 111 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 76ms |  |
| 112 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 7ms |  |
| 113 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 187ms |  |
| 114 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 69ms |  |
| 115 | @tauri-apps/plugin-notification.removeChannel | ✅ | 360ms |  |
| 116 | @tauri-apps/plugin-notification.pending+active | ✅ | 173ms |  |
| 117 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 118 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 437ms |  |
| 119 | tauri-plugin-sentry.breadcrumb | ✅ | 50ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 96ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 107ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 204ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 255ms |  |
| 124 | tauri-plugin-sentry.envelope | ✅ | 38ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 110ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 75ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 82ms |  |
| 128 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 54ms |  |
| 129 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 60ms |  |
| 130 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 46ms |  |
| 131 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 120ms |  |
| 132 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 161ms |  |
| 133 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 80ms |  |
| 134 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 55ms |  |
| 135 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 72ms |  |
| 136 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 61ms |  |
| 137 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 65ms |  |
| 138 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 174ms |  |
| 139 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 220ms |  |
| 140 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1312ms |  |
| 141 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 94ms |  |
| 142 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 74ms |  |
| 143 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 12ms |  |
| 144 | @tauri-apps/plugin-cli.getMatches | ✅ | 87ms |  |
| 145 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 95ms |  |
| 146 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 68ms |  |
| 147 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 97ms |  |
| 148 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 58ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 149 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 150 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 2ms |  |
| 151 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 2ms |  |
| 152 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 5ms |  |
| 153 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 154 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 2ms |  |
| 155 | @tauri-apps/api/window.innerSize | ✅ | 199ms |  |
| 156 | @tauri-apps/api/window.outerSize | ✅ | 54ms |  |
| 157 | @tauri-apps/api/window.innerPosition | ✅ | 47ms |  |
| 158 | @tauri-apps/api/window.outerPosition | ✅ | 53ms |  |
| 159 | @tauri-apps/api/window.scaleFactor | ✅ | 53ms |  |
| 160 | @tauri-apps/api/image.new | ✅ | 49ms |  |
| 161 | @tauri-apps/api/image.size | ✅ | 260ms |  |
| 162 | @tauri-apps/api/image.rgba | ✅ | 56ms |  |
| 163 | @tauri-apps/api/image.fromBytes | ✅ | 60ms |  |
| 164 | @tauri-apps/api/image.close | ✅ | 68ms |  |
| 165 | @tauri-apps/api/menu.Menu.new | ✅ | 50ms |  |
| 166 | @tauri-apps/api/menu.Menu.with_id | ✅ | 44ms |  |
| 167 | @tauri-apps/api/menu.Menu.with_items | ✅ | 103ms |  |
| 168 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 87ms |  |
| 169 | @tauri-apps/api/menu.Menu.append | ✅ | 86ms |  |
| 170 | @tauri-apps/api/menu.Menu.append_items | ✅ | 132ms |  |
| 171 | @tauri-apps/api/menu.Menu.prepend | ✅ | 133ms |  |
| 172 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 147ms |  |
| 173 | @tauri-apps/api/menu.Menu.insert | ✅ | 159ms |  |
| 174 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 132ms |  |
| 175 | @tauri-apps/api/menu.Menu.remove | ✅ | 114ms |  |
| 176 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 172ms |  |
| 177 | @tauri-apps/api/menu.Menu.get | ✅ | 90ms |  |
| 178 | @tauri-apps/api/menu.Menu.items | ✅ | 119ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.new | ✅ | 76ms |  |
| 180 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 66ms |  |
| 181 | @tauri-apps/api/menu.MenuItem.text | ✅ | 102ms |  |
| 182 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 117ms |  |
| 183 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 86ms |  |
| 184 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 99ms |  |
| 185 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 92ms |  |
| 186 | @tauri-apps/api/menu.Submenu.new | ✅ | 72ms |  |
| 187 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 72ms |  |
| 188 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 104ms |  |
| 189 | @tauri-apps/api/menu.Submenu.append | ✅ | 118ms |  |
| 190 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 128ms |  |
| 191 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 132ms |  |
| 192 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 146ms |  |
| 193 | @tauri-apps/api/menu.Submenu.insert | ✅ | 172ms |  |
| 194 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 140ms |  |
| 195 | @tauri-apps/api/menu.Submenu.remove | ✅ | 153ms |  |
| 196 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 238ms |  |
| 197 | @tauri-apps/api/menu.Submenu.items | ✅ | 144ms |  |
| 198 | @tauri-apps/api/menu.Submenu.get | ✅ | 129ms |  |
| 199 | @tauri-apps/api/menu.Submenu.text | ✅ | 147ms |  |
| 200 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 121ms |  |
| 201 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 87ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 68ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 99ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 74ms |  |
| 205 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 86ms |  |
| 206 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 90ms |  |
| 207 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 101ms |  |
| 208 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 90ms |  |
| 209 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 82ms |  |
| 210 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 121ms |  |
| 211 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 78ms |  |
| 212 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 97ms |  |
| 213 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 98ms |  |
| 214 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 113ms |  |
| 215 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 129ms |  |
| 216 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 93ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 75ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 154ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 63ms |  |
| 220 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 109ms |  |
| 221 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 118ms |  |
| 222 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 121ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 78ms |  |
| 224 | @tauri-apps/api/menu.MenuItem.action | ✅ | 80ms |  |
| 225 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 89ms |  |
| 226 | @tauri-apps/api/menu.Submenu.kind | ✅ | 60ms |  |
| 227 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 69ms |  |
| 228 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 69ms |  |
| 229 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 83ms |  |
| 230 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 86ms |  |
| 231 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 151ms |  |
| 232 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 29ms |  |
| 233 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 313ms |  |
| 234 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 136ms |  |
| 235 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 123ms |  |
| 236 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 134ms |  |
| 237 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 224ms |  |
| 238 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 157ms |  |
| 239 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1266ms |  |
| 240 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1230ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 531ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 575ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 95ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 59ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 583ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 92ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 51ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 116ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 69ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 94ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 80ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 104ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 83ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 123ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 130ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 96ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 262ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 104ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 119ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 627ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1177ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 203ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 72ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 58ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 114ms |  |
| 266 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 612ms |  |
| 267 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 7ms |  |
| 268 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 1142ms |  |
| 269 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1697ms |  |
| 270 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1735ms |  |
| 271 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 744ms |  |
| 272 | ohos-adapter.monitor.real-size | ✅ | 86ms |  |
| 273 | ohos-adapter.monitor.refresh-rate | ✅ | 107ms |  |
| 274 | ohos-init.chain.window-menu-tray | ✅ | 249ms |  |
| 275 | @tauri-apps/plugin-os.type | ✅ | 10ms |  |
| 276 | @tauri-apps/plugin-os.family | ✅ | 2ms |  |
| 277 | @tauri-apps/plugin-os.arch | ✅ | 2ms |  |
| 278 | @tauri-apps/plugin-os.eol | ✅ | 2ms |  |
| 279 | @tauri-apps/plugin-os.exeExtension | ✅ | 5ms |  |
| 280 | @tauri-apps/plugin-os.version | ✅ | 3ms |  |
| 281 | @tauri-apps/plugin-os.locale | ✅ | 343ms |  |
| 282 | @tauri-apps/plugin-os.hostname | ✅ | 108ms |  |
| 283 | @tauri-apps/plugin-notification.onAction register | ✅ | 95ms |  |
| 284 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 111ms |  |
| 285 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 67ms |  |
| 286 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 74ms |  |
| 287 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 76ms |  |
| 288 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 243ms |  |
| 289 | plugin-biometric.status | ✅ | 169ms |  |
| 290 | plugin-nfc.is_available | ✅ | 100ms |  |
| 291 | plugin-barcode-scanner.check_permissions | ✅ | 93ms |  |
| 292 | plugin-geolocation.check_permissions | ✅ | 113ms |  |
| 293 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 96ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 294 | plugin-notification.registerListener | ✅ | 103ms |  |
| 295 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 981ms |  |
| 296 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1602ms |  |
| 297 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1535ms |  |
| 298 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 168ms |  |
| 299 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 127ms |  |
| 300 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 523ms |  |
| 301 | window.setFullscreen diag (main window) | ✅ | 2126ms |  |
| 302 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3110ms |  |
| 303 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 3966ms |  |
| 304 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2531ms |  |
| 305 | window.setInnerSize actually resizes (main window) | ✅ | 1577ms |  |
| 306 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1567ms |  |
| 307 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 4429ms |  |
| 308 | float window setInnerSize exact readback (decor=0) | ✅ | 691ms |  |
| 309 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 663ms |  |
| 310 | window.maximize fills monitor | ✅ | 1106ms |  |
| 311 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 849ms |  |
| 312 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1710ms |  |
| 313 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 60ms |  |
| 314 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 4ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 315 | window.setIgnoreCursorEvents smoke | ✅ | 104ms |  |
| 316 | window decoration flags smoke (D group, main window contract #238) | ✅ | 132ms |  |
| 317 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1960ms |  |
| 318 | ut_window.hide rejects on OHOS (main window, #237) | ✅ | 53ms |  |
| 319 | ut_window.show keeps maximized state (#237, main window) | ✅ | 3139ms |  |
| 320 | ut_window main window decoration buttons (#238) | ✅ | 99ms |  |
| 321 | window cursor smoke (E group, no getter) | ✅ | 167ms |  |
| 322 | window.setContentProtection (demo cmd) | ✅ | 379ms |  |
| 323 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 656ms |  |
| 324 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 183ms |  |
| 325 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 538ms |  |
| 326 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 240ms |  |
| 327 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 238ms |  |

---

*Report generated at end of test run.*
