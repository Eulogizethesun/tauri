import { common } from '@kit.AbilityKit';

export interface Invoke {
  parseArgs(): string;
  resolve(result: string): void;
  reject(error: string): void;
}

export type CommandHandler = (invoke: Invoke) => void;

// Channel id wire-format prefix — must match Rust IPC_PAYLOAD_PREFIX ("__CHANNEL__:").
const CHANNEL_PREFIX: string = '__CHANNEL__:';

export abstract class Plugin {
  // UIAbilityContext for system API access (e.g. notification permissions).
  // Set by PluginManager.setContext() during EntryAbility.onCreate().
  // Null by default — plugins that need context (like Notification) should
  // check `this.context != null` before using it.
  context: common.UIAbilityContext | null = null;

  // Static handler bridging ArkTS emit to Rust NAPI (tauri_send_channel_data).
  // Set once by EntryAbility.initTauriPlugins() via Plugin.setEmitHandler().
  private static emitHandler: ((channelId: number, data: string) => void) | null = null;

  abstract getCommands(): Map<string, CommandHandler>;

  // ─── Channel emit mechanism ───

  /**
   * Installs the native bridge callback for emitting channel data to the webview.
   * Called once from EntryAbility.initTauriPlugins() after plugin manager setup.
   * Pass null to uninstall.
   */
  static setEmitHandler(handler: ((channelId: number, data: string) => void) | null): void {
    Plugin.emitHandler = handler;
  }

  /**
   * Sends a JSON-serialized payload to the JS layer via the Tauri IPC Channel
   * identified by `channelId`. The channel must have been registered by the
   * Rust side (register_channel) and the id obtained from the `channel` field
   * of the command payload (parseChannelId).
   *
   * If no emit handler is installed (e.g. webview not ready during cold start),
   * the call is logged and silently dropped.
   */
  emit(channelId: number, payload: object): void {
    if (Plugin.emitHandler != null) {
      try {
        const data: string = JSON.stringify(payload);
        Plugin.emitHandler(channelId, data);
      } catch (e) {
        console.warn('[Plugin] emit failed: ' + (e as Error).message);
      }
    } else {
      console.warn('[Plugin] emit called but no emitHandler installed (channel ' + channelId + ')');
    }
  }

  /**
   * Parses a Tauri IPC channel wire-format string ("__CHANNEL__:123") into the
   * numeric channel id. Returns null if the string does not match the expected
   * format.
   */
  static parseChannelId(channelStr: string): number | null {
    if (channelStr.startsWith(CHANNEL_PREFIX)) {
      const idStr: string = channelStr.substring(CHANNEL_PREFIX.length);
      const id: number = parseInt(idStr, 10);
      if (!isNaN(id)) {
        return id;
      }
    }
    return null;
  }

  /**
   * Called by EntryAbility when a notification action button is clicked
   * (via WantAgent cold-start or onNewWant warm-start). Default implementation
   * is a no-op. Override in plugins that handle notification actions (e.g.
   * NotificationPlugin emits on the "actionPerformed" listener channel).
   */
  onNotificationAction(notificationId: number, actionId: string, actionTypeId: string): void {
    // no-op — override in subclass
  }

  /**
   * Called by PluginManager.notifyForeground() when the host ability transitions
   * to the foreground (EntryAbility.onForeground). Plugins that have pending
   * asynchronous operations whose callbacks may have been lost during the
   * background state — e.g. requestPermissionsFromUser whose dialog causes the
   * ability to go onBackground and freezes the event loop — can override this
   * to check and settle those pending requests by reading the real system state.
   */
  onForeground(): void {
    // no-op — override in subclass
  }
}

export default Plugin;
