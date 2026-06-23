import { common } from '@kit.AbilityKit';

export interface Invoke {
  parseArgs(): string;
  resolve(result: string): void;
  reject(error: string): void;
}

export type CommandHandler = (invoke: Invoke) => void;

export abstract class Plugin {
  // UIAbilityContext for system API access (e.g. notification permissions).
  // Set by PluginManager.setContext() during EntryAbility.onCreate().
  // Null by default — plugins that need context (like Notification) should
  // check `this.context != null` before using it.
  context: common.UIAbilityContext | null = null;
  abstract getCommands(): Map<string, CommandHandler>;
}

export default Plugin;
