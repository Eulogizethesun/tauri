# clipboard-actions spec

## plugin: ohos.clipboard（新建）

Plugin ID: `ohos.clipboard`
Execution: `async`
Context requirement: `ability`（pasteboard 不需要 UIContext）

## 背景

当前 clipboard 仅在 `crates/ability/src/clipboard/mod.rs` 中实现 `clipboard_write_image`（旧 TSFN 模型，非 bridge plugin）。`ClipboardHelper.ets` 只有 `writeImageToClipboard`。文本读写完全缺失。本 phase 新建 `plugin-clipboard` crate，将 clipboard 能力统一到 bridge 插件模型。

## actions

### read-text

| 字段 | 值 |
|------|-----|
| action | `read-text` |
| reqType | `ohos.clipboard.ReadTextRequest` |
| respType | `ohos.clipboard.ReadTextResponse` |

**ReadTextRequest**: `{}`（空结构体）

**ReadTextResponse**: `{ text: Option<String> }`

**ArkTS**：
```typescript
import pasteboard from '@ohos.pasteboard';

const systemPasteboard = pasteboard.getSystemPasteboard();
const data = await systemPasteboard.getData();
const text = data.getPrimaryText();
return { typeName: READ_TEXT_RESPONSE_TYPE, value: { text: text ?? null } };
```

### write-text

| 字段 | 值 |
|------|-----|
| action | `write-text` |
| reqType | `ohos.clipboard.WriteTextRequest` |
| respType | `ohos.clipboard.WriteTextResponse` |

**WriteTextRequest**: `{ text: String }`

**WriteTextResponse**: `{ accepted: bool }`

**ArkTS**：
```typescript
const pasteData = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, request.text);
const systemPasteboard = pasteboard.getSystemPasteboard();
await systemPasteboard.setData(pasteData);
return { typeName: WRITE_TEXT_RESPONSE_TYPE, value: { accepted: true } };
```

### write-image（迁移自 ability/src/clipboard/mod.rs）

| 字段 | 值 |
|------|-----|
| action | `write-image` |
| reqType | `ohos.clipboard.WriteImageRequest` |
| respType | `ohos.clipboard.WriteImageResponse` |

**WriteImageRequest**: `{ rgba: Vec<u8>, width: u32, height: u32 }`

**WriteImageResponse**: `{ accepted: bool }`

**ArkTS**：复用现有 `ClipboardHelper.ets` 的 `writeImageToClipboard` 逻辑：
- `image.createPixelMapSync` 创建 RGBA_8888 PixelMap
- `pm.writeBufferToPixelsSync(jsArr.buffer)` 写入像素
- `pasteboard.createData(pasteboard.MIMETYPE_PIXELMAP, pm)` 创建剪贴板数据
- `systemPasteboard.setData(pasteData)` 写入系统剪贴板
- `pm.release()` 释放 PixelMap

## Rust facade

```rust
pub struct ClipboardBridgePlugin;

impl BridgePlugin for ClipboardBridgePlugin {
    type Mode = AsyncBridge;
    const ID: &'static str = "ohos.clipboard";
    const REQUIRED_CONTEXTS: &'static [BridgeContextRequirement] =
        &[BridgeContextRequirement::Ability];
}

pub struct ClipboardClient { bridge: BridgeRuntime }

impl ClipboardClient {
    pub fn new(app: &OpenHarmonyApp) -> Result<Self>;
    pub async fn read_text(&self) -> Result<Option<String>>;
    pub async fn write_text(&self, text: impl Into<String>) -> Result<()>;
    pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> Result<()>;
}

pub trait ClipboardExt {
    fn clipboard(&self) -> Result<ClipboardClient>;
}
```

## 迁移策略

- `crates/ability/src/clipboard/mod.rs` 的 `clipboard_write_image` 标记 `#[deprecated(note = "use ClipboardClient::write_image via plugin-clipboard")]`。
- `ClipboardHelper.ets` 的 `writeImageToClipboard` 函数保留，由新 `ClipboardPlugin.ets` 内部调用。
- 消费方（clipboard-manager 插件）在 B5 阶段切换到 `ClipboardClient` API。
- `init_clipboard_tsfn` 不再需要（bridge 模型替代 TSFN 直调）。

## ArkTS 插件结构

新建 `plugins/clipboard/` 目录：
```
plugins/clipboard/
  BuildProfile.ets
  index.ets
  src/main/ets/ClipboardPlugin.ets
```

`ClipboardPlugin.ets` 继承 `AsyncPluginBase`，id `"ohos.clipboard"`，`requires: ["ability"]`。在 `invokeAsync` 中分发 `read-text` / `write-text` / `write-image` 三个 action。

## 约束

- `pasteboard` API 全异步（返回 Promise），plugin 必须是 `AsyncBridge`。
- `getData()` 可能返回非文本类型（图片等），`getPrimaryText()` 在非文本时返回空字符串。
- write-image 的 `rgba` 维度校验：`rgba.len() == width * height * 4`，Rust 侧 validate。
- napi `Uint8Array` 传入 ArkTS 后需 copy 到 JS 管理的 buffer（`new Uint8Array(rgbaData.length); jsArr.set(rgbaData)`），因 napi external buffer 可能不被 PixelMap API 正确访问。
