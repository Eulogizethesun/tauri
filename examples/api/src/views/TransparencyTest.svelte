<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'

  let { onMessage } = $props()

  // Test: Create a transparent borderless SubWindow sub-window
  async function testCreateTransparentWindow() {
    try {
      await invoke('create_transparent_borderless_window', {
        windowId: 'transparency_test_' + Date.now()
      })
      onMessage('✅ Transparent borderless window created — check if background is see-through')
    } catch (e) {
      onMessage('❌ Error creating transparent window: ' + e)
    }
  }

  // Test: Create a transparent SubWindow sub-window with default decorations (bordered)
  async function testCreateTransparentBorderedWindow() {
    try {
      await invoke('create_transparent_window', {
        windowId: 'transparency_bordered_' + Date.now()
      })
      onMessage('✅ Transparent bordered window created — check if content area is see-through')
    } catch (e) {
      onMessage('❌ Error creating transparent bordered window: ' + e)
    }
  }

  const testCards = [
    {
      id: 'create-transparent',
      icon: '🪟',
      title: '创建透明无边框窗口',
      desc: '创建 SubWindow 子窗口 (transparent: true + decorations: false)，验证窗口背景透明可见桌面内容',
      fn: testCreateTransparentWindow,
      category: 'manual'
    },
    {
      id: 'create-transparent-bordered',
      icon: '🪟',
      title: '创建透明有边框窗口',
      desc: '创建 SubWindow 子窗口 (transparent: true，保留默认 decorations)，验证透明效果在有标题栏时的表现',
      fn: testCreateTransparentBorderedWindow,
      category: 'manual'
    }
  ]
</script>

<div class="transparency-test">
  <p class="desc">
    WebView 容器透明背景测试。使用 <code>transparent: true</code> 创建 SubWindow 子窗口验证穿透效果。
    <br><strong>⚠️ OHOS 平台限制：</strong>主窗口 Web 引擎渲染表面不支持透明，仅 SubWindow 子窗口可完整穿透到桌面。
  </p>

  <div class="cards">
    {#each testCards as card (card.id)}
      <div class="card">
        <div class="card-header">
          <span class="card-icon">{card.icon}</span>
          <div class="card-title-group">
            <h3 class="card-title">{card.title}</h3>
            <span class="card-category">{card.category}</span>
          </div>
        </div>
        <p class="card-desc">{card.desc}</p>
        <button class="btn" onclick={card.fn}>
          {card.icon} 执行测试
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .transparency-test {
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
    font-size: 0.85em;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .card {
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 12px;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .card:hover {
    border-color: rgba(128, 128, 128, 0.4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .card-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .card-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .card-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }

  .card-category {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.5;
  }

  .card-desc {
    font-size: 0.82rem;
    color: var(--text-secondary, #666);
    line-height: 1.4;
    margin: 0;
    flex: 1;
  }

  .btn {
    align-self: flex-start;
    padding: 0.45rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(128, 128, 128, 0.3);
    background: rgba(0, 0, 0, 0.04);
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s;
    margin-top: 0.3rem;
  }

  .btn:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .btn:active {
    background: rgba(0, 0, 0, 0.12);
  }

  :global(html.dark) .card {
    border-color: rgba(255, 255, 255, 0.1);
  }

  :global(html.dark) .card:hover {
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  :global(html.dark) .desc code {
    background: rgba(255, 255, 255, 0.08);
  }

  :global(html.dark) .btn {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: inherit;
  }

  :global(html.dark) .btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
