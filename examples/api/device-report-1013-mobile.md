# Test Report

*Generated: 2026-10-13T03:10:20.090943939+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 7ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 16ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 15ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 191ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 112ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 129ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 5ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 23ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ⏭️ | 15ms | desktop-only on OHOS mobile form — the currentMonitor window command is upstream cfg(desktop) and absent from the mobile build |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 6ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 21ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 26ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 26ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 4ms |  |
| 15 | window.__TAURI__ | ✅ | 4ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 49ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 83ms |  |
| 18 | append_invoke_initialization_script | ✅ | 5ms |  |
| 19 | localStorage set/get/remove | ✅ | 4ms |  |
| 20 | on_window_event | ✅ | 138ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 22ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 119ms |  |
| 23 | webview.eval_with_callback | ✅ | 22ms |  |
| 24 | webview.webPageSnapshot | ✅ | 669ms |  |
| 25 | app_handle.emit | ✅ | 129ms |  |
| 26 | app_handle.listen | ✅ | 128ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 227ms |  |
| 28 | on_page_load events | ✅ | 1067ms |  |
| 29 | on_navigation interceptor | ✅ | 1555ms |  |
| 30 | on_document_title_changed | ✅ | 1561ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 79ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 166ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 54ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1575ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1619ms |  |
| 36 | window.isDecorated returns boolean | ⏭️ | 28ms | desktop-only on OHOS mobile form — the isDecorated window command is upstream cfg(desktop) and absent from the mobile build |
| 37 | window.setDecorations toggles decorations state | ⏭️ | 9ms | desktop-only on OHOS mobile form — the setDecorations window command is upstream cfg(desktop) and absent from the mobile build |
| 38 | create_borderless_window command | ⏭️ | 9ms | desktop-only on OHOS mobile form — the create_borderless_window command is cfg(desktop)-only in cmd.rs |
| 39 | create_transparent_borderless_window command | ⏭️ | 6ms | desktop-only on OHOS mobile form — the create_transparent_borderless_window command is cfg(desktop)-only in cmd.rs |
| 40 | window.is_maximized returns boolean | ⏭️ | 7ms | desktop-only on OHOS mobile form — the isMaximized window command is upstream cfg(desktop) and absent from the mobile build |
| 41 | window.is_minimized returns boolean | ⏭️ | 6ms | desktop-only on OHOS mobile form — the isMinimized window command is upstream cfg(desktop) and absent from the mobile build |
| 42 | window.maximize then is_maximized reflects state | ⏭️ | 5ms | desktop-only on OHOS mobile form — the maximize/unmaximize window commands are upstream cfg(desktop) and absent from the mobile build |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ⏭️ | 6ms | desktop-only on OHOS mobile form — the maximize/unmaximize window commands are upstream cfg(desktop) and absent from the mobile build |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 625ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 635ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 110ms |  |
| 47 | on_new_window: Deny blocks window.open() | ⏭️ | 15ms | desktop-only on OHOS mobile form — the phone ArkWeb native layer returns a null URL for window.open (nweb_handler_delegate native return nullptr), so the event URL is null on mobile — known platform gap |
| 48 | on_new_window: window.open triggers event with correct URL | ⏭️ | 11ms | desktop-only on OHOS mobile form — the phone ArkWeb native layer returns a null URL for window.open (nweb_handler_delegate native return nullptr), so the event URL is null on mobile — known platform gap |
| 49 | webview.createPdf (default A4) | ✅ | 243ms |  |
| 50 | webview.clearAllBrowsingData routes to the labeled target | ⏭️ | 11ms | desktop-only on OHOS mobile form — the create_borderless_window command is cfg(desktop)-only in cmd.rs |
| 51 | on_download: Requested event fires | ✅ | 106ms |  |
| 52 | on_download: custom directory redirects path | ✅ | 104ms |  |
| 53 | on_download: block dangerous file types | ✅ | 109ms |  |
| 54 | on_download: audit log contains metadata | ✅ | 101ms |  |
| 55 | on_download: Finished event fires on successful download | ✅ | 116ms |  |
| 56 | DOM MouseEvent.dispatch (synthetic) | ✅ | 25ms |  |
| 57 | DOM MouseEvent.coordinates | ✅ | 14ms |  |
| 58 | DOM WheelEvent.dispatch (synthetic) | ✅ | 10ms |  |
| 59 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 9ms |  |
| 60 | @tauri-apps/api/window.cursorPosition | ⏭️ | 9ms | desktop-only on OHOS mobile form — the cursorPosition window command is upstream cfg(desktop) and absent from the mobile build |
| 61 | webview.set_cookie round-trip (OHOS) | ✅ | 74ms |  |
| 62 | webview.cookies() returns array (OHOS best-effort) | ✅ | 39ms |  |
| 63 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 37ms |  |
| 64 | webview.cookies_for_url readable (OHOS) | ✅ | 34ms |  |
| 65 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1055ms |  |
| 66 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 56ms |  |
| 67 | PathResolver app_data_dir valid (OHOS) | ✅ | 29ms |  |
| 68 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 27ms |  |
| 69 | Clipboard API available (OHOS always-on) | ✅ | 14ms |  |
| 70 | window.setEffects (Blur/Acrylic) — no throw | ⏭️ | 9ms | desktop-only on OHOS mobile form — the setEffects window command is upstream cfg(desktop) and absent from the mobile build |
| 71 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 156ms |  |
| 72 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ⏭️ | 94ms | UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): spawning an additional UIAbility window is only supported on the desktop (PC/2in1) form — this is a mobile-form build |
| 73 | @tauri-apps/plugin-os.platform | ✅ | 12ms |  |
| 74 | @tauri-apps/plugin-log.trace | ✅ | 48ms |  |
| 75 | @tauri-apps/plugin-log.debug | ✅ | 27ms |  |
| 76 | @tauri-apps/plugin-log.info | ✅ | 26ms |  |
| 77 | @tauri-apps/plugin-log.warn | ✅ | 30ms |  |
| 78 | @tauri-apps/plugin-log.error | ✅ | 26ms |  |
| 79 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 48ms |  |
| 80 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 34ms |  |
| 81 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 41ms |  |
| 82 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 35ms |  |
| 83 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 40ms |  |
| 84 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 43ms |  |
| 85 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 809ms |  |
| 86 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 99ms |  |
| 87 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 62ms |  |
| 88 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 33ms |  |
| 89 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 159ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 85ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 45ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 51ms |  |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 164ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 196ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 61ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 57ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 58ms |  |
| 98 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 61ms |  |
| 99 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 59ms |  |
| 100 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ⏭️ | 16ms | desktop-only on OHOS mobile form — enable()/disable() navigate to the system autostart settings page via startAbility — the pc_app_setup_settings URI is PC/2in1-only. Verified on Mate 70: startAbility LAUNCHES Settings and minimizes the calling UIAbility (MinimizeUIAbilityBySCB), backgrounding the app; the phone resource scheduler then freezes the process ~30s later, killing the rest of the suite. The plugin now refuses before startAbility on phone ("rejected the requested operation"), so the no-throw contract can no longer hold there |
| 101 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ⏭️ | 13ms | desktop-only on OHOS mobile form — OHOS forbids programmatic autostart toggling: enable()/disable() only navigate to the system autostart settings page, and that settings URI (pc_app_setup_settings) is PC/2in1-only — on phone the plugin refuses before startAbility and answers "rejected the requested operation" (launching Settings on phone would only background the caller; see the enable+disable skip above for the Mate 70 freeze forensics) |
| 102 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 10ms |  |
| 103 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 65ms |  |
| 104 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 42ms |  |
| 105 | @tauri-apps/plugin-notification.removeChannel | ✅ | 91ms |  |
| 106 | @tauri-apps/plugin-notification.pending+active | ✅ | 59ms |  |
| 107 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 23ms | notification permission disabled — enable notifications for this app to run this test |
| 108 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 317ms |  |
| 109 | tauri-plugin-sentry.breadcrumb | ✅ | 48ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 43ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 44ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 38ms |  |
| 113 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 59ms |  |
| 114 | tauri-plugin-sentry.envelope | ✅ | 29ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 40ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 39ms |  |
| 117 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 30ms |  |
| 118 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 32ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 39ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 39ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 48ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 48ms |  |
| 123 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 34ms |  |
| 124 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 34ms |  |
| 125 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 32ms |  |
| 126 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 35ms |  |
| 127 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 35ms |  |
| 128 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 60ms |  |
| 129 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 64ms |  |
| 130 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1286ms |  |
| 131 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 81ms |  |
| 132 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 45ms |  |
| 133 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 35ms |  |
| 134 | @tauri-apps/plugin-cli.getMatches | ✅ | 35ms |  |
| 135 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 37ms |  |
| 136 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 27ms |  |
| 137 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 40ms |  |
| 138 | nfc techLists fail-fast + zero session residue (OHOS) | ✅ | 1699ms |  |
| 139 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 69ms |  |
| 140 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 39ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 27ms |  |
| 142 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 25ms |  |
| 143 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 32ms |  |
| 144 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 31ms |  |
| 145 | @tauri-apps/api/window.innerSize | ✅ | 41ms |  |
| 146 | @tauri-apps/api/window.outerSize | ✅ | 30ms |  |
| 147 | @tauri-apps/api/window.innerPosition | ✅ | 26ms |  |
| 148 | @tauri-apps/api/window.outerPosition | ✅ | 27ms |  |
| 149 | @tauri-apps/api/window.scaleFactor | ✅ | 30ms |  |
| 150 | @tauri-apps/api/image.new | ✅ | 30ms |  |
| 151 | @tauri-apps/api/image.size | ✅ | 30ms |  |
| 152 | @tauri-apps/api/image.rgba | ✅ | 33ms |  |
| 153 | @tauri-apps/api/image.fromBytes | ✅ | 34ms |  |
| 154 | @tauri-apps/api/image.close | ✅ | 40ms |  |
| 155 | @tauri-apps/api/menu.Menu.new | ⏭️ | 17ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 156 | @tauri-apps/api/menu.Menu.with_id | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 157 | @tauri-apps/api/menu.Menu.with_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 158 | @tauri-apps/api/menu.Menu.with_id_and_items | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 159 | @tauri-apps/api/menu.Menu.append | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 160 | @tauri-apps/api/menu.Menu.append_items | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 161 | @tauri-apps/api/menu.Menu.prepend | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 162 | @tauri-apps/api/menu.Menu.prepend_items | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 163 | @tauri-apps/api/menu.Menu.insert | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 164 | @tauri-apps/api/menu.Menu.insert_items | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 165 | @tauri-apps/api/menu.Menu.remove | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 166 | @tauri-apps/api/menu.Menu.removeAt | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 167 | @tauri-apps/api/menu.Menu.get | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 168 | @tauri-apps/api/menu.Menu.items | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 169 | @tauri-apps/api/menu.MenuItem.new | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 170 | @tauri-apps/api/menu.MenuItem.with_id | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 171 | @tauri-apps/api/menu.MenuItem.text | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 172 | @tauri-apps/api/menu.MenuItem.setText | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 173 | @tauri-apps/api/menu.MenuItem.isEnabled | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 174 | @tauri-apps/api/menu.MenuItem.setEnabled | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 175 | @tauri-apps/api/menu.MenuItem.setAccelerator | ⏭️ | 16ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 176 | @tauri-apps/api/menu.Submenu.new | ⏭️ | 19ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 177 | @tauri-apps/api/menu.Submenu.with_id | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 178 | @tauri-apps/api/menu.Submenu.with_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 179 | @tauri-apps/api/menu.Submenu.append | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 180 | @tauri-apps/api/menu.Submenu.append_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 181 | @tauri-apps/api/menu.Submenu.prepend | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 182 | @tauri-apps/api/menu.Submenu.prepend_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 183 | @tauri-apps/api/menu.Submenu.insert | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 184 | @tauri-apps/api/menu.Submenu.insert_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 185 | @tauri-apps/api/menu.Submenu.remove | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 186 | @tauri-apps/api/menu.Submenu.removeAt | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 187 | @tauri-apps/api/menu.Submenu.items | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 188 | @tauri-apps/api/menu.Submenu.get | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 189 | @tauri-apps/api/menu.Submenu.text | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 190 | @tauri-apps/api/menu.Submenu.isEnabled | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 191 | @tauri-apps/api/menu.Submenu.setIcon | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 200 | @tauri-apps/api/menu.PredefinedMenuItem.text | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 201 | @tauri-apps/api/menu.CheckMenuItem.new | ⏭️ | 18ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 202 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ⏭️ | 18ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 203 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 204 | @tauri-apps/api/menu.CheckMenuItem.text | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 205 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 206 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 207 | @tauri-apps/api/menu.IconMenuItem.new | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 208 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 209 | @tauri-apps/api/menu.IconMenuItem.with_id | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 210 | @tauri-apps/api/menu.IconMenuItem.setIcon | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 211 | @tauri-apps/api/menu.IconMenuItem.text | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 212 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 213 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 214 | @tauri-apps/api/menu.MenuItem.action | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 215 | @tauri-apps/api/menu.MenuItem.kind | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 216 | @tauri-apps/api/menu.Submenu.kind | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 217 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 218 | @tauri-apps/api/menu.CheckMenuItem.kind | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 219 | @tauri-apps/api/menu.IconMenuItem.kind | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 220 | @tauri-apps/api/menu.PredefinedMenuItem.about | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 221 | @tauri-apps/api/menu.Menu.mixed_items | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 222 | @tauri-apps/api/menu.predefined_clipboard_primitives | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 223 | @tauri-apps/api/menu.Menu.popup_auto | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 224 | @tauri-apps/api/menu.Menu.popup_at_auto | ⏭️ | 19ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 225 | @tauri-apps/api/menu.Submenu.popup_auto | ⏭️ | 26ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 226 | @tauri-apps/api/menu.Submenu.popup_at_auto | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 227 | @tauri-apps/api/menu.Submenu.nested_auto | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 228 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ⏭️ | 15ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 229 | @tauri-apps/api/menu.Menu.full_workflow_auto | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 230 | @tauri-apps/api/menu.Menu.with_submenu_auto | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 231 | @tauri-apps/api/tray.TrayIcon.new | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 232 | @tauri-apps/api/tray.TrayIcon.new_with_id | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 233 | @tauri-apps/api/tray.TrayIcon.getById | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 234 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 235 | @tauri-apps/api/tray.TrayIcon.removeById | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 237 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 239 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 240 | @tauri-apps/api/tray.TrayIcon.setTooltip | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 241 | @tauri-apps/api/tray.TrayIcon.setTitle | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 242 | @tauri-apps/api/tray.TrayIcon.setVisible | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 243 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ⏭️ | 22ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ⏭️ | 26ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 247 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 248 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 249 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 250 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 251 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 252 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 255 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 256 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 257 | @tauri-apps/api/tray.TrayIcon.cleanup | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 258 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 261 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 262 | ohos-adapter.monitor.real-size | ⏭️ | 16ms | desktop-only on OHOS mobile form — currentMonitor is upstream cfg(desktop) and absent from the mobile build |
| 263 | ohos-adapter.monitor.refresh-rate | ✅ | 557ms |  |
| 264 | ohos-init.chain.window-menu-tray | ✅ | 56ms |  |
| 265 | @tauri-apps/plugin-os.type | ✅ | 22ms |  |
| 266 | @tauri-apps/plugin-os.family | ✅ | 27ms |  |
| 267 | @tauri-apps/plugin-os.arch | ✅ | 17ms |  |
| 268 | @tauri-apps/plugin-os.eol | ✅ | 18ms |  |
| 269 | @tauri-apps/plugin-os.exeExtension | ✅ | 16ms |  |
| 270 | @tauri-apps/plugin-os.version | ✅ | 17ms |  |
| 271 | @tauri-apps/plugin-os.locale | ✅ | 91ms |  |
| 272 | @tauri-apps/plugin-os.hostname | ✅ | 54ms |  |
| 273 | @tauri-apps/plugin-notification.onAction register | ✅ | 58ms |  |
| 274 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 48ms |  |
| 275 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 46ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 65ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 56ms |  |
| 278 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 210ms |  |
| 279 | plugin-biometric.status | ✅ | 101ms |  |
| 280 | plugin-nfc.is_available | ✅ | 66ms |  |
| 281 | plugin-barcode-scanner.check_permissions | ✅ | 61ms |  |
| 282 | plugin-geolocation.check_permissions | ✅ | 54ms |  |
| 283 | plugin-haptics.selection_feedback (routing smoke) | ✅ | 61ms |  |
| 284 | plugin-notification.registerListener | ✅ | 51ms |  |
| 285 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 778ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1511ms |  |
| 287 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1452ms |  |
| 288 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 128ms |  |
| 289 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 65ms |  |
| 290 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 180ms |  |
| 291 | window.setFullscreen diag (main window) | ⏭️ | 22ms | desktop-only on OHOS mobile form — the isFullscreen/setFullscreen window commands are upstream cfg(desktop) and absent from the mobile build |
| 292 | window.createUIAbilityWindow (webview registered + new instance IPC) | ⏭️ | 57ms | UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): spawning an additional UIAbility window is only supported on the desktop (PC/2in1) form — this is a mobile-form build |
| 293 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ⏭️ | 44ms | UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): spawning an additional UIAbility window is only supported on the desktop (PC/2in1) form — this is a mobile-form build |
| 294 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2530ms |  |
| 295 | window.setInnerSize actually resizes (main window) | ⏭️ | 47ms | desktop-only on OHOS mobile form — phone main window is full-screen: resize-inner cannot land (tao warns "precise decor unavailable" — Mate 70 r5-live.log ×10) — the exact-readback acceptance of issue#97 needs freeform resize, a PC/2in1 capability; the generic setSize path stays covered by the earlier window.set_size case |
| 296 | window.setInnerSize save/restore zero drift (5 rounds) | ⏭️ | 23ms | desktop-only on OHOS mobile form — phone main window is full-screen: resize-inner cannot land (tao warns "precise decor unavailable") — the zero-drift read-back loop of issue#97 needs freeform resize, a PC/2in1 capability |
| 297 | window.setSizeConstraints runtime min-floor clamps (and null clears) | ⏭️ | 21ms | desktop-only on OHOS mobile form — phone main window is full-screen: the min-floor clamp of setSizeConstraints needs a freeform-resizable main window (PC/2in1 capability), same policy as the setInnerSize cases |
| 298 | float window setInnerSize exact readback (decor=0) | ⏭️ | 19ms | desktop-only on OHOS mobile form — create_borderless_window (the Float-window creator used here) is cfg(desktop)-gated in cmd.rs since e2fb524c7 — Float windows work on mobile, but this creator command is desktop-only |
| 299 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 693ms |  |
| 300 | window.maximize fills monitor | ⏭️ | 62ms | desktop-only on OHOS mobile form — the maximize window command is upstream cfg(desktop) and absent from the mobile build |
| 301 | window.setFullscreen smoke (effect unverifiable from JS) | ⏭️ | 26ms | desktop-only on OHOS mobile form — the setFullscreen window command is upstream cfg(desktop) and absent from the mobile build |
| 302 | window.minimize smoke (effect unverifiable from JS) | ⏭️ | 21ms | desktop-only on OHOS mobile form — the minimize window command is upstream cfg(desktop) and absent from the mobile build |
| 303 | window.setAlwaysOnTop smoke (dispatches to setWindowTopmost API 14+; z-order effect unverifiable from JS) | ⏭️ | 21ms | desktop-only on OHOS mobile form — the setAlwaysOnTop window command is upstream cfg(desktop) and absent from the mobile build |
| 304 | window.setIgnoreCursorEvents smoke | ⏭️ | 20ms | desktop-only on OHOS mobile form — the setIgnoreCursorEvents window command is upstream cfg(desktop) and absent from the mobile build |
| 305 | window decoration flags smoke (D group, main window no-op) | ⏭️ | 19ms | desktop-only on OHOS mobile form — the setClosable/setMaximizable/setMinimizable window commands are upstream cfg(desktop) and absent from the mobile build |
| 306 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ⏭️ | 18ms | desktop-only on OHOS mobile form — the branch ops exercised here (setDecorations/minimize/decoration flags) are upstream cfg(desktop) window commands absent from the mobile build |
| 307 | window cursor smoke (E group, no getter) | ⏭️ | 19ms | desktop-only on OHOS mobile form — the setCursorVisible/setCursorIcon/setCursorPosition window commands are upstream cfg(desktop) and absent from the mobile build |
| 308 | window.setContentProtection (demo cmd) | ✅ | 405ms |  |
| 309 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 651ms |  |
| 310 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ⏭️ | 58ms | desktop-only on OHOS mobile form — the phone app sandbox denies exec of system binaries (EACCES os error 13) — /bin/sh exists on device but the mobile-form sandbox policy refuses it; the same case passes on the 2in1 desktop form |
| 311 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ⏭️ | 26ms | desktop-only on OHOS mobile form — the phone app sandbox denies exec of system binaries (EACCES os error 13) — /bin/sh exists on device but the mobile-form sandbox policy refuses it; the same case passes on the 2in1 desktop form |
| 312 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 210ms |  |
| 313 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 260ms |  |

---

*Report generated at end of test run.*
