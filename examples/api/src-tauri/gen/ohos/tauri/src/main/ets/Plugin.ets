export interface Invoke {
  parseArgs(): string;
  resolve(result: string): void;
  reject(error: string): void;
}

export type CommandHandler = (invoke: Invoke) => void;

export abstract class Plugin {
  abstract getCommands(): Map<string, CommandHandler>;
}

export default Plugin;