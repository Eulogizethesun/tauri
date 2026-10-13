# Test Report

*Generated: 2026-10-13T03:54:39.272357812+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 12ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 36ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 23ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 138ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 180ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 143ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 50ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ✅ | 32ms |  |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 35ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 48ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 53ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 15 | window.__TAURI__ | ✅ | 1ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 101ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 141ms |  |
| 18 | append_invoke_initialization_script | ✅ | 1ms |  |
| 19 | localStorage set/get/remove | ✅ | 1ms |  |
| 20 | on_window_event | ✅ | 168ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 27ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 123ms |  |
| 23 | webview.eval_with_callback | ✅ | 27ms |  |
| 24 | webview.webPageSnapshot | ✅ | 680ms |  |
| 25 | app_handle.emit | ✅ | 173ms |  |
| 26 | app_handle.listen | ✅ | 149ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 236ms |  |
| 28 | on_page_load events | ✅ | 1047ms |  |
| 29 | on_navigation interceptor | ✅ | 1642ms |  |
| 30 | on_document_title_changed | ✅ | 1545ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 62ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 164ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 45ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1575ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1581ms |  |
| 36 | window.isDecorated returns boolean | ✅ | 34ms |  |
| 37 | window.setDecorations toggles decorations state | ✅ | 86ms |  |
| 38 | create_borderless_window command | ✅ | 556ms |  |
| 39 | create_transparent_borderless_window command | ✅ | 550ms |  |
| 40 | window.is_maximized returns boolean | ✅ | 28ms |  |
| 41 | window.is_minimized returns boolean | ✅ | 25ms |  |
| 42 | window.maximize then is_maximized reflects state | ✅ | 534ms |  |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1063ms |  |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 586ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 574ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 106ms |  |
| 47 | on_new_window: Deny blocks window.open() | ✅ | 1580ms |  |
| 48 | on_new_window: window.open triggers event with correct URL | ✅ | 2113ms |  |
| 49 | webview.createPdf (default A4) | ✅ | 228ms |  |
| 50 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 770ms |  |
| 51 | on_download: Requested event fires | ✅ | 109ms |  |
| 52 | on_download: custom directory redirects path | ✅ | 100ms |  |
| 53 | on_download: block dangerous file types | ✅ | 109ms |  |
| 54 | on_download: audit log contains metadata | ✅ | 113ms |  |
| 55 | on_download: Finished event fires on successful download | ✅ | 114ms |  |
| 56 | DOM MouseEvent.dispatch (synthetic) | ✅ | 3ms |  |
| 57 | DOM MouseEvent.coordinates | ✅ | 5ms |  |
| 58 | DOM WheelEvent.dispatch (synthetic) | ✅ | 2ms |  |
| 59 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 1ms |  |
| 60 | @tauri-apps/api/window.cursorPosition | ✅ | 88ms |  |
| 61 | webview.set_cookie round-trip (OHOS) | ✅ | 33ms |  |
| 62 | webview.cookies() returns array (OHOS best-effort) | ✅ | 32ms |  |
| 63 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 32ms |  |
| 64 | webview.cookies_for_url readable (OHOS) | ✅ | 32ms |  |
| 65 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1047ms |  |
| 66 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 113ms |  |
| 67 | PathResolver app_data_dir valid (OHOS) | ✅ | 27ms |  |
| 68 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 23ms |  |
| 69 | Clipboard API available (OHOS always-on) | ✅ | 1ms |  |
| 70 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 321ms |  |
| 71 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 140ms |  |
| 72 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 41ms |  |
| 73 | @tauri-apps/plugin-os.platform | ✅ | 3ms |  |
| 74 | @tauri-apps/plugin-log.trace | ✅ | 182ms |  |
| 75 | @tauri-apps/plugin-log.debug | ✅ | 34ms |  |
| 76 | @tauri-apps/plugin-log.info | ✅ | 28ms |  |
| 77 | @tauri-apps/plugin-log.warn | ✅ | 25ms |  |
| 78 | @tauri-apps/plugin-log.error | ✅ | 24ms |  |
| 79 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 45ms |  |
| 80 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 62ms |  |
| 81 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 218ms |  |
| 82 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 54ms |  |
| 83 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 62ms |  |
| 84 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 74ms |  |
| 85 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 692ms |  |
| 86 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 50ms |  |
| 87 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 122ms |  |
| 88 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 32ms |  |
| 89 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 141ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 40ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 29ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 56ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 173ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 202ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 57ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 52ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 115ms |  |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 39ms |  |
| 99 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 184ms |  |
| 100 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 143ms |  |
| 101 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 99ms |  |
| 102 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 3ms |  |
| 103 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 81ms |  |
| 104 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 63ms |  |
| 105 | @tauri-apps/plugin-notification.removeChannel | ✅ | 103ms |  |
| 106 | @tauri-apps/plugin-notification.pending+active | ✅ | 54ms |  |
| 107 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 6ms | notification permission disabled — enable notifications for this app to run this test |
| 108 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 253ms |  |
| 109 | tauri-plugin-sentry.breadcrumb | ✅ | 32ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 68ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 87ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 72ms |  |
| 113 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 187ms |  |
| 114 | tauri-plugin-sentry.envelope | ✅ | 45ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 71ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 85ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 56ms |  |
| 118 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 49ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 56ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 58ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 79ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 139ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 64ms |  |
| 124 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 45ms |  |
| 125 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 46ms |  |
| 126 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 40ms |  |
| 127 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 43ms |  |
| 128 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 189ms |  |
| 129 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 136ms |  |
| 130 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1314ms |  |
| 131 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 106ms |  |
| 132 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 48ms |  |
| 133 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 16ms |  |
| 134 | @tauri-apps/plugin-cli.getMatches | ✅ | 73ms |  |
| 135 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 81ms |  |
| 136 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 44ms |  |
| 137 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 89ms |  |
| 138 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 71ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 139 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 140 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 1ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 1ms |  |
| 142 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 1ms |  |
| 143 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 2ms |  |
| 144 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 6ms |  |
| 145 | @tauri-apps/api/window.innerSize | ✅ | 87ms |  |
| 146 | @tauri-apps/api/window.outerSize | ✅ | 34ms |  |
| 147 | @tauri-apps/api/window.innerPosition | ✅ | 28ms |  |
| 148 | @tauri-apps/api/window.outerPosition | ✅ | 61ms |  |
| 149 | @tauri-apps/api/window.scaleFactor | ✅ | 37ms |  |
| 150 | @tauri-apps/api/image.new | ✅ | 35ms |  |
| 151 | @tauri-apps/api/image.size | ✅ | 38ms |  |
| 152 | @tauri-apps/api/image.rgba | ✅ | 44ms |  |
| 153 | @tauri-apps/api/image.fromBytes | ✅ | 55ms |  |
| 154 | @tauri-apps/api/image.close | ✅ | 76ms |  |
| 155 | @tauri-apps/api/menu.Menu.new | ✅ | 41ms |  |
| 156 | @tauri-apps/api/menu.Menu.with_id | ✅ | 30ms |  |
| 157 | @tauri-apps/api/menu.Menu.with_items | ✅ | 75ms |  |
| 158 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 96ms |  |
| 159 | @tauri-apps/api/menu.Menu.append | ✅ | 85ms |  |
| 160 | @tauri-apps/api/menu.Menu.append_items | ✅ | 150ms |  |
| 161 | @tauri-apps/api/menu.Menu.prepend | ✅ | 265ms |  |
| 162 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 209ms |  |
| 163 | @tauri-apps/api/menu.Menu.insert | ✅ | 217ms |  |
| 164 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 199ms |  |
| 165 | @tauri-apps/api/menu.Menu.remove | ✅ | 121ms |  |
| 166 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 232ms |  |
| 167 | @tauri-apps/api/menu.Menu.get | ✅ | 90ms |  |
| 168 | @tauri-apps/api/menu.Menu.items | ✅ | 181ms |  |
| 169 | @tauri-apps/api/menu.MenuItem.new | ✅ | 122ms |  |
| 170 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 54ms |  |
| 171 | @tauri-apps/api/menu.MenuItem.text | ✅ | 57ms |  |
| 172 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 99ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 80ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 126ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 58ms |  |
| 176 | @tauri-apps/api/menu.Submenu.new | ✅ | 64ms |  |
| 177 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 45ms |  |
| 178 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 138ms |  |
| 179 | @tauri-apps/api/menu.Submenu.append | ✅ | 76ms |  |
| 180 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 183ms |  |
| 181 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 147ms |  |
| 182 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 99ms |  |
| 183 | @tauri-apps/api/menu.Submenu.insert | ✅ | 153ms |  |
| 184 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 194ms |  |
| 185 | @tauri-apps/api/menu.Submenu.remove | ✅ | 181ms |  |
| 186 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 187ms |  |
| 187 | @tauri-apps/api/menu.Submenu.items | ✅ | 165ms |  |
| 188 | @tauri-apps/api/menu.Submenu.get | ✅ | 142ms |  |
| 189 | @tauri-apps/api/menu.Submenu.text | ✅ | 72ms |  |
| 190 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 77ms |  |
| 191 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 62ms |  |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 83ms |  |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 218ms |  |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 45ms |  |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 74ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 134ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 62ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 65ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 74ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 112ms |  |
| 201 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 65ms |  |
| 202 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 93ms |  |
| 203 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 88ms |  |
| 204 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 126ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 103ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 84ms |  |
| 207 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 74ms |  |
| 208 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 113ms |  |
| 209 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 48ms |  |
| 210 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 99ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 102ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 110ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 78ms |  |
| 214 | @tauri-apps/api/menu.MenuItem.action | ✅ | 93ms |  |
| 215 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 66ms |  |
| 216 | @tauri-apps/api/menu.Submenu.kind | ✅ | 52ms |  |
| 217 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 73ms |  |
| 218 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 69ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 71ms |  |
| 220 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 53ms |  |
| 221 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 202ms |  |
| 222 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 19ms |  |
| 223 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 250ms |  |
| 224 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 162ms |  |
| 225 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 118ms |  |
| 226 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 192ms |  |
| 227 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 166ms |  |
| 228 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 150ms |  |
| 229 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1239ms |  |
| 230 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1383ms |  |
| 231 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 530ms |  |
| 232 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 574ms |  |
| 233 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 87ms |  |
| 234 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 41ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 615ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 61ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 36ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 142ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 46ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 67ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 79ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 74ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 63ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 67ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 82ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 56ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 85ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 72ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 76ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 681ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1090ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 136ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 40ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 37ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 48ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 633ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 3ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 1124ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1673ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1781ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 755ms |  |
| 262 | ohos-adapter.monitor.real-size | ✅ | 72ms |  |
| 263 | ohos-adapter.monitor.refresh-rate | ✅ | 81ms |  |
| 264 | ohos-init.chain.window-menu-tray | ✅ | 257ms |  |
| 265 | @tauri-apps/plugin-os.type | ✅ | 8ms |  |
| 266 | @tauri-apps/plugin-os.family | ✅ | 5ms |  |
| 267 | @tauri-apps/plugin-os.arch | ✅ | 5ms |  |
| 268 | @tauri-apps/plugin-os.eol | ✅ | 6ms |  |
| 269 | @tauri-apps/plugin-os.exeExtension | ✅ | 4ms |  |
| 270 | @tauri-apps/plugin-os.version | ✅ | 5ms |  |
| 271 | @tauri-apps/plugin-os.locale | ✅ | 305ms |  |
| 272 | @tauri-apps/plugin-os.hostname | ✅ | 73ms |  |
| 273 | @tauri-apps/plugin-notification.onAction register | ✅ | 163ms |  |
| 274 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 53ms |  |
| 275 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 52ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 66ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 66ms |  |
| 278 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 207ms |  |
| 279 | plugin-biometric.status | ✅ | 99ms |  |
| 280 | plugin-nfc.is_available | ✅ | 98ms |  |
| 281 | plugin-barcode-scanner.check_permissions | ✅ | 41ms |  |
| 282 | plugin-geolocation.check_permissions | ✅ | 49ms |  |
| 283 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 66ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 284 | plugin-notification.registerListener | ✅ | 92ms |  |
| 285 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 882ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1410ms |  |
| 287 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1444ms |  |
| 288 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 106ms |  |
| 289 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 77ms |  |
| 290 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 410ms |  |
| 291 | window.setFullscreen diag (main window) | ✅ | 2087ms |  |
| 292 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3945ms |  |
| 293 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 5013ms |  |
| 294 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 3951ms |  |
| 295 | window.setInnerSize actually resizes (main window) | ✅ | 4090ms |  |
| 296 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1905ms |  |
| 297 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 5058ms |  |
| 298 | float window setInnerSize exact readback (decor=0) | ✅ | 996ms |  |
| 299 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 1988ms |  |
| 300 | window.maximize fills monitor | ✅ | 1931ms |  |
| 301 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 943ms |  |
| 302 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1524ms |  |
| 303 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 44ms |  |
| 304 | window.setIgnoreCursorEvents smoke | ✅ | 41ms |  |
| 305 | window decoration flags smoke (D group, main window no-op) | ✅ | 177ms |  |
| 306 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 1965ms |  |
| 307 | window cursor smoke (E group, no getter) | ✅ | 149ms |  |
| 308 | window.setContentProtection (demo cmd) | ✅ | 343ms |  |
| 309 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 621ms |  |
| 310 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 126ms |  |
| 311 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 542ms |  |
| 312 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 208ms |  |
| 313 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 266ms |  |

---

*Report generated at end of test run.*
