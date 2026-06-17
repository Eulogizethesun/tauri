import picker from '@ohos.file.picker';
import promptAction from '@ohos.promptAction';
import { Plugin, Invoke } from '@tauri/app';

interface FileFilter {
  name?: string;
  extensions?: string[];
}

interface OpenArgs {
  multiple?: boolean;
  filters?: FileFilter[];
  defaultPath?: string;
  title?: string;
}

interface SaveArgs {
  filters?: FileFilter[];
  defaultPath?: string;
  title?: string;
  fileName?: string;
}

interface MessageArgs {
  title?: string;
  message?: string;
  type?: string;
  okButtonLabel?: string;
  noButtonLabel?: string;
  cancelButtonLabel?: string;
}

export class DialogPlugin extends Plugin {
  getCommands(): Map<string, (invoke: Invoke) => void> {
    const commands: Map<string, (invoke: Invoke) => void> = new Map();
    commands.set('showFilePicker', (invoke: Invoke): void => { this.handleOpen(invoke); });
    commands.set('saveFileDialog', (invoke: Invoke): void => { this.handleSave(invoke); });
    commands.set('showMessageDialog', (invoke: Invoke): void => { this.handleMessage(invoke); });
    return commands;
  }

  private handleOpen(invoke: Invoke): void {
    const argsStr = invoke.parseArgs();
    console.info('[DialogPlugin] showFilePicker args: ' + argsStr);
    const args: OpenArgs = JSON.parse(argsStr) as OpenArgs;
    const multiple = args.multiple ?? false;
    this.showDocumentPicker(invoke, multiple);
  }

  private handleSave(invoke: Invoke): void {
    const argsStr = invoke.parseArgs();
    console.info('[DialogPlugin] saveFileDialog args: ' + argsStr);
    const args: SaveArgs = JSON.parse(argsStr) as SaveArgs;
    const fileName = args.fileName ?? 'untitled';
    this.showSavePicker(invoke, fileName);
  }

  private handleMessage(invoke: Invoke): void {
    const argsStr = invoke.parseArgs();
    console.info('[DialogPlugin] showMessageDialog args: ' + argsStr);
    const args: MessageArgs = JSON.parse(argsStr) as MessageArgs;
    const title = args.title ?? '';
    const message = args.message ?? '';
    const buttons: string[] = [];
    if (args.okButtonLabel != null) {
      buttons.push(args.okButtonLabel);
    }
    if (args.noButtonLabel != null) {
      buttons.push(args.noButtonLabel);
    }
    if (args.cancelButtonLabel != null) {
      buttons.push(args.cancelButtonLabel);
    }
    if (buttons.length === 0) {
      buttons.push('OK');
    }
    this.showMessageBox(invoke, title, message, buttons);
  }

  private async showDocumentPicker(invoke: Invoke, multiple: boolean): Promise<void> {
    try {
      console.info('[DialogPlugin] showDocumentPicker multiple=' + multiple);
      const documentPicker = new picker.DocumentViewPicker();
      const options: picker.DocumentSelectOptions = {
        maxSelectNumber: multiple ? 10 : 1
      };

      const result = await documentPicker.select(options);
      console.info('[DialogPlugin] documentPicker result: ' + JSON.stringify(result));
      if (result && result.length > 0) {
        invoke.resolve(JSON.stringify({ files: result }));
      } else {
        invoke.reject('File picker cancelled');
      }
    } catch (e) {
      const err = e as Error;
      console.error('[DialogPlugin] showDocumentPicker error: ' + err.message);
      invoke.reject('Document picker failed: ' + err.message);
    }
  }

  private async showSavePicker(invoke: Invoke, fileName: string): Promise<void> {
    try {
      console.info('[DialogPlugin] showSavePicker fileName=' + fileName);
      const documentPicker = new picker.DocumentViewPicker();
      const options: picker.DocumentSaveOptions = {
        newFileNames: [fileName]
      };

      const result = await documentPicker.save(options);
      console.info('[DialogPlugin] savePicker result: ' + JSON.stringify(result));
      if (result && result.length > 0) {
        invoke.resolve(JSON.stringify({ file: result[0] }));
      } else {
        invoke.reject('Save cancelled');
      }
    } catch (e) {
      const err = e as Error;
      console.error('[DialogPlugin] showSavePicker error: ' + err.message);
      invoke.reject('Save picker failed: ' + err.message);
    }
  }

  private async showMessageBox(invoke: Invoke, title: string, message: string, buttons: string[]): Promise<void> {
    try {
      console.info('[DialogPlugin] showMessageBox title=' + title + ', message=' + message);
      const buttonOptions: promptAction.Button[] = buttons.map((text: string): promptAction.Button => {
        return { text: text, color: '#1890FF' };
      });

      const result = await promptAction.showDialog({
        title: title,
        message: message,
        buttons: buttonOptions
      });

      const buttonText = buttons[result.index];
      console.info('[DialogPlugin] messageBox result: ' + buttonText);
      invoke.resolve(JSON.stringify({ value: buttonText }));
    } catch (e) {
      const err = e as Error;
      console.error('[DialogPlugin] showMessageBox error: ' + err.message);
      invoke.reject('Message box failed: ' + err.message);
    }
  }
}

export default DialogPlugin;