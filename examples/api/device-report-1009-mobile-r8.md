# Test Report

*Generated: 2026-10-09T01:55:57.410622508+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/ohos.versionInfo | ✅ | 7ms |  |
| 2 | @tauri-apps/api/app.getVersion | ✅ | 15ms |  |
| 3 | @tauri-apps/api/core.invoke | ✅ | 15ms |  |
| 4 | @tauri-apps/api/core.Channel | ✅ | 201ms |  |
| 5 | @tauri-apps/api/event.emit+listen | ✅ | 112ms |  |
| 6 | @tauri-apps/api/event.once | ✅ | 127ms |  |
| 7 | @tauri-apps/api/window.getCurrentWindow | ✅ | 5ms |  |
| 8 | @tauri-apps/api/window.isFocused | ✅ | 24ms |  |
| 9 | @tauri-apps/api/window.currentMonitor | ⏭️ | 16ms | desktop-only on OHOS mobile form — the currentMonitor window command is upstream cfg(desktop) and absent from the mobile build |
| 10 | @tauri-apps/api/webview.getCurrentWebview | ✅ | 5ms |  |
| 11 | @tauri-apps/api/path.appCacheDir | ✅ | 16ms |  |
| 12 | @tauri-apps/api/core.Resource | ✅ | 21ms |  |
| 13 | @tauri-apps/api/window.onFocusChanged | ✅ | 25ms |  |
| 14 | window.__TAURI_INTERNALS__ | ✅ | 5ms |  |
| 15 | window.__TAURI__ | ✅ | 4ms |  |
| 16 | register_uri_scheme_protocol (sync) | ✅ | 51ms |  |
| 17 | register_asynchronous_uri_scheme_protocol (async) | ✅ | 86ms |  |
| 18 | append_invoke_initialization_script | ✅ | 7ms |  |
| 19 | localStorage set/get/remove | ✅ | 6ms |  |
| 20 | on_window_event | ✅ | 130ms |  |
| 21 | on_menu_event_infrastructure | ✅ | 19ms |  |
| 22 | app_handle.get_webview_window (test_eval) | ✅ | 117ms |  |
| 23 | webview.eval_with_callback | ✅ | 23ms |  |
| 24 | webview.webPageSnapshot | ✅ | 683ms |  |
| 25 | app_handle.emit | ✅ | 131ms |  |
| 26 | app_handle.listen | ✅ | 128ms |  |
| 27 | tauri::async_runtime::spawn | ✅ | 224ms |  |
| 28 | on_page_load events | ✅ | 1027ms |  |
| 29 | on_navigation interceptor | ✅ | 1535ms |  |
| 30 | on_document_title_changed | ✅ | 1537ms |  |
| 31 | RunEvent::Ready fires on startup | ✅ | 38ms |  |
| 32 | RunEvent::MainEventsCleared fires | ✅ | 140ms |  |
| 33 | RunEvent::Resumed fires on startup | ✅ | 42ms |  |
| 34 | RunEvent::WindowEvent::CloseRequested fires | ✅ | 1568ms |  |
| 35 | RunEvent::WindowEvent::Destroyed fires | ✅ | 1575ms |  |
| 36 | window.isDecorated returns boolean | ⏭️ | 9ms | desktop-only on OHOS mobile form — the isDecorated window command is upstream cfg(desktop) and absent from the mobile build |
| 37 | window.setDecorations toggles decorations state | ⏭️ | 10ms | desktop-only on OHOS mobile form — the setDecorations window command is upstream cfg(desktop) and absent from the mobile build |
| 38 | create_borderless_window command | ⏭️ | 8ms | desktop-only on OHOS mobile form — the create_borderless_window command is cfg(desktop)-only in cmd.rs |
| 39 | create_transparent_borderless_window command | ⏭️ | 7ms | desktop-only on OHOS mobile form — the create_transparent_borderless_window command is cfg(desktop)-only in cmd.rs |
| 40 | window.is_maximized returns boolean | ⏭️ | 7ms | desktop-only on OHOS mobile form — the isMaximized window command is upstream cfg(desktop) and absent from the mobile build |
| 41 | window.is_minimized returns boolean | ⏭️ | 7ms | desktop-only on OHOS mobile form — the isMinimized window command is upstream cfg(desktop) and absent from the mobile build |
| 42 | window.maximize then is_maximized reflects state | ⏭️ | 7ms | desktop-only on OHOS mobile form — the maximize/unmaximize window commands are upstream cfg(desktop) and absent from the mobile build |
| 43 | window.unmaximize (recover) then is_maximized reflects state | ⏭️ | 9ms | desktop-only on OHOS mobile form — the maximize/unmaximize window commands are upstream cfg(desktop) and absent from the mobile build |
| 44 | window.set_position moves window (moveWindowTo) | ✅ | 584ms |  |
| 45 | window.set_size resizes window (resize) | ✅ | 549ms |  |
| 46 | window-state save_window_state + restore_state round-trip (all flags) | ✅ | 41ms |  |
| 47 | on_new_window: Deny blocks window.open() | ⏭️ | 15ms | desktop-only on OHOS mobile form — the phone ArkWeb native layer returns a null URL for window.open (nweb_handler_delegate native return nullptr), so the event URL is null on mobile — known platform gap |
| 48 | on_new_window: window.open triggers event with correct URL | ⏭️ | 14ms | desktop-only on OHOS mobile form — the phone ArkWeb native layer returns a null URL for window.open (nweb_handler_delegate native return nullptr), so the event URL is null on mobile — known platform gap |
| 49 | webview.createPdf (default A4) | ✅ | 239ms |  |
| 50 | on_download: Requested event fires | ✅ | 94ms |  |
| 51 | on_download: custom directory redirects path | ✅ | 102ms |  |
| 52 | on_download: block dangerous file types | ✅ | 102ms |  |
| 53 | on_download: audit log contains metadata | ✅ | 89ms |  |
| 54 | on_download: Finished event fires on successful download | ✅ | 90ms |  |
| 55 | DOM MouseEvent.dispatch (synthetic) | ✅ | 18ms |  |
| 56 | DOM MouseEvent.coordinates | ✅ | 12ms |  |
| 57 | DOM WheelEvent.dispatch (synthetic) | ✅ | 9ms |  |
| 58 | DOM WheelEvent.ctrlKey (pinch zoom simulation) | ✅ | 8ms |  |
| 59 | @tauri-apps/api/window.cursorPosition | ⏭️ | 9ms | desktop-only on OHOS mobile form — the cursorPosition window command is upstream cfg(desktop) and absent from the mobile build |
| 60 | webview.set_cookie round-trip (OHOS) | ✅ | 69ms |  |
| 61 | webview.cookies() returns array (OHOS best-effort) | ✅ | 45ms |  |
| 62 | webview.delete_cookie no-op (OHOS platform limit) | ✅ | 29ms |  |
| 63 | webview.cookies_for_url readable (OHOS) | ✅ | 32ms |  |
| 64 | webview.cookies_for_url main-thread sync bridge (OHOS #110) | ✅ | 1059ms |  |
| 65 | webview.set_bounds round-trip (OHOS desktop) | ✅ | 39ms |  |
| 66 | PathResolver app_data_dir valid (OHOS) | ✅ | 26ms |  |
| 67 | set_ignore_cursor_events is no-op (OHOS platform limit) | ✅ | 27ms |  |
| 68 | Clipboard API available (OHOS always-on) | ✅ | 8ms |  |
| 69 | window.setEffects (Blur/Acrylic) — no throw | ⏭️ | 8ms | desktop-only on OHOS mobile form — the setEffects window command is upstream cfg(desktop) and absent from the mobile build |
| 70 | vibrancy build-time effects (WindowBuilder::effects) — no throw | ✅ | 156ms |  |
| 71 | transparent UIAbility window (create + self-driven ops + hilog verifiable) | ⏭️ | 88ms | UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): spawning an additional UIAbility window is only supported on the desktop (PC/2in1) form — this is a mobile-form build |
| 72 | @tauri-apps/plugin-os.platform | ✅ | 9ms |  |
| 73 | @tauri-apps/plugin-log.trace | ✅ | 77ms |  |
| 74 | @tauri-apps/plugin-log.debug | ✅ | 17ms |  |
| 75 | @tauri-apps/plugin-log.info | ✅ | 30ms |  |
| 76 | @tauri-apps/plugin-log.warn | ✅ | 31ms |  |
| 77 | @tauri-apps/plugin-log.error | ✅ | 27ms |  |
| 78 | @tauri-apps/plugin-http.fetch (GET) | ✅ | 47ms |  |
| 79 | @tauri-apps/plugin-http.fetch (POST) | ✅ | 40ms |  |
| 80 | @tauri-apps/plugin-http.fetch (PUT) | ✅ | 37ms |  |
| 81 | @tauri-apps/plugin-http.fetch (DELETE) | ✅ | 34ms |  |
| 82 | @tauri-apps/plugin-http.fetch (custom headers) | ✅ | 45ms |  |
| 83 | @tauri-apps/plugin-http.fetch (JSON parse) | ✅ | 47ms |  |
| 84 | @tauri-apps/plugin-http.fetch (HTTPS/rustls-tls) | ✅ | 978ms |  |
| 85 | @tauri-apps/plugin-http.fetch (error handling) | ✅ | 72ms |  |
| 86 | @tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir | ✅ | 71ms |  |
| 87 | @tauri-apps/plugin-autostart.isEnabled | ✅ | 42ms |  |
| 88 | @tauri-apps/plugin-clipboard-manager.writeText+readText | ⏭️ | 155ms | readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 89 | @tauri-apps/plugin-clipboard-manager.writeImage | ✅ | 55ms |  |
| 90 | @tauri-apps/plugin-clipboard-manager.writeImage(number[]) | ✅ | 72ms |  |
| 91 | @tauri-apps/plugin-clipboard-manager.writeImage(Image) | ✅ | 72ms |  |
| 92 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage | ⏭️ | 168ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 93 | @tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113] | ⏭️ | 190ms | readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation |
| 94 | @tauri-apps/plugin-clipboard-manager.writeImage(rgba-object) | ✅ | 95ms |  |
| 95 | @tauri-apps/plugin-clipboard-manager.writeImage(data-uri) | ✅ | 58ms |  |
| 96 | @tauri-apps/plugin-clipboard-manager.writeImage(path) | ✅ | 83ms |  |
| 97 | @tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer) | ✅ | 52ms |  |
| 98 | @tauri-apps/plugin-window-state.filename+save+restore | ✅ | 58ms |  |
| 99 | @tauri-apps/plugin-autostart.enable+disable (no throw) | ⏭️ | 13ms | desktop-only on OHOS mobile form — enable()/disable() navigate to the system autostart settings page via startAbility — the pc_app_setup_settings URI is PC/2in1-only. Verified on Mate 70: startAbility LAUNCHES Settings and minimizes the calling UIAbility (MinimizeUIAbilityBySCB), backgrounding the app; the phone resource scheduler then freezes the process ~30s later, killing the rest of the suite. The plugin now refuses before startAbility on phone ("rejected the requested operation"), so the no-throw contract can no longer hold there |
| 100 | @tauri-apps/plugin-autostart.enable+isEnabled+disable | ⏭️ | 12ms | desktop-only on OHOS mobile form — OHOS forbids programmatic autostart toggling: enable()/disable() only navigate to the system autostart settings page, and that settings URI (pc_app_setup_settings) is PC/2in1-only — on phone the plugin refuses before startAbility and answers "rejected the requested operation" (launching Settings on phone would only background the caller; see the enable+disable skip above for the Mate 70 freeze forensics) |
| 101 | @tauri-apps/plugin-notification.isPermissionGranted | ✅ | 9ms |  |
| 102 | @tauri-apps/plugin-notification.createChannel+channels | ✅ | 69ms |  |
| 103 | @tauri-apps/plugin-notification.cancel+cancelAll | ✅ | 39ms |  |
| 104 | @tauri-apps/plugin-notification.removeChannel | ✅ | 77ms |  |
| 105 | @tauri-apps/plugin-notification.pending+active | ✅ | 39ms |  |
| 106 | @tauri-apps/plugin-notification.notify(schedule at) | ⏭️ | 21ms | notification permission disabled — enable notifications for this app to run this test |
| 107 | @tauri-apps/plugin-updater.checkAppGalleryUpdate | ✅ | 300ms |  |
| 108 | tauri-plugin-sentry.breadcrumb | ✅ | 31ms |  |
| 109 | @tauri-apps/plugin-global-shortcut.register+isRegistered | ✅ | 36ms |  |
| 110 | @tauri-apps/plugin-global-shortcut.unregister+isRegistered | ✅ | 39ms |  |
| 111 | @tauri-apps/plugin-global-shortcut.unregisterAll | ✅ | 37ms |  |
| 112 | @tauri-apps/plugin-global-shortcut.multipleCycles | ✅ | 66ms |  |
| 113 | tauri-plugin-sentry.envelope | ✅ | 31ms |  |
| 114 | @tauri-apps/plugin-global-shortcut.singleModifier | ✅ | 33ms |  |
| 115 | @tauri-apps/plugin-global-shortcut.twoModifiers | ✅ | 38ms |  |
| 116 | @tauri-apps/plugin-global-shortcut.threeModifiers_fails | ✅ | 37ms |  |
| 117 | tauri-plugin-sentry.rust_breadcrumb | ✅ | 37ms |  |
| 118 | @tauri-apps/plugin-global-shortcut.noModifier_fails | ✅ | 38ms |  |
| 119 | @tauri-apps/plugin-global-shortcut.invalidKey_fails | ✅ | 22ms |  |
| 120 | @tauri-apps/plugin-global-shortcut.duplicateModifier | ✅ | 51ms |  |
| 121 | @tauri-apps/plugin-global-shortcut.duplicateRegister | ✅ | 48ms |  |
| 122 | @tauri-apps/plugin-global-shortcut.unregisterNotRegistered | ✅ | 30ms |  |
| 123 | @tauri-apps/plugin-deep-link.getCurrent | ✅ | 38ms |  |
| 124 | @tauri-apps/plugin-deep-link.isRegistered | ✅ | 29ms |  |
| 125 | @tauri-apps/plugin-deep-link.register+unregister | ✅ | 34ms |  |
| 126 | @tauri-apps/plugin-deep-link.onOpenUrl register | ✅ | 32ms |  |
| 127 | @tauri-apps/plugin-store.set+get+has+keys+entries+delete | ✅ | 55ms |  |
| 128 | @tauri-apps/plugin-sql.load+execute+select+close | ✅ | 64ms |  |
| 129 | @tauri-apps/plugin-websocket.connect+send+echo+disconnect | ✅ | 1300ms |  |
| 130 | @tauri-apps/plugin-upload.upload (echo+progress) | ✅ | 65ms |  |
| 131 | @tauri-apps/plugin-persisted-scope.allow+persist | ✅ | 41ms |  |
| 132 | @tauri-apps/plugin-localhost.fetch 200 | ✅ | 30ms |  |
| 133 | @tauri-apps/plugin-cli.getMatches | ✅ | 35ms |  |
| 134 | @tauri-apps/plugin-positioner.moveWindow (smoke) | ✅ | 45ms |  |
| 135 | @tauri-apps/plugin-accessibility.getFontScale | ✅ | 33ms |  |
| 136 | @tauri-apps/plugin-accessibility.screenReader+touchExploreQueries | ✅ | 46ms |  |
| 137 | nfc techLists fail-fast + zero session residue (OHOS) | ✅ | 1387ms |  |
| 138 | @tauri-apps/api/dpi.PhysicalSize.constructor | ✅ | 72ms |  |
| 139 | @tauri-apps/api/dpi.PhysicalSize.toLogical | ✅ | 52ms |  |
| 140 | @tauri-apps/api/dpi.LogicalSize.constructor | ✅ | 33ms |  |
| 141 | @tauri-apps/api/dpi.LogicalSize.toPhysical | ✅ | 28ms |  |
| 142 | @tauri-apps/api/dpi.PhysicalPosition.constructor+toLogical | ✅ | 31ms |  |
| 143 | @tauri-apps/api/dpi.LogicalPosition.constructor+toPhysical | ✅ | 31ms |  |
| 144 | @tauri-apps/api/window.innerSize | ✅ | 32ms |  |
| 145 | @tauri-apps/api/window.outerSize | ✅ | 35ms |  |
| 146 | @tauri-apps/api/window.innerPosition | ✅ | 40ms |  |
| 147 | @tauri-apps/api/window.outerPosition | ✅ | 24ms |  |
| 148 | @tauri-apps/api/window.scaleFactor | ✅ | 32ms |  |
| 149 | @tauri-apps/api/image.new | ✅ | 32ms |  |
| 150 | @tauri-apps/api/image.size | ✅ | 29ms |  |
| 151 | @tauri-apps/api/image.rgba | ✅ | 30ms |  |
| 152 | @tauri-apps/api/image.fromBytes | ✅ | 33ms |  |
| 153 | @tauri-apps/api/image.close | ✅ | 43ms |  |
| 154 | @tauri-apps/api/menu.Menu.new | ⏭️ | 16ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 155 | @tauri-apps/api/menu.Menu.with_id | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 156 | @tauri-apps/api/menu.Menu.with_items | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 157 | @tauri-apps/api/menu.Menu.with_id_and_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 158 | @tauri-apps/api/menu.Menu.append | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 159 | @tauri-apps/api/menu.Menu.append_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 160 | @tauri-apps/api/menu.Menu.prepend | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 161 | @tauri-apps/api/menu.Menu.prepend_items | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 162 | @tauri-apps/api/menu.Menu.insert | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 163 | @tauri-apps/api/menu.Menu.insert_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 164 | @tauri-apps/api/menu.Menu.remove | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 165 | @tauri-apps/api/menu.Menu.removeAt | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 166 | @tauri-apps/api/menu.Menu.get | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 167 | @tauri-apps/api/menu.Menu.items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 168 | @tauri-apps/api/menu.MenuItem.new | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 169 | @tauri-apps/api/menu.MenuItem.with_id | ⏭️ | 10ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 170 | @tauri-apps/api/menu.MenuItem.text | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 171 | @tauri-apps/api/menu.MenuItem.setText | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 172 | @tauri-apps/api/menu.MenuItem.isEnabled | ⏭️ | 24ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 173 | @tauri-apps/api/menu.MenuItem.setEnabled | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 174 | @tauri-apps/api/menu.MenuItem.setAccelerator | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 175 | @tauri-apps/api/menu.Submenu.new | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 176 | @tauri-apps/api/menu.Submenu.with_id | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 177 | @tauri-apps/api/menu.Submenu.with_items | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 178 | @tauri-apps/api/menu.Submenu.append | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 179 | @tauri-apps/api/menu.Submenu.append_items | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 180 | @tauri-apps/api/menu.Submenu.prepend | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 181 | @tauri-apps/api/menu.Submenu.prepend_items | ⏭️ | 11ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 182 | @tauri-apps/api/menu.Submenu.insert | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 183 | @tauri-apps/api/menu.Submenu.insert_items | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 184 | @tauri-apps/api/menu.Submenu.remove | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 185 | @tauri-apps/api/menu.Submenu.removeAt | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 186 | @tauri-apps/api/menu.Submenu.items | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 187 | @tauri-apps/api/menu.Submenu.get | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 188 | @tauri-apps/api/menu.Submenu.text | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 189 | @tauri-apps/api/menu.Submenu.isEnabled | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 190 | @tauri-apps/api/menu.Submenu.setIcon | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 191 | @tauri-apps/api/menu.PredefinedMenuItem.separator | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 192 | @tauri-apps/api/menu.PredefinedMenuItem.copy | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 193 | @tauri-apps/api/menu.PredefinedMenuItem.cut | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 194 | @tauri-apps/api/menu.PredefinedMenuItem.paste | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 195 | @tauri-apps/api/menu.PredefinedMenuItem.selectAll | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 196 | @tauri-apps/api/menu.PredefinedMenuItem.undo | ⏭️ | 18ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 197 | @tauri-apps/api/menu.PredefinedMenuItem.redo | ⏭️ | 21ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 198 | @tauri-apps/api/menu.PredefinedMenuItem.fullscreen | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 199 | @tauri-apps/api/menu.PredefinedMenuItem.text | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 200 | @tauri-apps/api/menu.CheckMenuItem.new | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 201 | @tauri-apps/api/menu.CheckMenuItem.isChecked | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 202 | @tauri-apps/api/menu.CheckMenuItem.setChecked | ⏭️ | 15ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 203 | @tauri-apps/api/menu.CheckMenuItem.text | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 204 | @tauri-apps/api/menu.CheckMenuItem.isEnabled | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 205 | @tauri-apps/api/menu.CheckMenuItem.setAccelerator | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 206 | @tauri-apps/api/menu.IconMenuItem.new | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 207 | @tauri-apps/api/menu.IconMenuItem(native icon variants) | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 208 | @tauri-apps/api/menu.IconMenuItem.with_id | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 209 | @tauri-apps/api/menu.IconMenuItem.setIcon | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 210 | @tauri-apps/api/menu.IconMenuItem.text | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 211 | @tauri-apps/api/menu.IconMenuItem.isEnabled | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 212 | @tauri-apps/api/menu.IconMenuItem.setAccelerator | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 213 | @tauri-apps/api/menu.MenuItem.action | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 214 | @tauri-apps/api/menu.MenuItem.kind | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 215 | @tauri-apps/api/menu.Submenu.kind | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 216 | @tauri-apps/api/menu.PredefinedMenuItem.kind | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 217 | @tauri-apps/api/menu.CheckMenuItem.kind | ⏭️ | 21ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 218 | @tauri-apps/api/menu.IconMenuItem.kind | ⏭️ | 22ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 219 | @tauri-apps/api/menu.PredefinedMenuItem.about | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 220 | @tauri-apps/api/menu.Menu.mixed_items | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 221 | @tauri-apps/api/menu.predefined_clipboard_primitives | ⏭️ | 12ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 222 | @tauri-apps/api/menu.Menu.popup_auto | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 223 | @tauri-apps/api/menu.Menu.popup_at_auto | ⏭️ | 13ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 224 | @tauri-apps/api/menu.Submenu.popup_auto | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 225 | @tauri-apps/api/menu.Submenu.popup_at_auto | ⏭️ | 14ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 226 | @tauri-apps/api/menu.Submenu.nested_auto | ⏭️ | 16ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 227 | @tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto | ⏭️ | 15ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 228 | @tauri-apps/api/menu.Menu.full_workflow_auto | ⏭️ | 15ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 229 | @tauri-apps/api/menu.Menu.with_submenu_auto | ⏭️ | 15ms | desktop-only on OHOS mobile form — menu is a desktop-form feature (not initialised on mobile builds) |
| 230 | @tauri-apps/api/tray.TrayIcon.new | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 231 | @tauri-apps/api/tray.TrayIcon.new_with_id | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 232 | @tauri-apps/api/tray.TrayIcon.getById | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 233 | @tauri-apps/api/tray.TrayIcon.getById_not_found | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 234 | @tauri-apps/api/tray.TrayIcon.removeById | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 235 | @tauri-apps/api/tray.TrayIcon.setIcon | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 236 | @tauri-apps/api/tray.TrayIcon.setIcon_null | ⏭️ | 18ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 237 | @tauri-apps/api/tray.TrayIcon.setMenu | ⏭️ | 29ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 238 | @tauri-apps/api/tray.TrayIcon.setMenu_null | ⏭️ | 17ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 239 | @tauri-apps/api/tray.TrayIcon.setTooltip | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 240 | @tauri-apps/api/tray.TrayIcon.setTitle | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 241 | @tauri-apps/api/tray.TrayIcon.setVisible | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 242 | @tauri-apps/api/tray.TrayIcon.setTempDirPath | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 243 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 244 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_true | ⏭️ | 14ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 245 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_false | ⏭️ | 18ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 246 | @tauri-apps/api/tray.TrayIcon.setIconAsTemplate_toggle | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 247 | @tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 248 | @tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 249 | @tauri-apps/api/tray.TrayIcon.new_with_full_options | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 250 | @tauri-apps/api/tray.TrayIcon.removeById_then_recreate | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 251 | @tauri-apps/api/tray.TrayIcon.setMenu_replace | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 252 | @tauri-apps/api/tray.TrayIcon.setQuickOperation | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 253 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_null | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 254 | @tauri-apps/api/tray.TrayIcon.setQuickOperation_update | ⏭️ | 20ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 255 | @tauri-apps/api/tray.TrayIcon.event_handler_register | ⏭️ | 25ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 256 | @tauri-apps/api/tray.TrayIcon.cleanup | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 257 | @tauri-apps/api/tray.TrayIcon.full_test_tray | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 258 | @tauri-apps/api/tray.TrayIcon.tray_event_chain | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 259 | @tauri-apps/api/tray.TrayIcon.tray_menu_item_click | ⏭️ | 16ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 260 | @tauri-apps/api/tray.TrayIcon.tray_multi_item_menu | ⏭️ | 15ms | desktop-only on OHOS mobile form — tray is a desktop-form feature (not initialised on mobile builds) |
| 261 | ohos-adapter.monitor.real-size | ⏭️ | 15ms | desktop-only on OHOS mobile form — currentMonitor is upstream cfg(desktop) and absent from the mobile build |
| 262 | ohos-adapter.monitor.refresh-rate | ✅ | 544ms |  |
| 263 | ohos-init.chain.window-menu-tray | ✅ | 82ms |  |
| 264 | @tauri-apps/plugin-os.type | ✅ | 30ms |  |
| 265 | @tauri-apps/plugin-os.family | ✅ | 35ms |  |
| 266 | @tauri-apps/plugin-os.arch | ✅ | 43ms |  |
| 267 | @tauri-apps/plugin-os.eol | ✅ | 57ms |  |
| 268 | @tauri-apps/plugin-os.exeExtension | ✅ | 32ms |  |
| 269 | @tauri-apps/plugin-os.version | ✅ | 25ms |  |
| 270 | @tauri-apps/plugin-os.locale | ✅ | 74ms |  |
| 271 | @tauri-apps/plugin-os.hostname | ✅ | 61ms |  |
| 272 | @tauri-apps/plugin-notification.onAction register | ✅ | 59ms |  |
| 273 | @tauri-apps/plugin-notification.onNotificationReceived register | ✅ | 49ms |  |
| 274 | @tauri-apps/plugin-notification.registerActionTypes | ✅ | 34ms |  |
| 275 | @tauri-apps/plugin-clipboard-manager.writeHtml | ✅ | 56ms |  |
| 276 | @tauri-apps/plugin-clipboard-manager.clear | ✅ | 42ms |  |
| 277 | @tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip | ✅ | 160ms |  |
| 278 | plugin-biometric.status | ✅ | 162ms |  |
| 279 | plugin-nfc.is_available | ✅ | 53ms |  |
| 280 | plugin-barcode-scanner.check_permissions | ✅ | 46ms |  |
| 281 | plugin-geolocation.check_permissions | ✅ | 37ms |  |
| 282 | plugin-haptics.selection_feedback (routing smoke) | ✅ | 42ms |  |
| 283 | plugin-notification.registerListener | ✅ | 48ms |  |
| 284 | @tauri-apps/plugin-screenshot.captureWebview | ✅ | 787ms |  |
| 285 | @tauri-apps/plugin-screenshot.pickColorAt (red block) | ✅ | 1411ms |  |
| 286 | @tauri-apps/plugin-screenshot.pickColorAt (out of bounds) | ✅ | 1361ms |  |
| 287 | @tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch) | ✅ | 150ms |  |
| 288 | @tauri-apps/plugin-continuation.getContinuationData (normal launch) | ✅ | 72ms |  |
| 289 | @tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget) | ✅ | 184ms |  |
| 290 | window.setFullscreen diag (main window) | ⏭️ | 17ms | desktop-only on OHOS mobile form — the isFullscreen/setFullscreen window commands are upstream cfg(desktop) and absent from the mobile build |
| 291 | window.createUIAbilityWindow (webview registered + new instance IPC) | ⏭️ | 41ms | UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): spawning an additional UIAbility window is only supported on the desktop (PC/2in1) form — this is a mobile-form build |
| 292 | window.createUIAbilityWindowRacyAttrs (issue-7 repro) | ⏭️ | 41ms | UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): spawning an additional UIAbility window is only supported on the desktop (PC/2in1) form — this is a mobile-form build |
| 293 | window.createFloatWindowRacyAttrs (float creation race) | ✅ | 2494ms |  |
| 294 | window.setInnerSize actually resizes (main window) | ⏭️ | 66ms | desktop-only on OHOS mobile form — phone main window is full-screen: resize-inner cannot land (tao warns "precise decor unavailable" — Mate 70 r5-live.log ×10) — the exact-readback acceptance of issue#97 needs freeform resize, a PC/2in1 capability; the generic setSize path stays covered by the earlier window.set_size case |
| 295 | window.setInnerSize save/restore zero drift (5 rounds) | ⏭️ | 50ms | desktop-only on OHOS mobile form — phone main window is full-screen: resize-inner cannot land (tao warns "precise decor unavailable") — the zero-drift read-back loop of issue#97 needs freeform resize, a PC/2in1 capability |
| 296 | float window setInnerSize exact readback (decor=0) | ⏭️ | 28ms | desktop-only on OHOS mobile form — create_borderless_window (the Float-window creator used here) is cfg(desktop)-gated in cmd.rs since e2fb524c7 — Float windows work on mobile, but this creator command is desktop-only |
| 297 | window.setOuterPosition smoke (move unverifiable from JS) | ✅ | 676ms |  |
| 298 | window.maximize fills monitor | ⏭️ | 95ms | desktop-only on OHOS mobile form — the maximize window command is upstream cfg(desktop) and absent from the mobile build |
| 299 | window.setFullscreen smoke (effect unverifiable from JS) | ⏭️ | 64ms | desktop-only on OHOS mobile form — the setFullscreen window command is upstream cfg(desktop) and absent from the mobile build |
| 300 | window.minimize smoke (effect unverifiable from JS) | ⏭️ | 87ms | desktop-only on OHOS mobile form — the minimize window command is upstream cfg(desktop) and absent from the mobile build |
| 301 | window.setAlwaysOnTop smoke (OHOS partial: flag only, no z-order API) | ⏭️ | 89ms | desktop-only on OHOS mobile form — the setAlwaysOnTop window command is upstream cfg(desktop) and absent from the mobile build |
| 302 | window.setIgnoreCursorEvents smoke | ⏭️ | 44ms | desktop-only on OHOS mobile form — the setIgnoreCursorEvents window command is upstream cfg(desktop) and absent from the mobile build |
| 303 | window decoration flags smoke (D group, main window no-op) | ⏭️ | 28ms | desktop-only on OHOS mobile form — the setClosable/setMaximizable/setMinimizable window commands are upstream cfg(desktop) and absent from the mobile build |
| 304 | window Float kind-branch ops (D11: decorations/flags/minimize/show) | ⏭️ | 19ms | desktop-only on OHOS mobile form — the branch ops exercised here (setDecorations/minimize/decoration flags) are upstream cfg(desktop) window commands absent from the mobile build |
| 305 | window cursor smoke (E group, no getter) | ⏭️ | 20ms | desktop-only on OHOS mobile form — the setCursorVisible/setCursorIcon/setCursorPosition window commands are upstream cfg(desktop) and absent from the mobile build |
| 306 | window.setContentProtection (demo cmd) | ✅ | 390ms |  |
| 307 | fs watchImmediate: 文件创建事件 + unwatch | ✅ | 599ms |  |
| 308 | shell execute: sh -c echo（子进程执行 + stdout + 退出码） | ⏭️ | 41ms | desktop-only on OHOS mobile form — the phone app sandbox denies exec of system binaries (EACCES os error 13) — /bin/sh exists on device but the mobile-form sandbox policy refuses it; the same case passes on the 2in1 desktop form |
| 309 | shell spawn + stdin_write + kill（交互式子进程全生命周期） | ⏭️ | 23ms | desktop-only on OHOS mobile form — the phone app sandbox denies exec of system binaries (EACCES os error 13) — /bin/sh exists on device but the mobile-form sandbox policy refuses it; the same case passes on the 2in1 desktop form |
| 310 | @tauri-apps/plugin-stronghold initialize + store round-trip | ✅ | 209ms |  |
| 311 | @tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519) | ✅ | 203ms |  |

---

*Report generated at end of test run.*
