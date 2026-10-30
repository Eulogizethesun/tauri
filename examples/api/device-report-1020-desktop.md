# Test Report

*Generated: 2026-10-20T11:13:50.587079219+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 12ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 38ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 24ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 151ms |  |
| 5 | @tauri-apps/api/core.invoke (iframe child frame routing) | ✅ | 629ms |  |
| 6 | @tauri-apps/api/event.emit+listen | ✅ | 156ms |  |
| 7 | @tauri-apps/api/event.once | ✅ | 143ms |  |
| 8 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 9 | @tauri-apps/api/window.isFocused | ✅ | 39ms |  |
| 10 | @tauri-apps/api/window.currentMonitor | ✅ | 32ms |  |
| 11 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 12 | @tauri-apps/api/path.appCacheDir | ✅ | 44ms |  |
| 13 | @tauri-apps/api/core.Resource | ✅ | 68ms |  |
| 14 | @tauri-apps/api/window.onFocusChanged | ✅ | 69ms |  |
| 15 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 16 | window.__TAURI__ | ✅ | 1ms |  |
| 17 | register_uri_scheme_protocol (sync) | ✅ | 128ms |  |
| 18 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 156ms |  |
| 19 | append_invoke_initialization_script | ✅ | 1ms |  |
| 20 | localStorage set/get/remove | ✅ | 1ms |  |
| 21 | on_window_event | ✅ | 179ms |  |
| 22 | on_menu_event_infrastructure | ✅ | 39ms |  |
| 23 | app_handle.get_webview_window (test_eval) | ✅ | 138ms |  |
| 24 | webview.eval_with_callback | ✅ | 49ms |  |
| 25 | webview.webPageSnapshot | ✅ | 683ms |  |
| 26 | app_handle.emit | ✅ | 166ms |  |
| 27 | app_handle.listen | ✅ | 149ms |  |
| 28 | tauri::async_runtime::spawn | ✅ | 245ms |  |
| 29 | on_page_load events | ✅ | 1062ms |  |
| 30 | on_navigation interceptor | ✅ | 1626ms |  |
| 31 | on_document_title_changed | ✅ | 1547ms |  |
| 32 | RunEvent::Ready fires on startup | ✅ | 49ms |  |
| 33 | RunEvent::MainEventsCleared fires | ✅ | 163ms |  |
| 34 | RunEvent::Resumed fires on startup | ✅ | 36ms |  |
| 35 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1574ms |  |
| 36 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1581ms |  |
| 37 | window.isDecorated returns boolean | ✅ | 40ms |  |
| 38 | window.setDecorations toggles decorations state | ✅ | 99ms |  |
| 39 | create_borderless_window command | ✅ | 561ms |  |
| 40 | create_transparent_borderless_window command | ✅ | 555ms |  |
| 41 | window.is_maximized returns boolean | ✅ | 34ms |  |
| 42 | window.is_minimized returns boolean | ✅ | 22ms |  |
| 43 | window.maximize then is_maximized reflects state | ✅ | 539ms |  |
| 44 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1063ms |  |
| 45 | window.set_position moves window (moveWindowTo) | ✅ | 586ms |  |
| 46 | window.set_size resizes window (resize) | ✅ | 569ms |  |
| 47 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 67ms |  |
| 48 | on_new_window: Deny blocks window.open() | ✅ | 1570ms |  |
| 49 | on_new_window: window.open triggers event with correct URL | ✅ | 2095ms |  |
| 50 | webview.createPdf (default A4) | ✅ | 211ms |  |
| 51 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 654ms |  |
| 52 | on_download: Requested event fires | ✅ | 99ms |  |
| 53 | on_download: custom directory redirects path | ✅ | 110ms |  |
| 54 | on_download: block dangerous file types | ✅ | 114ms |  |
| 55 | on_download: audit log contains metadata | ✅ | 110ms |  |
| 56 | on_download: Finished event fires on successful download | ✅ | 130ms |  |
| 57 | webview child created with explicit bounds renders at requested size | ✅ | 687ms |  |
| 58 | webview child setSize/setPosition change rendered geometry (last call wins) | ✅ | 627ms |  |
| 59 | sub-window natural webview follows container then flips explicit via set_bounds | ✅ | 618ms |  |
| 60 | DOM MouseEvent.dispatch (synthetic) | ✅ | 8ms |  |
| 61 | DOM MouseEvent.coordinates | ✅ | 5ms |  |
| 62 | DOM WheelEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 63 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 3ms |  |
| 64 | @tauri-apps/api/window.cursorPosition | ✅ | 114ms |  |
| 65 | webview.set_cookie round-trip (OHOS) | ✅ | 44ms |  |
| 66 | webview.cookies() returns array (OHOS best-effort) | ✅ | 36ms |  |
| 67 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 36ms |  |
| 68 | webview.cookies_for_url readable (OHOS) | ✅ | 36ms |  |
| 69 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1043ms |  |
| 70 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 134ms |  |
| 71 | PathResolver app_data_dir valid (OHOS) | ✅ | 175ms |  |
| 72 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 57ms |  |
| 73 | Clipboard API available (OHOS always-on) | ✅ | 4ms |  |
| 74 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 314ms |  |
| 75 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 141ms |  |
| 76 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 63ms |  |
| 77 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 78 | @tauri-apps/plugin-log.trace | ✅ | 169ms |  |
| 79 | @tauri-apps/plugin-log.debug | ✅ | 37ms |  |
| 80 | @tauri-apps/plugin-log.info | ✅ | 43ms |  |
| 81 | @tauri-apps/plugin-log.warn | ✅ | 38ms |  |
| 82 | @tauri-apps/plugin-log.error | ✅ | 41ms |  |
| 83 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 63ms |  |
| 84 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 120ms |  |
| 85 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 63ms |  |
| 86 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 50ms |  |
| 87 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 52ms |  |
| 88 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 77ms |  |
| 89 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 1022ms |  |
| 90 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 49ms |  |
| 91 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 169ms |  |
| 92 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 38ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 164ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 48ms |  |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 35ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 55ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 256ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 186ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 99 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 37ms |  |
| 100 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 37ms |  |
| 101 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 109ms |  |
| 102 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 54ms |  |
| 103 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 225ms |  |
| 104 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 74ms |  |
| 105 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 89ms |  |
| 106 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 3ms |  |
| 107 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 87ms |  |
| 108 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 64ms |  |
| 109 | @tauri-apps/plugin-notification.removeChannel | ✅ | 164ms |  |
| 110 | @tauri-apps/plugin-notification.pending+active | ✅ | 52ms |  |
| 111 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 112 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 200ms |  |
| 113 | tauri-plugin-sentry.breadcrumb | ✅ | 44ms |  |
| 114 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 65ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 77ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 111ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 148ms |  |
| 118 | tauri-plugin-sentry.envelope | ✅ | 36ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 45ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 52ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 49ms |  |
| 122 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 35ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 45ms |  |
| 124 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 43ms |  |
| 125 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 79ms |  |
| 126 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 162ms |  |
| 127 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 58ms |  |
| 128 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 33ms |  |
| 129 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 50ms |  |
| 130 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 39ms |  |
| 131 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 53ms |  |
| 132 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 150ms |  |
| 133 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 318ms |  |
| 134 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1326ms |  |
| 135 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 80ms |  |
| 136 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 77ms |  |
| 137 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 12ms |  |
| 138 | @tauri-apps/plugin-cli.getMatches | ✅ | 62ms |  |
| 139 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 59ms |  |
| 140 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 39ms |  |
| 141 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 69ms |  |
| 142 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 56ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 143 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 144 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 3ms |  |
| 145 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 13ms |  |
| 146 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 47ms |  |
| 147 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 5ms |  |
| 148 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 3ms |  |
| 149 | @tauri-apps/api/window.innerSize | ✅ | 55ms |  |
| 150 | @tauri-apps/api/window.outerSize | ✅ | 41ms |  |
| 151 | @tauri-apps/api/window.innerPosition | ✅ | 47ms |  |
| 152 | @tauri-apps/api/window.outerPosition | ✅ | 40ms |  |
| 153 | @tauri-apps/api/window.scaleFactor | ✅ | 62ms |  |
| 154 | @tauri-apps/api/image.new | ✅ | 32ms |  |
| 155 | @tauri-apps/api/image.size | ✅ | 45ms |  |
| 156 | @tauri-apps/api/image.rgba | ✅ | 59ms |  |
| 157 | @tauri-apps/api/image.fromBytes | ✅ | 59ms |  |
| 158 | @tauri-apps/api/image.close | ✅ | 78ms |  |
| 159 | @tauri-apps/api/menu.Menu.new | ✅ | 44ms |  |
| 160 | @tauri-apps/api/menu.Menu.with_id | ✅ | 35ms |  |
| 161 | @tauri-apps/api/menu.Menu.with_items | ✅ | 86ms |  |
| 162 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 90ms |  |
| 163 | @tauri-apps/api/menu.Menu.append | ✅ | 120ms |  |
| 164 | @tauri-apps/api/menu.Menu.append_items | ✅ | 139ms |  |
| 165 | @tauri-apps/api/menu.Menu.prepend | ✅ | 154ms |  |
| 166 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 173ms |  |
| 167 | @tauri-apps/api/menu.Menu.insert | ✅ | 225ms |  |
| 168 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 196ms |  |
| 169 | @tauri-apps/api/menu.Menu.remove | ✅ | 159ms |  |
| 170 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 199ms |  |
| 171 | @tauri-apps/api/menu.Menu.get | ✅ | 136ms |  |
| 172 | @tauri-apps/api/menu.Menu.items | ✅ | 151ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.new | ✅ | 112ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 81ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.text | ✅ | 99ms |  |
| 176 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 91ms |  |
| 177 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 103ms |  |
| 178 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 117ms |  |
| 179 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 113ms |  |
| 180 | @tauri-apps/api/menu.Submenu.new | ✅ | 84ms |  |
| 181 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 93ms |  |
| 182 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 92ms |  |
| 183 | @tauri-apps/api/menu.Submenu.append | ✅ | 132ms |  |
| 184 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 157ms |  |
| 185 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 132ms |  |
| 186 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 209ms |  |
| 187 | @tauri-apps/api/menu.Submenu.insert | ✅ | 247ms |  |
| 188 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 163ms |  |
| 189 | @tauri-apps/api/menu.Submenu.remove | ✅ | 155ms |  |
| 190 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 189ms |  |
| 191 | @tauri-apps/api/menu.Submenu.items | ✅ | 126ms |  |
| 192 | @tauri-apps/api/menu.Submenu.get | ✅ | 123ms |  |
| 193 | @tauri-apps/api/menu.Submenu.text | ✅ | 106ms |  |
| 194 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 118ms |  |
| 195 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 93ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 78ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 75ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 85ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 88ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 94ms |  |
| 201 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 78ms |  |
| 202 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 81ms |  |
| 203 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 92ms |  |
| 204 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 115ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 67ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 75ms |  |
| 207 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 87ms |  |
| 208 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 102ms |  |
| 209 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 121ms |  |
| 210 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 80ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 66ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 136ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 58ms |  |
| 214 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 71ms |  |
| 215 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 104ms |  |
| 216 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 123ms |  |
| 217 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 82ms |  |
| 218 | @tauri-apps/api/menu.MenuItem.action | ✅ | 75ms |  |
| 219 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 51ms |  |
| 220 | @tauri-apps/api/menu.Submenu.kind | ✅ | 49ms |  |
| 221 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 71ms |  |
| 222 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 69ms |  |
| 223 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 64ms |  |
| 224 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 77ms |  |
| 225 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 174ms |  |
| 226 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 15ms |  |
| 227 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 262ms |  |
| 228 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 154ms |  |
| 229 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 143ms |  |
| 230 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 138ms |  |
| 231 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 180ms |  |
| 232 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 168ms |  |
| 233 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1217ms |  |
| 234 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1241ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 522ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 565ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 76ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 61ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 551ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 83ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 50ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 94ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 82ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 88ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 88ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 113ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 109ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 103ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 118ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 72ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 136ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 83ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 109ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 618ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1170ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 199ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 84ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 60ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 76ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 593ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 7ms |  |
| 262 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 931ms |  |
| 263 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1633ms |  |
| 264 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1859ms |  |
| 265 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 707ms |  |
| 266 | ohos-adapter.monitor.real-size | ✅ | 92ms |  |
| 267 | ohos-adapter.monitor.refresh-rate | ✅ | 87ms |  |
| 268 | ohos-init.chain.window-menu-tray | ✅ | 250ms |  |
| 269 | @tauri-apps/plugin-os.type | ✅ | 11ms |  |
| 270 | @tauri-apps/plugin-os.family | ✅ | 12ms |  |
| 271 | @tauri-apps/plugin-os.arch | ✅ | 6ms |  |
| 272 | @tauri-apps/plugin-os.eol | ✅ | 5ms |  |
| 273 | @tauri-apps/plugin-os.exeExtension | ✅ | 5ms |  |
| 274 | @tauri-apps/plugin-os.version | ✅ | 5ms |  |
| 275 | @tauri-apps/plugin-os.locale | ✅ | 278ms |  |
| 276 | @tauri-apps/plugin-os.hostname | ✅ | 86ms |  |
| 277 | @tauri-apps/plugin-notification.onAction register | ✅ | 86ms |  |
| 278 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 70ms |  |
| 279 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 66ms |  |
| 280 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 85ms |  |
| 281 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 67ms |  |
| 282 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 207ms |  |
| 283 | plugin-biometric.status | ✅ | 190ms |  |
| 284 | plugin-nfc.is_available | ✅ | 79ms |  |
| 285 | plugin-barcode-scanner.check_permissions | ✅ | 63ms |  |
| 286 | plugin-geolocation.check_permissions | ✅ | 72ms |  |
| 287 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 71ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 288 | plugin-notification.registerListener | ✅ | 84ms |  |
| 289 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 827ms |  |
| 290 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1437ms |  |
| 291 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1409ms |  |
| 292 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 97ms |  |
| 293 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 107ms |  |
| 294 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 300ms |  |
| 295 | window.setFullscreen diag (main window) | ✅ | 2020ms |  |
| 296 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3109ms |  |
| 297 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 3978ms |  |
| 298 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2515ms |  |
| 299 | window.setInnerSize actually resizes (main window) | ✅ | 1422ms |  |
| 300 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1486ms |  |
| 301 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 3060ms |  |
| 302 | float window setInnerSize exact readback (decor=0) | ✅ | 703ms |  |
| 303 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 655ms |  |
| 304 | window.maximize fills monitor | ✅ | 1105ms |  |
| 305 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 864ms |  |
| 306 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1623ms |  |
| 307 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 63ms |  |
| 308 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 3ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 309 | window.setIgnoreCursorEvents smoke | ✅ | 87ms |  |
| 310 | window decoration flags smoke (D group, main window no-op) | ✅ | 227ms |  |
| 311 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1988ms |  |
| 312 | window cursor smoke (E group, no getter) | ✅ | 168ms |  |
| 313 | window.setContentProtection (demo cmd) | ✅ | 355ms |  |
| 314 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 619ms |  |
| 315 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 134ms |  |
| 316 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 513ms |  |
| 317 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 190ms |  |
| 318 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 268ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `1147f3ae5`, 7 uncommitted tracked file(s), diff-sha256 `565a4b469772f780`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-20T11:15:20Z*
