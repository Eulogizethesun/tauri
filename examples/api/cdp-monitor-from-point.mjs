// CDP: invoke monitor_from_point directly in the tauri app WebView on a real device,
// verifying the OHOS boundary semantics (in-bounds -> Some / out-of-bounds -> None).
// Usage: node cdp-monitor-from-point.mjs [port]
const port = process.argv[2] || '9223';

const list = await (await fetch(`http://localhost:${port}/json`)).json();
console.log('[targets]');
for (const t of list) console.log(` - ${t.type} | ${t.title} | ${t.url}`);

// Find the tauri app page (tauri:// or tauri.localhost origin, excluding the device browser)
const page = list.find(
  (t) =>
    t.type === 'page' &&
    /tauri/i.test(t.url)
);
if (!page) {
  console.error('ERROR: no tauri page found in targets above');
  process.exit(1);
}
console.log(`[using] ${page.title} | ${page.url}`);

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;

function send(method, params) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};

await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

const expr = `
(async () => {
  const inv = window.__TAURI_INTERNALS__.invoke;
  const res = {};
  // 1) Primary monitor size (for reference)
  try {
    const m = await inv('plugin:window|primary_monitor');
    res.primary = m ? { size: m.size, scaleFactor: m.scaleFactor } : null;
  } catch (e) { res.primary = 'invoke error: ' + e; }
  // 2) probe_app_monitors (Rust probe; calls app.monitor_from_point(100,200))
  try { res.probe_app_monitors = await inv('probe_app_monitors'); }
  catch (e) { res.probe_app_monitors = 'invoke error: ' + e; }
  // 3) monitor_from_point boundary quartet: in-bounds / negative / far / top-right edge
  const pts = { 'in_100_200': [100, 200], 'neg_-1_0': [-1, 0], 'far_99999_0': [99999, 0] };
  for (const [k, [x, y]] of Object.entries(pts)) {
    try { res[k] = await inv('plugin:window|monitor_from_point', { x, y }); }
    catch (e) { res[k] = 'invoke error: ' + e; }
  }
  // 4) Exact edges using the real size: (w-1,h-1)=Some, (w,h)=None
  try {
    const m = await inv('plugin:window|primary_monitor');
    if (m && m.size) {
      const w = m.size.width, h = m.size.height;
      res['edge_w-1_h-1'] = await inv('plugin:window|monitor_from_point', { x: w - 1, y: h - 1 });
      res['edge_w_h'] = await inv('plugin:window|monitor_from_point', { x: w, y: h });
    }
  } catch (e) { res.edge = 'invoke error: ' + e; }
  return JSON.stringify(res, null, 2);
})()
`;

const out = await send('Runtime.evaluate', {
  expression: expr,
  awaitPromise: true,
  returnByValue: true,
});
console.log('[result]\n' + (out?.result?.value ?? JSON.stringify(out)));
ws.close();
process.exit(0);
