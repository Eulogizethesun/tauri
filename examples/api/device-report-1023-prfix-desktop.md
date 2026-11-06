# Test Report

*Generated: 2026-10-23T05:39:38.195011563+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 31ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 21ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 113ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 618ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 153ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 138ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 37ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 27ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 35ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 46ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 53ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 88ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 132ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 171ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 29ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 129ms |  |
| 24 | webview.eval_with_callback | ✅ | 35ms |  |
| 25 | webview.webPageSnapshot | ✅ | 653ms |  |
| 26 | app_handle.emit | ✅ | 164ms |  |
| 27 | app_handle.listen | ✅ | 155ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 238ms |  |
| 29 | on_page_load events | ✅ | 1046ms |  |
| 30 | on_navigation interceptor | ✅ | 1552ms |  |
| 31 | on_document_title_changed | ✅ | 1545ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 44ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 155ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 38ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1569ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1589ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 38ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 100ms |  |
| 39 | create_borderless_window command | ✅ | 551ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 549ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 25ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 23ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 531ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1045ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 583ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 576ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 87ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1572ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2212ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 247ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 608ms |  |
| 52 | webview.clearAllBrowsingData clears document.cookie | ⏭️ | 3ms | document.cookie set/read not observable on this build (before="") — cookie wipe unverifiable from JS |
| 53 | on_download: Requested event fires | ✅ | 113ms |  |
| 54 | on_download: custom directory redirects path | ✅ | 98ms |  |
| 55 | on_download: block dangerous file types | ✅ | 100ms |  |
| 56 | on_download: audit log contains metadata | ✅ | 101ms |  |
| 57 | on_download: Finished event fires on successful download | ✅ | 122ms |  |
| 58 | webview child created with explicit bounds renders at requested size | ✅ | 660ms |  |
| 59 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 556ms |  |
| 60 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 676ms |  |
| 61 | DOM MouseEvent.dispatch (synthetic) | ✅ | 3ms |  |
| 62 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 63 | DOM WheelEvent.dispatch (synthetic) | ✅ | 3ms |  |
| 64 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 65 | @tauri-apps/api/window.cursorPosition | ✅ | 108ms |  |
| 66 | webview.set_cookie round-trip (OHOS) | ✅ | 54ms |  |
| 67 | webview.cookies() returns array (OHOS best-effort) | ✅ | 44ms |  |
| 68 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 49ms |  |
| 69 | webview.cookies_for_url readable (OHOS) | ✅ | 51ms |  |
| 70 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1049ms |  |
| 71 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 120ms |  |
| 72 | PathResolver app_data_dir valid (OHOS) | ✅ | 49ms |  |
| 73 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 58ms |  |
| 74 | Clipboard API available (OHOS always-on) | ✅ | 2ms |  |
| 75 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 252ms |  |
| 76 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 120ms |  |
| 77 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 52ms |  |
| 78 | webview.url() main-thread sync read after SPA navigation (#192) | ✅ | 3173ms |  |
| 79 | webview.incognito create + cookie isolation (#188) | ✅ | 2778ms |  |
| 80 | window.set_title tracked ack: real window resolves, illegal label rejects (#219) | ✅ | 875ms |  |
| 81 | window tracked reject reaches invoke Err via ArkTS op (#219 M3) | ✅ | 37ms |  |
| 82 | https-intercept response headers reach the page (#186 M1) | ✅ | 240ms |  |
| 83 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 84 | @tauri-apps/plugin-log.trace | ✅ | 63ms |  |
| 85 | @tauri-apps/plugin-log.debug | ✅ | 27ms |  |
| 86 | @tauri-apps/plugin-log.info | ✅ | 33ms |  |
| 87 | @tauri-apps/plugin-log.warn | ✅ | 29ms |  |
| 88 | @tauri-apps/plugin-log.error | ✅ | 32ms |  |
| 89 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 52ms |  |
| 90 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 72ms |  |
| 91 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 63ms |  |
| 92 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 51ms |  |
| 93 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 54ms |  |
| 94 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 69ms |  |
| 95 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 1608ms |  |
| 96 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 86ms |  |
| 97 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 171ms |  |
| 98 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 53ms |  |
| 99 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 185ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 60ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 50ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 66ms |  |
| 103 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 183ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 104 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 177ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 105 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 53ms |  |
| 106 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 48ms |  |
| 107 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 100ms |  |
| 108 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 51ms |  |
| 109 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 221ms |  |
| 110 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 63ms |  |
| 111 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 92ms |  |
| 112 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 3ms |  |
| 113 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 90ms |  |
| 114 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 73ms |  |
| 115 | @tauri-apps/plugin-notification.removeChannel | ✅ | 73ms |  |
| 116 | @tauri-apps/plugin-notification.pending+active | ✅ | 48ms |  |
| 117 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 3ms | notification permission disabled — enable notifications for this app to run this test |
| 118 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 384ms |  |
| 119 | tauri-plugin-sentry.breadcrumb | ✅ | 44ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 65ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 69ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 59ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 165ms |  |
| 124 | tauri-plugin-sentry.envelope | ✅ | 84ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 80ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 66ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 61ms |  |
| 128 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 47ms |  |
| 129 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 69ms |  |
| 130 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 64ms |  |
| 131 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 97ms |  |
| 132 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 125ms |  |
| 133 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 62ms |  |
| 134 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 49ms |  |
| 135 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 62ms |  |
| 136 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 50ms |  |
| 137 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 40ms |  |
| 138 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 154ms |  |
| 139 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 105ms |  |
| 140 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1313ms |  |
| 141 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 89ms |  |
| 142 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 57ms |  |
| 143 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 20ms |  |
| 144 | @tauri-apps/plugin-cli.getMatches | ✅ | 57ms |  |
| 145 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 64ms |  |
| 146 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 53ms |  |
| 147 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 88ms |  |
| 148 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 68ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 149 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 150 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 2ms |  |
| 151 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 2ms |  |
| 152 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 2ms |  |
| 153 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 154 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 5ms |  |
| 155 | @tauri-apps/api/window.innerSize | ✅ | 179ms |  |
| 156 | @tauri-apps/api/window.outerSize | ✅ | 58ms |  |
| 157 | @tauri-apps/api/window.innerPosition | ✅ | 52ms |  |
| 158 | @tauri-apps/api/window.outerPosition | ✅ | 61ms |  |
| 159 | @tauri-apps/api/window.scaleFactor | ✅ | 55ms |  |
| 160 | @tauri-apps/api/image.new | ✅ | 60ms |  |
| 161 | @tauri-apps/api/image.size | ✅ | 66ms |  |
| 162 | @tauri-apps/api/image.rgba | ✅ | 75ms |  |
| 163 | @tauri-apps/api/image.fromBytes | ✅ | 66ms |  |
| 164 | @tauri-apps/api/image.close | ✅ | 69ms |  |
| 165 | @tauri-apps/api/menu.Menu.new | ✅ | 54ms |  |
| 166 | @tauri-apps/api/menu.Menu.with_id | ✅ | 54ms |  |
| 167 | @tauri-apps/api/menu.Menu.with_items | ✅ | 100ms |  |
| 168 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 71ms |  |
| 169 | @tauri-apps/api/menu.Menu.append | ✅ | 95ms |  |
| 170 | @tauri-apps/api/menu.Menu.append_items | ✅ | 101ms |  |
| 171 | @tauri-apps/api/menu.Menu.prepend | ✅ | 131ms |  |
| 172 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 124ms |  |
| 173 | @tauri-apps/api/menu.Menu.insert | ✅ | 165ms |  |
| 174 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 145ms |  |
| 175 | @tauri-apps/api/menu.Menu.remove | ✅ | 116ms |  |
| 176 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 172ms |  |
| 177 | @tauri-apps/api/menu.Menu.get | ✅ | 170ms |  |
| 178 | @tauri-apps/api/menu.Menu.items | ✅ | 128ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.new | ✅ | 75ms |  |
| 180 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 73ms |  |
| 181 | @tauri-apps/api/menu.MenuItem.text | ✅ | 109ms |  |
| 182 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 81ms |  |
| 183 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 77ms |  |
| 184 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 102ms |  |
| 185 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 99ms |  |
| 186 | @tauri-apps/api/menu.Submenu.new | ✅ | 58ms |  |
| 187 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 73ms |  |
| 188 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 144ms |  |
| 189 | @tauri-apps/api/menu.Submenu.append | ✅ | 116ms |  |
| 190 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 118ms |  |
| 191 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 163ms |  |
| 192 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 137ms |  |
| 193 | @tauri-apps/api/menu.Submenu.insert | ✅ | 172ms |  |
| 194 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 177ms |  |
| 195 | @tauri-apps/api/menu.Submenu.remove | ✅ | 94ms |  |
| 196 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 178ms |  |
| 197 | @tauri-apps/api/menu.Submenu.items | ✅ | 210ms |  |
| 198 | @tauri-apps/api/menu.Submenu.get | ✅ | 142ms |  |
| 199 | @tauri-apps/api/menu.Submenu.text | ✅ | 150ms |  |
| 200 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 98ms |  |
| 201 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 63ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 84ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 69ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 62ms |  |
| 205 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 82ms |  |
| 206 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 86ms |  |
| 207 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 66ms |  |
| 208 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 67ms |  |
| 209 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 91ms |  |
| 210 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 84ms |  |
| 211 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 51ms |  |
| 212 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 83ms |  |
| 213 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 95ms |  |
| 214 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 99ms |  |
| 215 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 109ms |  |
| 216 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 70ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 86ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 158ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 91ms |  |
| 220 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 73ms |  |
| 221 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 109ms |  |
| 222 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 96ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 73ms |  |
| 224 | @tauri-apps/api/menu.MenuItem.action | ✅ | 69ms |  |
| 225 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 78ms |  |
| 226 | @tauri-apps/api/menu.Submenu.kind | ✅ | 81ms |  |
| 227 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 74ms |  |
| 228 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 56ms |  |
| 229 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 67ms |  |
| 230 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 76ms |  |
| 231 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 122ms |  |
| 232 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 16ms |  |
| 233 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 260ms |  |
| 234 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 158ms |  |
| 235 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 142ms |  |
| 236 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 100ms |  |
| 237 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 181ms |  |
| 238 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 164ms |  |
| 239 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1309ms |  |
| 240 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1234ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 523ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 558ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 83ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 78ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 595ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 71ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 48ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 83ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 61ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 83ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 72ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 81ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 94ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 76ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 123ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 55ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 131ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 93ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 119ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 649ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1209ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 180ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 65ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 54ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 64ms |  |
| 266 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 618ms |  |
| 267 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 6ms |  |
| 268 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 1145ms |  |
| 269 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1691ms |  |
| 270 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1720ms |  |
| 271 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 731ms |  |
| 272 | ohos-adapter.monitor.real-size | ✅ | 84ms |  |
| 273 | ohos-adapter.monitor.refresh-rate | ✅ | 85ms |  |
| 274 | ohos-init.chain.window-menu-tray | ✅ | 248ms |  |
| 275 | @tauri-apps/plugin-os.type | ✅ | 9ms |  |
| 276 | @tauri-apps/plugin-os.family | ✅ | 4ms |  |
| 277 | @tauri-apps/plugin-os.arch | ✅ | 9ms |  |
| 278 | @tauri-apps/plugin-os.eol | ✅ | 6ms |  |
| 279 | @tauri-apps/plugin-os.exeExtension | ✅ | 7ms |  |
| 280 | @tauri-apps/plugin-os.version | ✅ | 5ms |  |
| 281 | @tauri-apps/plugin-os.locale | ✅ | 276ms |  |
| 282 | @tauri-apps/plugin-os.hostname | ✅ | 76ms |  |
| 283 | @tauri-apps/plugin-notification.onAction register | ✅ | 70ms |  |
| 284 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 71ms |  |
| 285 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 92ms |  |
| 286 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 105ms |  |
| 287 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 65ms |  |
| 288 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 189ms |  |
| 289 | plugin-biometric.status | ✅ | 96ms |  |
| 290 | plugin-nfc.is_available | ✅ | 51ms |  |
| 291 | plugin-barcode-scanner.check_permissions | ✅ | 62ms |  |
| 292 | plugin-geolocation.check_permissions | ✅ | 50ms |  |
| 293 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 69ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 294 | plugin-notification.registerListener | ✅ | 69ms |  |
| 295 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 896ms |  |
| 296 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1478ms |  |
| 297 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1618ms |  |
| 298 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 126ms |  |
| 299 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 158ms |  |
| 300 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 514ms |  |
| 301 | window.setFullscreen diag (main window) | ✅ | 2140ms |  |
| 302 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3118ms |  |
| 303 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 3986ms |  |
| 304 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2529ms |  |
| 305 | window.setInnerSize actually resizes (main window) | ✅ | 1527ms |  |
| 306 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1431ms |  |
| 307 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 3714ms |  |
| 308 | float window setInnerSize exact readback (decor=0) | ✅ | 688ms |  |
| 309 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 657ms |  |
| 310 | window.maximize fills monitor | ✅ | 1084ms |  |
| 311 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 864ms |  |
| 312 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1660ms |  |
| 313 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 47ms |  |
| 314 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 4ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 315 | window.setIgnoreCursorEvents smoke | ✅ | 72ms |  |
| 316 | window decoration flags smoke (D group, main window no-op) | ✅ | 198ms |  |
| 317 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1965ms |  |
| 318 | window cursor smoke (E group, no getter) | ✅ | 141ms |  |
| 319 | window.setContentProtection (demo cmd) | ✅ | 347ms |  |
| 320 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 613ms |  |
| 321 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 137ms |  |
| 322 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 516ms |  |
| 323 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 194ms |  |
| 324 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 229ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `b39ad91e3`, 6 uncommitted tracked file(s), diff-sha256 `bf12c0c968ae5b77`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-23T05:41:17Z*
