import { notificationManager } from '@kit.NotificationKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Plugin, Invoke } from '@tauri/app';

// ─── Types ───

interface NotificationData {
  id?: number;
  channelId?: string;
  title?: string;
  body?: string;
  schedule?: object;
  largeBody?: string;
  summary?: string;
  actionTypeId?: string;
  group?: string;
  groupSummary?: boolean;
  sound?: string;
  inboxLines?: string[];
  icon?: string;
  largeIcon?: string;
  iconColor?: string;
  attachments?: object[];
  extra?: Record<string, Object>;
  ongoing?: boolean;
  autoCancel?: boolean;
  silent?: boolean;
}

interface ChannelConfig {
  id: string;
  name: string;
  description?: string;
  importance?: number;
  sound?: string;
  lights?: boolean;
  lightColor?: string;
  vibration?: boolean;
  visibility?: number;
  slotType: notificationManager.SlotType;
}

interface ChannelPayload {
  id: string;
  name: string;
  description?: string;
  importance?: number;
  sound?: string;
  lights?: boolean;
  lightColor?: string;
  vibration?: boolean;
  visibility?: number;
}

interface NotificationIdRef {
  id: number;
}

interface BatchArgs {
  notifications: NotificationData[];
}

interface CancelArgs {
  notifications: number[];
}

interface RemoveActiveArgs {
  notifications: NotificationIdRef[];
}

interface DeleteChannelArgs {
  id: string;
}

// ─── Importance → SlotType mapping ───

function importanceToSlotType(importance: number | undefined): notificationManager.SlotType {
  switch (importance) {
    case 4: // Importance.High
      return notificationManager.SlotType.SOCIAL_COMMUNICATION;
    case 3: // Importance.Default
      return notificationManager.SlotType.SERVICE_INFORMATION;
    case 2: // Importance.Low
      return notificationManager.SlotType.CONTENT_INFORMATION;
    default: // Importance.Min(1), None(0), undefined
      return notificationManager.SlotType.OTHER_TYPES;
  }
}

// ─── Plugin Implementation ───

export class NotificationPlugin extends Plugin {
  private channelMap: Map<string, ChannelConfig> = new Map();
  // Track SlotType usage to prevent shared slots from being removed prematurely
  private slotTypeRefCount: Map<number, number> = new Map();

  getCommands(): Map<string, (invoke: Invoke) => void> {
    const commands: Map<string, (invoke: Invoke) => void> = new Map();
    commands.set('show', (invoke: Invoke): void => { this.handleShow(invoke); });
    commands.set('batch', (invoke: Invoke): void => { this.handleBatch(invoke); });
    commands.set('cancel', (invoke: Invoke): void => { this.handleCancel(invoke); });
    commands.set('removeActive', (invoke: Invoke): void => { this.handleRemoveActive(invoke); });
    commands.set('getActive', (invoke: Invoke): void => { invoke.resolve(JSON.stringify([])); });
    commands.set('getPending', (invoke: Invoke): void => { invoke.resolve(JSON.stringify([])); });
    commands.set('requestPermissions', (invoke: Invoke): void => { this.handleRequestPermissions(invoke); });
    commands.set('checkPermissions', (invoke: Invoke): void => { this.handleCheckPermissions(invoke); });
    commands.set('createChannel', (invoke: Invoke): void => { this.handleCreateChannel(invoke); });
    commands.set('deleteChannel', (invoke: Invoke): void => { this.handleDeleteChannel(invoke); });
    commands.set('listChannels', (invoke: Invoke): void => { this.handleListChannels(invoke); });
    commands.set('registerActionTypes', (invoke: Invoke): void => { invoke.resolve(''); });
    return commands;
  }

  // ─── show ───

  private handleShow(invoke: Invoke): void {
    this.publishNotification(invoke);
  }

  private async publishNotification(invoke: Invoke): Promise<void> {
    try {
      const args: NotificationData = JSON.parse(invoke.parseArgs()) as NotificationData;
      const id = args.id ?? 0;

      const request: notificationManager.NotificationRequest = {
        id: id,
        content: this.buildContent(args),
        tapDismissed: args.autoCancel !== false
      };

      // channel_id → SlotType lookup
      if (args.channelId != null) {
        const channelConfig = this.channelMap.get(args.channelId);
        if (channelConfig != null) {
          request.notificationSlotType = channelConfig.slotType;
        } else {
          console.warn('[NotificationPlugin] channelId "' + args.channelId + '" not found in local mapping');
        }
      }

      // sound: must be rawfile name or sandbox URI
      if (args.sound != null) {
        request.sound = args.sound;
      }

      await notificationManager.publish(request);
      invoke.resolve(JSON.stringify(id));
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] publish failed: ' + err.message);
      invoke.reject('Notification publish failed: ' + err.message);
    }
  }

  private buildContent(args: NotificationData): notificationManager.NotificationContent {
    const title = args.title ?? '';
    const text = args.body ?? '';
    const additionalText = args.summary ?? '';

    // long text style when largeBody is present
    if (args.largeBody != null && args.largeBody.length > 0) {
      const longContent: notificationManager.NotificationLongTextContent = {
        title: title,
        text: text,
        additionalText: additionalText,
        longText: args.largeBody,
        briefText: text,
        expandedTitle: title
      };
      const content: notificationManager.NotificationContent = {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_LONG_TEXT,
        longText: longContent
      };
      return content;
    }

    // multiline style when inboxLines present
    if (args.inboxLines != null && args.inboxLines.length > 0) {
      const multiContent: notificationManager.NotificationMultiLineContent = {
        title: title,
        text: text,
        additionalText: additionalText,
        lines: args.inboxLines,
        briefText: args.summary ?? '',
        longTitle: title
      };
      const content: notificationManager.NotificationContent = {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_MULTILINE,
        multiLine: multiContent
      };
      return content;
    }

    // default: basic text
    const basicContent: notificationManager.NotificationBasicContent = {
      title: title,
      text: text,
      additionalText: additionalText
    };
    const content: notificationManager.NotificationContent = {
      notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
      normal: basicContent
    };
    return content;
  }

  // ─── batch ───

  private handleBatch(invoke: Invoke): void {
    this.publishBatch(invoke);
  }

  private async publishBatch(invoke: Invoke): Promise<void> {
    try {
      const args: BatchArgs = JSON.parse(invoke.parseArgs()) as BatchArgs;
      const notifications: NotificationData[] = Array.isArray(args) ? args as NotificationData[] : args.notifications;
      const ids: number[] = [];

      // Start auto-IDs at 10000 to avoid conflicts with user-defined IDs (typically small numbers)
      let nextAutoId: number = 10000;

      for (const data of notifications) {
        const id = data.id ?? nextAutoId++;
        const request: notificationManager.NotificationRequest = {
          id: id,
          content: this.buildContent(data),
          tapDismissed: data.autoCancel !== false
        };

        if (data.channelId != null) {
          const channelConfig = this.channelMap.get(data.channelId);
          if (channelConfig != null) {
            request.notificationSlotType = channelConfig.slotType;
          }
        }

        if (data.sound != null) {
          request.sound = data.sound;
        }

        await notificationManager.publish(request);
        ids.push(id);
      }

      invoke.resolve(JSON.stringify(ids));
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] batch failed: ' + err.message);
      invoke.reject('Batch publish failed: ' + err.message);
    }
  }

  // ─── cancel ───

  private handleCancel(invoke: Invoke): void {
    this.cancelNotifications(invoke);
  }

  private async cancelNotifications(invoke: Invoke): Promise<void> {
    try {
      const argsStr = invoke.parseArgs();

      if (argsStr === '' || argsStr === 'null' || argsStr === '{}') {
        // cancelAll
        await notificationManager.cancelAll();
        invoke.resolve('');
        return;
      }

      const args: CancelArgs = JSON.parse(argsStr) as CancelArgs;
      const notifications: number[] = args.notifications;

      if (notifications != null && notifications.length > 0) {
        for (const id of notifications) {
          try {
            await notificationManager.cancel(id);
          } catch (cancelErr) {
            // Silently ignore if notification doesn't exist (OHOS throws, Android doesn't)
            console.warn('[NotificationPlugin] cancel id=' + id + ' failed (may not exist): ' + (cancelErr as BusinessError).message);
          }
        }
      } else {
        await notificationManager.cancelAll();
      }

      invoke.resolve('');
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] cancel failed: ' + err.message);
      invoke.reject('Cancel failed: ' + err.message);
    }
  }

  // ─── removeActive ───

  private handleRemoveActive(invoke: Invoke): void {
    this.removeActive(invoke);
  }

  private async removeActive(invoke: Invoke): Promise<void> {
    try {
      const argsStr = invoke.parseArgs();

      if (argsStr === '' || argsStr === 'null' || argsStr === '{}') {
        await notificationManager.cancelAll();
        invoke.resolve('');
        return;
      }

      const args: RemoveActiveArgs = JSON.parse(argsStr) as RemoveActiveArgs;
      const notifications: NotificationIdRef[] = args.notifications;

      if (notifications != null && notifications.length > 0) {
        for (const n of notifications) {
          try {
            await notificationManager.cancel(n.id);
          } catch (cancelErr) {
            // Silently ignore if notification doesn't exist
            console.warn('[NotificationPlugin] removeActive id=' + n.id + ' failed (may not exist): ' + (cancelErr as BusinessError).message);
          }
        }
      } else {
        await notificationManager.cancelAll();
      }

      invoke.resolve('');
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] removeActive failed: ' + err.message);
      invoke.reject('Remove active failed: ' + err.message);
    }
  }

  // ─── requestPermissions ───

  private handleRequestPermissions(invoke: Invoke): void {
    this.requestPermissions(invoke);
  }

  private async requestPermissions(invoke: Invoke): Promise<void> {
    try {
      // Check current state first
      const isEnabled = await notificationManager.isNotificationEnabled();
      if (isEnabled) {
        invoke.resolve(JSON.stringify({ permissionState: 'granted' }));
        return;
      }

      // Request permission — requires UIAbilityContext from Plugin base class
      if (this.context != null) {
        await notificationManager.requestEnableNotification(this.context);
      } else {
        console.warn('[NotificationPlugin] UIAbilityContext not available. User must enable notifications in system settings.');
        invoke.resolve(JSON.stringify({ permissionState: 'denied' }));
        return;
      }
      // Re-check actual state after request (user may have denied)
      const nowEnabled = await notificationManager.isNotificationEnabled();
      const state = nowEnabled ? 'granted' : 'denied';
      invoke.resolve(JSON.stringify({ permissionState: state }));
    } catch (e) {
      const err = e as BusinessError;
      if (err.code === 1600004) {
        // User previously denied — cannot re-prompt
        console.warn('[NotificationPlugin] Notification permission previously denied. User must enable in system settings.');
        invoke.resolve(JSON.stringify({ permissionState: 'denied' }));
      } else {
        console.error('[NotificationPlugin] requestPermissions failed: code=' + err.code + ', message=' + err.message);
        invoke.reject('requestPermissions failed: code=' + err.code + ', message=' + err.message);
      }
    }
  }

  // ─── checkPermissions ───

  private handleCheckPermissions(invoke: Invoke): void {
    this.checkPermissions(invoke);
  }

  private async checkPermissions(invoke: Invoke): Promise<void> {
    try {
      const isEnabled = await notificationManager.isNotificationEnabled();
      const state = isEnabled ? 'granted' : 'denied';
      invoke.resolve(JSON.stringify({ permissionState: state }));
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] checkPermissions failed: ' + err.message);
      invoke.resolve(JSON.stringify({ permissionState: 'denied' }));
    }
  }

  // ─── createChannel ───

  private handleCreateChannel(invoke: Invoke): void {
    this.createChannel(invoke);
  }

  private async createChannel(invoke: Invoke): Promise<void> {
    try {
      const args: ChannelPayload = JSON.parse(invoke.parseArgs()) as ChannelPayload;
      const slotType = importanceToSlotType(args.importance);

      // If overwriting existing channel with different SlotType, decrement old refCount
      const oldConfig = this.channelMap.get(args.id);
      if (oldConfig != null && oldConfig.slotType !== slotType) {
        const oldCount = this.slotTypeRefCount.get(oldConfig.slotType) ?? 1;
        if (oldCount <= 1) {
          this.slotTypeRefCount.delete(oldConfig.slotType);
        } else {
          this.slotTypeRefCount.set(oldConfig.slotType, oldCount - 1);
        }
      }

      // Track SlotType usage — warn if shared with another channel
      const existingCount = this.slotTypeRefCount.get(slotType) ?? 0;
      if (existingCount > 0) {
        console.warn('[NotificationPlugin] SlotType ' + slotType + ' already used by ' + existingCount + ' channel(s). ' +
          'OHOS only has 4 SlotType values; channels sharing the same SlotType will overwrite each other\'s system config.');
      }
      this.slotTypeRefCount.set(slotType, existingCount + 1);

      // Create the slot in the system (uses default config)
      await notificationManager.addSlot(slotType);

      // Store full config in local mapping table
      const config: ChannelConfig = {
        id: args.id,
        name: args.name,
        description: args.description,
        importance: args.importance,
        sound: args.sound,
        lights: args.lights,
        lightColor: args.lightColor,
        vibration: args.vibration,
        visibility: args.visibility,
        slotType: slotType
      };
      this.channelMap.set(args.id, config);

      invoke.resolve('');
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] createChannel failed: ' + err.message);
      invoke.reject('Create channel failed: ' + err.message);
    }
  }

  // ─── deleteChannel ───

  private handleDeleteChannel(invoke: Invoke): void {
    this.deleteChannel(invoke);
  }

  private async deleteChannel(invoke: Invoke): Promise<void> {
    try {
      const args: DeleteChannelArgs = JSON.parse(invoke.parseArgs()) as DeleteChannelArgs;

      const config = this.channelMap.get(args.id);
      if (config != null) {
        // Only remove system slot when no other channels share this SlotType
        const count = this.slotTypeRefCount.get(config.slotType) ?? 1;
        if (count <= 1) {
          await notificationManager.removeSlot(config.slotType);
          this.slotTypeRefCount.delete(config.slotType);
        } else {
          this.slotTypeRefCount.set(config.slotType, count - 1);
          console.warn('[NotificationPlugin] SlotType ' + config.slotType + ' still used by ' + (count - 1) + ' other channel(s), keeping system slot.');
        }
        this.channelMap.delete(args.id);
      }
      // Idempotent: no error if channel doesn't exist

      invoke.resolve('');
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] deleteChannel failed: ' + err.message);
      invoke.reject('Delete channel failed: ' + err.message);
    }
  }

  // ─── listChannels ───

  private handleListChannels(invoke: Invoke): void {
    this.listChannels(invoke);
  }

  private async listChannels(invoke: Invoke): Promise<void> {
    try {
      const systemSlots = await notificationManager.getSlots();
      const channels: ChannelPayload[] = [];

      // Collect local configs into an array for iteration (avoid Map.forEach type issues in ArkTS)
      const localConfigs: ChannelConfig[] = [];
      const configKeys: string[] = [];
      for (const key of this.channelMap.keys()) {
        configKeys.push(key);
      }
      for (let i = 0; i < configKeys.length; i++) {
        const val = this.channelMap.get(configKeys[i]);
        if (val != null) {
          localConfigs.push(val);
        }
      }

      // Merge system slots with local mapping
      for (const slot of systemSlots) {
        // Find local config by matching slotType
        let matchedConfig: ChannelConfig | undefined = undefined;
        for (let j = 0; j < localConfigs.length; j++) {
          if (localConfigs[j].slotType === slot.notificationType) {
            matchedConfig = localConfigs[j];
            break;
          }
        }

        const ch: ChannelPayload = {
          id: matchedConfig != null ? matchedConfig.id : ('slot_' + slot.notificationType),
          name: matchedConfig != null ? matchedConfig.name : ('Channel ' + slot.notificationType),
        };
        // Always set importance to avoid undefined fields in JSON (serde deserialization requires it)
        ch.importance = matchedConfig != null && matchedConfig.importance != null ? matchedConfig.importance : 3; // Default importance
        if (matchedConfig != null) {
          ch.description = matchedConfig.description;
          ch.sound = matchedConfig.sound;
          ch.lights = matchedConfig.lights;
          ch.lightColor = matchedConfig.lightColor;
          ch.vibration = matchedConfig.vibration;
          ch.visibility = matchedConfig.visibility;
        }
        channels.push(ch);
      }

      // Include local-only channels that don't have a system slot yet
      for (let k = 0; k < localConfigs.length; k++) {
        const config = localConfigs[k];
        let found = false;
        for (let m = 0; m < channels.length; m++) {
          if (channels[m].id === config.id) {
            found = true;
            break;
          }
        }
        if (!found) {
          const localCh: ChannelPayload = {
            id: config.id,
            name: config.name,
          };
          localCh.importance = config.importance != null ? config.importance : 3;
          localCh.description = config.description;
          localCh.sound = config.sound;
          localCh.lights = config.lights;
          localCh.lightColor = config.lightColor;
          localCh.vibration = config.vibration;
          localCh.visibility = config.visibility;
          channels.push(localCh);
        }
      }

      invoke.resolve(JSON.stringify(channels));
    } catch (e) {
      const err = e as BusinessError;
      console.error('[NotificationPlugin] listChannels failed: ' + err.message);
      invoke.reject('List channels failed: ' + err.message);
    }
  }
}

export default NotificationPlugin;
