import { abilityAccessCtrl, bundleManager, common, Permissions } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Plugin, Invoke } from '@tauri/app';

// ─── Permission name mapping ───

const PERMISSION_MAP: Record<string, Permissions> = {
  'camera': 'ohos.permission.CAMERA',
  'microphone': 'ohos.permission.MICROPHONE',
};

// ─── Plugin Implementation ───

export class OhosPermissionsPlugin extends Plugin {

  getCommands(): Map<string, (invoke: Invoke) => void> {
    const commands: Map<string, (invoke: Invoke) => void> = new Map();
    commands.set('checkCameraPermission', (invoke: Invoke): void => { this.handleCheck(invoke, 'camera'); });
    commands.set('requestCameraPermission', (invoke: Invoke): void => { this.handleRequest(invoke, 'camera'); });
    commands.set('checkMicrophonePermission', (invoke: Invoke): void => { this.handleCheck(invoke, 'microphone'); });
    commands.set('requestMicrophonePermission', (invoke: Invoke): void => { this.handleRequest(invoke, 'microphone'); });
    return commands;
  }

  // ─── Generic check handler ───

  private handleCheck(invoke: Invoke, permissionKey: string): void {
    this.checkPermission(permissionKey).then((granted: boolean) => {
      invoke.resolve(JSON.stringify(granted));
    }).catch((err: BusinessError) => {
      console.error('[OhosPermissionsPlugin] checkPermission failed for ' + permissionKey + ': ' + err.message);
      invoke.resolve(JSON.stringify(false));
    });
  }

  // ─── Generic request handler ───

  private handleRequest(invoke: Invoke, permissionKey: string): void {
    const ohosPermission = PERMISSION_MAP[permissionKey];
    if (ohosPermission === undefined) {
      invoke.reject('Unknown permission: ' + permissionKey);
      return;
    }

    const permissions: Array<Permissions> = [ohosPermission];
    let atManager: abilityAccessCtrl.AtManager = abilityAccessCtrl.createAtManager();

    if (this.context === undefined || this.context === null) {
      console.error('[OhosPermissionsPlugin] UIAbilityContext not available');
      invoke.reject('UIAbilityContext not available');
      return;
    }

    atManager.requestPermissionsFromUser(this.context, permissions).then((data) => {
      const authResults: number[] = data.authResults;
      if (authResults.length > 0 && authResults[0] === 0) {
        invoke.resolve('');
      } else {
        console.warn('[OhosPermissionsPlugin] Permission ' + permissionKey + ' denied by user.');
        invoke.resolve('');
      }
    }).catch((err: BusinessError) => {
      console.error('[OhosPermissionsPlugin] requestPermissionsFromUser failed: code=' + err.code + ', message=' + err.message);
      invoke.resolve('');
    });
  }

  // ─── Core: check if a permission is granted ───

  private async checkPermission(permissionKey: string): Promise<boolean> {
    const ohosPermission = PERMISSION_MAP[permissionKey];
    if (ohosPermission === undefined) {
      throw new Error('Unknown permission: ' + permissionKey);
    }

    const tokenId = await this.getAccessTokenId();
    const atManager: abilityAccessCtrl.AtManager = abilityAccessCtrl.createAtManager();

    const grantStatus: abilityAccessCtrl.GrantStatus =
      await atManager.checkAccessToken(tokenId, ohosPermission);

    return grantStatus === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
  }

  // ─── Core: get the app's access token ID ───

  private async getAccessTokenId(): Promise<number> {
    const bundleInfo: bundleManager.BundleInfo =
      await bundleManager.getBundleInfoForSelf(
        bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_APPLICATION
      );
    return bundleInfo.appInfo.accessTokenId;
  }
}

export default OhosPermissionsPlugin;
