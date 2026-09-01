<script lang="ts">
  import { isContinuationRestoreLaunch, getContinuationData, setContinuationData } from '@tauri-apps/plugin-continuation'

  let { onMessage } = $props()

  let restoreStatus = $state('')
  let dataText = $state('')
  let busy = $state(false)

  let snapshotInput = $state('{"scrollOffset":120,"route":"/article/42"}')
  let saveResult = $state('')

  async function queryRestore() {
    busy = true
    try {
      const isRestore = await isContinuationRestoreLaunch()
      restoreStatus = isRestore ? '接续恢复启动 ✅' : '普通启动（非接续）'
      onMessage(`✅ isContinuationRestoreLaunch: ${isRestore}`)
    } catch (e) {
      restoreStatus = ''
      onMessage(`❌ isContinuationRestoreLaunch failed: ${e}`)
    } finally {
      busy = false
    }
  }

  async function queryData() {
    busy = true
    try {
      // Consuming API: the first call after a continuation restore returns the
      // payload; every later call returns null. On a normal launch it is null.
      const payload = await getContinuationData()
      if (payload === null) {
        dataText = 'null（非接续启动或已被消费）'
      } else {
        dataText = payload
        try {
          const parsed = JSON.parse(payload)
          onMessage(`✅ getContinuationData (parsed): ${JSON.stringify(parsed, null, 2)}`)
        } catch {
          onMessage(`✅ getContinuationData (raw, not JSON): ${payload}`)
        }
      }
    } catch (e) {
      dataText = ''
      onMessage(`❌ getContinuationData failed: ${e}`)
    } finally {
      busy = false
    }
  }

  async function queryAll() {
    await queryRestore()
    await queryData()
  }

  async function saveSnapshot() {
    busy = true
    saveResult = ''
    try {
      await setContinuationData(snapshotInput)
      saveResult = '已保存 ✅（快照覆盖写，读取为 peek——取消迁移可重试）'
      onMessage(`✅ setContinuationData: ${snapshotInput.length} chars`)
    } catch (e) {
      saveResult = `失败 ❌: ${e}`
      onMessage(`❌ setContinuationData failed: ${e}`)
    } finally {
      busy = false
    }
  }

  async function clearSnapshot() {
    busy = true
    saveResult = ''
    try {
      await setContinuationData('')
      saveResult = '已清空 ✅（空快照 → onContinue 拒绝迁移 MISMATCH）'
      onMessage('✅ setContinuationData("") cleared')
    } catch (e) {
      saveResult = `失败 ❌: ${e}`
      onMessage(`❌ clear failed: ${e}`)
    } finally {
      busy = false
    }
  }

  async function saveOversized() {
    busy = true
    saveResult = ''
    try {
      // 96 KiB + 1 — exceeds the wantParam budget, must reject PayloadTooLarge.
      await setContinuationData('x'.repeat(96 * 1024 + 1))
      saveResult = '意外成功 ❌（超限应被拒绝）'
      onMessage('❌ oversized payload was NOT rejected')
    } catch (e) {
      saveResult = `按预期拒绝 ✅: ${e}`
      onMessage(`✅ oversized rejected: ${e}`)
    } finally {
      busy = false
    }
  }
</script>

<div class="continuation-demo">
  <p class="desc">
    应用接续（OHOS 专属插件 <code>tauri-plugin-continuation</code>，被动恢复 + 源端保存）。
    <br>信号来自 ability 生命周期（<code>launchReason === CONTINUATION</code>），零系统权限、无 bridge。
    <br><strong>⚠️ 消费型 API：</strong><code>getContinuationData</code> 一次消费——首次调用返回接续 payload，之后返回 null；
    <code>isContinuationRestoreLaunch</code> 为 peek，可重复调用。
    <br><strong>源端保存：</strong><code>setContinuationData</code> 预注册快照（覆盖写），系统发起迁移时 <code>onContinue</code>
    同步直读转发（<code>wantParam.continuationData</code>），空快照拒绝迁移（MISMATCH）。
    目标端往返约定：<code>JSON.parse(await getContinuationData()).continuationData</code>。
    <br>主动迁移由系统 UI 独占（超级终端/接续入口）；双设备完整迁移流见 manual_tests.md §三十四。
  </p>

  <div class="actions">
    <button class="btn" onclick={queryAll} disabled={busy}>🔍 查询恢复状态+数据</button>
    <button class="btn" onclick={queryRestore} disabled={busy}>isContinuationRestoreLaunch</button>
    <button class="btn" onclick={queryData} disabled={busy}>getContinuationData</button>
  </div>

  <div class="save-section">
    <strong>源端保存（setContinuationData）</strong>
    <textarea bind:value={snapshotInput} rows="3" class="snapshot-input"></textarea>
    <div class="actions">
      <button class="btn" onclick={saveSnapshot} disabled={busy}>💾 保存快照</button>
      <button class="btn" onclick={clearSnapshot} disabled={busy}>🧹 清空快照（""）</button>
      <button class="btn" onclick={saveOversized} disabled={busy}>🚫 超限测试（96KB+1）</button>
    </div>
    {#if saveResult}
      <div class="result">{saveResult}</div>
    {/if}
  </div>

  {#if restoreStatus}
    <div class="result">
      <strong>isContinuationRestoreLaunch：</strong> {restoreStatus}
    </div>
  {/if}

  {#if dataText}
    <div class="result">
      <strong>getContinuationData：</strong>
      <pre class="payload">{dataText}</pre>
    </div>
  {/if}
</div>

<style>
  .continuation-demo {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .desc {
    opacity: 0.8;
    font-size: 0.9rem;
    line-height: 1.6;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .result {
    padding: 0.75rem;
    border-radius: 6px;
    background: rgba(127, 127, 127, 0.15);
    word-break: break-all;
  }
  .payload {
    margin: 0.5rem 0 0;
    white-space: pre-wrap;
    font-size: 0.85rem;
  }
  .save-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .snapshot-input {
    padding: 0.5rem;
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.85rem;
  }
</style>
