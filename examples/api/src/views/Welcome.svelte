<script>
  import { onMount } from 'svelte'
  import { invoke } from '@tauri-apps/api/core'
  import {
    getName,
    getVersion,
    getTauriVersion,
    getBundleType
  } from '@tauri-apps/api/app'

  let { onMessage } = $props()

  let version = $state('1.0.0')
  let tauriVersion = $state('1.0.0')
  let appName = $state('Unknown')
  let bundleType = $state('Unknown')

  // OHOS custom-protocol font test (@font-face over tauri://localhost).
  let fontStatus = $state('testing…')
  let fontMime = $state('testing…')

  getName().then((n) => {
    appName = n
  })
  getVersion().then((v) => {
    version = v
  })
  getTauriVersion().then((v) => {
    tauriVersion = v
  })
  getBundleType().then((b) => {
    if (b) {
      bundleType = b
    }
  })

  function contextMenu() {
    invoke('plugin:app-menu|popup')
  }

  onMount(async () => {
    // 1. Fetch the font over the custom protocol to inspect the response headers.
    try {
      const resp = await fetch('/font-test.ttf')
      fontMime =
        `HTTP ${resp.status}, content-type: ${resp.headers.get('content-type') ?? '(none)'}`
    } catch (e) {
      fontMime = `fetch failed: ${e}`
    }
    // 2. Ask the CSS font loading API to actually load it.
    try {
      await document.fonts.load('28px FontTest')
      fontStatus = document.fonts.check('28px FontTest')
        ? 'loaded ✓'
        : 'load() resolved but check() = false'
    } catch (e) {
      fontStatus = `failed: ${e}`
    }
    console.log(`[font-test] status=${fontStatus} mime=${fontMime}`)
  })
</script>

<div class="grid gap-8 justify-items-start">
  <p>
    This is a demo of Tauri's API capabilities using the <code
      >@tauri-apps/api</code
    > package. It's used as the main validation app, serving as the test bed of our
    development process. In the future, this app will be used on Tauri's integration
    tests.
  </p>
  <pre>
    App name: <code>{appName}</code>
    App version: <code>{version}</code>
    Tauri version: <code>{tauriVersion}</code>
    Bundle type: <code>{bundleType}</code>
  </pre>

  <button class="btn" onclick={contextMenu}>Context menu</button>

  <div class="grid gap-2 justify-items-start">
    <h2 class="font-test">Custom font test 123 — Ink Free</h2>
    <pre>
      Font status: <code>{fontStatus}</code>
      Fetch info: <code>{fontMime}</code>
    </pre>
  </div>
</div>

<style>
  /* OHOS custom-protocol font verification: the src URL resolves against the
     tauri://localhost origin, exercising ArkWeb's custom-protocol font path. */
  @font-face {
    font-family: 'FontTest';
    src: url('/font-test.ttf') format('truetype');
  }

  .font-test {
    font-family: 'FontTest', sans-serif;
    font-size: 28px;
  }
</style>
