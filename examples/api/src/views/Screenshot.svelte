<script lang="ts">
  import { captureWebview, pickColorAt } from '@tauri-apps/plugin-screenshot'

  let { onMessage } = $props()

  let previewSrc = $state('')
  let capturedInfo = $state('')
  let pickedColor = $state('')
  let busy = $state(false)

  const blocks = [
    { label: '#FF0000', color: '#ff0000' },
    { label: '#00FF00', color: '#00ff00' },
    { label: '#0000FF', color: '#0000ff' },
    { label: '#FFFFFF', color: '#ffffff' },
    { label: '#000000', color: '#000000' },
  ]

  async function testCapture() {
    busy = true
    try {
      const image = await captureWebview()
      previewSrc = `data:image/png;base64,${image.pngBase64}`
      capturedInfo = `${image.width}×${image.height} px, base64 ${image.pngBase64.length} chars`
      onMessage(`✅ captureWebview: ${capturedInfo}`)
    } catch (e) {
      previewSrc = ''
      capturedInfo = ''
      onMessage(`❌ captureWebview failed: ${e}`)
    } finally {
      busy = false
    }
  }

  async function testPickColor(color: string, event: MouseEvent) {
    busy = true
    try {
      // The block's center in CSS pixels, scaled to snapshot pixels via the ratio
      // captureWidth / innerWidth (the snapshot is at physical resolution).
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const cssX = rect.left + rect.width / 2
      const cssY = rect.top + rect.height / 2
      const image = await captureWebview()
      const scale = image.width / window.innerWidth
      const x = Math.round(cssX * scale)
      const y = Math.round(cssY * scale)
      const c = await pickColorAt(x, y)
      pickedColor = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a}) @ snapshot(${x}, ${y}) — block ${color}`
      onMessage(`✅ pickColorAt(${x}, ${y}) on ${color}: rgba(${c.r},${c.g},${c.b},${c.a})`)
    } catch (e) {
      pickedColor = ''
      onMessage(`❌ pickColorAt failed: ${e}`)
    } finally {
      busy = false
    }
  }
</script>

<div class="screenshot-demo">
  <p class="desc">
    应用内 webview 截图与取色测试（OHOS 专属插件 <code>tauri-plugin-screenshot</code>）。
    <br>截图走 ArkWeb <code>webPageSnapshot</code>（零系统权限）；取色读取快图像素（BGRA→RGBA）。
    <br><strong>⚠️ 坐标系：</strong>取色使用快照物理像素坐标，页面按 captureWidth/innerWidth 比例换算。
  </p>

  <div class="actions">
    <button class="btn" onclick={testCapture} disabled={busy}>📷 截图预览</button>
    {#if capturedInfo}
      <span class="info">{capturedInfo}</span>
    {/if}
  </div>

  {#if previewSrc}
    <div class="preview">
      <img src={previewSrc} alt="webview screenshot preview" />
    </div>
  {/if}

  <div class="blocks">
    {#each blocks as block (block.label)}
      <button class="block" style="background: {block.color}" onclick={(e) => testPickColor(block.label, e)} disabled={busy}>
        <span class="block-label" style="color: {block.label === '#000000' || block.label === '#0000FF' || block.label === '#FF0000' ? '#fff' : '#000'}">{block.label}</span>
      </button>
    {/each}
  </div>
  {#if pickedColor}
    <p class="picked">{pickedColor}</p>
  {/if}
</div>

<style>
  .screenshot-demo {
    padding: 0.5rem 0;
  }

  .desc {
    color: var(--text-secondary, #666);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .desc code {
    background: rgba(0, 0, 0, 0.06);
    padding: 0.1em 0.4em;
    border-radius: 4px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.04);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .info {
    color: var(--text-secondary, #666);
    font-size: 0.85rem;
  }

  .preview {
    margin-bottom: 1.5rem;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    overflow: hidden;
    max-width: 480px;
  }

  .preview img {
    display: block;
    width: 100%;
    height: auto;
  }

  .blocks {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .block {
    width: 88px;
    height: 88px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    cursor: crosshair;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 4px;
  }

  .block:disabled {
    cursor: wait;
  }

  .block-label {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .picked {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-secondary, #444);
  }
</style>
