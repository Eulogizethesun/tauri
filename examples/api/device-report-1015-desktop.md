# Test Report

*Generated: 2026-10-15T07:23:09.722062656+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 11ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 34ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 22ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 145ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 178ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 141ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 1ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 66ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ✅ | 30ms |  |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 1ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 34ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 44ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 50ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 1ms |  |
| 15 | window.__TAURI__ | ✅ | 1ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 100ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 144ms |  |
| 18 | append_invoke_initialization_script | ✅ | 1ms |  |
| 19 | localStorage set/get/remove | ✅ | 1ms |  |
| 20 | on_window_event | ✅ | 169ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 45ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 123ms |  |
| 23 | webview.eval_with_callback | ✅ | 30ms |  |
| 24 | webview.webPageSnapshot | ✅ | 667ms |  |
| 25 | app_handle.emit | ✅ | 164ms |  |
| 26 | app_handle.listen | ✅ | 149ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 235ms |  |
| 28 | on_page_load events | ✅ | 1046ms |  |
| 29 | on_navigation interceptor | ✅ | 1553ms |  |
| 30 | on_document_title_changed | ✅ | 1552ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 47ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 162ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 46ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1604ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1616ms |  |
| 36 | window.isDecorated returns boolean | ✅ | 39ms |  |
| 37 | window.setDecorations toggles decorations state | ✅ | 103ms |  |
| 38 | create_borderless_window command | ✅ | 557ms |  |
| 39 | create_transparent_borderless_window command | ✅ | 555ms |  |
| 40 | window.is_maximized returns boolean | ✅ | 47ms |  |
| 41 | window.is_minimized returns boolean | ✅ | 23ms |  |
| 42 | window.maximize then is_maximized reflects state | ✅ | 535ms |  |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ✅ | 1061ms |  |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 567ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 571ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 71ms |  |
| 47 | on_new_window: Deny blocks window.open() | ✅ | 1569ms |  |
| 48 | on_new_window: window.open triggers event with correct URL | ✅ | 2115ms |  |
| 49 | webview.createPdf (default A4) | ✅ | 207ms |  |
| 50 | webview.clearAllBrowsingData routes to the labeled target | ✅ | 690ms |  |
| 51 | on_download: Requested event fires | ✅ | 105ms |  |
| 52 | on_download: custom directory redirects path | ✅ | 94ms |  |
| 53 | on_download: block dangerous file types | ✅ | 110ms |  |
| 54 | on_download: audit log contains metadata | ✅ | 113ms |  |
| 55 | on_download: Finished event fires on successful download | ✅ | 115ms |  |
| 56 | DOM MouseEvent.dispatch (synthetic) | ✅ | 3ms |  |
| 57 | DOM MouseEvent.coordinates | ✅ | 2ms |  |
| 58 | DOM WheelEvent.dispatch (synthetic) | ✅ | 1ms |  |
| 59 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 1ms |  |
| 60 | @tauri-apps/api/window.cursorPosition | ✅ | 79ms |  |
| 61 | webview.set_cookie round-trip (OHOS) | ✅ | 28ms |  |
| 62 | webview.cookies() returns array (OHOS best-effort) | ✅ | 31ms |  |
| 63 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 32ms |  |
| 64 | webview.cookies_for_url readable (OHOS) | ✅ | 31ms |  |
| 65 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1043ms |  |
| 66 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 87ms |  |
| 67 | PathResolver app_data_dir valid (OHOS) | ✅ | 34ms |  |
| 68 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 30ms |  |
| 69 | Clipboard API available (OHOS always-on) | ✅ | 1ms |  |
| 70 | window.setEffects (Blur/Acrylic) — no throw | ✅ | 294ms |  |
| 71 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 160ms |  |
| 72 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ✅ | 62ms |  |
| 73 | @tauri-apps/plugin-os.platform | ✅ | 5ms |  |
| 74 | @tauri-apps/plugin-log.trace | ✅ | 151ms |  |
| 75 | @tauri-apps/plugin-log.debug | ✅ | 33ms |  |
| 76 | @tauri-apps/plugin-log.info | ✅ | 29ms |  |
| 77 | @tauri-apps/plugin-log.warn | ✅ | 25ms |  |
| 78 | @tauri-apps/plugin-log.error | ✅ | 33ms |  |
| 79 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 44ms |  |
| 80 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 135ms |  |
| 81 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 63ms |  |
| 82 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 45ms |  |
| 83 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 49ms |  |
| 84 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 63ms |  |
| 85 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 790ms |  |
| 86 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 51ms |  |
| 87 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 135ms |  |
| 88 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 27ms |  |
| 89 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 142ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 59ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 49ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 60ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 170ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 181ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 66ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 47ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 111ms |  |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 54ms |  |
| 99 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 247ms |  |
| 100 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ✅ | 74ms |  |
| 101 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ✅ | 95ms |  |
| 102 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 2ms |  |
| 103 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 86ms |  |
| 104 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 59ms |  |
| 105 | @tauri-apps/plugin-notification.removeChannel | ✅ | 125ms |  |
| 106 | @tauri-apps/plugin-notification.pending+active | ✅ | 63ms |  |
| 107 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 2ms | notification permission disabled — enable notifications for this app to run this test |
| 108 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 250ms |  |
| 109 | tauri-plugin-sentry.breadcrumb | ✅ | 46ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 62ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 76ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 66ms |  |
| 113 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 197ms |  |
| 114 | tauri-plugin-sentry.envelope | ✅ | 37ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 58ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 52ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 46ms |  |
| 118 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 46ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 47ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 28ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 56ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 118ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 75ms |  |
| 124 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 43ms |  |
| 125 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 51ms |  |
| 126 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 45ms |  |
| 127 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 32ms |  |
| 128 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 130ms |  |
| 129 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 653ms |  |
| 130 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1293ms |  |
| 131 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 83ms |  |
| 132 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 56ms |  |
| 133 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 25ms |  |
| 134 | @tauri-apps/plugin-cli.getMatches | ✅ | 42ms |  |
| 135 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 44ms |  |
| 136 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 48ms |  |
| 137 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 69ms |  |
| 138 | nfc techLists fail-fast + zero session residue (OHOS) | ⏭️ | 46ms | no NFC hardware or NFC off — techLists scenario needs an NFC-capable device |
| 139 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 2ms |  |
| 140 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 1ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 1ms |  |
| 142 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 1ms |  |
| 143 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 1ms |  |
| 144 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 1ms |  |
| 145 | @tauri-apps/api/window.innerSize | ✅ | 148ms |  |
| 146 | @tauri-apps/api/window.outerSize | ✅ | 54ms |  |
| 147 | @tauri-apps/api/window.innerPosition | ✅ | 42ms |  |
| 148 | @tauri-apps/api/window.outerPosition | ✅ | 48ms |  |
| 149 | @tauri-apps/api/window.scaleFactor | ✅ | 45ms |  |
| 150 | @tauri-apps/api/image.new | ✅ | 40ms |  |
| 151 | @tauri-apps/api/image.size | ✅ | 45ms |  |
| 152 | @tauri-apps/api/image.rgba | ✅ | 71ms |  |
| 153 | @tauri-apps/api/image.fromBytes | ✅ | 55ms |  |
| 154 | @tauri-apps/api/image.close | ✅ | 71ms |  |
| 155 | @tauri-apps/api/menu.Menu.new | ✅ | 55ms |  |
| 156 | @tauri-apps/api/menu.Menu.with_id | ✅ | 98ms |  |
| 157 | @tauri-apps/api/menu.Menu.with_items | ✅ | 86ms |  |
| 158 | @tauri-apps/api/menu.Menu.with_id_and_items | ✅ | 104ms |  |
| 159 | @tauri-apps/api/menu.Menu.append | ✅ | 206ms |  |
| 160 | @tauri-apps/api/menu.Menu.append_items | ✅ | 85ms |  |
| 161 | @tauri-apps/api/menu.Menu.prepend | ✅ | 107ms |  |
| 162 | @tauri-apps/api/menu.Menu.prepend_items | ✅ | 158ms |  |
| 163 | @tauri-apps/api/menu.Menu.insert | ✅ | 185ms |  |
| 164 | @tauri-apps/api/menu.Menu.insert_items | ✅ | 145ms |  |
| 165 | @tauri-apps/api/menu.Menu.remove | ✅ | 135ms |  |
| 166 | @tauri-apps/api/menu.Menu.removeAt | ✅ | 193ms |  |
| 167 | @tauri-apps/api/menu.Menu.get | ✅ | 95ms |  |
| 168 | @tauri-apps/api/menu.Menu.items | ✅ | 143ms |  |
| 169 | @tauri-apps/api/menu.MenuItem.new | ✅ | 124ms |  |
| 170 | @tauri-apps/api/menu.MenuItem.with_id | ✅ | 48ms |  |
| 171 | @tauri-apps/api/menu.MenuItem.text | ✅ | 62ms |  |
| 172 | @tauri-apps/api/menu.MenuItem.setText | ✅ | 177ms |  |
| 173 | @tauri-apps/api/menu.MenuItem.isEnabled | ✅ | 91ms |  |
| 174 | @tauri-apps/api/menu.MenuItem.setEnabled | ✅ | 150ms |  |
| 175 | @tauri-apps/api/menu.MenuItem.setAccelerator | ✅ | 68ms |  |
| 176 | @tauri-apps/api/menu.Submenu.new | ✅ | 54ms |  |
| 177 | @tauri-apps/api/menu.Submenu.with_id | ✅ | 125ms |  |
| 178 | @tauri-apps/api/menu.Submenu.with_items | ✅ | 124ms |  |
| 179 | @tauri-apps/api/menu.Submenu.append | ✅ | 155ms |  |
| 180 | @tauri-apps/api/menu.Submenu.append_items | ✅ | 158ms |  |
| 181 | @tauri-apps/api/menu.Submenu.prepend | ✅ | 231ms |  |
| 182 | @tauri-apps/api/menu.Submenu.prepend_items | ✅ | 168ms |  |
| 183 | @tauri-apps/api/menu.Submenu.insert | ✅ | 169ms |  |
| 184 | @tauri-apps/api/menu.Submenu.insert_items | ✅ | 205ms |  |
| 185 | @tauri-apps/api/menu.Submenu.remove | ✅ | 158ms |  |
| 186 | @tauri-apps/api/menu.Submenu.removeAt | ✅ | 144ms |  |
| 187 | @tauri-apps/api/menu.Submenu.items | ✅ | 122ms |  |
| 188 | @tauri-apps/api/menu.Submenu.get | ✅ | 97ms |  |
| 189 | @tauri-apps/api/menu.Submenu.text | ✅ | 97ms |  |
| 190 | @tauri-apps/api/menu.Submenu.isEnabled | ✅ | 110ms |  |
| 191 | @tauri-apps/api/menu.Submenu.setIcon | ✅ | 72ms |  |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ✅ | 62ms |  |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ✅ | 111ms |  |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ✅ | 60ms |  |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ✅ | 64ms |  |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ✅ | 69ms |  |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ✅ | 75ms |  |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ✅ | 92ms |  |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ✅ | 97ms |  |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.text | ✅ | 94ms |  |
| 201 | @tauri-apps/api/menu.CheckMenuItem.new | ✅ | 78ms |  |
| 202 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ✅ | 108ms |  |
| 203 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ✅ | 105ms |  |
| 204 | @tauri-apps/api/menu.CheckMenuItem.text | ✅ | 104ms |  |
| 205 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ✅ | 86ms |  |
| 206 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ✅ | 65ms |  |
| 207 | @tauri-apps/api/menu.IconMenuItem.new | ✅ | 60ms |  |
| 208 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ✅ | 142ms |  |
| 209 | @tauri-apps/api/menu.IconMenuItem.with_id | ✅ | 78ms |  |
| 210 | @tauri-apps/api/menu.IconMenuItem.setIcon | ✅ | 117ms |  |
| 211 | @tauri-apps/api/menu.IconMenuItem.text | ✅ | 169ms |  |
| 212 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ✅ | 85ms |  |
| 213 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ✅ | 53ms |  |
| 214 | @tauri-apps/api/menu.MenuItem.action | ✅ | 50ms |  |
| 215 | @tauri-apps/api/menu.MenuItem.kind | ✅ | 65ms |  |
| 216 | @tauri-apps/api/menu.Submenu.kind | ✅ | 92ms |  |
| 217 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ✅ | 69ms |  |
| 218 | @tauri-apps/api/menu.CheckMenuItem.kind | ✅ | 73ms |  |
| 219 | @tauri-apps/api/menu.IconMenuItem.kind | ✅ | 98ms |  |
| 220 | @tauri-apps/api/menu.PredefinedMenuItem.about | ✅ | 105ms |  |
| 221 | @tauri-apps/api/menu.Menu.mixed_items | ✅ | 142ms |  |
| 222 | @tauri-apps/api/menu.predefined_clipboard_primitives | ✅ | 14ms |  |
| 223 | @tauri-apps/api/menu.Menu.popup_auto | ✅ | 259ms |  |
| 224 | @tauri-apps/api/menu.Menu.popup_at_auto | ✅ | 197ms |  |
| 225 | @tauri-apps/api/menu.Submenu.popup_auto | ✅ | 189ms |  |
| 226 | @tauri-apps/api/menu.Submenu.popup_at_auto | ✅ | 106ms |  |
| 227 | @tauri-apps/api/menu.Submenu.nested_auto | ✅ | 206ms |  |
| 228 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ✅ | 158ms |  |
| 229 | @tauri-apps/api/menu.Menu.full_workflow_auto | ✅ | 1147ms |  |
| 230 | @tauri-apps/api/menu.Menu.with_submenu_auto | ✅ | 1204ms |  |
| 231 | @tauri-apps/api/tray.TrayIcon.new | ✅ | 541ms |  |
| 232 | @tauri-apps/api/tray.TrayIcon.new_with_id | ✅ | 561ms |  |
| 233 | @tauri-apps/api/tray.TrayIcon.getById | ✅ | 81ms |  |
| 234 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ✅ | 42ms |  |
| 235 | @tauri-apps/api/tray.TrayIcon.removeById | ✅ | 561ms |  |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon | ✅ | 61ms |  |
| 237 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ✅ | 60ms |  |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu | ✅ | 90ms |  |
| 239 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ✅ | 46ms |  |
| 240 | @tauri-apps/api/tray.TrayIcon.setTooltip | ✅ | 67ms |  |
| 241 | @tauri-apps/api/tray.TrayIcon.setTitle | ✅ | 76ms |  |
| 242 | @tauri-apps/api/tray.TrayIcon.setVisible | ✅ | 128ms |  |
| 243 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ✅ | 73ms |  |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ✅ | 77ms |  |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ✅ | 66ms |  |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ✅ | 70ms |  |
| 247 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ✅ | 107ms |  |
| 248 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ✅ | 87ms |  |
| 249 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ✅ | 78ms |  |
| 250 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ✅ | 631ms |  |
| 251 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ✅ | 1159ms |  |
| 252 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ✅ | 231ms |  |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ✅ | 88ms |  |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ✅ | 48ms |  |
| 255 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ✅ | 89ms |  |
| 256 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ✅ | 622ms |  |
| 257 | @tauri-apps/api/tray.TrayIcon.cleanup | ✅ | 4ms |  |
| 258 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ✅ | 1073ms |  |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ✅ | 1674ms |  |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ✅ | 1768ms |  |
| 261 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ✅ | 802ms |  |
| 262 | ohos-adapter.monitor.real-size | ✅ | 80ms |  |
| 263 | ohos-adapter.monitor.refresh-rate | ✅ | 48ms |  |
| 264 | ohos-init.chain.window-menu-tray | ✅ | 224ms |  |
| 265 | @tauri-apps/plugin-os.type | ✅ | 6ms |  |
| 266 | @tauri-apps/plugin-os.family | ✅ | 4ms |  |
| 267 | @tauri-apps/plugin-os.arch | ✅ | 7ms |  |
| 268 | @tauri-apps/plugin-os.eol | ✅ | 6ms |  |
| 269 | @tauri-apps/plugin-os.exeExtension | ✅ | 3ms |  |
| 270 | @tauri-apps/plugin-os.version | ✅ | 4ms |  |
| 271 | @tauri-apps/plugin-os.locale | ✅ | 318ms |  |
| 272 | @tauri-apps/plugin-os.hostname | ✅ | 95ms |  |
| 273 | @tauri-apps/plugin-notification.onAction register | ✅ | 93ms |  |
| 274 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 106ms |  |
| 275 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 108ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 70ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 69ms |  |
| 278 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 235ms |  |
| 279 | plugin-biometric.status | ✅ | 137ms |  |
| 280 | plugin-nfc.is_available | ✅ | 56ms |  |
| 281 | plugin-barcode-scanner.check_permissions | ✅ | 180ms |  |
| 282 | plugin-geolocation.check_permissions | ✅ | 40ms |  |
| 283 | plugin-haptics.selection_feedback (routing smoke) | ⏭️ | 65ms | haptics device lacks vibrator or command rejected: selectionFeedback failed: Device operation failed. |
| 284 | plugin-notification.registerListener | ✅ | 76ms |  |
| 285 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 933ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1540ms |  |
| 287 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1574ms |  |
| 288 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 129ms |  |
| 289 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 70ms |  |
| 290 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 498ms |  |
| 291 | window.setFullscreen diag (main window) | ✅ | 2222ms |  |
| 292 | window.createUIAbilityWindow (webview registered + new instance IPC) | ✅ | 3714ms |  |
| 293 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ✅ | 5045ms |  |
| 294 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 3915ms |  |
| 295 | window.setInnerSize actually resizes (main window) | ✅ | 5013ms |  |
| 296 | window.setInnerSize save/restore zero drift (5 rounds) | ✅ | 1988ms |  |
| 297 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ✅ | 5027ms |  |
| 298 | float window setInnerSize exact readback (decor=0) | ✅ | 994ms |  |
| 299 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 1982ms |  |
| 300 | window.maximize fills monitor | ✅ | 1966ms |  |
| 301 | window.setFullscreen smoke (effect unverifiable from JS) | ✅ | 899ms |  |
| 302 | window.minimize smoke (effect unverifiable from JS) | ✅ | 1517ms |  |
| 303 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ✅ | 56ms |  |
| 304 | version-gate negative probes (print API 14 / setCursorGrab API 22) | ⏭️ | 2ms | API 23 ≥ 22 — both gates pass here; the Err sides only assert on lower-API devices |
| 305 | window.setIgnoreCursorEvents smoke | ✅ | 93ms |  |
| 306 | window decoration flags smoke (D group, main window no-op) | ✅ | 241ms |  |
| 307 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ✅ | 2037ms |  |
| 308 | window cursor smoke (E group, no getter) | ✅ | 218ms |  |
| 309 | window.setContentProtection (demo cmd) | ✅ | 365ms |  |
| 310 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 448ms |  |
| 311 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ✅ | 133ms |  |
| 312 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ✅ | 521ms |  |
| 313 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 172ms |  |
| 314 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 242ms |  |

---

*Report generated at end of test run.*

---
*Provenance: head `1a34b6b97`, 15 uncommitted tracked file(s), diff-sha256 `aebecd8a597b21cf`, device 3QC0124C11000038, device-type desktop, pulled 2026-10-15T07:23:09Z (retro-stamped; values captured at r3 run time, before the P4 text batch)*
