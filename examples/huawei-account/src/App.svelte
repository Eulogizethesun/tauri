<script>
  import { login, silentLogin, logout } from '@tauri-apps/plugin-huawei-account'

  let result = 'No action yet'
  let busy = false

  async function call(fn, label) {
    busy = true
    try {
      const r = await fn()
      result = `${label} → ${JSON.stringify(r)}`
    } catch (e) {
      result = `${label} error → ${String(e)}`
    } finally {
      busy = false
    }
  }
</script>

<main style="font-family: sans-serif; max-width: 480px; margin: 24px auto; padding: 16px;">
  <h2>Huawei Account Test</h2>
  <div style="display: flex; gap: 8px; margin: 16px 0;">
    <button onclick={() => call(login, 'login')} disabled={busy}>login</button>
    <button onclick={() => call(silentLogin, 'silentLogin')} disabled={busy}>silentLogin</button>
    <button onclick={() => call(() => logout().then(() => 'OK'), 'logout')} disabled={busy}>logout</button>
  </div>
  <pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; white-space: pre-wrap; word-break: break-all;">{result}</pre>
</main>
