# Test Report

*Generated: 2026-10-22T04:16:10.789381406+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 34ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 23ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 153ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 631ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 154ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 143ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 39ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 35ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 38ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 54ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 57ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 115ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 155ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 175ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 29ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 129ms |  |
| 24 | webview.eval_with_callback | ✅ | 31ms |  |
| 25 | webview.webPageSnapshot | ✅ | 679ms |  |
| 26 | app_handle.emit | ✅ | 168ms |  |
| 27 | app_handle.listen | ✅ | 157ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 240ms |  |
| 29 | on_page_load events | ✅ | 1057ms |  |
| 30 | on_navigation interceptor | ✅ | 1553ms |  |
| 31 | on_document_title_changed | ✅ | 1545ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 53ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 156ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 35ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1571ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1613ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 39ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 77ms |  |
| 39 | create_borderless_window command | ✅ | 551ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 550ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 28ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 24ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 533ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1051ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 580ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 567ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 107ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1558ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2082ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 234ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 676ms |  |
| 52 | webview.clearAllBrowsingData clears document.cookie | ⏭️ | 2ms | document.cookie set/read not observable on this build (before="") — cookie wipe unverifiable from JS |
| 53 | on_download: Requested event fires | ✅ | 124ms |  |
| 54 | on_download: custom directory redirects path | ✅ | 111ms |  |
| 55 | on_download: block dangerous file types | ✅ | 96ms |  |
| 56 | on_download: audit log contains metadata | ✅ | 106ms |  |
| 57 | on_download: Finished event fires on successful download | ✅ | 109ms |  |
| 58 | webview child created with explicit bounds renders at requested size | ✅ | 630ms |  |
| 59 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 631ms |  |
| 60 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 632ms |  |
| 61 | DOM MouseEvent.dispatch (synthetic) | ✅ | 8ms |  |
| 62 | DOM MouseEvent.coordinates | ✅ | 3ms |  |
| 63 | DOM WheelEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 64 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 2ms |  |
| 65 | @tauri-apps/api/window.cursorPosition | ✅ | 97ms |  |
| 66 | webview.set_cookie round-trip (OHOS) | ✅ | 44ms |  |
| 67 | webview.cookies() returns array (OHOS best-effort) | ✅ | 36ms |  |
| 68 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 40ms |  |
| 69 | webview.cookies_for_url readable (OHOS) | ✅ | 42ms |  |
| 70 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1041ms |  |
| 71 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 138ms |  |
| 72 | PathResolver app_data_dir valid (OHOS) | ✅ | 49ms |  |
| 73 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 48ms |  |
| 74 | Clipboard API available (OHOS always-on) | ✅ | 4ms |  |
| 75 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 294ms |  |
| 76 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 133ms |  |
| 77 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 39ms |  |
| 78 | webview.url() main-thread sync read after SPA navigation (#192) | ✅ | 3223ms |  |
| 79 | webview.incognito create + cookie isolation (#188) | ✅ | 2786ms |  |
| 80 | window.set_title tracked ack: real window resolves, illegal label rejects (#219) | ✅ | 874ms |  |
| 81 | window tracked reject reaches invoke Err via ArkTS op (#219 M3) | ✅ | 45ms |  |
| 82 | https-intercept response headers reach the page (#186 M1) | ✅ | 280ms |  |
| 83 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 84 | @tauri-apps/plugin-log.trace | ✅ | 72ms |  |
| 85 | @tauri-apps/plugin-log.debug | ✅ | 30ms |  |
| 86 | @tauri-apps/plugin-log.info | ✅ | 30ms |  |
| 87 | @tauri-apps/plugin-log.warn | ✅ | 27ms |  |
| 88 | @tauri-apps/plugin-log.error | ✅ | 40ms |  |
| 89 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 56ms |  |
| 90 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 77ms |  |
| 91 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 80ms |  |
| 92 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 53ms |  |
| 93 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 59ms |  |
| 94 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 75ms |  |
| 95 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 992ms |  |
| 96 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 57ms |  |
| 97 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 144ms |  |
| 98 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 41ms |  |
| 99 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 174ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 62ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 163ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 98ms |  |
| 103 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 216ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 104 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 195ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 105 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 65ms |  |
| 106 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 77ms |  |
| 107 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 148ms |  |
| 108 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 46ms |  |
| 109 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 317ms |  |
| 110 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 131ms |  |
| 111 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 96ms |  |
| 112 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 2ms |  |
| 113 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 221ms |  |
| 114 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 121ms |  |
| 115 | @tauri-apps/plugin-notification.removeChannel | ✅ | 159ms |  |
| 116 | @tauri-apps/plugin-notification.pending+active | ✅ | 85ms |  |
| 117 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 118 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 354ms |  |
| 119 | tauri-plugin-sentry.breadcrumb | ✅ | 73ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 92ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 98ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 92ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 269ms |  |
| 124 | tauri-plugin-sentry.envelope | ✅ | 59ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 85ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 85ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 71ms |  |
| 128 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 53ms |  |
| 129 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 68ms |  |
| 130 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 52ms |  |
| 131 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 93ms |  |
| 132 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 141ms |  |
| 133 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 68ms |  |
| 134 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 58ms |  |
| 135 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 82ms |  |
| 136 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 71ms |  |
| 137 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 58ms |  |
| 138 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 245ms |  |
| 139 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 169ms |  |
| 140 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1309ms |  |
| 141 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 112ms |  |
| 142 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 65ms |  |
| 143 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 15ms |  |
| 144 | @tauri-apps/plugin-cli.getMatches | ✅ | 84ms |  |
| 145 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 81ms |  |
| 146 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 60ms |  |
| 147 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 102ms |  |
| 148 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 68ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 149 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 150 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 2ms |  |
| 151 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 4ms |  |
| 152 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 2ms |  |
| 153 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 154 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 2ms |  |
| 155 | @tauri-apps/api/window.innerSize | ✅ | 225ms |  |
| 156 | @tauri-apps/api/window.outerSize | ✅ | 54ms |  |
| 157 | @tauri-apps/api/window.innerPosition | ✅ | 40ms |  |
| 158 | @tauri-apps/api/window.outerPosition | ✅ | 47ms |  |
| 159 | @tauri-apps/api/window.scaleFactor | ✅ | 57ms |  |
| 160 | @tauri-apps/api/image.new | ✅ | 46ms |  |
| 161 | @tauri-apps/api/image.size | ✅ | 83ms |  |
| 162 | @tauri-apps/api/image.rgba | ✅ | 70ms |  |
| 163 | @tauri-apps/api/image.fromBytes | ✅ | 64ms |  |
| 164 | @tauri-apps/api/image.close | ✅ | 84ms |  |
| 165 | @tauri-apps/api/menu.Menu.new | ✅ | 51ms |  |
| 166 | @tauri-apps/api/menu.Menu.with_id | ✅ | 64ms |  |
| 167 | @tauri-apps/api/menu.Menu.with_items | ✅ | 95ms |  |
| 168 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 81ms |  |
| 169 | @tauri-apps/api/menu.Menu.append | ✅ | 96ms |  |
| 170 | @tauri-apps/api/menu.Menu.append_items | ✅ | 118ms |  |
| 171 | @tauri-apps/api/menu.Menu.prepend | ✅ | 145ms |  |
| 172 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 169ms |  |
| 173 | @tauri-apps/api/menu.Menu.insert | ✅ | 176ms |  |
| 174 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 144ms |  |
| 175 | @tauri-apps/api/menu.Menu.remove | ✅ | 144ms |  |
| 176 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 158ms |  |
| 177 | @tauri-apps/api/menu.Menu.get | ✅ | 108ms |  |
| 178 | @tauri-apps/api/menu.Menu.items | ✅ | 139ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.new | ✅ | 81ms |  |
| 180 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 62ms |  |
| 181 | @tauri-apps/api/menu.MenuItem.text | ✅ | 72ms |  |
| 182 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 89ms |  |
| 183 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 81ms |  |
| 184 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 99ms |  |
| 185 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 85ms |  |
| 186 | @tauri-apps/api/menu.Submenu.new | ✅ | 69ms |  |
| 187 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 64ms |  |
| 188 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 112ms |  |
| 189 | @tauri-apps/api/menu.Submenu.append | ✅ | 116ms |  |
| 190 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 129ms |  |
| 191 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 132ms |  |
| 192 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 152ms |  |
| 193 | @tauri-apps/api/menu.Submenu.insert | ✅ | 163ms |  |
| 194 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 164ms |  |
| 195 | @tauri-apps/api/menu.Submenu.remove | ✅ | 123ms |  |
| 196 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 157ms |  |
| 197 | @tauri-apps/api/menu.Submenu.items | ✅ | 179ms |  |
| 198 | @tauri-apps/api/menu.Submenu.get | ✅ | 255ms |  |
| 199 | @tauri-apps/api/menu.Submenu.text | ✅ | 134ms |  |
| 200 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 115ms |  |
| 201 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 79ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 81ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 93ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 85ms |  |
| 205 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 87ms |  |
| 206 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 91ms |  |
| 207 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 90ms |  |
| 208 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 95ms |  |
| 209 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 97ms |  |
| 210 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 126ms |  |
| 211 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 78ms |  |
| 212 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 89ms |  |
| 213 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 105ms |  |
| 214 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 134ms |  |
| 215 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 106ms |  |
| 216 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 96ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 77ms |  |
| 218 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 143ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 68ms |  |
| 220 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 85ms |  |
| 221 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 109ms |  |
| 222 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 125ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 97ms |  |
| 224 | @tauri-apps/api/menu.MenuItem.action | ✅ | 66ms |  |
| 225 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 60ms |  |
| 226 | @tauri-apps/api/menu.Submenu.kind | ✅ | 70ms |  |
| 227 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 62ms |  |
| 228 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 70ms |  |
| 229 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 69ms |  |
| 230 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 98ms |  |
| 231 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 146ms |  |
| 232 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 30ms |  |
| 233 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 161ms |  |
| 234 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 185ms |  |
| 235 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 151ms |  |
| 236 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 116ms |  |
| 237 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 174ms |  |
| 238 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 164ms |  |
| 239 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1218ms |  |
| 240 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1218ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 531ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 546ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 94ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 74ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 576ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 94ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 76ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 204ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 86ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 78ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 84ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 109ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 96ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 98ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 146ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 113ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 133ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 184ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 133ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 631ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1169ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 230ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 74ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 85ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 87ms |  |
| 266 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 607ms |  |
| 267 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 7ms |  |
| 268 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 982ms |  |
| 269 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1675ms |  |
| 270 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1714ms |  |
| 271 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 718ms |  |
| 272 | ohos-adapter.monitor.real-size | ✅ | 110ms |  |
| 273 | ohos-adapter.monitor.refresh-rate | ✅ | 118ms |  |
| 274 | ohos-init.chain.window-menu-tray | ✅ | 219ms |  |
| 275 | @tauri-apps/plugin-os.type | ✅ | 4ms |  |
| 276 | @tauri-apps/plugin-os.family | ✅ | 10ms |  |
| 277 | @tauri-apps/plugin-os.arch | ✅ | 6ms |  |
| 278 | @tauri-apps/plugin-os.eol | ✅ | 3ms |  |
| 279 | @tauri-apps/plugin-os.exeExtension | ✅ | 6ms |  |
| 280 | @tauri-apps/plugin-os.version | ✅ | 6ms |  |
| 281 | @tauri-apps/plugin-os.locale | ✅ | 266ms |  |
| 282 | @tauri-apps/plugin-os.hostname | ✅ | 88ms |  |
| 283 | @tauri-apps/plugin-notification.onAction register | ✅ | 89ms |  |
| 284 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 80ms |  |
| 285 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 67ms |  |
| 286 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 101ms |  |
| 287 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 71ms |  |
| 288 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 210ms |  |
| 289 | plugin-biometric.status | ✅ | 121ms |  |
| 290 | plugin-nfc.is_available | ✅ | 84ms |  |
| 291 | plugin-barcode-scanner.check_permissions | ✅ | 65ms |  |
| 292 | plugin-geolocation.check_permissions | ✅ | 59ms |  |
| 293 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 76ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 294 | plugin-notification.registerListener | ✅ | 91ms |  |
| 295 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 905ms |  |
| 296 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1473ms |  |
| 297 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1539ms |  |
| 298 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 133ms |  |
| 299 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 133ms |  |
| 300 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 500ms |  |
| 301 | window.setFullscreen diag (main window) | ✅ | 2166ms |  |
| 302 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3166ms |  |
| 303 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 3944ms |  |
| 304 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2532ms |  |
| 305 | window.setInnerSize actually resizes (main window) | ✅ | 1740ms |  |
| 306 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1562ms |  |
| 307 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 4725ms |  |
| 308 | float window setInnerSize exact readback (decor=0) | ✅ | 694ms |  |
| 309 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 660ms |  |
| 310 | window.maximize fills monitor | ✅ | 1108ms |  |
| 311 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 863ms |  |
| 312 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1640ms |  |
| 313 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 76ms |  |
| 314 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 3ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 315 | window.setIgnoreCursorEvents smoke | ✅ | 73ms |  |
| 316 | window decoration flags smoke (D group, main window no-op) | ✅ | 187ms |  |
| 317 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1993ms |  |
| 318 | window cursor smoke (E group, no getter) | ✅ | 213ms |  |
| 319 | window.setContentProtection (demo cmd) | ✅ | 357ms |  |
| 320 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 622ms |  |
| 321 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 163ms |  |
| 322 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 527ms |  |
| 323 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 215ms |  |
| 324 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 241ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `dd2e30022`, 6 uncommitted tracked file(s), diff-sha256 `bf12c0c968ae5b77`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-22T04:17:55Z*
